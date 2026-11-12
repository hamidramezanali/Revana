import { useEffect, useState } from "react";
import type { ApiBodyGoals, ApiJourney } from "./api.generated";
import { workspaceRequest } from "./agentClient";
import "./body-goals.css";
type Area = NonNullable<ApiBodyGoals["priority_area"]>;
type Intention = ApiBodyGoals["areas"][number]["intention"];
export const areaNames: Record<Area, string> = {
  waist: "Waist",
  abdomen: "Abdomen",
  chest: "Chest",
  shoulders: "Shoulders",
  arms: "Arms",
  back: "Back",
  glutes: "Glutes",
  thighs: "Thighs",
  calves: "Calves",
};
const directions: Array<[ApiBodyGoals["direction"], string]> = [
  ["reduce_fat", "Reduce body fat"],
  ["build_muscle", "Build muscle"],
  ["recomposition", "Improve composition"],
  ["maintain", "Maintain & get stronger"],
  ["unsure", "Help me decide"],
];
const intentions: Array<[Intention, string]> = [
  ["reduce_size", "Reduce size"],
  ["build_muscle", "Build muscle"],
  ["strength", "Improve strength"],
  ["definition", "Improve definition"],
  ["unsure", "Not sure yet"],
  ["other", "Something else"],
];
const arms =
  "M103 77 Q91 77 87 99 L77 157 L65 196 Q62 207 71 210 Q80 211 84 199 L96 162 L110 105 Z";
const thigh = "M106 220 L137 228 L134 308 Q123 320 108 309 L103 270 Z";
const calf = "M109 316 Q121 322 133 316 L129 362 L124 398 L109 398 L111 362 Z";
const paired = (path: string) => [
  <path key="left" d={path} />,
  <path key="right" d={path} transform="translate(280 0) scale(-1 1)" />,
];
export function BodyGoalsSummary({
  goals,
  onEdit,
}: {
  goals: ApiBodyGoals;
  onEdit: () => void;
}) {
  if (goals.direction === "unsure" && !goals.areas.length) return null;
  return (
    <section className="body-goals-summary">
      <div>
        <small>YOUR BODY GOALS</small>
        <strong>
          {directions.find(([id]) => id === goals.direction)?.[1]}
        </strong>
        <p>
          {goals.areas
            .map(
              (a) =>
                `${a.area === goals.priority_area ? "★ " : ""}${areaNames[a.area]} · ${intentions.find(([id]) => id === a.intention)?.[1]}`,
            )
            .join(" / ")}
        </p>
      </div>
      <button className="subtle-button" onClick={onEdit}>
        Edit body map →
      </button>
    </section>
  );
}
export function BodyGoals({
  journey,
  busy,
  onMutate,
  onContinue,
}: {
  journey: ApiJourney;
  busy: boolean;
  onMutate: (fn: () => Promise<ApiJourney>) => Promise<void>;
  onContinue: () => void;
}) {
  const [goals, setGoals] = useState<ApiBodyGoals>(journey.body_goals);
  const [side, setSide] = useState<"front" | "back">("front");
  const [active, setActive] = useState<Area | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    setGoals(journey.body_goals);
    setActive(null);
    setSaved(false);
    setError("");
  }, [journey.body_goals]);
  const dirty = JSON.stringify(goals) !== JSON.stringify(journey.body_goals);
  const selected = goals.areas.find((a) => a.area === active);
  function choose(area: Area) {
    if (busy) return;
    setActive(area);
    setSaved(false);
    if (!goals.areas.some((a) => a.area === area))
      setGoals({
        ...goals,
        areas: [...goals.areas, { area, intention: "unsure", note: "" }],
      });
  }
  function remove(area: Area) {
    setGoals({
      ...goals,
      areas: goals.areas.filter((a) => a.area !== area),
      priority_area: goals.priority_area === area ? null : goals.priority_area,
    });
    if (active === area) setActive(null);
    setSaved(false);
  }
  function region(area: Area, content: React.ReactNode) {
    const picked = goals.areas.some((a) => a.area === area);
    return (
      <g
        key={area}
        role="button"
        tabIndex={busy ? -1 : 0}
        aria-label={`${areaNames[area]}${picked ? ", selected" : ""}`}
        aria-pressed={picked}
        className={`body-region ${picked ? "selected" : ""} ${active === area ? "editing" : ""}`}
        onClick={() => choose(area)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            choose(area);
          }
        }}
      >
        <title>{areaNames[area]}</title>
        {content}
      </g>
    );
  }
  async function save() {
    setError("");
    await onMutate(async () => {
      try {
        const next = await workspaceRequest<ApiJourney>("body-goals", {
          revision: journey.revision,
          body_goals: goals,
        });
        setSaved(true);
        return next;
      } catch (e) {
        setError((e as Error).message);
        throw e;
      }
    });
  }
  return (
    <section className="body-goals-editor" aria-label="Visual body goals">
      <header>
        <p className="eyebrow">YOUR BODY, YOUR DIRECTION</p>
        <h2>What would you like to work on?</h2>
        <p>
          Choose your direction, then tap the areas you care about. This is
          optional.
        </p>
      </header>
      <fieldset disabled={busy} className="body-direction">
        <legend>Overall direction</legend>
        {directions.map(([id, label]) => (
          <button
            type="button"
            key={id}
            aria-pressed={goals.direction === id}
            onClick={() => {
              setGoals({ ...goals, direction: id });
              setSaved(false);
            }}
          >
            {label}
          </button>
        ))}
      </fieldset>
      <div className="body-map-layout">
        <div className="body-map-panel">
          <div className="body-side" role="group" aria-label="Body map view">
            {(["front", "back"] as const).map((v) => (
              <button
                key={v}
                disabled={busy}
                aria-pressed={side === v}
                onClick={() => setSide(v)}
              >
                {v === "front" ? "Front" : "Back"}
              </button>
            ))}
          </div>
          <svg
            viewBox="35 0 210 435"
            className="body-map"
            role="group"
            aria-label={`${side} body map. Select areas, or use the buttons below.`}
          >
            <ellipse
              cx="140"
              cy="32"
              rx="21"
              ry="26"
              className="body-neutral"
            />
            <path
              className="body-neutral"
              d="M130 56 L150 56 L153 72 L127 72 Z"
            />
            {region(
              "shoulders",
              <path d="M127 65 L153 65 Q169 66 179 78 L173 98 L107 98 L101 78 Q111 67 127 65 Z" />,
            )}
            {region("arms", paired(arms))}
            {side === "front" ? (
              <>
                {region(
                  "chest",
                  <path d="M109 100 L171 100 L169 139 Q140 150 111 139 Z" />,
                )}
                {region(
                  "waist",
                  <path d="M111 142 Q140 153 169 142 L172 166 Q140 176 108 166 Z" />,
                )}
                {region(
                  "abdomen",
                  <path d="M108 169 Q140 179 172 169 L176 211 Q140 224 104 211 Z" />,
                )}
              </>
            ) : (
              <>
                {region(
                  "back",
                  <path d="M109 100 L171 100 L171 159 Q140 170 109 159 Z" />,
                )}
                {region(
                  "waist",
                  <path d="M109 162 Q140 173 171 162 L174 181 Q140 192 106 181 Z" />,
                )}
                {region(
                  "glutes",
                  <path d="M106 184 Q140 195 174 184 L177 219 L165 242 L142 237 L140 216 L138 237 L115 242 L103 219 Z" />,
                )}
              </>
            )}
            {side === "front" && (
              <path
                className="body-neutral"
                d="M104 214 Q140 227 176 214 L166 242 L143 238 L140 224 L137 238 L114 242 Z"
              />
            )}
            {region("thighs", paired(thigh))}
            {region("calves", paired(calf))}
            <path
              className="body-neutral"
              d="M109 401 L124 401 L128 414 L100 414 Q97 409 109 401 Z"
            />
            <path
              className="body-neutral"
              d="M109 401 L124 401 L128 414 L100 414 Q97 409 109 401 Z"
              transform="translate(280 0) scale(-1 1)"
            />
          </svg>
          <p className="body-map-caption">
            {side === "front" ? "Front view" : "Back view"} · illustrative, not
            a body scan
          </p>
        </div>
        <div className="body-area-controls">
          <p className="body-subheading">Choose an area</p>
          <div className="body-area-list" role="group" aria-label="Body areas">
            {Object.entries(areaNames).map(([id, label]) => (
              <button
                key={id}
                disabled={busy}
                aria-pressed={goals.areas.some((a) => a.area === id)}
                onClick={() => {
                  choose(id as Area);
                  if (id === "glutes" || id === "back") setSide("back");
                  if (id === "chest" || id === "abdomen") setSide("front");
                }}
              >
                {goals.areas.some((a) => a.area === id) ? "✓ " : "+ "}
                {label}
              </button>
            ))}
          </div>
          <p className="body-map-help">
            You can select several. Choose one main priority if you like.
          </p>
          <div className="body-selected" aria-label="Selected body areas">
            {goals.areas.map((a) => (
              <div key={a.area} className={active === a.area ? "active" : ""}>
                <button
                  aria-expanded={active === a.area}
                  onClick={() => setActive(a.area)}
                  disabled={busy}
                >
                  {a.area === goals.priority_area ? "★ " : ""}
                  {areaNames[a.area]}
                  <small>
                    {intentions.find(([id]) => id === a.intention)?.[1]}
                  </small>
                </button>
                <button
                  className="body-remove"
                  disabled={busy}
                  aria-label={`Remove ${areaNames[a.area]}`}
                  onClick={() => remove(a.area)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          {selected && (
            <fieldset disabled={busy} className="body-area-detail">
              <legend>{areaNames[selected.area]}: desired change</legend>
              <select
                aria-label={`Desired change for ${areaNames[selected.area]}`}
                value={selected.intention}
                onChange={(e) => {
                  setGoals({
                    ...goals,
                    areas: goals.areas.map((a) =>
                      a.area === selected.area
                        ? { ...a, intention: e.target.value as Intention }
                        : a,
                    ),
                  });
                  setSaved(false);
                }}
              >
                {intentions.map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
              <label>
                A little context{" "}
                {selected.intention === "other" ? "(required)" : "(optional)"}
                <textarea
                  value={selected.note}
                  maxLength={300}
                  placeholder="For example: stronger for hiking, or how clothes fit"
                  onChange={(e) => {
                    setGoals({
                      ...goals,
                      areas: goals.areas.map((a) =>
                        a.area === selected.area
                          ? { ...a, note: e.target.value }
                          : a,
                      ),
                    });
                    setSaved(false);
                  }}
                />
              </label>
              <button
                type="button"
                className="body-priority"
                aria-pressed={goals.priority_area === selected.area}
                onClick={() => {
                  setGoals({
                    ...goals,
                    priority_area:
                      goals.priority_area === selected.area
                        ? null
                        : selected.area,
                  });
                  setSaved(false);
                }}
              >
                {goals.priority_area === selected.area
                  ? "★ Main priority"
                  : "☆ Make my main priority"}
              </button>
            </fieldset>
          )}
          {!goals.areas.length && (
            <p className="body-map-help">
              No areas selected. An overall goal is enough to start.
            </p>
          )}
        </div>
      </div>
      <p className="body-reality">
        <strong>A focus, not a prediction.</strong> You can work on specific
        muscles and strength. Where fat changes is not something this map can
        choose or promise.
      </p>
      {error && (
        <p role="alert" className="workspace-error">
          {error}
        </p>
      )}
      <footer>
        <button
          className="accent-button"
          disabled={
            busy ||
            !dirty ||
            goals.areas.some((a) => a.intention === "other" && !a.note.trim())
          }
          onClick={() => void save()}
        >
          {busy ? "Saving…" : "Save body goals"}
        </button>
        <button
          className="subtle-button"
          disabled={busy || dirty}
          onClick={onContinue}
        >
          {journey.plans.length
            ? "Discuss with my agent →"
            : "Continue with my agent →"}
        </button>
        {dirty ? (
          <small>Save your selections to use them in planning.</small>
        ) : (
          <small role="status">
            {saved ? "Saved. " : ""}Your agent uses saved preferences. Your
            accepted plan changes only after review and acceptance.
          </small>
        )}
      </footer>
    </section>
  );
}
