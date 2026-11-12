import { useEffect, useRef, useState } from "react";
import type {
  ApiJourney as Journey,
  ApiPlan as Plan,
  ApiSessionCreated,
  ApiRunStep,
  ApiAction,
} from "./api.generated";
import { agentRequest, savedToken, forgetToken } from "./agentClient";
import { PhotoAnswer } from "./PhotoAnswer";
import { PhotoReview } from "./PhotoReview";
import { AppDialog } from "./ProfileSettings";
import type { IdeaIntent } from "./ActionCard";
import { localDate } from "./CareWorkspace";
import { GoalArtifact, type View } from "./GoalViews";

type GoalRef = { token: string; title: string };
const fieldLabels: Record<string, string> = {
  height_cm: "Height (cm)",
  weight_kg: "Weight (kg)",
  age: "Age (years)",
  daily_minutes: "Minutes per day",
  monthly_budget_sek: "Monthly budget (SEK)",
};
function refs(): GoalRef[] {
  try {
    const parsed: unknown = JSON.parse(
      localStorage.getItem("revana.goal.refs") || "[]",
    );
    return Array.isArray(parsed)
      ? parsed
          .filter(
            (g): g is GoalRef =>
              typeof g?.token === "string" && typeof g?.title === "string",
          )
          .slice(0, 20)
      : [];
  } catch {
    return [];
  }
}
async function request<T>(path: string, body?: unknown): Promise<T> {
  const token = savedToken();
  const response = await fetch(`/v1/workspace/${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!response.ok) {
    const d = await response.json().catch(() => null);
    throw new Error(
      d?.error?.message ||
        (typeof d?.detail === "string"
          ? d.detail
          : "The agent could not respond. Your saved plan is unchanged."),
    );
  }
  return response.json();
}
export default function GoalWorkspace() {
  const [journey, setJourney] = useState<Journey | null>(null);
  const [goals, setGoals] = useState<GoalRef[]>(refs);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<Plan | null>(null);
  const [steps, setSteps] = useState<ApiRunStep[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [text, setText] = useState("");
  const [consent, setConsent] = useState(false);
  const [choices, setChoices] = useState<string[]>([]);
  const [textValues, setTextValues] = useState<Record<string, string>>({});
  const [values, setValues] = useState<Record<string, string>>({});
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoConsent, setPhotoConsent] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [view, setView] = useState<View>("overview");
  const [mobileAgent, setMobileAgent] = useState(true);
  const [drawer, setDrawer] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [selectedIdea, setSelectedIdea] = useState<ApiAction | null>(null);
  const [expandedId, setExpandedId] = useState<string>();
  const composer = useRef<HTMLTextAreaElement>(null);
  const current = useRef<Journey | null>(null);
  const controller = useRef<AbortController | null>(null);
  const nonce = useRef(0);
  const bottom = useRef<HTMLDivElement>(null);
  const workspace = journey?.workspace;
  const working = streaming || workspace?.run?.status === "running";
  const blocked = busy || working;
  const question = workspace?.question;
  const pendingPhoto = journey?.events.some(
    (e) => e.photo_notes && !e.photo_notes.confirmed,
  );
  function update(j: Journey) {
    current.current = j;
    setJourney(j);
    const token = savedToken();
    if (token) {
      const title = j.workspace?.title || j.context.description || "My goal";
      setGoals((old) => {
        const next = [
          { token, title },
          ...old.filter((g) => g.token !== token),
        ].slice(0, 20);
        localStorage.setItem("revana.goal.refs", JSON.stringify(next));
        return next;
      });
    }
  }
  useEffect(() => {
    let active = true;
    if (!savedToken()) {
      setLoading(false);
      return;
    }
    request<Journey>("state")
      .then((j) => {
        if (active) update(j);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!working) return;
    const start = workspace?.run?.started_at
      ? new Date(workspace.run.started_at).getTime()
      : Date.now();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [working, workspace?.run?.id]);
  useEffect(() => {
    if (streaming || workspace?.run?.status !== "running") return;
    const timer = setInterval(() => {
      void request<Journey>("state")
        .then(update)
        .catch((e) => setError(e.message));
    }, 2000);
    return () => clearInterval(timer);
  }, [streaming, workspace?.run?.status]);
  useEffect(() => {
    setChoices([]);
    setValues({});
    setTextValues({});
    setPhotos([]);
    setPhotoConsent(false);
  }, [question?.id]);
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "nearest" });
  }, [workspace?.messages.length, question?.id, steps.length]);
  async function changeGoal(token?: string) {
    if (blocked || loading) return;
    const id = ++nonce.current;
    setError("");
    setDraft(null);
    setSteps([]);
    setText("");
    setDrawer(false);
    setSelectedIdea(null);
    setExpandedId(undefined);
    setView("overview");
    setMobileAgent(true);
    if (!token) {
      current.current = null;
      setJourney(null);
      return;
    }
    localStorage.setItem("revana.journey.token", token);
    setLoading(true);
    current.current = null;
    setJourney(null);
    try {
      const j = await request<Journey>("state");
      if (id === nonce.current) update(j);
    } catch (e) {
      if (id === nonce.current) setError((e as Error).message);
    } finally {
      if (id === nonce.current) setLoading(false);
    }
  }
  async function run(j: Journey, payload: Record<string, unknown> = {}) {
    const id = ++nonce.current;
    setStreaming(true);
    setError("");
    setDraft(null);
    setSteps([]);
    const abort = new AbortController();
    controller.current = abort;
    try {
      const response = await fetch("/v1/workspace/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${savedToken()}`,
        },
        body: JSON.stringify({ revision: j.revision, ...payload }),
        signal: abort.signal,
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(
          data?.error?.message ||
            (typeof data?.detail === "string"
              ? data.detail
              : "The agent could not start. Please retry."),
        );
      }
      const reader = response.body?.getReader();
      if (!reader) throw new Error("Streaming is unavailable in this browser.");
      const decoder = new TextDecoder();
      let buffer = "";
      let finished = false;
      while (true) {
        const part = await reader.read();
        buffer += decoder.decode(part.value, { stream: !part.done });
        let end: number;
        while ((end = buffer.indexOf("\n\n")) >= 0) {
          const block = buffer.slice(0, end);
          buffer = buffer.slice(end + 2);
          const line = block.split("\n").find((l) => l.startsWith("data: "));
          if (!line) continue;
          const event = JSON.parse(line.slice(6));
          if (id !== nonce.current) continue;
          if (event.journey) update(event.journey);
          if (event.type === "stage")
            setSteps((old) =>
              event.status === "working"
                ? [
                    ...old,
                    {
                      id: String(old.length),
                      label:
                        event.role === "planner"
                          ? "Building your working plan"
                          : event.role === "reviewer"
                            ? "Checking safety, fit and effort"
                            : event.role === "researcher"
                              ? "Researching evidence and public listings"
                              : "Understanding your update",
                      status: "working",
                    },
                  ]
                : old.map((s, i) =>
                    i === old.length - 1 ? { ...s, status: "done" } : s,
                  ),
            );
          if (event.type === "draft") setDraft(event.plan);
          if (["complete", "cancelled", "error"].includes(event.type)) {
            finished = true;
            setDraft(null);
            if (event.message) setError(event.message);
          }
        }
        if (part.done) break;
      }
      if (!finished && id === nonce.current) {
        update(await request<Journey>("state"));
        setError(
          "The connection ended. Your saved goal is available; check its status or retry.",
        );
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError" && id === nonce.current) {
        setError((e as Error).message);
        try {
          update(await request<Journey>("state"));
        } catch {
          /* preserve saved view */
        }
      }
    } finally {
      if (id === nonce.current) {
        setStreaming(false);
        controller.current = null;
      }
    }
  }
  async function stop() {
    try {
      const j = await request<Journey>("cancel", {
        revision: current.current?.revision,
      });
      nonce.current++;
      controller.current?.abort();
      controller.current = null;
      setStreaming(false);
      setDraft(null);
      update(j);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function submit(skip = false, finish = false) {
    const j = current.current;
    if (!j) {
      if (!text.trim() || !consent) return;
      setBusy(true);
      setError("");
      try {
        const result = await request<ApiSessionCreated>("goals", {
          message: text.trim(),
          consent: true,
          reuse_profile: true,
        });
        localStorage.setItem("revana.journey.token", result.token);
        update(result.journey);
        setText("");
        setBusy(false);
        if (!result.journey.workspace?.question)
          void run(result.journey, { action: "continue" });
      } catch (e) {
        setError((e as Error).message);
        setBusy(false);
      }
      return;
    }
    const payload = selectedIdea
      ? {
          message: text.trim(),
          action_id: selectedIdea.id,
          idea_intent: "improve",
        }
      : skip
        ? { question_id: j.workspace?.question?.id, skipped: true }
        : {
            message: text.trim(),
            question_id: j.workspace?.question?.id,
            choices,
            values: Object.fromEntries(
              Object.entries(values)
                .filter(([, v]) => v.trim())
                .map(([k, v]) => [k, Number(v)]),
            ),
            text_values: Object.fromEntries(
              Object.entries(textValues).filter(([, v]) => v.trim()),
            ),
            photos,
            photo_consent: photoConsent,
          };
    const actualPayload: Record<string, unknown> = payload;
    if (finish) {
      actualPayload.action = "plan";
      if (
        j.workspace?.question &&
        !text.trim() &&
        !choices.length &&
        !Object.values(values).some((v) => v.trim()) &&
        !Object.values(textValues).some((v) => v.trim()) &&
        !photos.length
      )
        actualPayload.skipped = true;
    }
    setText("");
    setPhotos([]);
    setPhotoConsent(false);
    setSelectedIdea(null);
    await run(j, actualPayload);
  }
  async function mutate(fn: () => Promise<Journey>) {
    setBusy(true);
    setError("");
    try {
      update(await fn());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function ideaAction(action: ApiAction, intent: IdeaIntent) {
    const j = current.current;
    if (!j || blocked) return;
    if (intent === "improve") {
      setSelectedIdea(action);
      setMobileAgent(true);
      setError("");
      requestAnimationFrame(() => composer.current?.focus());
      return;
    }
    if (intent === "details") {
      setExpandedId(action.id);
      await run(j, { action_id: action.id, idea_intent: "details" });
      return;
    }
    await mutate(() =>
      request<Journey>("idea-choice", {
        revision: j.revision,
        action_id: action.id,
        choice: intent,
      }),
    );
  }
  function openPlan() {
    setView("plan");
    setMobileAgent(false);
  }
  function reviewPlan() {
    openPlan();
    const goalNavigation = nonce.current;
    // Wait for the Plan pane to mount/become visible, even if it was already selected.
    requestAnimationFrame(() => {
      if (nonce.current !== goalNavigation) return;
      const review = document.getElementById("plan-review");
      review?.scrollIntoView({ block: "start", behavior: "auto" });
      review?.focus({ preventScroll: true });
    });
  }
  const selectedSteps = steps.length ? steps : workspace?.run?.steps || [];
  const canSend =
    !blocked &&
    !preparing &&
    !loading &&
    (!journey
      ? !!text.trim() && consent
      : selectedIdea
        ? !!text.trim()
        : !!text.trim() ||
          choices.length > 0 ||
          Object.values(values).some((v) => v.trim()) ||
          Object.values(textValues).some((v) => v.trim()) ||
          photos.length > 0) &&
    (!photos.length || photoConsent) &&
    (!selectedIdea || !!text.trim()) &&
    (question?.key !== "timeline" ||
      choices.length > 0 ||
      !!textValues.target_date ||
      !!text.trim());
  return (
    <div className={`goal-app ${mobileAgent ? "show-agent" : "show-artifact"}`}>
      <header className="goal-topbar">
        <button
          className="goal-menu"
          onClick={() => setDrawer(true)}
          aria-label="Open goals"
        >
          ☰
        </button>
        <a
          className="goal-wordmark"
          href="#"
          onClick={(e) => e.preventDefault()}
        >
          ◈ <strong>Revana</strong>
          <span> / goal workspace</span>
        </a>
        <span className="goal-mode">Skin · Hair · Body</span>
      </header>
      {drawer && (
        <AppDialog
          title="Your goals"
          onClose={() => setDrawer(false)}
          busy={blocked}
        >
          <button
            className="new-goal"
            disabled={blocked || loading}
            onClick={() => void changeGoal()}
          >
            ＋ New goal
          </button>
          <nav className="dialog-goals" aria-label="Choose saved goal">
            {goals.map((g) => (
              <button
                key={g.token}
                disabled={blocked || loading}
                onClick={() => void changeGoal(g.token)}
              >
                {g.title}
              </button>
            ))}
          </nav>
        </AppDialog>
      )}
      <aside className="goal-sidebar">
        <div className="sidebar-label">WORKSPACE</div>
        <button
          className="new-goal"
          disabled={blocked || loading}
          onClick={() => void changeGoal()}
        >
          ＋ New goal
        </button>
        <p className="sidebar-label goals-label">YOUR GOALS</p>
        <nav aria-label="Saved goals">
          {goals.map((g) => (
            <button
              key={g.token}
              disabled={blocked || loading}
              aria-current={
                journey && savedToken() === g.token ? "page" : undefined
              }
              onClick={() => void changeGoal(g.token)}
            >
              <span>◇</span>
              {g.title}
            </button>
          ))}
          {!goals.length && (
            <p className="sidebar-hint">
              Your goals and accepted plans will live here.
            </p>
          )}
        </nav>
        <div className="sidebar-bottom">
          <span>Personal lifestyle workspace</span>
          <small>General guidance · not medical care</small>
        </div>
      </aside>
      <GoalArtifact
        journey={journey}
        draft={draft}
        steps={selectedSteps}
        loading={loading}
        busy={blocked}
        working={working}
        view={view}
        onView={(v) => {
          setView(v);
          setMobileAgent(false);
        }}
        onExample={(s) => {
          setText(s);
          setMobileAgent(true);
        }}
        onAgent={() => setMobileAgent(true)}
        onMutate={mutate}
        onAccept={() =>
          journey &&
          void mutate(() =>
            request<Journey>("accept", { revision: journey.revision }),
          )
        }
        onDelete={() => setDeleting(true)}
        onError={setError}
        onIdea={(action, intent) => void ideaAction(action, intent)}
        expandedId={expandedId}
        onBodyContinue={() => {
          setMobileAgent(true);
          if (current.current?.plans.length) {
            setText(
              "Use my saved body goals and main priority to propose a coordinated food and activity plan. Reuse what you know, clarify only what changes the plan, and preserve my health constraints.",
            );
            composer.current?.focus();
          }
        }}
        onRebalance={() => {
          if (current.current) {
            setMobileAgent(true);
            void run(current.current, {
              action: "assess",
              message:
                "I want to rebalance this programme around practical meal preparation, food choices and suitable activity. Ask the missing nutrition, dietary preference and cooking questions before proposing the update. Keep my health constraints and timeline.",
            });
          }
        }}
        onResearch={(topic, city, services) => {
          if (current.current) {
            void run(current.current, {
              action: "research",
              research_topic: topic,
              research_city: city,
              research_services: services,
            });
          }
        }}
        onAssess={() => {
          if (current.current) {
            setMobileAgent(true);
            void run(current.current, { action: "assess" });
          }
        }}
        onOpenAction={(id) => {
          setExpandedId(undefined);
          setView("plan");
          setMobileAgent(false);
          requestAnimationFrame(() => {
            setExpandedId(id);
            requestAnimationFrame(() =>
              document
                .getElementById(`idea-${id}`)
                ?.scrollIntoView({ block: "start" }),
            );
          });
        }}
      />
      <section className="goal-agent" aria-label="Goal agent">
        <header className="agent-panel-heading">
          <div>
            <span className={`agent-indicator ${working ? "active" : ""}`} />
            <strong>Your agent</strong>
          </div>
          <span>{working ? `${elapsed}s` : "Goal → plan → progress"}</span>
        </header>
        {journey?.context.goals.includes("body") && (
          <button
            className="body-map-entry"
            disabled={blocked}
            onClick={() => {
              setView("overview");
              setMobileAgent(false);
            }}
          >
            ◎ Body goals{" "}
            <span>
              {journey.body_goals.areas.length
                ? `${journey.body_goals.areas.length} areas selected`
                : "Choose areas on the body map"}{" "}
              →
            </span>
          </button>
        )}
        <div className="agent-transcript">
          <p className="agent-intro">
            {journey
              ? "Work on this goal. Keep what fits. Ask for changes."
              : "Tell me the outcome you want. I’ll help turn it into a practical plan."}
          </p>
          {workspace?.messages.map((m, i) => (
            <div className={`working-message ${m.role}`} key={i}>
              <small>{m.role === "user" ? "YOU" : "REVANA"}</small>
              <p>{m.text}</p>
            </div>
          ))}
          {workspace?.reply &&
            !workspace.messages.some((m) => m.text === workspace.reply) && (
              <div className="working-message assistant">
                <small>REVANA</small>
                <p>{workspace.reply}</p>
              </div>
            )}
          {working && (
            <div className="agent-working" role="status">
              <span className="agent-indicator active" />
              {selectedSteps.at(-1)?.label || "Starting your agent"}
              <span>{elapsed}s</span>
              {elapsed > 35 && (
                <small>
                  This run is taking longer. You can stop it; your saved plan is
                  safe.
                </small>
              )}
            </div>
          )}
          {journey?.proposal && !working && (
            <button
              className="draft-link"
              onClick={reviewPlan}
              aria-controls="plan-review"
            >
              ▤{" "}
              {journey.workflow.status === "ready" &&
              journey.workflow.review?.approved
                ? "Draft ready"
                : "Draft needs attention"}{" "}
              · Review plan →
            </button>
          )}
          {error && (
            <div className="workspace-error" role="alert">
              <strong>Couldn’t finish</strong>
              <p>{error}</p>
              {journey && (
                <button
                  onClick={() =>
                    void request<Journey>("state")
                      .then(update)
                      .then(() => setError(""))
                      .catch((e) => setError(e.message))
                  }
                >
                  Reload saved goal
                </button>
              )}
            </div>
          )}
          {workspace?.run?.performance && !working && (
            <details className="run-performance">
              <summary>
                Last run ·{" "}
                {(workspace.run.performance.total_ms / 1000).toFixed(1)}s ·{" "}
                {workspace.run.performance.calls.length} model{" "}
                {workspace.run.performance.calls.length === 1
                  ? "call"
                  : "calls"}
              </summary>
              <dl>
                <dt>Model requests</dt>
                <dd>
                  {(
                    workspace.run.performance.calls.reduce(
                      (n, c) => n + c.elapsed_ms,
                      0,
                    ) / 1000
                  ).toFixed(1)}
                  s
                </dd>
                <dt>Context preparation</dt>
                <dd>
                  {(workspace.run.performance.context_ms / 1000).toFixed(3)}s
                </dd>
                <dt>Storage</dt>
                <dd>
                  {(workspace.run.performance.storage_ms / 1000).toFixed(3)}s ·{" "}
                  {workspace.run.performance.storage_operations} operations
                </dd>
              </dl>
              {workspace.run.performance.calls.map((c, i) => (
                <p key={i}>
                  {c.role} · {(c.elapsed_ms / 1000).toFixed(1)}s
                  {c.input_tokens != null && c.output_tokens != null
                    ? ` · ${c.input_tokens} in / ${c.output_tokens} out tokens`
                    : ""}
                  {!c.completed ? " · interrupted" : ""}
                </p>
              ))}
              <small>
                Server measurements. Model time includes the provider request
                and response handling. Browser network time and separate
                research requests are not measured here.
              </small>
            </details>
          )}
          {workspace?.run?.status === "failed" && !blocked && (
            <button
              className="subtle-button"
              onClick={() => void run(journey!, { action: "retry" })}
            >
              Retry this work
            </button>
          )}
          {pendingPhoto && journey && (
            <PhotoReview
              key={journey.events.length}
              journey={journey}
              busy={blocked}
              onReview={async (event_index, observations, discard) => {
                setBusy(true);
                try {
                  const j = await request<Journey>("photo-review", {
                    revision: journey.revision,
                    event_index,
                    observations,
                    discard,
                  });
                  update(j);
                  setBusy(false);
                  void run(j, { action: "continue" });
                } catch (e) {
                  setError((e as Error).message);
                  setBusy(false);
                }
              }}
            />
          )}
          <div ref={bottom} />
        </div>
        <form
          className="agent-composer"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          {selectedIdea && (
            <div className="idea-attachment">
              <div>
                <small>IMPROVE THIS IDEA</small>
                <strong>{selectedIdea.title}</strong>
                <span>
                  Only this idea will change. Add what you want improved.
                </span>
              </div>
              <button
                type="button"
                disabled={blocked}
                aria-label="Detach idea"
                onClick={() => setSelectedIdea(null)}
              >
                ×
              </button>
            </div>
          )}
          {question && !pendingPhoto && !selectedIdea && (
            <div className="inline-question">
              <p className="question-label">{question.text}</p>
              <p>{question.why}</p>
              {question.key === "timeline" && (
                <div className="assessment-goal">
                  <small>YOUR CURRENT GOAL</small>
                  <span>{workspace?.outcome || workspace?.objective}</span>
                </div>
              )}
              {question.text_fields.map((field) => (
                <label className="question-text-field" key={field}>
                  {field === "target_date"
                    ? "Or choose a specific date"
                    : "Refine the desired result (optional)"}
                  <input
                    type={field === "target_date" ? "date" : "text"}
                    min={
                      field === "target_date" && journey
                        ? localDate(journey.body.timezone)
                        : undefined
                    }
                    maxLength={field === "target_date" ? 10 : 1000}
                    disabled={blocked}
                    value={textValues[field] || ""}
                    placeholder={
                      field === "goal_outcome"
                        ? "What would a useful result look like?"
                        : undefined
                    }
                    onChange={(e) => {
                      setTextValues({ ...textValues, [field]: e.target.value });
                      if (field === "target_date" && e.target.value)
                        setChoices([]);
                    }}
                  />
                </label>
              ))}
              {question.fields.map((f) => (
                <label key={f}>
                  {fieldLabels[f]}
                  <input
                    type="number"
                    inputMode="decimal"
                    step={f === "height_cm" || f === "weight_kg" ? "any" : "1"}
                    min={f === "height_cm" ? 100 : f === "weight_kg" ? 25 : 0}
                    max={
                      f === "height_cm"
                        ? 250
                        : f === "weight_kg"
                          ? 400
                          : undefined
                    }
                    disabled={blocked}
                    value={values[f] || ""}
                    onChange={(e) =>
                      setValues({ ...values, [f]: e.target.value })
                    }
                  />
                </label>
              ))}
              {question.choices.length > 0 && (
                <div className="question-choices">
                  {question.choices.map((c) => (
                    <button
                      key={c}
                      type="button"
                      disabled={blocked}
                      aria-pressed={choices.includes(c)}
                      onClick={() => {
                        if (question.key === "timeline")
                          setTextValues((old) => ({ ...old, target_date: "" }));
                        setChoices(
                          question.multiple
                            ? choices.includes(c)
                              ? choices.filter((v) => v !== c)
                              : [...choices, c]
                            : [c],
                        );
                      }}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}
              {question.photo_mode !== "none" && (
                <>
                  <PhotoAnswer
                    mode={question.photo_mode}
                    photos={photos}
                    onChange={setPhotos}
                    busy={blocked}
                    onPreparing={setPreparing}
                  />
                  {photos.length > 0 && (
                    <label className="consent-row">
                      <input
                        type="checkbox"
                        checked={photoConsent}
                        onChange={(e) => setPhotoConsent(e.target.checked)}
                      />
                      Send these photos to OpenAI for temporary analysis.
                    </label>
                  )}
                </>
              )}
            </div>
          )}
          <label className="sr-only" htmlFor="agent-message">
            {journey ? "Message your goal agent" : "Describe your goal"}
          </label>
          <textarea
            ref={composer}
            id="agent-message"
            rows={3}
            maxLength={2000}
            disabled={blocked || !!pendingPhoto || loading}
            placeholder={
              selectedIdea
                ? "What should change? More practical, different timing, easier to follow…"
                : journey
                  ? question
                    ? "Add context (optional)…"
                    : "Ask for a change or share an update…"
                  : "I want to…"
            }
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          {!journey && (
            <label className="consent-row">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              I am 18+ and agree to send my goal and updates to OpenAI for
              guidance.
            </label>
          )}
          <div className="composer-toolbar">
            <span>
              {busy
                ? "Saving…"
                : journey
                  ? "Context stays with your goal"
                  : "Skin, hair & body habits"}
            </span>
            {working ? (
              <button
                type="button"
                className="stop-button"
                onClick={() => void stop()}
              >
                ■ Stop
              </button>
            ) : (
              <div>
                {question && !selectedIdea && (
                  <button
                    className="skip-button"
                    disabled={blocked || loading}
                    type="button"
                    onClick={() => void submit(true)}
                  >
                    Skip
                  </button>
                )}
                <button
                  className="accent-button"
                  type="submit"
                  disabled={!canSend || !!pendingPhoto}
                >
                  {journey ? "Send ↑" : "Start goal ↑"}
                </button>
              </div>
            )}
          </div>
          {journey &&
            !workspace?.assessment_complete &&
            !selectedIdea &&
            !pendingPhoto &&
            !working && (
              <div className="assessment-footer">
                <span>
                  {workspace?.assessment_count || 0} of up to 6 focused
                  questions
                </span>
                <button
                  type="button"
                  disabled={
                    blocked || preparing || (photos.length > 0 && !photoConsent)
                  }
                  onClick={() => void submit(false, true)}
                >
                  Build weekly plan now →
                </button>
              </div>
            )}
          <small className="composer-note">
            Guidance can be wrong. Seek qualified care for concerning symptoms.
          </small>
        </form>
      </section>
      <nav className="mobile-workspace-nav" aria-label="Mobile workspace">
        <button
          aria-current={mobileAgent ? "page" : undefined}
          onClick={() => setMobileAgent(true)}
        >
          ◈ Agent
        </button>
        <button
          aria-current={
            !mobileAgent && view === "overview" ? "page" : undefined
          }
          onClick={() => {
            setView("overview");
            setMobileAgent(false);
          }}
        >
          ◇ Goal
        </button>
        <button
          aria-current={!mobileAgent && view === "plan" ? "page" : undefined}
          onClick={openPlan}
        >
          ☷ Plan{journey?.proposal ? " •" : ""}
        </button>
        <button
          aria-current={
            !mobileAgent && view === "progress" ? "page" : undefined
          }
          onClick={() => {
            setView("progress");
            setMobileAgent(false);
          }}
        >
          ↗ Progress
        </button>
      </nav>
      {deleting && (
        <AppDialog
          title="Delete this goal"
          busy={blocked}
          onClose={() => setDeleting(false)}
        >
          <h2>Delete this goal?</h2>
          <p>
            This removes its profile, plans and progress. Other saved goals
            remain.
          </p>
          <button
            className="danger-button"
            disabled={blocked}
            onClick={async () => {
              const token = savedToken();
              setBusy(true);
              try {
                await agentRequest("session", undefined, "DELETE");
                const next = goals.filter((g) => g.token !== token);
                localStorage.setItem("revana.goal.refs", JSON.stringify(next));
                setGoals(next);
                forgetToken();
                current.current = null;
                setJourney(null);
                setDeleting(false);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Delete goal permanently
          </button>
          <button className="subtle-button" onClick={() => setDeleting(false)}>
            Keep goal
          </button>
        </AppDialog>
      )}
    </div>
  );
}
