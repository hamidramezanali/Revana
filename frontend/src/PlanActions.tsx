import type { Journey } from "./Agent";
import { ActionCard, type ActionChoice } from "./ActionCard";
import { Button } from "./ui";

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
  const preferences = (journey.action_preferences ?? []).filter(item => item.plan_version === version.version);
  const choices = new Map(preferences.map(item => [item.action_id, item.choice]));
  const completed = (journey.completions ?? []).filter(item => item.plan_version === version.version).map(item => item.action_id);
  const kept = preferences.filter(item => item.choice === "keep").length;
  const rejected = preferences.filter(item => item.choice === "not_for_me").length;
  const allKept = kept === version.plan.actions.length;
  const canRefresh = !busy && !journey.proposal && !allKept && (!!preferences.length || !!note.trim());
  return <>
    <div className="focus-action-list">{version.plan.actions.map(action => <ActionCard key={`${version.version}-${action.id}`} action={action} choice={choices.get(action.id)} busy={busy} onChoice={choice => onChoice(action.id, choice)} completed={completed.includes(action.id)} onComplete={() => onComplete(action.id)} />)}</div>
    <section className="plan-refresh" aria-labelledby="refresh-heading">
      <h3 id="refresh-heading">Make this plan yours</h3>
      <p>Keep what fits. Mark anything you’d like replaced. Kept actions stay unchanged; other actions can be reassessed.</p>
      {!!preferences.length && <p className="plan-refresh-counts" role="status">{kept} kept · {rejected} to replace</p>}
      <label htmlFor="plan-refresh-note">Anything to help the coach? <span>Optional</span></label>
      <textarea id="plan-refresh-note" maxLength={1000} rows={3} value={note} disabled={busy} onChange={event => onNoteChange(event.target.value)} placeholder="For example: I have less time, or I’d prefer a lower-cost option." />
      <Button className="primary" disabled={!canRefresh} onClick={() => onReshuffle(note.trim())}>{busy ? "Updating…" : "Refresh my plan"}</Button>
      <p className="plan-refresh-hint">{allKept ? "All actions are kept. Unmark one if you’d like to explore alternatives." : journey.proposal ? "Review the proposed update above, or change a choice to start again." : "You’ll review the suggestions before your current plan changes. Tap a selected choice again to clear it."}</p>
    </section>
  </>;
}
