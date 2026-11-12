import { useEffect, useState } from "react";
import type { ApiPlan as Plan } from "./api.generated";
import { agentRequest } from "./agentClient";
const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export function MealPreparation({ plan }: { plan: Plan }) {
  const [foods, setFoods] = useState<Array<{ id: number; name: string }>>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void agentRequest<{ foods: Array<{ id: number; name: string }> }>(
      "food-catalog",
    )
      .then((r) => {
        if (active) setFoods(r.foods);
      })
      .catch(() => {
        if (active)
          setError(
            "Ingredient names could not load. Retry before following these recipes.",
          );
      });
    return () => {
      active = false;
    };
  }, []);
  const n = plan.nutrition;
  const [day, setDay] = useState(0);
  const meals = plan.meals.filter((m) => m.day === day);
  const totals = new Map<number, number>();
  for (const meal of plan.meals)
    for (const i of meal.ingredients)
      totals.set(i.food_id, (totals.get(i.food_id) || 0) + i.grams);
  if (!n && !plan.meals.length) return null;
  return (
    <section className="meal-preparation">
      <p className="eyebrow">FOOD & PREPARATION</p>
      <h2>Meals that fit your week</h2>
      {n && (
        <>
          <p>{n.focus}</p>
          <details className="energy-approach">
            <summary>
              {n.energy_strategy === "deficit_discussion"
                ? "Energy balance & weight-management approach"
                : n.energy_strategy === "clinician_review"
                  ? "Individual nutrition review needed"
                  : "Balanced, satisfying meals"}
            </summary>
            <p>{n.energy_explanation}</p>
            <p>{n.meal_pattern}</p>
            <p>{n.portion_approach}</p>
            <p className="muted">
              Meal estimates are not a personal daily calorie prescription.
            </p>
          </details>
          {n.prep_sessions.length > 0 && (
            <div className="prep-sessions">
              <h3>Batch-prep sessions</h3>
              {n.prep_sessions.map((session, i) => (
                <details key={i}>
                  <summary>
                    <strong>
                      {days[session.day]} · {session.title}
                    </strong>
                    <span>{session.minutes} min</span>
                  </summary>
                  <ol>
                    {session.steps.map((s, k) => (
                      <li key={k}>{s}</li>
                    ))}
                  </ol>
                  <p>
                    <strong>Storage: </strong>
                    {session.storage}
                  </p>
                  <small>
                    {session.meal_keys.length
                      ? `Linked to ${session.meal_keys.length} scheduled meals`
                      : "Review the preparation instructions to choose suitable meals."}
                  </small>
                </details>
              ))}
            </div>
          )}
        </>
      )}
      {plan.meals.length > 0 && (
        <>
          <div className="week-days" role="group" aria-label="Meal days">
            {days.map((d, i) => (
              <button
                key={d}
                aria-pressed={day === i}
                onClick={() => setDay(i)}
              >
                {d}
                <i
                  className={
                    plan.meals.some((m) => m.day === i) ? "scheduled" : ""
                  }
                />
              </button>
            ))}
          </div>
          {error && <p role="alert">{error}</p>}
          <div className="meal-cards">
            {meals.length ? (
              meals.map((meal, i) => (
                <details key={i}>
                  <summary>
                    <span>
                      <small>{meal.slot}</small>
                      <strong>{meal.title}</strong>
                    </span>
                    <small>{meal.preparation_minutes} min assembly/prep</small>
                  </summary>
                  <p>{meal.instructions}</p>
                  <ul>
                    {meal.ingredients.map((item, k) => (
                      <li key={k}>
                        {foods.find((f) => f.id === item.food_id)?.name ||
                          "Ingredient name unavailable"}{" "}
                        · {item.grams} g
                      </li>
                    ))}
                  </ul>
                  <p>{meal.substitution_note}</p>
                  {meal.storage && (
                    <p>
                      <strong>Storage/reheating: </strong>
                      {meal.storage}
                    </p>
                  )}
                  <p className="meal-estimate">
                    {meal.nutrition.available
                      ? `Approx. ${meal.nutrition.kcal} kcal · ${meal.nutrition.protein_g} g protein for the listed ingredients`
                      : "Nutrition estimate unavailable for these ingredients."}
                  </p>
                  <small>{meal.nutrition.source}</small>
                </details>
              ))
            ) : (
              <p className="muted">
                No meals are scheduled for this day. Follow your meal-pattern
                guidance.
              </p>
            )}
          </div>
          <details className="ingredient-totals">
            <summary>Weekly ingredient totals</summary>
            <p>
              Quantities use the preparation state named below. Cooked weights
              are not equivalent to dry shopping weights.
            </p>
            <ul>
              {[...totals].map(([id, grams]) => (
                <li key={id}>
                  {foods.find((f) => f.id === id)?.name ||
                    "Ingredient name unavailable"}{" "}
                  · {Math.round(grams)} g
                </li>
              ))}
            </ul>
          </details>
        </>
      )}
      {n?.substitutions.length ? (
        <details>
          <summary>Flexible substitutions</summary>
          <ul>
            {n.substitutions.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
