import { useEffect, useRef, useState } from "react";
import type { Journey } from "./Agent";
import { QuestionCard } from "./QuestionCard";
import { Button } from "./ui";
import { PhotoReview } from "./PhotoReview";

export type CoachAnswer = { question_id: string; selected_option_ids: string[]; skipped: boolean; photos?: string[]; photo_consent?: boolean };

export function CoachConversation({journey, busy, note, onNoteChange, onSend, onFinish, onPhotoReview}: {
  journey: Journey; busy: boolean; note: string; onNoteChange: (value: string) => void;
  onSend: (message: string, answer?: CoachAnswer) => void; onFinish?: () => void;
  onPhotoReview?: (eventIndex: number, observations: string[], discard: boolean) => void;
}) {
  const conversation = journey.suggestion_board?.conversation ?? [];
  const latest = conversation[conversation.length - 1];
  const pendingPhoto = journey.events.some(event => event.photo_notes && !event.photo_notes.confirmed);
  const question = journey.suggestion_board?.pending_question ?? (!journey.plans.length ? journey.decision.questions[0] : null);
  const [changingTopic, setChangingTopic] = useState(false);
  const composer = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {setChangingTopic(false);}, [question?.id]);
  useEffect(() => {if (changingTopic) composer.current?.focus();}, [changingTopic]);
  const checkpoint = !pendingPhoto && !journey.plans.length && (journey.decision.ready || journey.assessment_count >= 3);
  const turnText = (turn: typeof latest) => [turn.selected_answers.join(", "), turn.message].filter(Boolean).join(" — ") || (turn.skipped ? "Skipped this question" : "Continue");
  return <section className="plan-refresh coach-conversation" aria-labelledby="conversation-heading">
    <span className="eyebrow">REVANA · YOUR CONVERSATION</span><h2 id="conversation-heading">Let’s work on what matters to you.</h2>
    {conversation.length > 1 && <details className="coach-earlier"><summary>What we’ve discussed</summary>{conversation.slice(0, -1).map((turn, index) => <div key={index} className="coach-turn">{turn.question && <p><strong>Revana asked:</strong> {turn.question.text}</p>}<p><strong>You:</strong> {turnText(turn)}</p><p><strong>Revana:</strong> {turn.reply}</p></div>)}</details>}
    {latest && <div className="coach-turn" aria-live="polite">{latest.question && <p><strong>In response to:</strong> {latest.question.text}</p>}{(latest.message || latest.selected_answers.length || latest.skipped) && <p className="coach-user-message"><strong>You:</strong> {turnText(latest)}</p>}<p className="coach-reply"><strong>Revana:</strong> {latest.reply}</p></div>}
    {busy && <p role="status">Considering your message and checking what fits. Your saved choices stay in place.</p>}
    {journey.workflow?.message && <p role="status">{journey.workflow.message}</p>}
    {checkpoint && <div className="coach-checkpoint"><h3>Ready for a starting plan?</h3><p>We can make a useful starting point from what you’ve shared. Anything else to consider?</p><div className="agent-buttons"><Button className="primary" disabled={busy} onClick={onFinish}>Build my starting plan</Button><Button className="secondary" disabled={busy} onClick={() => setChangingTopic(true)}>Add context</Button><Button className="secondary" disabled={busy} onClick={() => onSend("Continue exploring what would most improve my starting plan; please avoid re-asking supplied facts.")}>Continue exploring</Button></div></div>}
    {pendingPhoto ? <PhotoReview key={journey.revision} journey={journey} busy={busy} onReview={(eventIndex, observations, discard) => onPhotoReview?.(eventIndex, observations, discard)} /> : question && !changingTopic ? <section className="coach-question" aria-label="Coach follow-up question"><h3>{question.text}</h3><details className="question-explanation"><summary>Why this helps</summary><p>{question.why}</p></details><QuestionCard key={question.id} question={question} busy={busy} onSubmit={answer => onSend(answer.answer, {question_id: question.id, selected_option_ids: answer.selected_option_ids, skipped: answer.skipped, photos: answer.photos, photo_consent: answer.photo_consent})} /><Button className="secondary" disabled={busy} onClick={() => setChangingTopic(true)}>Change direction or add something else</Button></section> : <form onSubmit={event => {event.preventDefault(); if (!busy) onSend(note.trim());}}><label htmlFor="coach-message">{changingTopic ? "What should we focus on now?" : "Your message"}</label><textarea ref={composer} id="coach-message" maxLength={2000} rows={3} value={note} disabled={busy} onChange={event => onNoteChange(event.target.value)} placeholder="Tell me what matters, ask for options, or change the goal…" /><Button className="primary" disabled={busy || (!journey.plans.length && !note.trim())} type="submit">{busy ? "Working on it…" : note.trim() ? "Send message" : "Explore relevant options"}</Button>{changingTopic && question && <Button className="secondary" disabled={busy} onClick={() => setChangingTopic(false)}>Return to this question</Button>}</form>}
    {onFinish && !checkpoint && !pendingPhoto && <Button className="secondary" disabled={busy} onClick={onFinish}>Make a starting plan with what I’ve shared</Button>}
    {journey.workflow?.status === "retry" && <Button className="secondary" disabled={busy} onClick={() => onSend("Please retry my last request using my saved message and selected answers.")}>Retry response</Button>}
    <p className="plan-refresh-hint">Questions adapt to your replies. Choose what helps; you can skip or finish whenever you’re ready.</p>
  </section>;
}
