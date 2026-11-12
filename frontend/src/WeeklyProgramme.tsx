import { useState } from "react";
import type { ApiAction, ApiPlan, ApiJourney } from "./api.generated";
import { localDate, weekday } from "./CareWorkspace";
const names = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
export function WeeklyProgramme({
  plan,
  journey,
  onOpen,
}: {
  plan: ApiPlan;
  journey: ApiJourney;
  onOpen: (id: string) => void;
}) {
  const [day, setDay] = useState(() =>
    weekday(localDate(journey.body.timezone)),
  );
  const programme = plan.programme;
  if (!programme) return null;
  const actions = plan.actions.filter((a) => a.days.includes(day));
  const meals = plan.meals.filter((m) => m.day === day);
  const minutes =
    actions.reduce((sum, a) => sum + (a.minutes || 0), 0) +
    meals.reduce((sum, m) => sum + m.preparation_minutes, 0);
  return (
    <section className="weekly-programme">
      <header>
        <div>
          <p className="eyebrow">{programme.weeks}-WEEK PROGRAMME</p>
          <h2>Your week</h2>
        </div>
        <span>
          {journey.context.target_date
            ? `Requested date: ${journey.context.target_date}`
            : journey.workspace?.timeline_note || "Flexible timeframe"}
        </span>
      </header>
      <p>{programme.outcome}</p>
      <details className="programme-rationale">
        <summary>Goal, timeline & review</summary>
        <p>{programme.deadline_assessment}</p>
        <p>{programme.schedule_notes}</p>
        <h3>Meaningful progress</h3>
        <ul>
          {programme.success_signals.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
        <p>{programme.review_rule}</p>
      </details>
      <div className="week-days" role="group" aria-label="Weekly schedule">
        {names.map((name, index) => (
          <button
            key={name}
            type="button"
            aria-label={name}
            aria-pressed={day === index}
            onClick={() => setDay(index)}
          >
            {name.slice(0, 3)}
            <i
              className={
                plan.actions.some((a) => a.days.includes(index))
                  ? "scheduled"
                  : ""
              }
            />
          </button>
        ))}
      </div>
      <div className="day-programme">
        <h3>
          {names[day]}
          <span>
            {minutes > 0 ? `${minutes} min planned` : "Recovery / flexible"}
          </span>
        </h3>
        {!actions.length && !meals.length && (
          <p className="muted">
            No scheduled actions. Follow the recovery or maintenance guidance
            above.
          </p>
        )}
        {actions.map((a) => (
          <button
            className="scheduled-idea"
            key={a.id}
            onClick={() => onOpen(a.id)}
          >
            <span>
              <strong>{a.title}</strong>
              <small>{sessionSummary(a)}</small>
            </span>
            <span>↗</span>
          </button>
        ))}
        {meals.map((m, i) => (
          <div className="scheduled-meal" key={i}>
            <small>{m.slot}</small>
            <strong>{m.title}</strong>
            <p>{m.instructions}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
function sessionSummary(action: ApiAction) {
  if (action.exercises.length)
    return `${action.exercises.length} exercises · ${action.minutes ?? "Time adaptable"}${action.minutes != null ? " min" : ""} · ${action.time_of_day}`;
  return `${action.minutes != null ? `${action.minutes} min · ` : ""}${action.timing}`;
}
