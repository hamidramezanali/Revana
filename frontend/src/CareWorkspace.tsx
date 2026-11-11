import { useEffect, useState } from "react"

import { agentRequest, type Journey } from "./Agent"

import { ActionCard } from "./ActionCard"

import type {
  ApiBodyContext,
  ApiProgressRequest,
  ApiAction,
  ApiMeal,
} from "./api.generated"

import { Button } from "./ui"

export const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

export function localDate(timezone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
}

export function weekday(date: string) {
  return (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7
}

export function BodyEditor({
  journey,
  busy,
  onSave,
}: {
  journey: Journey
  busy: boolean
  onSave: (body: ApiBodyContext) => void
}) {
  const [draft, setDraft] = useState(journey.body)

  const numeric = (
    key: "age" | "height_cm" | "weight_kg" | "target_weight_kg" | "daily_minutes" | "monthly_budget_sek",
    title: string,
    min: number,
    max: number,
  ) => (
    <label>
      {title}
      <input
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={key === "age" || key === "daily_minutes" ? "1" : "any"}
        value={draft[key] ?? ""}
        onChange={(event) =>
          setDraft({
            ...draft,
            [key]:
              event.target.value === "" ? null : Number(event.target.value),
          })
        }
      />
    </label>
  )

  return (
    <details className="workspace-panel">
      <summary>
        Measurements, time & budget <span>Optional</span>
      </summary>
      <p>
        Only add what is relevant. Blank values stay unknown. Changes require a
        plan review.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          onSave(draft)
        }}
      >
        <fieldset disabled={busy} className="profile-fields">
          <div className="field-pair">
            {numeric("daily_minutes", "Available minutes / day", 1, 240)}
            {numeric("monthly_budget_sek", "Monthly budget (SEK)", 0, 100000)}
          </div>
          <label>
            City
            <input
              maxLength={100}
              value={draft.city}
              onChange={(event) =>
                setDraft({ ...draft, city: event.target.value })
              }
            />
          </label>
          <label>
            Timezone
            <input
              value={draft.timezone}
              onChange={(event) =>
                setDraft({ ...draft, timezone: event.target.value })
              }
            />
          </label>
          {journey.context.goals.includes("body") && (
            <>
              <p>
                For weight and energy estimates. These do not authorize a
                weight-loss diet.
              </p>
              <div className="field-pair">
                {numeric("age", "Age (years)", 18, 120)}
                {numeric("height_cm", "Height (cm)", 100, 250)}
                {numeric("weight_kg", "Current weight (kg)", 25, 400)}
                {numeric("target_weight_kg", "Desired weight (kg)", 25, 400)}
              </div>
              <label>
                Energy-equation coefficient
                <select
                  value={draft.equation_coefficient}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      equation_coefficient: event.target
                        .value as ApiBodyContext["equation_coefficient"],
                    })
                  }
                >
                  <option value="not_specified">Prefer not to provide</option>
                  <option value="female">Female coefficient</option>
                  <option value="male">Male coefficient</option>
                </select>
              </label>
              <label>
                Pregnancy / breastfeeding context
                <select
                  value={draft.pregnancy}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      pregnancy: event.target
                        .value as ApiBodyContext["pregnancy"],
                    })
                  }
                >
                  <option value="unknown">Not provided</option>
                  <option value="not_applicable">Not applicable</option>
                  <option value="pregnant_or_breastfeeding">
                    Pregnant or breastfeeding
                  </option>
                </select>
              </label>
              <label>
                Activity pattern
                <select
                  value={draft.activity}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      activity: event.target
                        .value as ApiBodyContext["activity"],
                    })
                  }
                >
                  <option value="unknown">Not provided</option>
                  <option value="mostly_seated">Mostly seated</option>
                  <option value="some_activity">Some regular activity</option>
                  <option value="regular_training">Regular training</option>
                </select>
              </label>
            </>
          )}
          <Button
            className="secondary"
            type="submit"
            disabled={
              busy || JSON.stringify(draft) === JSON.stringify(journey.body)
            }
          >
            Save context
          </Button>
        </fieldset>
      </form>
    </details>
  )
}

export type ProgressDraft = Omit<ApiProgressRequest, "revision" | "meal_key"> & {
  meal_key?: string | null
}

type Progress = ProgressDraft

const statusLabels: Record<Progress["status"], string> = {
  not_attempted: "Not attempted",
  inconsistent: "Tried some days",
  followed: "Followed",
  improved: "Improved",
  unchanged: "No change",
  worse: "Worse",
}

export function ProgressPanel({
  journey,
  busy,
  onRecord,
  onRemove,
}: {
  journey: Journey
  busy: boolean
  onRecord: (value: Progress) => void
  onRemove: (id: string) => void
}) {
  const [status, setStatus] = useState<Progress["status"]>("not_attempted")

  const [note, setNote] = useState("")

  const [action, setAction] = useState("")

  const [date, setDate] = useState(localDate(journey.body.timezone))

  const plan = journey.plans.at(-1)!.plan

  useEffect(() => setNote(""), [journey.progress.length])

  return (
    <section className="workspace-panel">
      <h2>Your progress</h2>
      <p>What you tried and what changed are separate.</p>
      <details>
        <summary>Record an observation</summary>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            onRecord({
              action_id: action || null,
              status,
              note,
              observed_on: date,
            })
          }}
        >
          <fieldset disabled={busy} className="profile-fields">
            <label>
              About
              <select
                value={action}
                onChange={(event) => setAction(event.target.value)}
              >
                <option value="">Overall wellbeing</option>
                {plan.actions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              What happened?
              <select
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as Progress["status"])
                }
              >
                {Object.entries(statusLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Date
              <input
                type="date"
                required
                value={date}
                max={localDate(journey.body.timezone)}
                onChange={(event) => setDate(event.target.value)}
              />
            </label>
            <label>
              A short note (optional)
              <textarea
                rows={2}
                maxLength={1000}
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </label>
            <Button className="primary" type="submit" disabled={busy}>
              Save observation
            </Button>
          </fieldset>
        </form>
      </details>
      {journey.progress.length > 0 ? (
        <ol className="progress-entries">
          {journey.progress
            .slice(-6)
            .reverse()
            .map((entry) => (
              <li key={entry.id}>
                <strong>
                  {statusLabels[entry.status]}
                  {entry.meal_key ? ` · ${entry.meal_key.split("-")[1]}` : ""}
                </strong>
                <small>
                  {entry.observed_on} · plan {entry.plan_version}
                </small>
                {entry.note && <p>{entry.note}</p>}
                <Button
                  className="secondary"
                  disabled={busy}
                  onClick={() => onRemove(entry.id)}
                >
                  Remove observation
                </Button>
              </li>
            ))}
        </ol>
      ) : (
        <p className="empty-copy">
          No observations yet. Missing entries are not counted as failures.
        </p>
      )}
    </section>
  )
}

export function Milestones({ journey }: { journey: Journey }) {
  const plan = journey.plans.at(-1)!.plan

  return (
    <section className="workspace-panel">
      <h2>What to watch for</h2>
      <p>Review points, not promised results.</p>
      {plan.milestones.length ? (
        <ol className="milestone-list">
          {plan.milestones.map((item, index) => (
            <li key={index}>
              <span>
                Day {item.day} · {item.label}
              </span>
              <p>{item.description}</p>
              {item.assumptions && <small>{item.assumptions}</small>}
            </li>
          ))}
        </ol>
      ) : (
        <p>
          Review after {plan.review_days} days, or earlier if something worsens.
          No personalized outcome forecast has been established.
        </p>
      )}
    </section>
  )
}

export function ScheduledActions({
  actions,
  day,
  busy,
  onComplete,
  completed,
  blocked,
}: {
  actions: ApiAction[]
  day: number
  busy: boolean
  onComplete?: (id: string) => void
  completed: Set<string>
  blocked: (id: string) => string | undefined
}) {
  const due = actions.filter((action) =>
    (action.days ?? [0, 1, 2, 3, 4, 5, 6]).includes(day),
  )

  return (
    <div className="focus-action-list">
      {due.length ? (
        due.map((action) => (
          <div key={action.id}>
            {blocked(action.id) && (
              <p className="review-notice">{blocked(action.id)}</p>
            )}
            <ActionCard
              action={action}
              busy={busy}
              completed={completed.has(action.id)}
              onComplete={
                blocked(action.id) || !onComplete
                  ? undefined
                  : () => onComplete(action.id)
              }
              badge={`${action.time_of_day ?? "flexible"}${
                action.minutes == null ? "" : ` · ~${action.minutes} min`
              }`}
            />
          </div>
        ))
      ) : (
        <p className="action-list-empty">
          No habits scheduled for this day. Keep your usual routine.
        </p>
      )}
    </div>
  )
}

type Food = { id: number; name: string; source_url: string }

export function Meals({
  journey,
  day,
  busy,
  onSwap,
  onRecord,
}: {
  journey: Journey
  day: number
  busy: boolean
  onSwap: (meal: ApiMeal, source: ApiMeal) => void
  onRecord?: (value: ProgressDraft) => void
}) {
  const [foods, setFoods] = useState<Food[]>([])
  const [loadError, setLoadError] = useState(false)
  const [shopping, setShopping] = useState<Array<{
    food_id: number
    name: string
    grams: number
  }> | null>(null)

  const version = journey.plans.at(-1)!

  const meals = version.plan.meals

  const today = localDate(journey.body.timezone)

  const hadMeal = (meal: ApiMeal) => {
    const entries = journey.progress.filter(
      (entry) =>
        entry.plan_version === version.version &&
        entry.observed_on === today &&
        entry.meal_key === `${meal.day}-${meal.slot}` &&
        ["followed", "not_attempted"].includes(entry.status),
    )
    return entries[entries.length - 1]?.status === "followed"
  }

  useEffect(() => {
    let cancelled = false
    if (meals.length)
      void agentRequest<{ foods: Food[] }>("food-catalog")
        .then((result) => {
          if (!cancelled) setFoods(result.foods)
        })
        .catch(() => {
          if (!cancelled) setLoadError(true)
        })
    return () => {
      cancelled = true
    }
  }, [meals.length])

  if (!meals.length) return null

  return (
    <section className="workspace-panel">
      <h2>Meals</h2>
      {journey.workflow.status !== "ready" && (
        <p className="review-notice">
          Your context changed. Recheck these meals with your coach before
          following them. You can still record what you actually ate.
        </p>
      )}
      <p>
        Starting portions, prepared as named. Adjust for your needs; these are
        not prescribed intakes.
      </p>
      {loadError && (
        <p role="status">
          Ingredient names could not load; nutrition totals remain tied to their
          catalog IDs.
        </p>
      )}
      {meals
        .filter((meal) => meal.day === day)
        .map((meal) => (
          <article className="meal-card" key={meal.slot}>
            <span className="eyebrow">
              {meal.slot} · ~{meal.preparation_minutes} min
            </span>
            <h3>{meal.title}</h3>
            {onRecord && (
              <button
                className="meal-complete"
                type="button"
                aria-pressed={hadMeal(meal)}
                disabled={busy}
                onClick={() =>
                  onRecord({
                    action_id: null,
                    meal_key: `${meal.day}-${meal.slot}`,
                    status: hadMeal(meal) ? "not_attempted" : "followed",
                    note: "",
                    observed_on: today,
                  })
                }
              >
                {hadMeal(meal) ? "✓ Meal logged · undo" : "I had this meal"}
              </button>
            )}
            {meal.nutrition.available ? (
              <details className="nutrition-estimate">
                <summary>Nutrition estimate</summary>
                <p className="nutrition-badge">
                  ~{meal.nutrition.kcal} kcal · {meal.nutrition.protein_g} g
                  protein
                </p>
              </details>
            ) : (
              <p>Nutrition unavailable for these ingredients.</p>
            )}
            <details>
              <summary>Ingredients & preparation</summary>
              <ul>
                {meal.ingredients.map((item, index) => (
                  <li key={index}>
                    {item.grams} g ·{" "}
                    {foods.find((food) => food.id === item.food_id)?.name ??
                      `Food #${item.food_id}`}
                  </li>
                ))}
              </ul>
              <p>{meal.instructions}</p>
              <p>{meal.substitution_note}</p>
              <small>{meal.nutrition.source}</small>
              <label>
                Use another accepted meal
                <select
                  value=""
                  disabled={busy || journey.workflow.status !== "ready"}
                  onChange={(event) => {
                    const source = meals[Number(event.target.value)]
                    if (source) onSwap(meal, source)
                  }}
                >
                  <option value="">Choose a replacement…</option>
                  {meals.map(
                    (source, index) =>
                      (source.day !== meal.day ||
                        source.slot !== meal.slot) && (
                        <option key={index} value={index}>
                          {dayNames[source.day]} · {source.title}
                        </option>
                      ),
                  )}
                </select>
              </label>
            </details>
          </article>
        ))}
      <details
        onToggle={(event) => {
          if (event.currentTarget.open && shopping === null)
            void agentRequest<Array<{
              food_id: number
              name: string
              grams: number
            }>>("shopping-list")
              .then(setShopping)
              .catch(() => setLoadError(true))
        }}
      >
        <summary>Weekly shopping list</summary>
        {shopping ? (
          <ul>
            {shopping.map((item) => (
              <li key={item.food_id}>
                {item.name}: {item.grams} g
              </li>
            ))}
          </ul>
        ) : (
          <p>Loading consolidated ingredients…</p>
        )}
        <small>
          Livsmedelsverket · CC BY 4.0. Actual products and nutrition vary;
          check labels and allergies.
        </small>
      </details>
    </section>
  )
}

export function ServiceLinks() {
  const [result, setResult] = useState<{
    message: string
    links: Array<{ category: string; url: string; instruction: string }>
  } | null>(null)
  const [error, setError] = useState("")

  return (
    <details
      className="workspace-panel"
      onToggle={(event) => {
        if (event.currentTarget.open && !result && !error)
          void agentRequest<{
            message: string
            links: Array<{ category: string; url: string; instruction: string }>
          }>("services")
            .then(setResult)
            .catch(() =>
              setError(
                "Service links are unavailable. Your plan is unaffected.",
              ),
            )
      }}
    >
      <summary>Optional professional support</summary>
      {error ? (
        <p>{error}</p>
      ) : result ? (
        <>
          <p>{result.message}</p>
          {result.links.map((link) => (
            <p key={link.category}>
              <a href={link.url} target="_blank" rel="noopener noreferrer">
                Browse {link.category.toLowerCase()} options on Bokadirekt ↗
              </a>
              <small>{link.instruction}</small>
            </p>
          ))}
        </>
      ) : (
        <p>Loading external links…</p>
      )}
    </details>
  )
}


export function GoalEditor({journey,busy,onSave}:{journey:Journey;busy:boolean;onSave:(goals:Array<"skin"|"hair"|"body">,targetDate:string)=>void}) {
  const [goals,setGoals]=useState<Array<"skin"|"hair"|"body">>(journey.context.goals.filter((goal):goal is "skin"|"hair"|"body"=>["skin","hair","body"].includes(goal)));
  const [date,setDate]=useState(journey.context.target_date);
  return <details className="workspace-panel"><summary>Goals & timing</summary><form onSubmit={event=>{event.preventDefault();if(goals.length)onSave(goals,date);}}><fieldset className="profile-fields" disabled={busy}><div className="goal-chips">{(["skin","hair","body"] as const).map(goal=><button key={goal} type="button" aria-pressed={goals.includes(goal)} onClick={()=>setGoals(goals.includes(goal)?goals.filter(value=>value!==goal):[...goals,goal])}>{goal==="body"?"Weight & body habits":goal==="skin"?"Skin":"Hair"}</button>)}</div><label>Target date (optional)<input type="date" value={date} onChange={event=>setDate(event.target.value)}/></label><p>Changing goals keeps your allergies and limitations. Your coach will propose changes before the accepted plan is replaced.</p><Button className="secondary" type="submit" disabled={busy||!goals.length}>Save goals</Button></fieldset></form></details>;
}
