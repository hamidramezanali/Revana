import { useState } from "react";
import type { Journey } from "./Agent";

export function PhotoReview({journey, busy, onReview}: {journey: Journey; busy: boolean; onReview: (eventIndex: number, observations: string[], discard: boolean) => void}) {
  const eventIndex = journey.events.findIndex(event => event.photo_notes && !event.photo_notes.confirmed);
  const notes = journey.events[eventIndex]?.photo_notes;
  const [text, setText] = useState(notes?.observations.join("\n") ?? "");
  if (!notes) return null;
  const observations = text.split("\n").map(value => value.trim()).filter(Boolean);
  const valid = observations.length <= 6 && observations.every(value => value.length <= 500);
  return <section className="photo-review" aria-label="Review photo observations">
    <p>These are visual observations, not a diagnosis. Correct anything that isn’t accurate before continuing.</p>
    <label htmlFor="photo-observations">What the coach noticed <span>One observation per line</span></label>
    <textarea id="photo-observations" rows={5} maxLength={3006} disabled={busy} value={text} onChange={event => setText(event.target.value)} />
    <div className="photo-uncertainties"><strong>What a photo couldn’t establish</strong><ul>{notes.uncertainties.map((item, index) => <li key={index}>{item}</li>)}</ul></div>
    {!valid && <p className="agent-error" role="alert">Use up to six observations, each under 500 characters.</p>}
    <div className="agent-buttons"><button className="button primary" type="button" disabled={busy || !valid} onClick={() => onReview(eventIndex, observations, false)}>{busy ? "Continuing…" : "Use these observations"}</button><button className="button secondary" type="button" disabled={busy} onClick={() => onReview(eventIndex, [], true)}>Discard observations</button></div>
    <p className="agent-small">Original photos aren’t saved. Reviewed notes remain separate from what you reported.</p>
  </section>;
}
