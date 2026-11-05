import { useState } from "react";
import { PhotoAnswer } from "./PhotoAnswer";
import type { ApiAnswerRequest, ApiQuestion } from "./api.generated";

type Answer = Pick<ApiAnswerRequest, "answer" | "selected_option_ids" | "skipped" | "photos" | "photo_consent">;

export function QuestionCard({ question, busy, onSubmit, onLoadOptions }: {
  question: ApiQuestion;
  busy: boolean;
  onSubmit: (answer: Answer) => void;
  onLoadOptions?: () => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoConsent, setPhotoConsent] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const photoMode = question.photo_mode ?? "none";
  const canSubmit = !busy && !preparing && !!(selected.length || text.trim() || photos.length) && (!photos.length || photoConsent);
  // Also tolerate an existing pre-update question still held by a hot-reloaded client.
  const options = question.options ?? [];
  const multiple = question.selection_mode !== "single";
  const toggle = (id: string) => {
    const option = options.find(item => item.id === id);
    if (!option) return;
    setSelected(current => {
      if (current.includes(id)) return current.filter(value => value !== id);
      if (!multiple || option.exclusive) return [id];
      return [...current.filter(value => !options.find(item => item.id === value)?.exclusive), id];
    });
  };
  const submit = () => onSubmit({ answer: text.trim(), selected_option_ids: selected, skipped: false, photos, photo_consent: photoConsent });
  return <form className="agent-question-card" onSubmit={event => { event.preventDefault(); if (canSubmit) submit(); }}>
    {!options.length && onLoadOptions && <button className="button secondary" type="button" disabled={busy} onClick={onLoadOptions}>Show suggested answers</button>}
    {options.length > 0 && <fieldset className="answer-options" disabled={busy}>
      <legend>{multiple ? "Choose all that fit" : "Choose the best fit"}</legend>
      <div className="answer-options-grid">{options.map(option => <label className={`answer-option ${selected.includes(option.id) ? "selected" : ""}`} key={option.id}>
        <input type={multiple ? "checkbox" : "radio"} name={`question-${question.id}`} checked={selected.includes(option.id)} onChange={() => toggle(option.id)} />
        <span>{option.label}</span>
      </label>)}</div>
    </fieldset>}
    <details className="answer-note" open={options.length ? undefined : true}><summary>{options.length ? "Add a note (optional)" : "Answer in your own words"}</summary>
    <label className="answer-extra" htmlFor={`extra-${question.id}`}>{options.length ? "Anything else? (optional)" : "Your answer"}</label>
    <textarea id={`extra-${question.id}`} rows={3} maxLength={2000} disabled={busy} value={text} onChange={event => setText(event.target.value)} placeholder={options.length ? "Add something missing, or answer in your own words…" : "Tell us in your own words…"} />
    </details>
    <PhotoAnswer mode={photoMode} photos={photos} onChange={value => {setPhotos(value); if (!value.length) setPhotoConsent(false);}} busy={busy} onPreparing={setPreparing} />
    {!!photos.length && <label className="photo-consent"><input type="checkbox" checked={photoConsent} disabled={busy || preparing} onChange={event => setPhotoConsent(event.target.checked)} /><span>{photos.length === 1 ? "Send this photo" : "Send these photos"} to OpenAI with my answer. I understand photos may contain sensitive information and provider retention is separate from Revana’s temporary handling.</span></label>}
    <div className="agent-buttons">
      <button className="button primary" type="submit" disabled={!canSubmit}>{busy ? "Thinking…" : "Continue"}</button>
      <button className="button secondary" type="button" disabled={busy || preparing} onClick={() => onSubmit({ answer: "", selected_option_ids: [], skipped: true, photos: [], photo_consent: false })}>Skip question</button>
    </div>
  </form>;
}
