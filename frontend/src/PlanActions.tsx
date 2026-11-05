import type { Journey } from "./Agent";
import { ActionCard, type ActionChoice } from "./ActionCard";
import { Button } from "./ui";

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
  onReshuffle: (message: string) => void;
  onComplete: (actionId: string) => void;
}) {
  const version = journey.plans[journey.plans.length - 1];
  const board = actionLists(journey);
  const completed = (journey.completions ?? []).filter(item => item.plan_version === version.version).map(item => item.action_id);
  const limitReached = (journey.suggestion_board?.rounds ?? 0) >= 50;
  return <>
    <section className="action-list-section kept-actions" aria-labelledby="kept-heading">
      <div className="section-title"><h2 id="kept-heading">Your kept list <span className="action-list-count">{board.kept.length}</span></h2></div>
      <p className="action-list-intro">Your chosen actions stay here while you explore.</p>
      {board.kept.length ? <div className="focus-action-list">{board.kept.map(action => <ActionCard key={action.id} action={action} choice="keep" busy={busy} onChoice={choice => onChoice(action.id, choice)} completed={completed.includes(action.id)} onComplete={() => onComplete(action.id)} />)}</div> : <p className="action-list-empty">Tap “Keep it” on a suggestion to save it here.</p>}
    </section>
    <section className="action-list-section" aria-labelledby="suggestions-heading">
      <div className="section-title"><h2 id="suggestions-heading">Suggestions <span className="action-list-count">{board.suggestions.length}</span></h2></div>
      <p className="action-list-intro">Keep what fits. Dismiss anything that isn’t for you.</p>
      {board.suggestions.length ? <div className="focus-action-list">{board.suggestions.map(action => <ActionCard key={action.id} action={action} busy={busy} onChoice={choice => onChoice(action.id, choice)} />)}</div> : <p className="action-list-empty" role="status">You’ve reviewed this batch. Explore new suggestions when you’re ready.</p>}
      {!!board.safety_notes.length && <details className="suggestion-safety"><summary>Guidance for these suggestions</summary>{board.safety_notes.map((text, index) => <p key={index}>{text}</p>)}</details>}
    </section>
    <section className="plan-refresh" aria-labelledby="refresh-heading">
      <h3 id="refresh-heading">Explore more ideas</h3>
      <p>Get a fresh batch tailored to your answers and choices. Your kept list stays unchanged.</p>
      <details className="suggestion-message"><summary>Add a message for your coach</summary>
      <label htmlFor="plan-refresh-note">Anything to help the coach? <span>Optional</span></label>
      <textarea id="plan-refresh-note" maxLength={1000} rows={2} value={note} disabled={busy} onChange={event => onNoteChange(event.target.value)} placeholder="For example: less time, or lower-cost ideas." />
      </details>
      <Button className="primary" disabled={busy || limitReached} onClick={() => onReshuffle(note.trim())}>{busy ? "Thinking…" : "Get new suggestions"}</Button>
      <p className="plan-refresh-hint">{limitReached ? "This local journey has reached its suggestion limit. You can still use your kept list and export your journey." : "Each batch replaces the suggestions above. Only actions you keep are saved to your list."}</p>
    </section>
  </>;
}
