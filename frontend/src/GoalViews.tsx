import type {
  ApiJourney as Journey,
  ApiPlan as Plan,
  ApiRunStep,
  ApiAction,
} from "./api.generated";
import { agentRequest } from "./agentClient";
import { ActionCard, type IdeaIntent } from "./ActionCard";
import { BodyEditor, ProgressPanel, Milestones } from "./CareWorkspace";
import { WeeklyProgramme } from "./WeeklyProgramme";
import { MealPreparation } from "./MealPreparation";
import { MethodDiscovery, type Topic, type City } from "./MethodDiscovery";
import { CareProfile } from "./CareProfile";
export type View = "overview" | "plan" | "progress" | "profile";
type Props = {
  journey: Journey | null;
  draft: Plan | null;
  steps: ApiRunStep[];
  loading: boolean;
  busy: boolean;
  working: boolean;
  view: View;
  onView: (v: View) => void;
  onExample: (s: string) => void;
  onAgent: () => void;
  onMutate: (fn: () => Promise<Journey>) => Promise<void>;
  onAccept: () => void;
  onDelete: () => void;
  onError: (s: string) => void;
  onIdea: (a: ApiAction, intent: IdeaIntent) => void;
  expandedId?: string;
  onAssess: () => void;
  onOpenAction: (id: string) => void;
  onRebalance: () => void;
  onResearch: (topic: Topic, city: City, services: boolean) => void;
};
export function GoalArtifact({
  journey: j,
  draft,
  steps,
  loading,
  busy,
  working,
  view,
  onView,
  onExample,
  onAgent,
  onMutate,
  onAccept,
  onDelete,
  onError,
  onIdea,
  expandedId,
  onAssess,
  onOpenAction,
  onResearch,
  onRebalance,
}: Props) {
  const accepted = j?.plans.at(-1)?.plan;
  const sourcePlan = draft || j?.proposal || accepted;
  const removedTitles = new Set(
    j?.workspace?.idea_feedback
      .filter((f) => f.choice === "remove")
      .map((f) => f.action.title.toLowerCase().trim()),
  );
  const plan = sourcePlan
    ? {
        ...sourcePlan,
        actions: sourcePlan.actions.filter(
          (a) => !removedTitles.has(a.title.toLowerCase().trim()),
        ),
      }
    : undefined;
  const workspace = j?.workspace;
  const keptIds = new Set(
    j?.action_preferences
      .filter(
        (p) =>
          p.plan_version === j.plans.at(-1)?.version && p.choice === "keep",
      )
      .map((p) => p.action_id),
  );
  for (const f of j?.workspace?.idea_feedback || [])
    if (f.choice === "keep") keptIds.add(f.action.id);
  return (
    <main className="goal-artifact">
      <nav className="artifact-tabs" aria-label="Workspace views">
        {(["overview", "plan", "progress", "profile"] as View[]).map((v) => (
          <button
            key={v}
            aria-current={view === v ? "page" : undefined}
            onClick={() => onView(v)}
          >
            {v === "overview"
              ? "◇ Goal"
              : v === "plan"
                ? "☷ Plan"
                : v === "progress"
                  ? "↗ Progress"
                  : "◎ Profile"}
            {v === "plan" && j?.proposal && <i />}
          </button>
        ))}
      </nav>
      <div className="artifact-scroll">
        {loading ? (
          <p role="status">Opening your workspace…</p>
        ) : !j ? (
          <section className="workspace-empty">
            <span className="empty-mark">◈</span>
            <p className="eyebrow">A GOAL. A PLAN. THE NEXT STEP.</p>
            <h1>
              What would you like
              <br />
              to work on?
            </h1>
            <p>
              Work with your agent on skin, hair or body habits. Start with an
              outcome. Build a plan you can actually use.
            </p>
            <div className="goal-examples">
              {[
                "Lose weight with habits that fit my week",
                "Understand my dry, irritated skin",
                "Build a simpler hair and scalp routine",
              ].map((s) => (
                <button key={s} onClick={() => onExample(s)}>
                  ◇ {s}
                  <span>↗</span>
                </button>
              ))}
            </div>
            <p className="empty-footnote">
              Your profile and plan carry forward.
              <br />
              Old conversations aren’t a chat archive.
            </p>
          </section>
        ) : (
          <>
            <div className="artifact-heading">
              <p className="eyebrow">
                {j.context.goals.join(" / ")} · YOUR GOAL
              </p>
              <h1>{workspace?.title || j.context.description}</h1>
              <span className={`phase-badge ${working ? "working" : ""}`}>
                {working
                  ? "Agent working"
                  : j.proposal
                    ? "Draft ready for review"
                    : accepted
                      ? "Plan accepted"
                      : workspace?.question
                        ? "One clarification"
                        : "Ready to work"}
              </span>
            </div>
            {view === "overview" && (
              <>
                <section className="workspace-card">
                  <h2>The outcome</h2>
                  <p>{workspace?.objective || j.context.description}</p>
                  <p className="muted">
                    {workspace?.reply ||
                      "Tell the agent what you want to change next."}
                  </p>
                </section>
                {steps.length > 0 && (
                  <section className="workspace-card">
                    <h2>Agent work</h2>
                    <ol className="run-steps">
                      {steps.map((s) => (
                        <li key={s.id}>
                          <span>
                            {s.status === "done"
                              ? "✓"
                              : s.status === "failed"
                                ? "!"
                                : "◌"}
                          </span>
                          {s.label}
                          <small>{s.status}</small>
                        </li>
                      ))}
                    </ol>
                  </section>
                )}
                <section className="workspace-card">
                  <h2>
                    {j.proposal
                      ? "Proposed next steps"
                      : accepted
                        ? "Your current focus"
                        : "Your plan will appear here"}
                  </h2>
                  {plan ? (
                    <>
                      <p>{plan.priority || plan.summary}</p>
                      {plan.actions.map((a) => (
                        <div className="action-outline" key={a.id}>
                          <span>◇</span>
                          <div>
                            <strong>{a.title}</strong>
                            <small>{a.timing}</small>
                          </div>
                        </div>
                      ))}
                      <button
                        className="subtle-button"
                        onClick={() => onView("plan")}
                      >
                        Open {j.proposal ? "draft" : "plan"} →
                      </button>
                    </>
                  ) : (
                    <p className="muted">
                      Start with a goal. Your agent will create a useful draft,
                      then check fit and safety before you accept it.
                    </p>
                  )}
                </section>
              </>
            )}
            {view === "plan" && (
              <>
                {!plan?.programme && (
                  <section className="programme-upgrade">
                    <strong>Build a complete weekly programme</strong>
                    <p>
                      Set your goal and timeline, answer the relevant questions,
                      and get scheduled actions with progression.
                    </p>
                    <button
                      className="accent-button"
                      disabled={busy}
                      onClick={onAssess}
                    >
                      Plan my week →
                    </button>
                  </section>
                )}
                {plan?.programme && (
                  <WeeklyProgramme
                    plan={plan}
                    journey={j}
                    onOpen={onOpenAction}
                  />
                )}

                {j.workflow.status === "needs_review" && (
                  <p className="workspace-error" role="status">
                    {j.workflow.message} Ask your agent to review the plan.
                  </p>
                )}
                {!plan ? (
                  <section className="workspace-card">
                    <h2>No plan yet</h2>
                    <p>Continue with your agent to build the first draft.</p>
                    <button
                      className="subtle-button mobile-only"
                      onClick={onAgent}
                    >
                      Open agent →
                    </button>
                  </section>
                ) : (
                  <>
                    {j.context.goals.includes("body") && (
                      <section className="nutrition-rebalance">
                        <div>
                          <strong>
                            {plan.nutrition
                              ? "Fine-tune food & preparation"
                              : "Make meal prep part of your plan"}
                          </strong>
                          <p>
                            Review food preferences, cooking constraints and the
                            balance between meals and activity.
                          </p>
                        </div>
                        <button
                          className="subtle-button"
                          disabled={busy}
                          onClick={onRebalance}
                        >
                          {plan.nutrition
                            ? "Update food preferences"
                            : "Add meal-prep planning"}{" "}
                          →
                        </button>
                      </section>
                    )}
                    <section className="workspace-card plan-intro">
                      <p className="eyebrow">
                        {j.proposal
                          ? "PROPOSED PLAN"
                          : draft
                            ? "WORK IN PROGRESS · CHECKING"
                            : "ACCEPTED PLAN"}
                      </p>
                      <h2>
                        {plan.actions.length !== sourcePlan?.actions.length
                          ? "Your remaining ideas"
                          : plan.priority || "Your working plan"}
                      </h2>
                      <p>
                        {plan.actions.length !== sourcePlan?.actions.length
                          ? "Removed ideas are excluded. Continue with the ideas you chose, or ask your agent for alternatives."
                          : plan.summary}
                      </p>
                      {j.proposal && (
                        <>
                          <p className="muted">
                            Review the plan and profile before accepting.
                            {accepted
                              ? " Your previous accepted plan is preserved."
                              : ""}
                          </p>
                          <div className="plan-review-controls">
                            <button
                              className="accent-button"
                              disabled={
                                busy ||
                                !plan.actions.length ||
                                !j.workflow.review?.approved ||
                                j.workflow.status !== "ready"
                              }
                              onClick={onAccept}
                            >
                              Accept plan & profile
                            </button>
                            <button
                              className="subtle-button"
                              onClick={() => onView("profile")}
                            >
                              Review profile
                            </button>
                          </div>
                        </>
                      )}
                      {draft && (
                        <p role="status">
                          The agent is checking this draft. It is not ready to
                          accept yet.
                        </p>
                      )}
                    </section>
                    {!plan.actions.length && (
                      <section className="workspace-card">
                        <h2>No active ideas</h2>
                        <p>
                          You removed all these suggestions. Ask the agent for
                          different ideas.
                        </p>
                        <button
                          className="subtle-button"
                          onClick={() =>
                            onExample(
                              "Suggest different, more practical ideas for my goal. Do not repeat the removed ideas.",
                            )
                          }
                        >
                          Ask for new ideas →
                        </button>
                      </section>
                    )}
                    {(plan.nutrition || plan.meals.length > 0) && (
                      <MealPreparation plan={plan} />
                    )}
                    <div className="plan-actions">
                      {([true, false] as const).map((kept) => {
                        const group = plan.actions.filter(
                          (a) => keptIds.has(a.id) === kept,
                        );
                        if (!group.length) return null;
                        return (
                          <section
                            className="habit-group"
                            key={String(kept)}
                            aria-label={kept ? "Kept habits" : "Plan actions"}
                          >
                            {!!keptIds.size && (
                              <h2>{kept ? "Kept habits" : "Other actions"}</h2>
                            )}
                            {group.map((a) => (
                              <ActionCard
                                key={a.id}
                                action={a}
                                busy={busy}
                                onIdea={
                                  !draft
                                    ? (intent) => onIdea(a, intent)
                                    : undefined
                                }
                                expanded={expandedId === a.id}
                                badge={
                                  !draft &&
                                  j.workflow.review?.action_checks.find(
                                    (c) => c.action_id === a.id,
                                  )?.status !== "compatible"
                                    ? "Needs review"
                                    : undefined
                                }
                                choice={
                                  j.workspace?.idea_feedback.some(
                                    (f) =>
                                      f.choice === "keep" &&
                                      f.action.id === a.id,
                                  )
                                    ? "keep"
                                    : j.action_preferences
                                        .filter(
                                          (p) =>
                                            p.action_id === a.id &&
                                            p.plan_version ===
                                              j.plans.at(-1)?.version,
                                        )
                                        .at(-1)?.choice
                                }
                                onChoice={
                                  !j.proposal && !draft
                                    ? (choice) =>
                                        void onMutate(() =>
                                          agentRequest<Journey>(
                                            "action-preferences",
                                            {
                                              revision: j.revision,
                                              action_id: a.id,
                                              choice,
                                            },
                                          ),
                                        )
                                    : undefined
                                }
                              />
                            ))}
                          </section>
                        );
                      })}
                    </div>
                    {!!j.workspace?.idea_feedback.some(
                      (f) => f.choice === "remove",
                    ) && (
                      <details className="removed-ideas">
                        <summary>Removed ideas</summary>
                        <p>
                          Excluded from your active suggestions and future agent
                          context. Saved plan history is preserved.
                        </p>
                        {j.workspace.idea_feedback
                          .filter((f) => f.choice === "remove")
                          .map((f) => (
                            <div key={f.action.id}>
                              <span>{f.action.title}</span>
                              <button
                                type="button"
                                disabled={
                                  busy ||
                                  !sourcePlan?.actions.some(
                                    (a) => a.id === f.action.id,
                                  )
                                }
                                onClick={() => onIdea(f.action, "clear")}
                              >
                                Restore
                              </button>
                            </div>
                          ))}
                      </details>
                    )}
                    <MethodDiscovery
                      journey={j}
                      busy={busy}
                      onSearch={onResearch}
                      onDiscuss={onExample}
                    />

                    {accepted && !j.proposal && !draft && (
                      <Milestones journey={j} />
                    )}
                    <section className="workspace-card">
                      <h2>Before you start</h2>
                      {plan.safety_notes.map((s, i) => (
                        <p key={i}>{s}</p>
                      ))}
                      <details>
                        <summary>Assumptions & open questions</summary>
                        {[...plan.hypotheses, ...plan.uncertainties].map(
                          (s, i) => (
                            <p key={i}>{s}</p>
                          ),
                        )}
                      </details>
                    </section>
                  </>
                )}
                {accepted && (j.proposal || draft) && (
                  <details className="workspace-card">
                    <summary>Current accepted plan</summary>
                    <p>{accepted.summary}</p>
                    {accepted.actions.map((a) => (
                      <ActionCard key={a.id} action={a} />
                    ))}
                  </details>
                )}
              </>
            )}
            {view === "progress" &&
              (accepted ? (
                <>
                  <ProgressPanel
                    journey={j}
                    busy={busy}
                    onRecord={(value) =>
                      void onMutate(() =>
                        agentRequest<Journey>("progress", {
                          revision: j.revision,
                          ...value,
                        }),
                      )
                    }
                    onRemove={(id) => {
                      if (window.confirm("Delete this progress record?"))
                        void onMutate(() =>
                          agentRequest<Journey>(
                            `progress/${id}`,
                            { revision: j.revision },
                            "DELETE",
                          ),
                        );
                    }}
                  />
                  <section className="workspace-card">
                    <h2>Adapt the plan</h2>
                    <p>
                      Tell your agent what worked, what didn’t and what changed.
                      It will propose a revision using your saved progress.
                    </p>
                    <button
                      className="subtle-button"
                      onClick={() =>
                        onExample(
                          "Review my progress and suggest the next adjustment.",
                        )
                      }
                    >
                      Review progress with agent →
                    </button>
                  </section>
                </>
              ) : (
                <section className="workspace-card">
                  <h2>Progress starts with a plan</h2>
                  <p>
                    Accept your first plan, then record how it fits your life.
                  </p>
                </section>
              ))}
            {view === "profile" && (
              <>
                <section className="workspace-card">
                  <h2>Your context</h2>
                  <p className="muted">
                    Keep the details that help your agent. Correct anything that
                    isn’t accurate.
                  </p>
                  <BodyEditor
                    key={j.profile_revision}
                    journey={j}
                    busy={busy}
                    onSave={(body) =>
                      void onMutate(() =>
                        agentRequest<Journey>("body-context", {
                          revision: j.revision,
                          body,
                        }),
                      )
                    }
                  />
                </section>
                <CareProfile
                  journey={j}
                  busy={busy}
                  expanded
                  onEdit={(edit) =>
                    void onMutate(() =>
                      agentRequest<Journey>("profile", {
                        revision: j.revision,
                        ...edit,
                      }),
                    )
                  }
                />
                <section className="workspace-card">
                  <h2>Workspace data</h2>
                  <button
                    className="subtle-button"
                    disabled={busy}
                    onClick={async () => {
                      try {
                        const data = await agentRequest<Journey>("session");
                        const url = URL.createObjectURL(
                          new Blob([JSON.stringify(data, null, 2)], {
                            type: "application/json",
                          }),
                        );
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = "revana-goal.json";
                        a.click();
                        URL.revokeObjectURL(url);
                      } catch (e) {
                        onError((e as Error).message);
                      }
                    }}
                  >
                    Export this goal
                  </button>
                  <button
                    className="danger-button"
                    disabled={busy}
                    onClick={onDelete}
                  >
                    Delete this goal
                  </button>
                </section>
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}
