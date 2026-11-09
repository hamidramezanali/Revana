import { useEffect, useRef, useState } from "react";
import { ProfileSettings } from "./ProfileSettings";
import { PhotoReview } from "./PhotoReview";
import { QuestionCard } from "./QuestionCard";
import { PlanActions, actionLists, type CoachAnswer } from "./PlanActions";
import { ActionCard, type ActionChoice } from "./ActionCard";
import { PlanView } from "./PlanView";
import { dashboardTabs, useDashboardNavigation } from "./navigation";
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
    const fallback = response.status === 413 ? "These photos are too large. Try fewer or smaller photos."
      : response.status === 401 || response.status === 403 ? "This deployment requires access. Sign in to the deployment and retry."
      : response.status === 404 ? "The coaching service route is unavailable. Check this deployment’s backend configuration."
      : "The coaching service could not start or respond. Check the backend deployment logs; your saved journey is unchanged.";
    throw new Error(typeof data?.error?.message === "string" ? data.error.message : fallback);
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
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const editingEvent = editingIndex === null ? null : journey.events[editingIndex];
  const question = editingEvent ? editingEvent.question_snapshot ?? {
    id: `legacy-${editingIndex}`, text: editingEvent.question,
    why: "Update your answer so the next question can adapt.", options: [],
    selection_mode: "multiple" as const, photo_mode: "none" as const,
  } : journey.decision.questions[0];
  const pendingPhoto = journey.events.some(event => event.photo_notes && !event.photo_notes.confirmed);
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { headingRef.current?.focus(); }, [question?.id, pendingPhoto]);
  const count = journey.mode === "assessment" ? journey.assessment_count : journey.checkin_count;
  const cycleStart = journey.mode === "checkin" ? journey.events.reduce((start, event, index) => event.kind === "checkin" ? index + 1 : start, journey.events.length) : 0;
  const editable = journey.events.map((event, index) => ({event, index})).filter(({event, index}) => event.kind === "answer" && index >= cycleStart);
  const loadOptions = () => run(async () => update(await agentRequest<Journey>("question-options", { revision: journey.revision })));
  const submit = (payload: Pick<ApiAnswerRequest, "answer" | "selected_option_ids" | "skipped" | "photos" | "photo_consent">) => run(async () => {
    const next = await agentRequest<Journey>("answers", {
      revision: journey.revision, question_id: question.id, ...payload,
      ...(editingIndex === null ? {} : {event_index: editingIndex}),
    });
    update(next);
    setEditingIndex(null);
  });
  return <div className="question-page wide-question adaptive-question-page">
    <span className="eyebrow">{journey.mode === "assessment" ? "GETTING TO KNOW YOU" : "YOUR FOLLOW-UP"} · {editingEvent ? "UPDATE AN ANSWER" : question ? `QUESTION ${count + 1}` : `${count} ANSWERED`}</span>
    <h2 ref={headingRef} tabIndex={-1}>{pendingPhoto ? "Check what I noticed." : question ? question.text : "Your starting point is ready."}</h2>
    {pendingPhoto ? <PhotoReview key={journey.events.length} journey={journey} busy={busy} onReview={(eventIndex, observations, discard) => run(async () => update(await agentRequest<Journey>("photo-notes", {revision: journey.revision, event_index: eventIndex, observations, discard})))} /> : question ? <>
      <details className="question-explanation"><summary>Why we ask</summary><p>{question.why}</p></details>
      {editingEvent && <><p>Changing this answer replaces the later questions in this round, so they can adapt to your update.</p>{!!editingEvent.photo_count && <p>Your earlier photo notes for this answer will be replaced. Attach photos again if you want to use them.</p>}<Button className="secondary" disabled={busy} onClick={() => setEditingIndex(null)}>Cancel editing</Button></>}
      <QuestionCard key={`${question.id}-${editingIndex}`} question={question} busy={busy} onSubmit={submit} onLoadOptions={editingEvent ? undefined : loadOptions} editing={!!editingEvent} initialAnswer={editingEvent ? {selected_options: editingEvent.selected_options, answer: editingEvent.question_snapshot ? editingEvent.answer : [...editingEvent.selected_options, editingEvent.answer].filter(Boolean).join(" — ")} : undefined} />
    </> : <p className="prompt-status" role="status">{journey.decision.summary}</p>}
    {!editingEvent && <div className="agent-buttons">{!!editable.length && <Button className="secondary" disabled={busy || pendingPhoto} onClick={() => setEditingIndex(editable[editable.length - 1].index)}>← Previous question</Button>}<Button className={question ? "secondary" : "primary"} disabled={busy || pendingPhoto} onClick={onFinish}>{journey.mode === "assessment" ? "Continue to fit & safety" : "Draft an updated plan"}</Button></div>}
    {!!editable.length && <details className="question-explanation" open={editingEvent ? true : undefined}><summary>Review or change earlier answers</summary>{editable.map(({event, index}) => <section key={index}><h3>{event.question}</h3><p>{event.skipped ? "Skipped" : [event.selected_options.join(", "), event.answer].filter(Boolean).join(" — ") || "Photo answer"}</p><Button className="secondary" disabled={busy || pendingPhoto} onClick={() => setEditingIndex(index)}>Change answer {index - cycleStart + 1}</Button></section>)}</details>}
    <p className="agent-small">Your answers shape the next question. We ask only what helps and stop when there’s enough to guide you. You can skip or finish whenever you’re ready.</p>
  </div>;
}

export function AgentAnalysis({ journey, onPlan, onBack }: { journey: Journey; onPlan: () => void; onBack: () => void }) {
  const plan = journey.plans[journey.plans.length - 1].plan;
  return <div className="analysis-page"><button type="button" className="app-back" onClick={onBack}>← Back to start</button><div className="analysis-intro"><span className="eyebrow">PERSONAL ANALYSIS</span><h1>Let’s connect the dots.</h1><p>{plan.summary}</p></div>
    <div className="analysis-grid">{([
      ["REPORTED BY YOU", "Your starting point", plan.reported, "reported"],
      ["WORKING HYPOTHESES", "Promising opportunities", plan.hypotheses, "inferred"],
      ["STILL UNCERTAIN", "What we won’t assume", plan.uncertainties, "unknown"],
    ] as const).map(([label, title, items, kind]) => <section key={label}><span className={`analysis-type ${kind}`}>{label}</span><h3>{title}</h3><ul>{items.map((x, i) => <li key={i}>{x}</li>)}</ul></section>)}</div>
    <div className="privacy-note"><Icon name="info" /><div>{plan.safety_notes.map((x, i) => <p key={i}>{x}</p>)}</div></div>
    <Button className="primary large" onClick={onPlan}>Open my personal plan <Icon name="arrow" /></Button><SafetyStrip />
  </div>;
}

export function AgentDashboard({ journey, update, busy, run, onDelete, onBack }: {
  journey: Journey; update: (journey: Journey) => void; busy: boolean;
  run: (task: () => Promise<void>) => void; onDelete: () => void; onBack: () => void;
}) {
  const [tab, setTab] = useDashboardNavigation();
  const pageHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { window.scrollTo({top: 0, behavior: "instant"}); pageHeading.current?.focus({preventScroll: true}); }, [tab]);
  const [planMessage, setPlanMessage] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [checking, setChecking] = useState(journey.mode === "checkin" && !journey.proposal);
  const version = journey.plans[journey.plans.length - 1];
  const plan = version.plan;
  useEffect(() => { setPlanMessage(""); }, [version.version]);
  const completed = journey.completions.filter(item => item.plan_version === version.version).map(item => item.action_id);
  const keptActions = actionLists(journey).kept;
  const keptCompleted = keptActions.filter(action => completed.includes(action.id)).length;
  const review = new Date(version.created_at);
  review.setDate(review.getDate() + plan.review_days);
  const draft = () => run(async () => {
    update(await agentRequest<Journey>("plan", { revision: journey.revision, preferences: journey.preferences }));
    setChecking(false);
  });
  const chooseAction = (actionId: string, choice: ActionChoice) => run(async () => {
    update(await agentRequest<Journey>("suggestion-choice", { revision: journey.revision, action_id: actionId, choice }));
  });
  const reshuffle = (message: string, answer?: CoachAnswer) => run(async () => {
    update(await agentRequest<Journey>("suggestions", { revision: journey.revision, message, ...answer }));
    setPlanMessage("");
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
  const back = () => {
    if (checking) { setChecking(false); return; }
    if (tab !== "Today") { setTab("Today"); return; }
    onBack();
  };
  const navigation = <nav className="app-navigation" aria-label="Main navigation">{dashboardTabs.map((item, index) => <button key={item} type="button" aria-current={tab === item ? "page" : undefined} className={tab === item ? "active" : ""} onClick={() => { setChecking(false); setTab(item); }}><Icon name={(["home", "check", "sparkle", "search"] as const)[index]} size={21} /><span>{item}</span></button>)}</nav>;
  return <div className="dashboard-app"><header className="app-header"><button type="button" className="app-back" disabled={busy} onClick={back} aria-label={checking ? "Back to plan" : tab === "Today" ? "Back to analysis" : "Back to Today"}>← Back</button><Brand /><button type="button" className="profile-settings-trigger" aria-label="Open profile settings" onClick={() => setSettingsOpen(true)}><Icon name="user" size={21} /></button></header>
    {navigation}
    {settingsOpen && <ProfileSettings busy={busy} onClose={() => setSettingsOpen(false)} onExport={exportJourney} onRestart={() => {setSettingsOpen(false); onDelete();}} />}
    <main className="dash-main"><section className="dash-hero"><div><span className="eyebrow">YOUR PERSONAL PLAN · VERSION {version.version}</span><h1 ref={pageHeading} tabIndex={-1}>{tab === "Today" ? "A little care, every day." : tab === "My plan" ? "Your personal plan." : tab === "Coach" ? "Let’s check in." : "Your understanding."}</h1>{tab === "Today" ? <details className="hero-summary"><summary>Your plan at a glance</summary><p>{plan.summary}</p></details> : tab === "Coach" ? <p>What’s changed since we last spoke?</p> : tab === "Insights" ? <p>What you shared, and what we’re still exploring.</p> : null}</div><div className="review-card"><Icon name="calendar" size={18} /><span>Next review</span><strong>{review.toLocaleDateString(undefined, {day: "numeric", month: "short"})}</strong></div></section>
      {journey.proposal && <section className="plan-proposal" aria-labelledby="proposal-heading"><span className="eyebrow">PROPOSED UPDATE</span><h2 id="proposal-heading">Your refreshed plan</h2><p>{journey.proposal.changes}</p><div className="focus-action-list">{journey.proposal.actions.map(action => <ActionCard key={action.id} action={action} badge={(journey.action_preferences ?? []).some(item => item.plan_version === version.version && item.action_id === action.id && item.choice === "keep") ? "Kept unchanged" : "Suggested"} />)}</div><div className="agent-buttons"><Button className="primary" disabled={busy} onClick={() => run(async () => update(await agentRequest<Journey>("accept", { revision: journey.revision })))}>Accept updated plan</Button><Button className="secondary" disabled={busy} onClick={() => run(async () => update(await agentRequest<Journey>("discard-proposal", { revision: journey.revision })))}>Keep current plan</Button></div><div className="proposal-safety">{journey.proposal.safety_notes.map((text, index) => <p key={index}>{text}</p>)}</div></section>}
      {checking ? <AdaptiveQuestions journey={journey} update={update} busy={busy} run={run} onFinish={draft} /> : <div className={`dash-grid${tab === "Coach" ? " coach-active" : ""}`}><div className="dash-primary">
        {(tab === "Today" || tab === "Coach") && <><div className="section-title"><h2>{tab === "Coach" ? "Your conversation & choices" : "Your actions & ideas"}</h2><span className="progress-text">{keptCompleted}/{keptActions.length} kept actions complete</span></div>{actionSection}</>}
        {tab === "My plan" && <><button type="button" className="plan-settings-link" onClick={() => setSettingsOpen(true)}>Profile settings · start over</button><PlanView key={version.version} journey={journey} busy={busy} onCheckin={message => run(async () => {
          update(await agentRequest<Journey>("checkins", { revision: journey.revision, message }));
          setChecking(true);
        })}>{actionSection}</PlanView></>}
        {tab === "Insights" && <div className="insights-view"><h2>What we’re learning</h2><p>Observations, not arbitrary wellness scores.</p><h3>Reported by you</h3><ul>{plan.reported.map((x, i) => <li key={i}>{x}</li>)}</ul><h3>Working hypotheses</h3><ul>{plan.hypotheses.map((x, i) => <li key={i}>{x}</li>)}</ul><h3>Still uncertain</h3><ul>{plan.uncertainties.map((x, i) => <li key={i}>{x}</li>)}</ul><h3>Your answers & check-ins</h3>{journey.events.map((e, i) => <details key={i}><summary>{e.question}</summary><p>{e.skipped ? "Skipped" : [e.selected_options?.join(", "), e.answer].filter(Boolean).join(" — ") || (e.photo_count ? "Photo answer" : "")}</p>{e.photo_notes && <div><strong>Reviewed photo observations · not a diagnosis</strong><ul>{e.photo_notes.observations.map((note, index) => <li key={index}>{note}</li>)}</ul><p>{e.photo_notes.uncertainties.join(" ")}</p></div>}</details>)}</div>}
      </div><aside className="coach-panel" aria-label="Coach and your data"><section className="coach-card"><div className="coach-title"><span><Icon name="sparkle" /></span><div><strong>Your conversation leads</strong><small>Guidance shaped around what you ask</small></div></div><p>Explore options with your coach. To propose a change to your accepted plan, use the check-in in My plan.</p><Button className="primary" onClick={() => setTab("Coach")}>Open coach</Button></section><details className="starting-point"><summary>Your data & settings</summary><p>Saved by this Revana deployment. Your answers and plan context are sent to OpenAI when you ask the agent. Exported files contain your answers; store them privately.</p><div className="agent-buttons"><Button className="secondary" onClick={exportJourney}>Export journey</Button><Button className="secondary" disabled={busy} onClick={onDelete}>Delete profile & start over</Button></div></details></aside></div>}
    </main><SafetyStrip /></div>;
}
