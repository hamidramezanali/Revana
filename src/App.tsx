import { useEffect, useMemo, useState } from "react";

type IconName = "arrow" | "calendar" | "check" | "chevron" | "clock" | "hair" | "heart" | "home" | "info" | "location" | "plus" | "search" | "skin" | "sparkle" | "star" | "user";
type Screen = "welcome" | "timeline" | "goals" | "details" | "routine" | "safety" | "analysis" | "dashboard";
type Goal = "skin" | "hair" | "body" | "energy" | "other";

function scrollToTop() {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
}

function Icon({ name, size = 20, className = "" }: { name: IconName; size?: number; className?: string }) {
  const paths: Record<IconName, React.ReactNode> = {
    arrow: <><path d="M5 12h14M14 7l5 5-5 5" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M8 3v4M16 3v4M3 10h18" /></>,
    check: <path d="m5 12 4 4 10-10" />,
    chevron: <path d="m9 18 6-6-6-6" />,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    hair: <><path d="M7 20c-1-5-1-11 2-15 1-1 2-2 3-2 4 1 6 5 5 10-.5 3-2 5-4 7" /><path d="M9 18c3-4 4-8 3-13M13 19c2-5 2-9 0-14" /></>,
    heart: <path d="M20.8 4.8a5.4 5.4 0 0 0-7.7 0L12 6l-1.2-1.2a5.4 5.4 0 0 0-7.6 7.7L12 21l8.8-8.5a5.4 5.4 0 0 0 0-7.7Z" />,
    home: <><path d="m3 11 9-8 9 8" /><path d="M5 10v10h14V10M9 20v-6h6v6" /></>,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7h.01" /></>,
    location: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    search: <><circle cx="10.5" cy="10.5" r="7" /><path d="m16 16 5 5" /></>,
    skin: <><path d="M12 3c4 0 7 3 7 7v2c0 5-3 9-7 9s-7-4-7-9v-2c0-4 3-7 7-7Z" /><path d="M8.5 11h.1M15.5 11h.1M9 16c2 1 4 1 6 0" /></>,
    sparkle: <><path d="m12 2 1.5 5.5L19 9l-5.5 1.5L12 16l-1.5-5.5L5 9l5.5-1.5L12 2Z" /><path d="m19 16 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16Z" /></>,
    star: <path d="m12 3 2.7 5.5 6 .9-4.4 4.2 1 6-5.3-2.8-5.3 2.8 1-6-4.4-4.2 6-.9L12 3Z" />,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c.7-5 3.4-7 8-7s7.3 2 8 7" /></>,
  };
  return <svg aria-hidden="true" className={className} fill="none" height={size} viewBox="0 0 24 24" width={size}><g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7">{paths[name]}</g></svg>;
}

function Button({ children, className = "", disabled, onClick }: { children: React.ReactNode; className?: string; disabled?: boolean; onClick?: () => void }) {
  return <button className={`button ${className}`} disabled={disabled} onClick={onClick} type="button">{children}</button>;
}

const goalData: { id: Goal; title: string; icon: IconName }[] = [
  { id: "skin", title: "Face & skin", icon: "skin" },
  { id: "hair", title: "Hair", icon: "hair" },
  { id: "body", title: "Body & fitness", icon: "heart" },
  { id: "energy", title: "Energy & lifestyle", icon: "sparkle" },
  { id: "other", title: "Something else", icon: "plus" },
];

const chipsByGoal: Record<Goal, string[]> = {
  skin: ["Dullness", "Uneven texture", "Puffiness", "Dark circles", "Dryness", "Sensitivity"],
  hair: ["Dry lengths", "Dullness", "Breakage", "Frizz", "Scalp discomfort", "Increased shedding"],
  body: ["Build strength", "Improve endurance", "Body composition", "Move more", "Clothes fit"],
  energy: ["Afternoon crash", "Unrefreshing sleep", "Low motivation", "Irregular meals", "Stress"],
  other: ["Brows", "Lashes", "Nails", "Body skin", "Smile", "Overall freshness"],
};

const routineQuestionsByGoal: Record<Goal, string[]> = {
  skin: ["What products do you use in the morning and evening?", "How often do you use sunscreen?"],
  hair: ["How often do you wash and style your hair?", "What products or treatments are part of your current routine?"],
  body: ["What kinds of movement are part of a usual week?", "What makes it easier or harder to stay active?"],
  energy: ["What does a usual day look like for sleep, meals, and activity?", "When do you tend to notice changes in your energy?"],
  other: ["What do you currently do for this goal?", "Have you tried anything that helped or did not suit you?"],
};

type DiscoveryPrompts = {
  concerns: Partial<Record<Goal, string[]>>;
  routineQuestions: Partial<Record<Goal, string[]>>;
};
type DiscoveryState = { prompts: DiscoveryPrompts; status: "loading" | "llm" | "fallback" };

const emptyDiscoveryPrompts: DiscoveryPrompts = { concerns: {}, routineQuestions: {} };

function isGoal(value: unknown): value is Goal {
  return value === "skin" || value === "hair" || value === "body" || value === "energy" || value === "other";
}

function readPromptMap(value: unknown): Partial<Record<Goal, string[]>> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const result: Partial<Record<Goal, string[]>> = {};
  for (const [key, items] of Object.entries(value)) {
    if (!isGoal(key) || !Array.isArray(items) || !items.every((item) => typeof item === "string")) return null;
    result[key] = items.map((item) => item.trim().slice(0, 120)).filter(Boolean).slice(0, 10);
  }
  return result;
}

function readDiscoveryPrompts(value: unknown): DiscoveryPrompts | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const payload = value as Record<string, unknown>;
  const concerns = readPromptMap(payload.concerns);
  const routineQuestions = readPromptMap(payload.routineQuestions);
  return concerns && routineQuestions ? { concerns, routineQuestions } : null;
}

function Brand() {
  return <div className="brand"><span><Icon name="sparkle" size={16} /></span><b>Revana</b></div>;
}

function SafetyStrip() {
  return <div className="safety-strip"><Icon name="info" size={14} /><span><strong>General information, not medical care.</strong> Revana does not diagnose, prescribe, or replace qualified medical, nutrition, or cosmetic advice.</span></div>;
}

type Profile = {
  deadlineType: "event" | "journey";
  targetDate: string;
  goals: Goal[];
  ownWords: string;
  concerns: Record<Goal, string[]>;
  routineNotes: Record<Goal, string>;
  hairHeat: string;
  skinRoutine: string;
  activity: string;
  energyDrop: string;
  products: string;
  sensitivities: string[];
  limitations: string;
};

const initialProfile: Profile = {
  deadlineType: "journey",
  targetDate: "",
  goals: [],
  ownWords: "",
  concerns: { skin: [], hair: [], body: [], energy: [], other: [] },
  routineNotes: { skin: "", hair: "", body: "", energy: "", other: "" },
  hairHeat: "3–5 times a week",
  skinRoutine: "Cleanser and moisturizer, sometimes SPF",
  activity: "Mostly seated, short walks",
  energyDrop: "Around 3pm on workdays",
  products: "",
  sensitivities: [],
  limitations: "",
};

const order: Screen[] = ["welcome", "timeline", "goals", "details", "routine", "safety", "analysis", "dashboard"];

function OnboardingShell({ children, screen, setScreen }: { children: React.ReactNode; screen: Screen; setScreen: (screen: Screen) => void }) {
  const index = order.indexOf(screen);
  return (
    <div className="onboarding">
      <header className="onboarding-header">
        <Brand />
        {screen !== "welcome" && screen !== "analysis" && <><div className="stepper">{["Direction", "Goals", "Understand", "Routine", "Safety"].map((item, i) => <span className={i <= index - 1 ? "active" : ""} key={item}><i />{item}</span>)}</div><button className="save-exit" type="button">Save & exit</button></>}
      </header>
      <div className="onboarding-body">{children}</div>
      {screen !== "welcome" && <SafetyStrip />}
      {screen !== "welcome" && screen !== "analysis" && <button className="back-link" onClick={() => setScreen(order[Math.max(0, index - 1)])} type="button">← Back</button>}
    </div>
  );
}

function Welcome({ onStart }: { onStart: () => void }) {
  return (
    <div className="welcome">
      <div className="welcome-copy">
        <h1>Your goals. Your lifestyle.<br /><em>Your transformation</em></h1>
        <Button className="primary large" onClick={onStart}>Begin your journey <Icon name="arrow" /></Button>
      </div>
      <div className="welcome-visual">
        <img alt="Natural portrait representing personal wellbeing" src="https://images.unsplash.com/photo-1632765854612-9b02b6ec2b15?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=1080" />
      </div>
    </div>
  );
}

function Timeline({ profile, setProfile, next }: { profile: Profile; setProfile: (p: Profile) => void; next: () => void }) {
  const days = profile.targetDate ? Math.ceil((new Date(`${profile.targetDate}T12:00:00`).getTime() - Date.now()) / 86400000) : null;
  return (
    <div className="question-page">
      <span className="eyebrow">YOUR DIRECTION · 1 OF 5</span>
      <h2>When would you like to feel your best?</h2>
      <div className="timeline-options">
        <button className={profile.deadlineType === "event" ? "selected" : ""} onClick={() => setProfile({ ...profile, deadlineType: "event" })} type="button"><Icon name="calendar" /><span><strong>A specific event</strong><small>Choose an exact date</small></span><i>{profile.deadlineType === "event" && <Icon name="check" size={15} />}</i></button>
        <button className={profile.deadlineType === "journey" ? "selected" : ""} onClick={() => setProfile({ ...profile, deadlineType: "journey", targetDate: "" })} type="button"><Icon name="sparkle" /><span><strong>No deadline</strong><small>An ongoing improvement journey</small></span><i>{profile.deadlineType === "journey" && <Icon name="check" size={15} />}</i></button>
      </div>
      {profile.deadlineType === "event" && <div className="date-field"><label>Event date</label><input min={new Date().toISOString().split("T")[0]} onChange={(e) => setProfile({ ...profile, targetDate: e.target.value })} type="date" value={profile.targetDate} />{days !== null && days > 0 && <span>{days} days away</span>}</div>}
      <Button className="primary continue" onClick={next}>Continue <Icon name="arrow" /></Button>
    </div>
  );
}

function Goals({ profile, setProfile, next }: { profile: Profile; setProfile: (p: Profile) => void; next: () => void }) {
  const toggle = (id: Goal) => setProfile({ ...profile, goals: profile.goals.includes(id) ? profile.goals.filter((g) => g !== id) : [...profile.goals, id] });
  return (
    <div className="question-page wide-question">
      <span className="eyebrow">WHAT MATTERS · 2 OF 5</span>
      <h2>What would you like to improve?</h2>
      <p>Choose one or several areas.</p>
      <div className="goal-grid">
        {goalData.map((goal) => <button aria-pressed={profile.goals.includes(goal.id)} className={profile.goals.includes(goal.id) ? "selected" : ""} key={goal.id} onClick={() => toggle(goal.id)} type="button"><span className="goal-icon"><Icon name={goal.icon} /></span><strong>{goal.title}</strong><i>{profile.goals.includes(goal.id) && <Icon name="check" size={15} />}</i></button>)}
      </div>
      <label className="text-field"><span>Tell us in your own words <small>OPTIONAL</small></span><textarea onChange={(e) => setProfile({ ...profile, ownWords: e.target.value })} placeholder="For example: My face looks tired even when I sleep, and my hair feels dry after washing…" value={profile.ownWords} /></label>
      <Button className="primary continue" disabled={!profile.goals.length && !profile.ownWords} onClick={next}>Continue <Icon name="arrow" /></Button>
    </div>
  );
}

function Details({ profile, setProfile, next, discovery }: { profile: Profile; setProfile: (p: Profile) => void; next: () => void; discovery: DiscoveryState }) {
  const activeGoals = profile.goals.length ? profile.goals : ["other" as Goal];
  const [newReasons, setNewReasons] = useState<Partial<Record<Goal, string>>>({});
  const toggleConcern = (goal: Goal, chip: string) => {
    const existing = profile.concerns[goal];
    setProfile({ ...profile, concerns: { ...profile.concerns, [goal]: existing.includes(chip) ? existing.filter((x) => x !== chip) : [...existing, chip] } });
  };
  const addReason = (goal: Goal) => {
    const reason = newReasons[goal]?.trim().slice(0, 80);
    if (!reason) return;
    const existing = profile.concerns[goal];
    if (existing.some((item) => item.toLowerCase() === reason.toLowerCase())) {
      setNewReasons({ ...newReasons, [goal]: "" });
      return;
    }
    setProfile({ ...profile, concerns: { ...profile.concerns, [goal]: [...existing, reason] } });
    setNewReasons({ ...newReasons, [goal]: "" });
  };
  return (
    <div className="question-page wide-question">
      <span className="eyebrow">UNDERSTAND · 3 OF 5</span>
      <h2>Let’s understand what you’re noticing.</h2>
      <p>These follow-ups are based only on the areas you selected. Choose what feels relevant; skip anything you’re unsure about.</p>
      <p className="prompt-status" role="status">{discovery.status === "loading" ? "Loading tailored suggestions…" : discovery.status === "fallback" ? "Personalized suggestions are unavailable right now. Common options are shown instead." : "Suggestions tailored to your selected focus."}</p>
      <div className="adaptive-stack">
        {activeGoals.map((goal) => {
          const suggestions = discovery.prompts.concerns[goal]?.length ? discovery.prompts.concerns[goal] : chipsByGoal[goal];
          const options = [...new Set([...suggestions, ...profile.concerns[goal]])];
          return <section key={goal}><div className="adaptive-heading"><span><Icon name={goalData.find((g) => g.id === goal)?.icon || "sparkle"} /></span><div><small>ABOUT {goal.toUpperCase()}</small><strong>{goal === "hair" ? "What are you noticing in your hair?" : goal === "skin" ? "What makes your face feel less refreshed?" : goal === "body" ? "What change would feel most meaningful?" : goal === "energy" ? "Where do you feel most held back?" : "What would you like to focus on?"}</strong></div></div><div className="chip-grid">{options.map((chip) => <button aria-pressed={profile.concerns[goal].includes(chip)} className={profile.concerns[goal].includes(chip) ? "selected" : ""} key={chip} onClick={() => toggleConcern(goal, chip)} type="button">{chip}{profile.concerns[goal].includes(chip) && <Icon name="check" size={13} />}</button>)}</div><div className="add-reason"><label htmlFor={`other-reason-${goal}`}>Something else?</label><div><input id={`other-reason-${goal}`} maxLength={80} onChange={(event) => setNewReasons({ ...newReasons, [goal]: event.target.value })} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addReason(goal); } }} placeholder="Add another reason" value={newReasons[goal] ?? ""} /><button aria-label={`Add another ${goal} concern`} disabled={!newReasons[goal]?.trim()} onClick={() => addReason(goal)} type="button"><Icon name="plus" size={17} /> Add</button></div></div></section>;
        })}
      </div>
      <div className="context-note"><Icon name="sparkle" /><p><strong>Adaptive path:</strong> your next questions will focus on {activeGoals.map((g) => goalData.find((x) => x.id === g)?.title.toLowerCase()).join(" and ")}—not unrelated topics.</p></div>
      <Button className="primary continue" onClick={next}>Continue <Icon name="arrow" /></Button>
    </div>
  );
}

function Routine({ profile, setProfile, next, discovery }: { profile: Profile; setProfile: (p: Profile) => void; next: () => void; discovery: DiscoveryState }) {
  const has = (goal: Goal) => profile.goals.includes(goal);
  const activeGoals = profile.goals.length ? profile.goals : ["other" as Goal];
  return (
    <div className="question-page wide-question">
      <span className="eyebrow">YOUR REAL LIFE · 4 OF 5</span>
      <h2>Help us reconstruct what happens today.</h2>
      <p>You don’t need to diagnose your own habits. A few concrete details help us look for patterns without guessing.</p>
      <p className="prompt-status" role="status">{discovery.status === "loading" ? "Preparing routine questions…" : discovery.status === "fallback" ? "Personalized questions are unavailable right now. Starter questions are shown instead." : "Questions tailored to your selected focus."}</p>
      <div className="form-sections">
        {has("hair") && <section><span className="form-number">01</span><div><label>How often do you use a dryer, straightener, or curling tool?</label><select onChange={(e) => setProfile({ ...profile, hairHeat: e.target.value })} value={profile.hairHeat}><option>Rarely or never</option><option>1–2 times a week</option><option>3–5 times a week</option><option>Daily</option></select><small>Follow-up selected because you mentioned hair.</small></div></section>}
        {has("skin") && <section><span className="form-number">02</span><div><label>What does your usual morning skincare look like?</label><input onChange={(e) => setProfile({ ...profile, skinRoutine: e.target.value })} value={profile.skinRoutine} /><small>Include only what you remember—product names are optional.</small></div></section>}
        {(has("body") || has("energy")) && <section><span className="form-number">03</span><div><label>What does movement on a typical workday look like?</label><input onChange={(e) => setProfile({ ...profile, activity: e.target.value })} value={profile.activity} /></div></section>}
        {has("energy") && <section><span className="form-number">04</span><div><label>When do you usually notice your energy drop?</label><input onChange={(e) => setProfile({ ...profile, energyDrop: e.target.value })} value={profile.energyDrop} /></div></section>}
        {activeGoals.map((goal, index) => {
          const questions = discovery.prompts.routineQuestions[goal]?.length ? discovery.prompts.routineQuestions[goal] : routineQuestionsByGoal[goal];
          return <section key={goal}><span className="form-number">{String(index + 1).padStart(2, "0")}</span><div><label htmlFor={`routine-notes-${goal}`}>{questions?.join(" ") ?? routineQuestionsByGoal[goal].join(" ")}</label><textarea id={`routine-notes-${goal}`} maxLength={600} onChange={(event) => setProfile({ ...profile, routineNotes: { ...profile.routineNotes, [goal]: event.target.value } })} placeholder="Share what your routine is like now, in your own words…" value={profile.routineNotes[goal]} /></div></section>;
        })}
        <section><span className="form-number">+</span><div><label>Products, routines, or approaches you’ve already tried</label><textarea onChange={(e) => setProfile({ ...profile, products: e.target.value })} placeholder="Names, photos, or a simple description…" value={profile.products} /><button className="upload" type="button"><Icon name="plus" size={15} /> Add a product photo</button></div></section>
      </div>
      <Button className="primary continue" onClick={next}>Continue <Icon name="arrow" /></Button>
    </div>
  );
}

function Safety({ profile, setProfile, next }: { profile: Profile; setProfile: (p: Profile) => void; next: () => void }) {
  const options: { label: string; icon: IconName }[] = [
    { label: "No known allergies or reactions", icon: "check" },
    { label: "Food allergies or dietary restrictions", icon: "heart" },
    { label: "Sensitive skin or scalp", icon: "skin" },
    { label: "Ingredient reactions", icon: "info" },
    { label: "Medication or ongoing medical care", icon: "heart" },
    { label: "Pregnant or breastfeeding", icon: "user" },
  ];
  const toggle = (item: string) => setProfile({ ...profile, sensitivities: profile.sensitivities.includes(item) ? profile.sensitivities.filter((x) => x !== item) : [...profile.sensitivities, item] });
  return (
    <div className="question-page wide-question">
      <span className="eyebrow">YOUR BOUNDARIES · 5 OF 5</span>
      <h2>Anything we should keep in mind?</h2>
      <div className="safety-sections">
        <section className="safety-card">
          <h3>Anything we should account for?</h3>
          <div className="goal-grid safety-options">{options.map(({ label, icon }) => {
            const selected = profile.sensitivities.includes(label);
            return <button aria-pressed={selected} className={selected ? "selected" : ""} key={label} onClick={() => toggle(label)} type="button"><span className="goal-icon"><Icon name={icon} size={17} /></span><strong>{label}</strong><i>{selected && <Icon name="check" size={15} />}</i></button>;
          })}</div>
        </section>
        <section className="safety-card">
          <h3>Any other limitations or allergies?</h3>
          <label className="safety-notes-label" htmlFor="safety-limitations">Share anything else you’d like your plan to take into account</label>
          <textarea id="safety-limitations" maxLength={800} onChange={(event) => setProfile({ ...profile, limitations: event.target.value })} placeholder="For example, ingredients you avoid, movement limitations, or anything you’d rather leave out…" value={profile.limitations} />
        </section>
      </div>
      <Button className="primary continue" onClick={next}>Connect the dots <Icon name="arrow" /></Button>
    </div>
  );
}

function Analysis({ profile, onPlan }: { profile: Profile; onPlan: () => void }) {
  const goalNames = profile.goals.map((g) => goalData.find((x) => x.id === g)?.title).join(", ");
  const hasHair = profile.goals.includes("hair");
  const hasSkin = profile.goals.includes("skin");
  return (
    <div className="analysis-page">
      <div className="analysis-intro"><span className="assistant-mark"><Icon name="sparkle" /></span><span className="eyebrow">PERSONAL ANALYSIS</span><h1>Let’s connect the dots.</h1><p>Here’s how your own answers translate into a small number of useful starting points. Nothing here is a diagnosis.</p></div>
      <div className="analysis-grid">
        <section><span className="analysis-type reported">REPORTED BY YOU</span><h3>Your goal</h3><p>{profile.ownWords || `You want to improve ${goalNames.toLowerCase()} with a realistic plan that fits your life.`}</p><ul>{profile.goals.map((g) => <li key={g}><Icon name="check" size={14} />{profile.concerns[g].slice(0, 2).join(" and ") || goalData.find((x) => x.id === g)?.title}</li>)}{profile.goals.filter((goal) => profile.routineNotes[goal].trim()).map((goal) => <li key={`routine-${goal}`}><Icon name="check" size={14} />Current routine ({goalData.find((item) => item.id === goal)?.title}): {profile.routineNotes[goal].trim()}</li>)}{profile.sensitivities.map((item) => <li key={`sensitivity-${item}`}><Icon name="info" size={14} />To account for: {item}</li>)}{profile.limitations.trim() && <li><Icon name="info" size={14} />Additional boundaries: {profile.limitations.trim()}</li>}</ul></section>
        <section><span className="analysis-type inferred">OUR WORKING HYPOTHESES</span><h3>Promising opportunities</h3><p>These are possibilities suggested by your answers—not established causes.</p><ul>{hasHair && <li><Icon name="sparkle" size={14} />Your {profile.hairHeat.toLowerCase()} heat use may contribute to dryness; protection and technique are sensible first tests.</li>}{hasSkin && <li><Icon name="sparkle" size={14} />Inconsistent SPF and a minimal moisture routine may limit visible improvement in texture and glow.</li>}<li><Icon name="sparkle" size={14} />A focused starting point makes it easier to notice what helps before adding more changes.</li></ul></section>
        <section><span className="analysis-type unknown">STILL UNCERTAIN</span><h3>What we won’t assume</h3><p>We don’t have clinical assessment, lab data, or passive health tracking.</p><ul><li><Icon name="info" size={14} />We cannot infer nutrient deficiency, hormonal causes, or a skin condition from this questionnaire.</li><li><Icon name="info" size={14} />If shedding, fatigue, or irritation is persistent or worsening, professional assessment comes before optimization.</li></ul></section>
      </div>
      <div className="opportunity"><div><span>HIGHEST-VALUE START</span><strong>Adjust what you already do before buying more.</strong><p>It is low cost, easy to evaluate, and directly connected to the routines you reported.</p></div><div className="impact-meter"><span>Expected value</span><i><b /></i><strong>High</strong></div></div>
      <Button className="primary large" onClick={onPlan}>Build my personal plan <Icon name="arrow" /></Button>
      <SafetyStrip />
    </div>
  );
}

type Action = { id: number; category: string; title: string; detail: string; why: string; timing: string; impact: string; effort: string };

function Dashboard({ profile, onRestart }: { profile: Profile; onRestart: () => void }) {
  const [done, setDone] = useState<number[]>([]);
  const [expanded, setExpanded] = useState<number | null>(1);
  const [simplified, setSimplified] = useState(false);
  const [coachText, setCoachText] = useState("");
  const [coachAnswer, setCoachAnswer] = useState("");
  const [tab, setTab] = useState("Today");
  useEffect(() => {
    scrollToTop();
  }, [tab]);
  const actions = useMemo<Action[]>(() => {
    const list: Action[] = [];
    if (profile.goals.includes("hair")) list.push({ id: 1, category: "HAIR · ROUTINE RESET", title: "Lower heat and add protection", detail: "Use a lower setting and apply heat protectant through the lengths before drying.", why: `You reported heat styling ${profile.hairHeat.toLowerCase()} alongside dryness or dullness. Heat may be contributing, so this is a more relevant first test than a supplement or salon treatment.`, timing: "Every heat-styling day · review in 3 weeks", impact: "High", effort: "Low" });
    if (profile.goals.includes("skin")) list.push({ id: 2, category: "SKIN · PROTECT", title: "Make SPF the final morning step", detail: "Apply a broad-spectrum SPF 30+ as directed to exposed skin.", why: `You described “${profile.skinRoutine}.” Consistent UV protection has stronger evidence for preventing visible photoaging than adding another active right now.`, timing: "Every morning · review in 4 weeks", impact: "High", effort: "Low" });
    if (profile.goals.includes("body") || profile.goals.includes("energy")) list.push({ id: 3, category: "MOVEMENT · START SMALL", title: simplified ? "Take an 8-minute walk" : "Complete a 12-minute strength circuit", detail: simplified ? "Walk at a comfortable pace after the meal that fits your day best." : "Two rounds of squats-to-chair, wall push-ups, hip hinges, and a short walk.", why: `You described workdays as “${profile.activity}.” A short repeatable session reduces the activation barrier while creating a useful baseline.`, timing: "3 times this week · reassess after 2 weeks", impact: "Medium", effort: simplified ? "Very low" : "Medium" });
    list.push({ id: 4, category: "OBSERVE · DON’T GUESS", title: "Record one useful observation", detail: "Note energy, irritation, softness, or manageability—only the outcome connected to your main goal.", why: "A single relevant observation helps us adapt your plan without asking you to track dozens of arbitrary metrics.", timing: "30 seconds this evening", impact: "Medium", effort: "Very low" });
    return list.slice(0, simplified ? 2 : 4);
  }, [profile, simplified]);
  const askCoach = () => {
    const text = coachText.toLowerCase();
    if (text.includes("miss")) setCoachAnswer("Nothing needs restarting. Continue with the next planned action today; consistency over time matters more than a perfect streak.");
    else if (text.includes("cheap") || text.includes("cost")) setCoachAnswer("Yes. Keep the routine change and tracking step, and postpone products or services. Your highest-priority actions do not require a clinic booking.");
    else if (text.includes("irrit")) setCoachAnswer("Pause the new product or step. If irritation is significant, persistent, or worsening, seek qualified medical advice rather than testing another active.");
    else setCoachAnswer("Based on your profile, I’d keep the first change small and evaluate it before adding anything else. Tell me what feels difficult or what changed, and I’ll adjust the plan.");
  };
  return (
    <div className="dashboard-app">
      <header className="app-header"><Brand /><nav aria-label="Dashboard navigation">{["Today", "My plan", "Insights"].map((item) => <button aria-current={tab === item ? "page" : undefined} className={tab === item ? "active" : ""} key={item} onClick={() => setTab(item)} type="button">{item}</button>)}</nav><div><button aria-label="Profile" className="profile-button" type="button">AM</button></div></header>
      <SafetyStrip />
      <main className="dash-main">
        <section className="dash-hero"><div><span className="eyebrow">TUESDAY · YOUR PERSONAL PLAN</span><h1>Good morning, Alex.</h1><p>{done.length ? `You’ve completed ${done.length} of today’s priorities. Keep the pace realistic.` : "Your plan starts with the few changes most connected to what you told us."}</p></div><div className="review-card"><span>NEXT REVIEW</span><strong>In 12 days</strong><small>We’ll ask what changed—not judge your streak.</small></div></section>
        {tab === "Today" && <div className="dash-grid">
          <div className="today-column">
            <div className="section-title"><div><span className="eyebrow">TODAY’S PRIORITIES</span><h2>{actions.length} focused actions</h2></div><span className="progress-text">{done.length}/{actions.length} complete</span></div>
            <div className="action-list">{actions.map((action) => <article className={done.includes(action.id) ? "done" : ""} key={action.id}><button aria-label="Complete action" className="complete" onClick={() => setDone(done.includes(action.id) ? done.filter((id) => id !== action.id) : [...done, action.id])} type="button">{done.includes(action.id) && <Icon name="check" size={15} />}</button><div className="action-copy"><span>{action.category}</span><h3>{action.title}</h3><p>{action.detail}</p><div className="action-meta"><span><Icon name="clock" size={13} />{action.timing}</span><b>{action.impact} impact</b><b>{action.effort} effort</b></div><button className="why-button" onClick={() => setExpanded(expanded === action.id ? null : action.id)} type="button"><Icon name="sparkle" size={14} /> Why this for me? <Icon name="chevron" size={14} /></button>{expanded === action.id && <div className="why-panel"><strong>Connected to your answers</strong><p>{action.why}</p><small>Evidence confidence: moderate to strong for the general action; your individual result is uncertain.</small></div>}</div></article>)}</div>
            <div className="plan-feedback"><div><strong>Does today feel manageable?</strong><span>Your answer adapts the next version—no guilt, no broken streaks.</span></div><button onClick={() => setSimplified(false)} type="button">Yes, keep it</button><button onClick={() => setSimplified(true)} type="button">Simplify it</button></div>
          </div>
          <aside>
            <section className="coach-card"><div className="coach-title"><span><Icon name="sparkle" /></span><div><strong>Ask your demo coach</strong><small>Uses preset responses, not a live AI</small></div></div>{coachAnswer && <div className="coach-answer">{coachAnswer}</div>}<textarea onChange={(e) => setCoachText(e.target.value)} placeholder="Can you make this cheaper? I missed two days…" value={coachText} /><Button className="primary" disabled={!coachText} onClick={askCoach}>Ask Revana <Icon name="arrow" size={15} /></Button><div className="quick-asks">{["I have less time", "This caused irritation", "Show a cheaper option"].map((x) => <button key={x} onClick={() => setCoachText(x)} type="button">{x}</button>)}</div></section>
            <section className="starting-point"><span className="eyebrow">YOUR STARTING POINT</span><h3>Why these actions</h3><p>Your first plan prioritizes changes to existing routines because they are safer, lower cost, and easier to evaluate than introducing several products or supplements.</p><button onClick={() => setTab("Insights")} type="button">Review the analysis <Icon name="arrow" size={14} /></button></section>
          </aside>
        </div>}
        <div hidden={tab !== "My plan"}><PlanView profile={profile} /></div>
        {tab === "Insights" && <Insights profile={profile} onRestart={onRestart} />}
      </main>
    </div>
  );
}

type PlanIdea = { id: string; title: string; preview: string; suggestion: string; why: string; research: string };
type PlanWeek = { title: string; ideas: PlanIdea[] };

function buildWeeklyPlan(profile: Profile): PlanWeek[] {
  const concerns = profile.goals.flatMap((goal) => profile.concerns[goal]).map((concern) => concern.toLowerCase());
  const hasConcern = (...terms: string[]) => concerns.some((concern) => terms.some((term) => concern.includes(term)));
  const hairSelected = profile.goals.includes("hair");
  const skinSelected = profile.goals.includes("skin");
  const energySelected = profile.goals.includes("energy") || profile.goals.includes("body");
  const general = profile.goals.length === 0 || profile.goals.includes("other");
  const weeks: PlanWeek[] = [
    {
      title: "Softer mornings",
      ideas: [
        { id: "gentle-rinse", title: "Lukewarm rinse", preview: "Try a comfortably warm rinse as part of your morning routine.", suggestion: "If it feels comfortable, try water that is warm rather than very hot during your morning routine.", why: "A small, easy-to-adjust change can be a gentle place to start while keeping the rest of your routine familiar.", research: "General skin-care guidance · review with a qualified professional if irritation persists." },
        { id: "pat-dont-rub", title: "Pat, don't rub", preview: "A softer touch after washing may feel more comfortable.", suggestion: "After washing, gently pat your skin or hair dry instead of rubbing.", why: hasConcern("dry", "break", "sensitive") ? "You mentioned dryness, breakage, or sensitivity, so a gentler handling habit may be a relevant low-effort experiment." : "This is an optional, low-effort way to keep your routine gentle.", research: "General care suggestion · individual results vary." },
        { id: "daylight-break", title: "A little daylight", preview: "Step outside for a few minutes when it suits your day.", suggestion: "If practical, take a short daylight break at a time that works for you.", why: "You selected lifestyle-related goals; this is one flexible idea that does not require special equipment.", research: "General wellbeing suggestion · not a treatment recommendation." },
      ],
    },
    {
      title: "Water and wind-down",
      ideas: [
        { id: "glass-nearby", title: "A glass nearby", preview: "Keep water within reach during a part of your day.", suggestion: "You could keep a glass of water nearby during the part of the day when it is easiest to forget.", why: "A visible cue can make a routine easier to remember without turning it into a target or rule.", research: "General habit-design idea · needs vary with health, climate, and activity." },
        { id: "phone-aside", title: "Phone aside, earlier", preview: "Try setting your phone aside a little earlier on one evening.", suggestion: "On an evening that suits you, try putting your phone aside a little earlier than usual.", why: "You can explore whether a small change to your evening routine feels restful; there is no need to do this every night.", research: "General sleep-habit suggestion · individual needs and circumstances vary." },
        { id: "evening-moisturiser", title: "Evening moisturiser", preview: "Consider a simple moisturiser before bed, if it suits you.", suggestion: "If you already use a moisturiser and it suits your skin, consider making it part of a comfortable evening routine.", why: hasConcern("dry", "tight", "sensitive") ? "You mentioned dryness, tightness, or sensitivity. Keeping to a product you already tolerate avoids adding several new variables." : "Keeping a familiar routine steady can make it easier to notice how your skin feels.", research: "General skin-care guidance · check ingredients and stop if a product causes irritation." },
      ],
    },
    {
      title: "Noticing what you love",
      ideas: [
        { id: "favorite-routine", title: "One familiar favorite", preview: "Make a little room for something you already enjoy.", suggestion: "Choose one small part of your existing routine that feels pleasant and give it room to stay.", why: "A plan is more likely to feel personal when it builds on things you already enjoy rather than adding pressure.", research: "Personal preference matters · this is a reflection prompt, not a clinical intervention." },
        { id: "gentle-movement", title: "A daylight walk", preview: "If it feels right, take a short walk at a comfortable pace.", suggestion: "If it fits your day and abilities, consider a short, comfortable walk outdoors.", why: "You selected lifestyle or movement goals. This is only an optional idea; choose movement that feels appropriate for you.", research: "General activity suggestion · adapt to your abilities and seek professional guidance when needed." },
        { id: "notice-comfort", title: "Notice what feels good", preview: "Pay attention to one change you liked, if any.", suggestion: "At the end of the week, notice one thing that felt comfortable or enjoyable—or note that nothing stood out.", why: "Your own experience can help decide what is worth keeping, without requiring scores or a perfect streak.", research: "A personal check-in · your observation is not proof of cause and effect." },
      ],
    },
  ];
  return weeks.map((week) => ({
    ...week,
    ideas: week.ideas.filter((idea) => {
      if (idea.id === "gentle-rinse" || idea.id === "pat-dont-rub") return skinSelected || hairSelected || general;
      if (idea.id === "evening-moisturiser") return skinSelected || general;
      if (idea.id === "daylight-break" || idea.id === "gentle-movement") return energySelected || general;
      return true;
    }),
  }));
}

function formatWeekRange(start: Date) {
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const startText = new Intl.DateTimeFormat(undefined, options).format(start);
  const endText = new Intl.DateTimeFormat(undefined, options).format(end);
  return `${startText} – ${endText}`;
}

function PlanView({ profile }: { profile: Profile }) {
  const [view, setView] = useState<"summary" | "weekly">("summary");
  const [selectedWeek, setSelectedWeek] = useState(0);
  const [dismissedIdeas, setDismissedIdeas] = useState<string[]>([]);
  const [expandedIdea, setExpandedIdea] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [savedNote, setSavedNote] = useState("");
  const weeklyPlan = useMemo(() => buildWeeklyPlan(profile), [profile]);
  const planStart = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return start;
  }, []);
  const weekStart = new Date(planStart);
  weekStart.setDate(planStart.getDate() + selectedWeek * 7);
  const currentWeek = weeklyPlan[selectedWeek];
  const goalNames = profile.goals.map((goal) => goalData.find((item) => item.id === goal)?.title.toLowerCase()).filter(Boolean).join(" and ");
  const selectedConcerns = profile.goals.flatMap((goal) => profile.concerns[goal]).slice(0, 2);
  const summaryTopics = [...new Set([...selectedConcerns, ...profile.goals.map((goal) => goalData.find((item) => item.id === goal)?.title || goal)])];
  const reasons = [
    selectedConcerns.length ? `You mentioned ${selectedConcerns.join(" and ").toLowerCase()}, so the suggestions start with gentle, optional ideas.` : `You chose to focus on ${goalNames || "your wellbeing"}, so the suggestions offer small ways to explore that area.`,
    Object.values(profile.routineNotes).some((routine) => routine.trim()) ? "Your current routine is part of the context; the ideas are designed to fit around what you already do." : "The suggestions are intentionally small, so you can decide what fits your existing routine.",
    "Nothing is required. Keep the ideas that feel useful and leave out anything that does not.",
  ];
  const activeIdeaCount = weeklyPlan.reduce((count, week) => count + week.ideas.filter((idea) => !dismissedIdeas.includes(idea.id)).length, 0);
  const dismissIdea = (ideaId: string) => setDismissedIdeas((ideas) => ideas.includes(ideaId) ? ideas : [...ideas, ideaId]);

  return <div className="plan-view">
    {view === "summary" ? <>
      <header className="plan-page-heading"><span className="eyebrow">REVANA</span><h2>Your plan</h2></header>
      <section className="plan-summary-card">
        <span className="plan-card-label"><Icon name="sparkle" size={16} /> WHAT WE THINK MAY WORK</span>
        <h3>{selectedConcerns.length ? "Small shifts for a gentler routine" : "A calmer rhythm, shaped around you"}</h3>
        <p>Over the next few weeks, these ideas may help you explore {goalNames || "your goals"} at a pace that feels right. Nothing here is required—keep what fits and leave the rest.</p>
        <div className="plan-topic-tags">{(summaryTopics.length ? summaryTopics : ["Gentle routines", "Personal pace"]).slice(0, 4).map((topic) => <span key={topic}>{topic}</span>)}</div>
      </section>
      <section className="plan-reasons"><h3>Why this plan, for you</h3>{reasons.map((reason) => <p key={reason}>{reason}</p>)}</section>
      <section className="plan-upcoming">
        <div className="plan-upcoming-heading"><div><h3>The weeks ahead</h3><p>Leave out anything that isn't for you—your weekly plans will follow.</p></div><span>{activeIdeaCount} ideas</span></div>
        <div className="summary-weeks">{weeklyPlan.map((week, index) => {
          const start = new Date(planStart);
          start.setDate(planStart.getDate() + index * 7);
          const visibleIdeas = week.ideas.filter((idea) => !dismissedIdeas.includes(idea.id));
          return <section className="summary-week" key={week.title}>
            <header><span>WEEK {index + 1} · {formatWeekRange(start)}{index === 0 ? " · THIS WEEK" : ""}</span><span>{visibleIdeas.length} {visibleIdeas.length === 1 ? "idea" : "ideas"}</span></header>
            <h4>{week.title}</h4>
            {visibleIdeas.length ? <ul>{visibleIdeas.map((idea) => <li key={idea.id}><span>{idea.title}</span><button onClick={() => dismissIdea(idea.id)} type="button">Not for me</button></li>)}</ul> : <p className="empty-week">You’ve left out all the ideas for this week.</p>}
          </section>;
        })}</div>
      </section>
      <p className="plan-disclaimer"><Icon name="info" size={15} />These are example suggestions in this prototype, not yet personalized by a connected AI or verified against live research. They are not a diagnosis or a guarantee. Take what helps; leave what doesn't.</p>
      <Button className="primary plan-continue" onClick={() => { setView("weekly"); setExpandedIdea(null); }}>See weekly plans <Icon name="arrow" /></Button>
    </> : <>
      <button className="plan-back" onClick={() => setView("summary")} type="button"><Icon name="chevron" size={16} /> Plan summary</button>
      <header className="plan-page-heading weekly-heading"><h2>Weekly plans</h2></header>
      <div className="week-picker">
        <button aria-label="Previous week" disabled={selectedWeek === 0} onClick={() => { setSelectedWeek((week) => week - 1); setExpandedIdea(null); }} type="button"><Icon name="chevron" size={20} /></button>
        <div><span>{selectedWeek === 0 ? "THIS WEEK" : `WEEK ${selectedWeek + 1}`}</span><strong>Week {selectedWeek + 1}</strong><small>{formatWeekRange(weekStart)}</small></div>
        <button aria-label="Next week" disabled={selectedWeek === weeklyPlan.length - 1} onClick={() => { setSelectedWeek((week) => week + 1); setExpandedIdea(null); }} type="button"><Icon name="chevron" size={20} /></button>
      </div>
      <nav aria-label="Select week" className="week-dots">{weeklyPlan.map((week, index) => <button aria-label={`Go to week ${index + 1}`} aria-current={selectedWeek === index ? "step" : undefined} className={selectedWeek === index ? "active" : ""} key={week.title} onClick={() => { setSelectedWeek(index); setExpandedIdea(null); }} type="button" />)}</nav>
      <section aria-live="polite" className="weekly-suggestions">
        <span className="eyebrow">REVANA SUGGESTS · {currentWeek.ideas.filter((idea) => !dismissedIdeas.includes(idea.id)).length} IDEAS</span>
        <h3>{currentWeek.title}</h3>
        <div className="suggestion-list">{currentWeek.ideas.filter((idea) => !dismissedIdeas.includes(idea.id)).map((idea) => {
          const expanded = expandedIdea === idea.id;
          return <article className={`suggestion-card${expanded ? " expanded" : ""}`} key={idea.id}>
            <button aria-expanded={expanded} className="suggestion-toggle" onClick={() => setExpandedIdea(expanded ? null : idea.id)} type="button"><span><strong>{idea.title}</strong>{!expanded && <small>{idea.preview}</small>}</span><Icon className={expanded ? "rotated" : ""} name="chevron" size={18} /></button>
            {expanded && <div className="suggestion-detail" id={`suggestion-details-${idea.id}`}>
              <p>{idea.suggestion}</p>
              <h4>Why this, for you</h4><p>{idea.why}</p>
              <details className="suggestion-research"><summary><Icon name="info" size={15} /> What to keep in mind</summary><p>{idea.research}</p></details>
              <button className="suggestion-dismiss" onClick={() => dismissIdea(idea.id)} type="button">Not for me</button>
            </div>}
          </article>;
        })}</div>
        {currentWeek.ideas.every((idea) => dismissedIdeas.includes(idea.id)) && <p className="empty-week">You’ve left out all the ideas for this week. Choose another week or continue without suggestions.</p>}
      </section>
      <section className="plan-note">
        <span className="eyebrow">IN YOUR WORDS · OPTIONAL</span>
        <h3>Anything you tried or noticed?</h3>
        <textarea maxLength={800} onChange={(event) => setNote(event.target.value)} placeholder="No pressure — a few words, or nothing at all." value={note} />
        <Button className="primary" disabled={!note.trim()} onClick={() => setSavedNote(note.trim())}>{savedNote ? "Note saved" : "Keep this note"}</Button>
        {savedNote && <p className="saved-note-status" role="status">Your note is saved for this visit.</p>}
      </section>
    </>}
  </div>;
}

function Insights({ profile, onRestart }: { profile: Profile; onRestart: () => void }) {
  return <div className="insights-view"><div className="section-title"><div><span className="eyebrow">PROGRESS WITHOUT FALSE PRECISION</span><h2>What we’re learning</h2><p>Observations, not arbitrary wellness scores.</p></div><Button className="secondary" onClick={onRestart}>Update profile</Button></div><div className="insight-cards"><section><span>YOUR REPORT</span><strong>Starting baseline saved</strong><p>{profile.ownWords || "Your chosen concerns and current routine form the baseline for the first review."}</p></section><section><span>EARLY SIGNAL</span><strong>Not enough information yet</strong><p>After 12 days, we’ll ask about only the outcomes connected to your first actions.</p></section><section><span>PLAN RESPONSE</span><strong>Effort can adapt immediately</strong><p>If the plan is too difficult or causes a reaction, change it now rather than waiting for review day.</p></section></div></div>;
}

function App() {
  const [screen, setScreen] = useState<Screen>("welcome");
  const [profile, setProfile] = useState(initialProfile);
  const [discovery, setDiscovery] = useState<DiscoveryState>({ prompts: emptyDiscoveryPrompts, status: "fallback" });
  const selectedGoalsKey = profile.goals.join(",");
  useEffect(() => {
    scrollToTop();
  }, [screen]);
  useEffect(() => {
    if (!selectedGoalsKey) {
      setDiscovery({ prompts: emptyDiscoveryPrompts, status: "fallback" });
      return;
    }
    const controller = new AbortController();
    const goals = selectedGoalsKey.split(",").filter(isGoal);
    setDiscovery({ prompts: emptyDiscoveryPrompts, status: "loading" });
    const loadDiscovery = async () => {
      try {
        const response = await fetch("/api/onboarding/discovery", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ goals }),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Prompt service returned ${response.status}.`);
        const prompts = readDiscoveryPrompts(await response.json());
        if (!prompts) throw new Error("Prompt service returned an invalid response.");
        setDiscovery({ prompts, status: "llm" });
      } catch (error) {
        if (controller.signal.aborted) return;
        setDiscovery({ prompts: emptyDiscoveryPrompts, status: "fallback" });
        if (error instanceof Error) console.info("Using default onboarding prompts:", error.message);
      }
    };
    void loadDiscovery();
    return () => controller.abort();
  }, [selectedGoalsKey]);
  const next = () => setScreen(order[Math.min(order.length - 1, order.indexOf(screen) + 1)]);
  return (
    <>
      {screen === "dashboard" ? <Dashboard onRestart={() => setScreen("goals")} profile={profile} /> :
        screen === "analysis" ? <Analysis onPlan={() => setScreen("dashboard")} profile={profile} /> :
          <OnboardingShell screen={screen} setScreen={setScreen}>
            {screen === "welcome" && <Welcome onStart={next} />}
            {screen === "timeline" && <Timeline next={next} profile={profile} setProfile={setProfile} />}
            {screen === "goals" && <Goals next={next} profile={profile} setProfile={setProfile} />}
            {screen === "details" && <Details discovery={discovery} next={next} profile={profile} setProfile={setProfile} />}
            {screen === "routine" && <Routine discovery={discovery} next={next} profile={profile} setProfile={setProfile} />}
            {screen === "safety" && <Safety next={next} profile={profile} setProfile={setProfile} />}
          </OnboardingShell>}
    </>
  );
}

export default App;
