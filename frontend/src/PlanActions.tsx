import type { Journey } from "./Agent";
import { ActionCard, type ActionChoice } from "./ActionCard";
import { Button } from "./ui";
import { QuestionCard } from "./QuestionCard";

export type CoachAnswer = { question_id: string; selected_option_ids: string[]; skipped: boolean };

export function actionLists(journey: Journey) {
  if (journey.suggestion_board) return journey.suggestion_board;
  const version = journey.plans[journey.plans.length - 1];
  const choices = new Map((journey.action_preferences ?? []).filter(item => item.plan_version === version.version).map(item => [item.action_id, item.choice]));
  return {
    kept: version.plan.actions.filter(action => choices.get(action.id) === "keep"),
    suggestions: version.plan.actions.filter(action => !choices.has(action.id)),
    safety_notes: [],
  };
}

export function PlanActions({ journey, busy, note, onNoteChange, onChoice, onReshuffle, onComplete }: {
  journey: Journey;
  busy: boolean;
  note: string;
  onNoteChange: (value: string) => void;
  onChoice: (actionId: string, choice: ActionChoice) => void;
  onReshuffle: (message: string, answer?: CoachAnswer) => void;
  onComplete: (actionId: string) => void;
}) {
  const version = journey.plans[journey.plans.length - 1];
  const board = actionLists(journey);
  const completed = (journey.completions ?? []).filter(item => item.plan_version === version.version).map(item => item.action_id);
  const conversation = journey.suggestion_board?.conversation ?? [];
  const latest = conversation[conversation.length - 1];
  const question = journey.suggestion_board?.pending_question;
  return <>
    <section className="plan-refresh coach-conversation" aria-labelledby="refresh-heading">
      <span className="eyebrow">LET’S WORK ON WHAT MATTERS TO YOU</span>
      <h2 id="refresh-heading">Talk to your coach</h2>
      <p>Ask for a specific idea, change direction, or tell us what isn’t working. Your message shapes what comes next.</p>
      {conversation.length > 1 && <details className="coach-earlier"><summary>Earlier in this conversation</summary>{conversation.slice(0, -1).map((turn, index) => <div key={index} className="coach-turn"><p><strong>You:</strong> {[turn.selected_answers.join(", "), turn.message].filter(Boolean).join(" — ") || (turn.skipped ? "Skipped question" : "Explore ideas")}</p><p><strong>Revana:</strong> {turn.reply}</p></div>)}</details>}
      {latest && <div className="coach-turn" aria-live="polite"><p className="coach-user-message"><strong>You:</strong> {[latest.selected_answers.join(", "), latest.message].filter(Boolean).join(" — ") || (latest.skipped ? "Skipped question" : "Explore ideas")}</p><p className="coach-reply"><strong>Revana:</strong> {latest.reply}</p></div>}
      {question && <section className="coach-question" aria-label="Coach follow-up question"><h3>{question.text}</h3><details className="question-explanation"><summary>Why we ask</summary><p>{question.why}</p></details><QuestionCard key={question.id} question={question} busy={busy} onSubmit={answer => onReshuffle(answer.answer, {question_id: question.id, selected_option_ids: answer.selected_option_ids, skipped: answer.skipped})} /></section>}
      <label htmlFor="plan-refresh-note">{question ? "Or ask something else" : "Your message"}</label>
      <textarea id="plan-refresh-note" maxLength={2000} rows={3} value={note} disabled={busy} onChange={event => onNoteChange(event.target.value)} placeholder="What would you like help with? Ask for practical options or tell me what to change…" />
      <Button className="primary" disabled={busy} onClick={() => onReshuffle(note.trim())}>{busy ? "Thinking…" : note.trim() ? "Send message" : "Explore ideas"}</Button>
      <p className="plan-refresh-hint">We adapt the questions and choices to your replies. Your kept actions stay saved; a conversation does not replace your accepted plan.</p>
    </section>
    <section className="action-list-section kept-actions" aria-labelledby="kept-heading">
      <div className="section-title"><h2 id="kept-heading">Your kept list <span className="action-list-count">{board.kept.length}</span></h2></div>
      <p className="action-list-intro">Your chosen actions stay here while you explore.</p>
      {board.kept.length ? <div className="focus-action-list">{board.kept.map(action => <ActionCard key={action.id} action={action} choice="keep" busy={busy} onChoice={choice => onChoice(action.id, choice)} completed={completed.includes(action.id)} onComplete={() => onComplete(action.id)} />)}</div> : <p className="action-list-empty">Tap “Keep it” on a suggestion to save it here.</p>}
    </section>
    <section className="action-list-section" aria-labelledby="suggestions-heading">
      <div className="section-title"><h2 id="suggestions-heading">Suggestions <span className="action-list-count">{board.suggestions.length}</span></h2></div>
      <p className="action-list-intro">Keep what fits. Dismiss anything that isn’t for you.</p>
      {board.suggestions.length ? <div className="focus-action-list">{board.suggestions.map(action => <ActionCard key={action.id} action={action} busy={busy} onChoice={choice => onChoice(action.id, choice)} />)}</div> : <p className="action-list-empty" role="status">Tell your coach what you want to explore next.</p>}
      {!!board.safety_notes.length && <details className="suggestion-safety"><summary>Guidance for these suggestions</summary>{board.safety_notes.map((text, index) => <p key={index}>{text}</p>)}</details>}
    </section>
  </>;
}
