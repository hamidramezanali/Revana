import { completedToday } from "./progress"

import type { Journey } from "./Agent"

import { ActionCard, type ActionChoice } from "./ActionCard"

import { CoachConversation, type CoachAnswer } from "./CoachConversation"

import type { ApiProfileEdit } from "./api.generated"

export type { CoachAnswer } from "./CoachConversation"

export function actionLists(journey: Journey) {
  if (journey.suggestion_board) return journey.suggestion_board

  const version = journey.plans[journey.plans.length - 1]

  const choices = new Map(
    (journey.action_preferences ?? [])
      .filter((item) => item.plan_version === version.version)
      .map((item) => [item.action_id, item.choice]),
  )

  return {
    kept: version.plan.actions.filter(
      (action) => choices.get(action.id) === "keep",
    ),

    suggestions: version.plan.actions.filter(
      (action) => !choices.has(action.id),
    ),

    safety_notes: [],
  }
}

export function PlanActions({
  journey,
  busy,
  note,
  onNoteChange,
  onChoice,
  onReshuffle,
  onComplete,
  onProfileEdit,
}: {
  journey: Journey

  busy: boolean

  note: string

  onNoteChange: (value: string) => void

  onChoice: (actionId: string, choice: ActionChoice) => void

  onReshuffle: (message: string, answer?: CoachAnswer) => void

  onComplete: (actionId: string) => void

  onProfileEdit: (edit: Omit<ApiProfileEdit, "revision">) => void
}) {
  const version = journey.plans[journey.plans.length - 1]

  const board = actionLists(journey)

  const completed = [
    ...completedToday(journey, [...board.kept, ...board.suggestions]),
  ]

  const checks = journey.workflow?.review?.action_checks ?? []

  const checkFor = (id: string) =>
    checks.find((check) => check.action_id === id)

  const needsReview = (id: string) =>
    busy ||
    (checkFor(id)
      ? checkFor(id)?.status !== "compatible"
      : journey.workflow?.status !== "ready")

  const suggestions = board.suggestions.filter(
    (action) => !needsReview(action.id),
  )

  return (
    <>
      {journey.suggestion_board?.pending_question ? (
        <CoachConversation
          journey={journey}
          busy={busy}
          note={note}
          onNoteChange={onNoteChange}
          onSend={onReshuffle}
        />
      ) : (
        journey.suggestion_board?.conversation.at(-1)?.reply && (
          <p>{journey.suggestion_board.conversation.at(-1)!.reply}</p>
        )
      )}
      {journey.workflow?.review && !journey.workflow.review.approved && (
        <div className="review-notice" role="status">
          <strong>This response still has limitations.</strong>
          {[
            ...new Set([
              ...journey.workflow.review.issues,
              ...journey.workflow.review.limitations,
            ]),
          ].map((text, index) => (
            <p key={index}>{text}</p>
          ))}
        </div>
      )}
      {!!journey.workflow?.research &&
        journey.workflow.research.status !== "not_needed" && (
          <details className="research-sources">
            <summary>
              {journey.workflow.research.sources.length
                ? "Sources & applicability"
                : "Research unavailable or limited"}
            </summary>
            <p>{journey.workflow.research.summary}</p>
            {journey.workflow.research.sources.map((source) => (
              <p key={source.id}>
                <a href={source.url} target="_blank" rel="noopener noreferrer">
                  {source.title}
                </a>{" "}
                · {source.kind} · retrieved{" "}
                {new Date(source.retrieved_at).toLocaleDateString()}
                <br />
                {source.applicability}
                <br />
                {source.uncertainty}
              </p>
            ))}
          </details>
        )}
      <section
        className="action-list-section kept-actions"
        aria-labelledby="kept-heading"
      >
        <div className="section-title">
          <h2 id="kept-heading">
            Your kept list{" "}
            <span className="action-list-count">{board.kept.length}</span>
          </h2>
        </div>
        <p className="action-list-intro">
          Your chosen actions stay here while you explore.
        </p>
        {board.kept.length ? (
          <div className="focus-action-list">
            {board.kept.map((action) => (
              <div key={action.id}>
                {needsReview(action.id) && (
                  <p className="review-notice" role="status">
                    <strong>Review this kept action before using it.</strong>{" "}
                    {checkFor(action.id)?.reason ??
                      "Your context changed; compatibility has not been checked."}
                  </p>
                )}
                <ActionCard
                  key={action.id}
                  action={action}
                  choice="keep"
                  busy={busy}
                  onChoice={(choice) => onChoice(action.id, choice)}
                  completed={completed.includes(action.id)}
                  onComplete={
                    needsReview(action.id)
                      ? undefined
                      : () => onComplete(action.id)
                  }
                />
              </div>
            ))}
          </div>
        ) : (
          <p className="action-list-empty">
            Tap “Keep it” on a suggestion to save it here.
          </p>
        )}
      </section>
      <section
        className="action-list-section"
        aria-labelledby="suggestions-heading"
      >
        <div className="section-title">
          <h2 id="suggestions-heading">
            Suggestions{" "}
            <span className="action-list-count">{suggestions.length}</span>
          </h2>
        </div>
        <p className="action-list-intro">
          Keep what fits. Dismiss anything that isn’t for you.
        </p>
        {board.suggestions.length > suggestions.length && (
          <p className="review-notice" role="status">
            Some options are withheld because they still need review against
            your current goals and limits. Your kept list has not been deleted.
          </p>
        )}
        {suggestions.length ? (
          <div className="focus-action-list">
            {suggestions.map((action) => (
              <ActionCard
                key={action.id}
                action={action}
                busy={busy}
                badge={
                  journey.workflow?.review?.suggested_starts.includes(action.id)
                    ? "Suggested starting point"
                    : undefined
                }
                onChoice={(choice) => onChoice(action.id, choice)}
              />
            ))}
          </div>
        ) : (
          <p className="action-list-empty" role="status">
            Tell your coach what you want to explore next.
          </p>
        )}
        {!!board.safety_notes.length && (
          <details className="suggestion-safety">
            <summary>Guidance for these suggestions</summary>
            {board.safety_notes.map((text, index) => (
              <p key={index}>{text}</p>
            ))}
          </details>
        )}
      </section>
    </>
  )
}
