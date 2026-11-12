import type { ApiAction, ApiActionPreferenceRequest } from "./api.generated";

export type IdeaIntent = "keep" | "clear" | "details" | "improve" | "remove";

export type ActionChoice = ApiActionPreferenceRequest["choice"];

export function ActionCard({
  action,
  choice,
  busy = false,
  onChoice,
  completed = false,
  onComplete,
  badge,
  onIdea,
  expanded = false,
}: {
  action: ApiAction;

  choice?: "keep" | "not_for_me";

  busy?: boolean;

  onChoice?: (choice: ActionChoice) => void;

  completed?: boolean;

  onComplete?: () => void;

  badge?: string;
  onIdea?: (intent: IdeaIntent) => void;
  expanded?: boolean;
}) {
  const steps = action.detail
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <article
      id={`idea-${action.id}`}
      className={`focus-action${choice ? ` preference-${choice}` : ""}`}
    >
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
        {action.minutes != null && <span>{action.minutes} min</span>}
        <span title={action.effort}>{action.effort} effort</span>
        <span title={action.cost}>{action.cost}</span>
        {badge && <span className="focus-action-tag">{badge}</span>}
        {completed && <span className="focus-action-tag">Completed</span>}
      </div>
      {onIdea && (
        <div
          className="focus-action-choices idea-controls"
          role="group"
          aria-label={`Improve idea: ${action.title}`}
        >
          <button
            type="button"
            disabled={busy}
            aria-pressed={choice === "keep"}
            className={choice === "keep" ? "selected keep" : ""}
            aria-label={`Keep as is: ${action.title}`}
            onClick={() => onIdea(choice === "keep" ? "clear" : "keep")}
          >
            {choice === "keep" ? "Kept as is" : "Keep as is"}
          </button>
          <button
            type="button"
            disabled={busy}
            aria-label={`More detail: ${action.title}`}
            onClick={() => onIdea("details")}
          >
            More detail
          </button>
          <button
            type="button"
            disabled={busy}
            aria-label={`Improve in chat: ${action.title}`}
            onClick={() => onIdea("improve")}
          >
            Improve in chat
          </button>
          <button
            type="button"
            disabled={busy}
            className="remove-idea"
            aria-label={`Remove idea: ${action.title}`}
            onClick={() => onIdea("remove")}
          >
            Remove
          </button>
        </div>
      )}
      {!onIdea && onChoice && (
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
      <details className="focus-action-details" open={expanded || undefined}>
        <summary>Show more</summary>
        {steps.length > 1 ? (
          <ol className="idea-steps">
            {steps.map((step, i) => (
              <li key={i}>{step.replace(/^(?:\d+[.)]|[-•])\s*/, "")}</li>
            ))}
          </ol>
        ) : (
          <p>{action.detail}</p>
        )}
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
                <p className="exercise-instructions">{exercise.instructions}</p>
                {!!exercise.form_cues.length && (
                  <ul className="exercise-cues">
                    {exercise.form_cues.map((cue, i) => (
                      <li key={i}>{cue}</li>
                    ))}
                  </ul>
                )}
                {exercise.progression && (
                  <p>
                    <strong>Progression: </strong>
                    {exercise.progression}
                  </p>
                )}
                <p>
                  <strong>Easier option: </strong>
                  {exercise.easier_alternative}
                </p>
              </div>
            ))}
          </section>
        )}
        {!!action.progression.length && (
          <section className="action-progression">
            <h4>How to progress</h4>
            {action.progression.map((step, i) => (
              <div key={i}>
                <strong>From week {step.week}</strong>
                <p>{step.instruction}</p>
                <p>
                  <strong>Advance when: </strong>
                  {step.advance_when}
                </p>
                <p>
                  <strong>If difficult: </strong>
                  {step.if_difficult}
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
  );
}
