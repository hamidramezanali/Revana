import type { ApiAction, ApiActionPreferenceRequest } from "./api.generated"

export type ActionChoice = ApiActionPreferenceRequest["choice"]

export function ActionCard({
  action,
  choice,
  busy = false,
  onChoice,
  completed = false,
  onComplete,
  badge,
}: {
  action: ApiAction

  choice?: "keep" | "not_for_me"

  busy?: boolean

  onChoice?: (choice: ActionChoice) => void

  completed?: boolean

  onComplete?: () => void

  badge?: string
}) {
  return (
    <article className={`focus-action${choice ? ` preference-${choice}` : ""}`}>
      <div className="focus-action-heading">
        {onComplete && (
          <button
            className={`action-completion${completed ? " completed" : ""}`}
            type="button"
            disabled={busy}
            aria-pressed={completed}
            aria-label={`${
              completed ? "Mark not completed" : "Mark completed"
            }: ${action.title}`}
            onClick={onComplete}
          >
            {completed ? "✓" : ""}
          </button>
        )}
        <h3>{action.title}</h3>
      </div>
      <div className="focus-action-badges">
        <span title={action.effort}>{action.effort} effort</span>
        <span title={action.cost}>{action.cost}</span>
        {badge && <span className="focus-action-tag">{badge}</span>}
        {completed && <span className="focus-action-tag">Completed</span>}
      </div>
      {onChoice && (
        <div
          className="focus-action-choices"
          role="group"
          aria-label={`Preference for ${action.title}`}
        >
          <button
            type="button"
            disabled={busy}
            aria-pressed={choice === "keep"}
            aria-label={`Keep it: ${action.title}`}
            className={choice === "keep" ? "selected keep" : ""}
            onClick={() => onChoice(choice === "keep" ? "clear" : "keep")}
          >
            {choice === "keep" ? "Kept" : "Keep it"}
          </button>
          <button
            type="button"
            disabled={busy}
            aria-pressed={choice === "not_for_me"}
            aria-label={`Not for me: ${action.title}`}
            className={choice === "not_for_me" ? "selected reject" : ""}
            onClick={() =>
              onChoice(choice === "not_for_me" ? "clear" : "not_for_me")
            }
          >
            Not for me
          </button>
        </div>
      )}
      <details className="focus-action-details">
        <summary>View details</summary>
        <p>{action.detail}</p>
        {!!action.exercises?.length && (
          <section className="exercise-list">
            <h4>Your session</h4>
            {action.exercises.map((exercise, index) => (
              <div key={index}>
                <strong>{exercise.name}</strong>
                <p>
                  {exercise.sets ? `${exercise.sets} sets · ` : ""}
                  {exercise.repetitions}
                  {exercise.duration_minutes
                    ? ` · ${exercise.duration_minutes} min`
                    : ""}
                  {exercise.rest_seconds != null
                    ? ` · rest ${exercise.rest_seconds}s`
                    : ""}
                </p>
                <p>{exercise.instructions}</p>
                <p>
                  <strong>Easier option: </strong>
                  {exercise.easier_alternative}
                </p>
              </div>
            ))}
          </section>
        )}
        <h4>Why this fits you</h4>
        <p>{action.why}</p>
        <h4>When and what to notice</h4>
        <p>{action.timing}</p>
        <p>{action.observation}</p>
        <p className="focus-action-fit">
          {action.category} · {action.effort} effort · {action.cost}
        </p>
      </details>
    </article>
  )
}
