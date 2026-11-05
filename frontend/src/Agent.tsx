import { useEffect, useRef, useState } from "react";
import { QuestionCard } from "./QuestionCard";
import { PlanActions } from "./PlanActions";
import { ActionCard, type ActionChoice } from "./ActionCard";
import { PlanView } from "./PlanView";
import { Brand, Button, Icon, SafetyStrip } from "./ui";

import type { ApiJourney, ApiContext, ApiAnswerRequest } from "./api.generated";
export type Goal = ApiContext["goals"][number];
export type Journey = ApiJourney;

const tokenKey = "revana.journey.token";
export const savedToken = () => localStorage.getItem(tokenKey);
export const forgetToken = () => localStorage.removeItem(tokenKey);

export async function agentRequest<T>(path: string, body?: unknown, method?: string): Promise<T> {
  const token = savedToken();
  const response = await fetch(`/v1/agent/${path}`, {
    method: method ?? (body === undefined ? "GET" : "POST"),
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error?.message ?? "Revana is unavailable. Your saved journey is unchanged; please retry.");
  }
  return response.status === 204 ? undefined as T : response.json();
}

export async function startJourney(context: Journey["context"]): Promise<Journey> {
  const result = await agentRequest<{ token: string; journey: Journey }>("sessions", { context, consent: true });
  localStorage.setItem(tokenKey, result.token);
  return result.journey;
}

export function AgentError({ error }: { error: string }) {
  return error ? <p className="agent-error" role="alert">{error}</p> : null;
}

export function AdaptiveQuestions({ journey, update, onFinish, busy, run }: {
  journey: Journey; update: (journey: Journey) => void; onFinish: () => void;
  busy: boolean; run: (task: () => Promise<void>) => void;
}) {
  const question = journey.decision.questions[0];
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { headingRef.current?.focus(); }, [question?.id]);
  const count = journey.mode === "assessment" ? journey.assessment_count : journey.checkin_count;
  const max = journey.mode === "assessment" ? 6 : 3;
  const loadOptions = () => run(async () => update(await agentRequest<Journey>("question-options", { revision: journey.revision })));
  const submit = (payload: Pick<ApiAnswerRequest, "answer" | "selected_option_ids" | "skipped">) => run(async () => {
    const next = await agentRequest<Journey>("answers", {
      revision: journey.revision, question_id: question.id, ...payload,
    });
    update(next);
  });
  return <div className="question-page wide-question adaptive-question-page">
    <span className="eyebrow">{journey.mode === "assessment" ? "GETTING TO KNOW YOU" : "YOUR FOLLOW-UP"} · {question ? `QUESTION ${count + 1} · UP TO ${max}` : `${count} ANSWERED`}</span>
    <h2 ref={headingRef} tabIndex={-1}>{question ? question.text : "Your starting point is ready."}</h2>
    {question ? <>
      <details className="question-explanation"><summary>Why we ask</summary><p>{question.why}</p></details>
      <QuestionCard key={question.id} question={question} busy={busy} onSubmit={submit} onLoadOptions={loadOptions} />
    </> : <p className="prompt-status" role="status">{journey.decision.summary}</p>}
    <div className="agent-buttons"><Button className={question ? "secondary" : "primary"} disabled={busy} onClick={onFinish}>{journey.mode === "assessment" ? "Continue to fit & safety" : "Draft an updated plan"}</Button></div>
    <p className="agent-small">Your answers shape the next question. We stop when there’s enough to help, with no more than {max} questions. You can finish early.</p>
  </div>;
}

export function AgentAnalysis({ journey, onPlan }: { journey: Journey; onPlan: () => void }) {
  const plan = journey.plans[journey.plans.length - 1].plan;
  return <div className="analysis-page"><div className="analysis-intro"><span className="eyebrow">PERSONAL ANALYSIS</span><h1>Let’s connect the dots.</h1><p>{plan.summary}</p></div>
    <div className="analysis-grid">{([
      ["REPORTED BY YOU", "Your starting point", plan.reported, "reported"],
      ["WORKING HYPOTHESES", "Promising opportunities", plan.hypotheses, "inferred"],
      ["STILL UNCERTAIN", "What we won’t assume", plan.uncertainties, "unknown"],
    ] as const).map(([label, title, items, kind]) => <section key={label}><span className={`analysis-type ${kind}`}>{label}</span><h3>{title}</h3><ul>{items.map((x, i) => <li key={i}>{x}</li>)}</ul></section>)}</div>
    <div className="privacy-note"><Icon name="info" /><div>{plan.safety_notes.map((x, i) => <p key={i}>{x}</p>)}</div></div>
    <Button className="primary large" onClick={onPlan}>Open my personal plan <Icon name="arrow" /></Button><SafetyStrip />
  </div>;
}

export function AgentDashboard({ journey, update, busy, run, onDelete }: {
  journey: Journey; update: (journey: Journey) => void; busy: boolean;
  run: (task: () => Promise<void>) => void; onDelete: () => void;
}) {
  const [tab, setTab] = useState("Today");
  const [planMessage, setPlanMessage] = useState("");
  const [message, setMessage] = useState("");
  const [checking, setChecking] = useState(journey.mode === "checkin" && !journey.proposal);
  const version = journey.plans[journey.plans.length - 1];
  const plan = version.plan;
  useEffect(() => { setPlanMessage(""); }, [version.version]);
  const completed = journey.completions.filter(item => item.plan_version === version.version).map(item => item.action_id);
  const review = new Date(version.created_at);
  review.setDate(review.getDate() + plan.review_days);
  const draft = () => run(async () => {
    update(await agentRequest<Journey>("plan", { revision: journey.revision, preferences: journey.preferences }));
    setChecking(false);
  });
  const chooseAction = (actionId: string, choice: ActionChoice) => run(async () => {
    update(await agentRequest<Journey>("action-preferences", { revision: journey.revision, action_id: actionId, choice }));
  });
  const reshuffle = (message: string) => run(async () => {
    update(await agentRequest<Journey>("reshuffle", { revision: journey.revision, message }));
    setChecking(false); window.scrollTo({ top: 0, behavior: "auto" });
  });
  const completeAction = (actionId: string) => run(async () => {
    update(await agentRequest<Journey>("actions", { revision: journey.revision, action_id: actionId, completed: !completed.includes(actionId) }));
  });
  const actionSection = <PlanActions journey={journey} busy={busy} note={planMessage} onNoteChange={setPlanMessage} onChoice={chooseAction} onReshuffle={reshuffle} onComplete={completeAction} />;
  const exportJourney = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(journey, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "revana-journey.json"; anchor.click();
    URL.revokeObjectURL(url);
  };
  return <div className="dashboard-app"><header className="app-header"><Brand /><nav aria-label="Dashboard navigation">{["Today", "My plan", "Insights"].map(x => <button key={x} className={tab === x ? "active" : ""} onClick={() => setTab(x)}>{x}</button>)}</nav><div className="agent-small">Your beauty agent</div></header><SafetyStrip />
    <main className="dash-main"><section className="dash-hero"><div><span className="eyebrow">YOUR PERSONAL PLAN · VERSION {version.version}</span><h1>Your next useful steps.</h1><p>{plan.summary}</p></div><div className="review-card"><span>NEXT REVIEW</span><strong>{review.toLocaleDateString()}</strong><small>Check in sooner if something changes.</small></div></section>
      {journey.proposal && <section className="plan-proposal" aria-labelledby="proposal-heading"><span className="eyebrow">PROPOSED UPDATE</span><h2 id="proposal-heading">Your refreshed plan</h2><p>{journey.proposal.changes}</p><div className="focus-action-list">{journey.proposal.actions.map(action => <ActionCard key={action.id} action={action} badge={(journey.action_preferences ?? []).some(item => item.plan_version === version.version && item.action_id === action.id && item.choice === "keep") ? "Kept unchanged" : "Suggested"} />)}</div><div className="agent-buttons"><Button className="primary" disabled={busy} onClick={() => run(async () => update(await agentRequest<Journey>("accept", { revision: journey.revision })))}>Accept updated plan</Button><Button className="secondary" disabled={busy} onClick={() => run(async () => update(await agentRequest<Journey>("discard-proposal", { revision: journey.revision })))}>Keep current plan</Button></div><div className="proposal-safety">{journey.proposal.safety_notes.map((text, index) => <p key={index}>{text}</p>)}</div></section>}
      {checking ? <AdaptiveQuestions journey={journey} update={update} busy={busy} run={run} onFinish={draft} /> : <div className="dash-grid"><div>
        {tab === "Today" && <><div className="section-title"><h2>{plan.actions.length} focused {plan.actions.length === 1 ? "action" : "actions"}</h2><span className="progress-text">{completed.length}/{plan.actions.length} complete</span></div>{actionSection}</>}
        {tab === "My plan" && <PlanView key={version.version} journey={journey} busy={busy} onCheckin={message => run(async () => {
          update(await agentRequest<Journey>("checkins", { revision: journey.revision, message }));
          setChecking(true);
        })}>{actionSection}</PlanView>}
        {tab === "Insights" && <div className="insights-view"><h2>What we’re learning</h2><p>Observations, not arbitrary wellness scores.</p><h3>Reported by you</h3><ul>{plan.reported.map((x, i) => <li key={i}>{x}</li>)}</ul><h3>Working hypotheses</h3><ul>{plan.hypotheses.map((x, i) => <li key={i}>{x}</li>)}</ul><h3>Still uncertain</h3><ul>{plan.uncertainties.map((x, i) => <li key={i}>{x}</li>)}</ul><h3>Your answers & check-ins</h3>{journey.events.map((e, i) => <details key={i}><summary>{e.question}</summary><p>{e.skipped ? "Skipped" : [e.selected_options?.join(", "), e.answer].filter(Boolean).join(" — ")}</p></details>)}</div>}
      </div><aside><section className="coach-card"><div className="coach-title"><span><Icon name="sparkle" /></span><div><strong>Check in with Revana</strong><small>Live guidance based on your saved journey</small></div></div><p>Tell your agent what changed, what feels difficult, or what you want to explore. It may ask up to three questions before proposing an update.</p><textarea aria-label="Check-in or question" maxLength={2000} value={message} disabled={busy} onChange={e => setMessage(e.target.value)} placeholder="I have less time. My routine caused irritation. What else could help?" /><Button className="primary" disabled={busy || !message.trim()} onClick={() => run(async () => {
        update(await agentRequest<Journey>("checkins", { revision: journey.revision, message: message.trim() }));
        setMessage(""); setChecking(true);
      })}>{busy ? "Thinking…" : "Ask my beauty agent"}</Button></section><section className="starting-point"><h3>Your data</h3><p>Saved on this computer’s backend. Your answers and plan context are sent to OpenAI when you ask the agent. Exported files contain your answers; store them privately.</p><div className="agent-buttons"><Button className="secondary" onClick={exportJourney}>Export journey</Button><Button className="secondary" disabled={busy} onClick={onDelete}>Delete journey</Button></div></section></aside></div>}
    </main></div>;
}
