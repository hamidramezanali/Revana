"use client";

import { useEffect, useMemo, useState } from "react";
import { brand } from "@/config/brand";

type Screen = "home" | "onboarding" | "analysis" | "app";
type AppTab = "today" | "plan" | "progress" | "coach";
type Goal = "hair" | "skin" | "body" | "energy" | "other";
type Timeline = "date" | "range" | "none" | "";
type Profile = {
  timeline: Timeline;
  timelinePurpose: string;
  skipped: string[];
  targetDate: string;
  timeframe: string;
  goals: Goal[];
  concern: string;
  dryness: string;
  washFrequency: string;
  currentProducts: string;
  heat: string;
  color: string;
  hairChange: string;
  sensitivity: string;
  shedding: string;
  timeAvailable: string;
  budget: string;
  approach: string;
  focusNotes: Partial<Record<Goal, string>>;
  focusContexts: Partial<Record<Goal, string>>;
};
type Recommendation = {
  id: string;
  category: string;
  title: string;
  detail: string;
  why: string;
  cadence: string;
  review: string;
  priority: string;
};
type ChatMessage = { role: "user" | "coach"; text: string };

function scrollToTop() {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
}

const initialProfile: Profile = {
  timeline: "",
  timelinePurpose: "",
  skipped: [],
  targetDate: "",
  timeframe: "",
  goals: [],
  concern: "",
  dryness: "",
  washFrequency: "",
  currentProducts: "",
  heat: "",
  color: "",
  hairChange: "",
  sensitivity: "",
  shedding: "",
  timeAvailable: "",
  budget: "",
  approach: "",
  focusNotes: {},
  focusContexts: {},
};

const goalChoices: Array<{ id: Goal; icon: string; title: string; description: string }> = [
  { id: "skin", icon: "◌", title: "Face & skin", description: "How your skin looks or feels" },
  { id: "hair", icon: "⌁", title: "Hair", description: "Dryness, shine, breakage or routine" },
  { id: "body", icon: "↗", title: "Body & fitness", description: "Strength, movement or how you feel" },
  { id: "energy", icon: "✳", title: "Energy & lifestyle", description: "Daily energy or routines" },
  { id: "other", icon: "+", title: "Something else", description: "Describe your own focus" },
];

const focusQuestions: Record<Goal, { title: string; prompt: string; context: string }> = {
  hair: { title: "Let’s understand your hair", prompt: "When do you notice dryness most: after washing, between washes, or after styling?", context: "What have you tried, or what seems to make it feel better or worse?" },
  skin: { title: "Let’s understand your skin concern", prompt: "When do you notice it most, and has anything changed recently?", context: "What is your current routine, or what have you already tried?" },
  body: { title: "Let’s understand what matters to you", prompt: "Which matters most right now: strength, endurance, energy, or how movement feels?", context: "What kinds of movement do you enjoy, and what tends to get in the way?" },
  energy: { title: "Let’s understand your day", prompt: "When do you notice your energy changing most?", context: "What does a typical day look like around rest, meals or activity? Share only what feels comfortable." },
  other: { title: "Tell us what matters", prompt: "When does this concern affect you most?", context: "What have you already tried, or what would a helpful change look like?" },
};

function buildRecommendations(profile: Profile, simplified: boolean): Recommendation[] {
  const selectedGoals: Goal[] = profile.goals.length > 0 ? profile.goals : ["other"];
  const itemsByGoal = new Map<Goal, Recommendation[]>();

  if (selectedGoals.includes("hair")) {
    const hairItems: Recommendation[] = [{
      id: "hair-inventory",
      category: "Hair · starting point",
      title: profile.currentProducts.trim() ? "Review what you already use" : "Note what you use on wash day",
      detail: profile.currentProducts.trim()
        ? "Review when you use the products you listed. Keep the routine as it is for now; there is no need to add or replace anything."
        : "If you feel comfortable, note the products you use and when. This is an observation, not a suggestion to buy anything.",
      why: profile.currentProducts.trim()
        ? `You mentioned “${profile.currentProducts.trim().slice(0, 80)}${profile.currentProducts.trim().length > 80 ? "…" : ""}”.`
        : "You have not listed products yet, so this starts with observation rather than guessing.",
      cadence: "Once · 3 minutes",
      review: "Today",
      priority: "First step",
    }];
    hairItems.push(profile.heat === "Often" || profile.heat === "Most wash days" ? {
      id: "hair-heat",
      category: "Hair · routine to review",
      title: "Notice how heat styling fits your routine",
      detail: "Next time you style, notice when and how you use heat. You can choose whether you want to change anything; this preview does not assume heat is the cause.",
      why: `You said you use heat ${profile.heat.toLowerCase()}. That makes it a possible factor to explore, not an established cause.`,
      cadence: "Next styling day",
      review: "At your next check-in",
      priority: "Worth exploring",
    } : {
      id: "hair-observe",
      category: "Hair · observation",
      title: "Notice when the dryness appears",
      detail: "When you next notice dryness, make a brief note of what was happening. Keep the rest of your routine familiar for now.",
      why: profile.washFrequency ? `You wash about ${profile.washFrequency.toLowerCase()}; the timing may help guide a useful follow-up.` : "Your wash frequency is not known, so we are not assuming a routine.",
      cadence: "When you next notice it",
      review: "At your next check-in",
      priority: "Low effort",
    });
    const explicitlyLacksConditioner = /(?:\b(?:no|not|without|never|don't|do not)\b.{0,40}\bcondition(?:er|ing)\b|\bcondition(?:er|ing)\b.{0,30}\b(?:not|never|rarely|seldom)\b)/i.test(profile.currentProducts);
    const mentionsConditioner = /condition(er|ing)/i.test(profile.currentProducts) && !explicitlyLacksConditioner;
    hairItems.push(mentionsConditioner ? {
      id: "hair-observe-response",
      category: "Hair · progress note",
      title: "Keep a simple softness note",
      detail: "After your usual wash, note softness or manageability in your own words. No score or photo is needed.",
      why: "You listed a conditioning product; first notice how your existing routine feels before adding another step.",
      cadence: "Once this week",
      review: "At the weekly check-in",
      priority: "Easy to track",
    } : {
      id: "hair-conditioner-check",
      category: "Hair · explore what you own",
      title: "Check what conditioning products you already have",
      detail: "If you wish, check whether you already own a conditioner or leave-in and how you use it. No purchase is suggested.",
      why: profile.currentProducts.trim() ? "Your product notes do not clearly mention a conditioner; we do not know whether you use one." : "You have not listed products yet, so we do not know what you use.",
      cadence: "Once · 2 minutes",
      review: "This week",
      priority: "Optional check",
    });
    itemsByGoal.set("hair", hairItems);
  }

  const nonHairMeta: Record<Exclude<Goal, "hair">, { label: string; title: string; detail: string }> = {
    skin: { label: "Face & skin", title: "Clarify what you notice most", detail: "Note when you notice this and what you already do. This preview does not assess skin conditions or suggest treatments." },
    body: { label: "Body & fitness", title: "Define what progress means to you", detail: "Write down a practical change you would notice. This preview does not set a weight target or prescribe exercise." },
    energy: { label: "Energy & lifestyle", title: "Notice the pattern you described", detail: "Reflect on when this tends to happen. This preview does not monitor your health or infer a medical cause." },
    other: { label: "Your focus", title: "Clarify what a helpful change looks like", detail: "Capture one detail that matters to you. Your own description can guide a relevant follow-up." },
  };
  for (const goal of selectedGoals) {
    if (goal === "hair") continue;
    const meta = nonHairMeta[goal];
    const note = profile.focusNotes[goal]?.trim();
    itemsByGoal.set(goal, [{
      id: `explore-${goal}`,
      category: `${meta.label} · discovery`,
      title: meta.title,
      detail: meta.detail,
      why: note ? `You told us: “${note.slice(0, 140)}${note.length > 140 ? "…" : ""}”.` : "You selected this focus but have not added details yet. We will not guess what is causing it.",
      cadence: "Once · 2 minutes",
      review: "Before considering next steps",
      priority: "Your chosen focus",
    }]);
  }

  const items = selectedGoals.length > 1
    ? selectedGoals.map((goal) => itemsByGoal.get(goal)?.[0]).filter((item): item is Recommendation => Boolean(item))
    : itemsByGoal.get(selectedGoals[0]) ?? [];
  return simplified ? items.slice(0, 2) : items;
}

function dateLabel(profile: Profile) {
  if (!profile.timeline) return profile.skipped.includes("timeline") ? "Timeline skipped" : "No timeline chosen";
  if (profile.timeline === "none") return "Ongoing journey · no deadline";
  if (profile.timeline === "range") return `${profile.timeframe || "Timeframe not specified"}${profile.timelinePurpose ? ` · ${profile.timelinePurpose === "event" ? "event" : profile.timelinePurpose === "long-term" ? "long-term goal" : "ongoing"}` : ""}`;
  if (!profile.targetDate) return "Target date not specified";
  const formattedDate = new Date(`${profile.targetDate}T12:00:00`).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
  return `${formattedDate}${profile.timelinePurpose ? ` · ${profile.timelinePurpose === "event" ? "event" : profile.timelinePurpose === "long-term" ? "long-term goal" : "personal date"}` : ""}`;
}

function focusSummary(profile: Profile) {
  const focuses: Goal[] = profile.goals.length ? profile.goals : ["other"];
  return focuses.map((goal) => {
    const title = goalChoices.find((item) => item.id === goal)?.title ?? "Your focus";
    const note = profile.focusNotes[goal]?.trim();
    if (goal === "hair") {
      const details = [
        profile.dryness ? `dryness around ${profile.dryness.toLowerCase()}` : "",
        profile.heat ? `heat styling ${profile.heat.toLowerCase()}` : "",
        profile.washFrequency ? `washing ${profile.washFrequency.toLowerCase()}` : "",
      ].filter(Boolean);
      return details.length ? `${title}: ${details.join(", ")}.` : `${title}: some routine details are still open.`;
    }
    return note ? `${title}: “${note.slice(0, 100)}${note.length > 100 ? "…" : ""}”.` : `${title}: details are still open.`;
  }).join(" ");
}

function AppHeader({ onHome, onReset, showReset }: { onHome: () => void; onReset: () => void; showReset: boolean }) {
  return (
    <header className="topbar">
      <button className="brand" onClick={onHome} aria-label={`${brand.name} home`}>
        <span className="brand-mark" aria-hidden="true">R</span>
        <span className="brand-name">{brand.name}</span>
      </button>
      <div className="topbar-right">
        <span className="local-label" title="This prototype runs in your browser only"><i className="local-dot" />Local preview</span>
        {showReset && <button className="top-link" onClick={onReset}>Start over</button>}
      </div>
    </header>
  );
}

function Onboarding({
  profile,
  setProfile,
  onFinish,
  onExit,
}: {
  profile: Profile;
  setProfile: (update: (current: Profile) => Profile) => void;
  onFinish: () => void;
  onExit: () => void;
}) {
  const [step, setStep] = useState(0);
  const [message, setMessage] = useState("");
  const [activeFocus, setActiveFocus] = useState<Goal>(profile.goals[0] ?? "other");
  const selectedFocuses: Goal[] = profile.goals.length > 0 ? profile.goals : ["other"];
  const activeGoal = selectedFocuses.includes(activeFocus) ? activeFocus : selectedFocuses[0];
  const activeQuestions = focusQuestions[activeGoal];
  const nextUnansweredFocus = (after: Goal) => {
    const currentIndex = selectedFocuses.indexOf(after);
    return selectedFocuses.slice(currentIndex + 1).find((goal) =>
      !profile.focusNotes[goal]?.trim()
      && !profile.focusContexts[goal]?.trim()
      && !profile.skipped.includes(`focus-${goal}`),
    );
  };
  const labels = ["Your timeline", "Your focus", "Your routine", "Your preferences"];
  useEffect(() => {
    scrollToTop();
  }, [step]);
  const update = <K extends keyof Profile>(key: K, value: Profile[K]) => setProfile((current) => ({
    ...current,
    [key]: value,
    skipped: current.skipped.filter((item) => item !== key),
  }));
  const forward = () => {
    setMessage("");
    if (step === 0 && !profile.timeline) {
      setMessage("Choose a date, timeframe, or no deadline. You can also skip this question for now.");
      return;
    }
    if (step === 1 && profile.goals.length === 0 && !profile.concern.trim()) {
      setMessage("Choose the hair journey or describe what you would like help with.");
      return;
    }
    if (step === 2) {
      const hasFocusNote = Boolean(profile.focusNotes[activeGoal]?.trim() || profile.focusContexts[activeGoal]?.trim());
      if (!hasFocusNote && !profile.skipped.includes(`focus-${activeGoal}`)) {
        setMessage("Add a short note, share optional context, or skip this focus to continue.");
        return;
      }
      const nextFocus = nextUnansweredFocus(activeGoal);
      if (nextFocus) {
        setActiveFocus(nextFocus);
        setMessage("");
        scrollToTop();
        return;
      }
    }
    if (step < 3) setStep((current) => current + 1);
    else onFinish();
  };
  const back = () => {
    setMessage("");
    if (step === 0) onExit();
    else setStep((current) => current - 1);
  };
  const toggleGoal = (goal: Goal) => {
    const nextGoals = profile.goals.includes(goal) ? profile.goals.filter((item) => item !== goal) : [...profile.goals, goal];
    update("goals", nextGoals);
    if (nextGoals.length > 0 && !nextGoals.includes(activeFocus)) setActiveFocus(nextGoals[0]);
  };
  const skipCurrentStep = () => {
    const stepFields = [
      ["timeline", "targetDate", "timeframe"],
      ["goals", "concern"],
      ["dryness", "washFrequency", "currentProducts", "heat", "color", "hairChange"],
      ["timeAvailable", "budget", "approach"],
    ];
    setProfile((current) => {
      const unanswered = (stepFields[step] ?? []).filter((field) => {
        const value = current[field as keyof Profile];
        return Array.isArray(value) ? value.length === 0 : !value;
      });
      if (step === 2 && !current.focusNotes[activeGoal] && !current.focusContexts[activeGoal]) unanswered.push(`focus-${activeGoal}`);
      if (step === 3 && current.goals.some((goal) => goal === "hair" || goal === "skin") && !current.sensitivity) unanswered.push("sensitivity");
      return { ...current, skipped: [...new Set([...current.skipped, ...unanswered])] };
    });
    setMessage("");
    if (step === 2) {
      const nextFocus = nextUnansweredFocus(activeGoal);
      if (nextFocus) {
        setActiveFocus(nextFocus);
        scrollToTop();
        return;
      }
    }
    if (step < 3) setStep((current) => current + 1);
    else onFinish();
  };

  return (
    <main className="onboarding-shell">
      <div className="step-meta"><span>YOUR FIRST PERSONAL PLAN</span><span>0{step + 1} / 04 · {labels[step]}</span></div>
      <div className="progress-track" aria-label={`Step ${step + 1} of 4`}><div className="progress-value" style={{ width: `${((step + 1) / 4) * 100}%` }} /></div>

      <section className="step-content" key={step}>
        {step === 0 && <>
          <span className="eyebrow">A LITTLE CONTEXT FIRST</span>
          <h1 className="step-title">A date you want to work toward?</h1>
          <p className="step-copy">Choose a target—or keep it open. We’ll plan at a realistic pace.</p>
          <div className="choice-grid">
            <button className={`choice-card ${profile.timeline === "date" ? "selected" : ""}`} onClick={() => setProfile((current) => ({ ...current, timeline: "date", timelinePurpose: "", skipped: current.skipped.filter((item) => item !== "timeline") }))}><span className="choice-icon">⌑</span><span><strong>I have a date in mind</strong><small>An event, trip or personal milestone</small></span></button>
            <button className={`choice-card ${profile.timeline === "range" ? "selected" : ""}`} onClick={() => setProfile((current) => ({ ...current, timeline: "range", timelinePurpose: "", skipped: current.skipped.filter((item) => item !== "timeline") }))}><span className="choice-icon">↗</span><span><strong>A rough timeframe</strong><small>For example, over the next few months</small></span></button>
            <button className={`choice-card ${profile.timeline === "none" ? "selected" : ""}`} onClick={() => setProfile((current) => ({ ...current, timeline: "none", timelinePurpose: "ongoing", skipped: current.skipped.filter((item) => item !== "timeline") }))}><span className="choice-icon">∞</span><span><strong>No specific deadline</strong><small>Let’s make this sustainable</small></span></button>
          </div>
          {profile.timeline === "date" && <div className="form-grid">
            <label><span className="form-label">Your target date</span><input className="input" type="date" value={profile.targetDate} min={new Date().toISOString().slice(0, 10)} onChange={(event) => update("targetDate", event.target.value)} /></label>
            <label><span className="form-label">What is the date for?</span><select className="select" aria-label="Type of target date" value={profile.timelinePurpose} onChange={(event) => update("timelinePurpose", event.target.value)}><option value="">Choose one (optional)</option><option value="event">An event or milestone</option><option value="long-term">A longer-term personal goal</option><option value="other">Something else</option></select></label>
          </div>}
          {profile.timeline === "range" && <div className="form-grid"><label><span className="form-label">What feels like a useful horizon?</span><select className="select" value={profile.timeframe} onChange={(event) => update("timeframe", event.target.value)}><option value="">Choose a timeframe (optional)</option><option>About 2–4 weeks</option><option>About 1–3 months</option><option>About 3–6 months</option><option>Longer-term, 6+ months</option></select></label><label><span className="form-label">What is this timeline for?</span><select className="select" value={profile.timelinePurpose} onChange={(event) => update("timelinePurpose", event.target.value)}><option value="">Choose one (optional)</option><option value="event">An event or milestone</option><option value="long-term">A longer-term personal goal</option><option value="ongoing">An ongoing journey</option></select></label></div>}
          <p className="field-hint">A timeline helps us plan reviews. It cannot guarantee a particular result by a certain date.</p>
        </>}

        {step === 1 && <>
          <span className="eyebrow">START WITH WHAT MATTERS TO YOU</span>
          <h1 className="step-title">What feels worth focusing on?</h1>
          <p className="step-copy">Choose one or more. We’ll ask about each focus next.</p>
          <div className="choice-grid focus-grid">
            {goalChoices.map((goal) => <button key={goal.id} className={`choice-card ${profile.goals.includes(goal.id) ? "selected" : ""}`} onClick={() => toggleGoal(goal.id)} aria-pressed={profile.goals.includes(goal.id)}>
              <span className="choice-icon">{goal.icon}</span><span><strong>{goal.title}</strong><small>{goal.description}</small></span>
            </button>)}
          </div>
          <label><span className="form-label">Anything else you’d like us to know? <span className="optional-inline">Optional</span></span><textarea className="textarea focus-note" value={profile.concern} onChange={(event) => update("concern", event.target.value)} placeholder="Tell us in your own words…" maxLength={600} /></label>
        </>}

        {step === 2 && <>
          <span className="eyebrow">A FEW QUESTIONS ABOUT YOU</span>
          <h1 className="step-title">Let’s understand your focus.</h1>
          <p className="step-copy">One focus at a time. Your answers shape what comes next.</p>
          {selectedFocuses.length > 1 && <div className="focus-tabs" role="tablist" aria-label="Selected focus areas">{selectedFocuses.map((goal) => <button key={goal} role="tab" aria-selected={activeGoal === goal} className={`focus-tab ${activeGoal === goal ? "active" : ""}`} onClick={() => { setActiveFocus(goal); scrollToTop(); }}>{goalChoices.find((item) => item.id === goal)?.title ?? "Your focus"}</button>)}</div>}
          <div className="focus-panel" key={activeGoal}>
            <h2 className="question-title">{activeQuestions.title}</h2>
            <label><span className="form-label">{activeQuestions.prompt}</span><textarea className="textarea focus-note" value={profile.focusNotes[activeGoal] ?? ""} onChange={(event) => setProfile((current) => ({ ...current, focusNotes: { ...current.focusNotes, [activeGoal]: event.target.value }, skipped: current.skipped.filter((item) => item !== `focus-${activeGoal}`) }))} placeholder="A short note is enough…" maxLength={500} /></label>
            <details className="optional-details focus-context">
              <summary>A little more context <span>Optional</span></summary>
              <label><span className="form-label">{activeQuestions.context}</span><textarea className="textarea focus-note" value={profile.focusContexts[activeGoal] ?? ""} onChange={(event) => setProfile((current) => ({ ...current, focusContexts: { ...current.focusContexts, [activeGoal]: event.target.value } }))} placeholder="Share only what feels useful…" maxLength={500} /></label>
            </details>
          </div>
          {activeGoal === "hair" && <>
          <div className="question-block hair-questions">
            <h2 className="question-title">Where does your hair feel driest?</h2><p className="question-caption">Choose the closest fit; you can select more than one.</p>
            <div className="segmented">{["Roots", "Lengths", "Ends", "All over", "Not sure"].map((value) => {
              const selected = profile.dryness.split(", ").includes(value);
              return <button type="button" key={value} className={`segment ${selected ? "selected" : ""}`} aria-pressed={selected} onClick={() => {
                const current = profile.dryness.split(", ").filter(Boolean);
                const next = selected ? current.filter((item) => item !== value) : [...current.filter((item) => item !== "Not sure"), value];
                update("dryness", next.join(", "));
              }}>{value}</button>;
            })}</div>
          </div>
          <div className="form-grid">
            <label><span className="form-label">How often do you wash it?</span><select className="select" value={profile.washFrequency} onChange={(event) => update("washFrequency", event.target.value)}><option value="">Choose if you wish</option><option>Daily</option><option>2–3 times a week</option><option>Once a week</option><option>Less than once a week</option><option>It varies</option></select></label>
            <label><span className="form-label">How often do you use heat?</span><select className="select" value={profile.heat} onChange={(event) => update("heat", event.target.value)}><option value="">Choose if you wish</option><option>Never</option><option>Sometimes</option><option>Often</option><option>Most wash days</option></select></label>
          </div>
          <details className="optional-details">
            <summary>Products &amp; treatments <span>Optional</span></summary>
            <label><span className="form-label">What products do you use?</span><textarea className="textarea" style={{ minHeight: 70 }} value={profile.currentProducts} onChange={(event) => update("currentProducts", event.target.value)} placeholder="Names or types—or leave blank." maxLength={500} /></label>
            <div className="form-grid optional-fields">
              <label><span className="form-label">Colour or chemical treatments?</span><select className="select" value={profile.color} onChange={(event) => update("color", event.target.value)}><option value="">Not answered</option><option>No</option><option>Colour or dye</option><option>Bleach/lightening</option><option>Other</option><option>Prefer not to say</option></select></label>
              <label><span className="form-label">Recent routine change?</span><select className="select" value={profile.hairChange} onChange={(event) => update("hairChange", event.target.value)}><option value="">Not answered</option><option>No recent change</option><option>Changed products</option><option>Changed styling or wash routine</option><option>Not sure</option></select></label>
            </div>
          </details>
          </>}
        </>}

        {step === 3 && <>
          <span className="eyebrow">A PLAN THAT FITS YOUR LIFE</span>
          <h1 className="step-title">What feels doable?</h1>
          <p className="step-copy">Tell us what fits your time and comfort. Skip any question.</p>
          {profile.goals.some((goal) => goal === "hair" || goal === "skin") && <div className="question-block">
            <h2 className="question-title">Any sensitivity or reaction we should know about?</h2>
            <p className="question-caption">This is optional. We will not assume an ingredient is suitable for you.</p>
            <div className="segmented">{["No known sensitivity", "I have had reactions", "Not sure", "Prefer to skip"].map((value) => <button key={value} className={`segment ${profile.sensitivity === value ? "selected" : ""}`} onClick={() => update("sensitivity", value)} aria-pressed={profile.sensitivity === value}>{value}</button>)}</div>
          </div>}
          <div className="form-grid">
            <label><span className="form-label">How much time feels manageable?</span><select className="select" value={profile.timeAvailable} onChange={(event) => update("timeAvailable", event.target.value)}><option value="">Choose if you wish</option><option>Under 5 minutes</option><option>5–10 minutes</option><option>10–20 minutes</option><option>It depends on the day</option></select></label>
            <label><span className="form-label">What would you like to prioritize?</span><select className="select" value={profile.approach} onChange={(event) => update("approach", event.target.value)}><option value="">Choose if you wish</option><option>At-home routine first</option><option>Use what I already own</option><option>Open to professional advice</option><option>A balanced mix</option></select></label>
          </div>
          <details className="optional-details preference-details">
            <summary>Budget preference <span>Optional</span></summary>
            <label><span className="form-label">What budget feels comfortable?</span><select className="select" value={profile.budget} onChange={(event) => update("budget", event.target.value)}><option value="">Not answered</option><option>Prefer to use what I own</option><option>Keep any changes low-cost</option><option>Open to a considered purchase</option><option>I would rather not say</option></select></label>
          </details>
          <div className="demo-banner"><span aria-hidden="true">✳</span><span><strong>Optional context only.</strong> This preview does not diagnose, prescribe, or recommend supplements. Share only what feels relevant to your selected focus.</span></div>
        </>}
      </section>

      {message && <p className="inline-message" role="alert">{message}</p>}
      <footer className="form-footer">
        <button className="button-text" onClick={back}>{step === 0 ? "← Back to introduction" : "← Back"}</button>
        <div className="form-footer-right">
          {step > 0 && <button className="skip-link" onClick={skipCurrentStep}>Skip for now</button>}
          <button className="button" onClick={forward}>{step === 3 ? "See my analysis" : "Continue"}<span className="arrow">→</span></button>
        </div>
      </footer>
    </main>
  );
}

function Analysis({ profile, onContinue, onEdit }: { profile: Profile; onContinue: () => void; onEdit: () => void }) {
  const focuses: Goal[] = profile.goals.length ? profile.goals : ["other"];
  const opportunities: Record<Goal, string> = {
    hair: profile.heat === "Often" || profile.heat === "Most wash days"
      ? "You mentioned frequent heat styling. It may be worth reviewing, but your answers do not establish it as the cause."
      : "We do not yet have enough detail to identify a likely contributor. Notice when dryness appears before changing several things.",
    skin: "We do not yet know what is contributing to your skin concern. Your description can guide a relevant follow-up; this preview does not assess skin conditions or treatments.",
    body: "We do not yet know which movement or routine changes would fit your situation. Start from the goal and barriers you described, without assuming a target.",
    energy: "We do not yet know what is behind the energy pattern you described. This preview does not infer a health cause or monitor your routine.",
    other: "Your focus is personal to you. A little more context would help shape a useful next question; we will not guess the cause.",
  };
  const facts = [
    profile.concern.trim() ? `You described: “${profile.concern.trim().slice(0, 160)}${profile.concern.trim().length > 160 ? "…" : ""}”` : "",
    ...focuses.flatMap((goal) => [profile.focusNotes[goal] ? `${goalChoices.find((item) => item.id === goal)?.title}: ${profile.focusNotes[goal]}` : "", profile.focusContexts[goal] ? `More context (${goalChoices.find((item) => item.id === goal)?.title}): ${profile.focusContexts[goal]}` : ""]),
    ...(focuses.includes("hair") ? [
      profile.dryness ? `Dryness: ${profile.dryness.toLowerCase()}.` : "",
      profile.washFrequency ? `Wash frequency: ${profile.washFrequency.toLowerCase()}.` : "",
      profile.heat ? `Heat styling: ${profile.heat.toLowerCase()}.` : "",
      profile.currentProducts.trim() ? `Products: ${profile.currentProducts.trim().slice(0, 100)}${profile.currentProducts.trim().length > 100 ? "…" : ""}` : "",
    ] : []),
  ].filter(Boolean);
  const hairMissing = focuses.includes("hair") ? [
    ["dryness", "where you notice dryness"],
    ["washFrequency", "how often you wash your hair"],
    ["heat", "how often you use heat styling"],
    ["currentProducts", "the products you currently use"],
  ] : [];
  const focusMissing = focuses.map((goal) => [`focus-${goal}`, `more about ${goalChoices.find((item) => item.id === goal)?.title.toLowerCase()}`]);
  const missingFacts = [...hairMissing, ...focusMissing]
    .filter(([key]) => {
      const goal = key.startsWith("focus-") ? key.replace("focus-", "") as Goal : null;
      return !(profile[key as keyof Profile] || (goal ? profile.focusNotes[goal] || profile.focusContexts[goal] : ""));
    })
    .map(([key, label]) => `${profile.skipped.includes(key) ? "Skipped" : "Not answered"}: ${label}`);
  const opportunityList = focuses.map((goal) => ({ goal, text: opportunities[goal] }));

  return (
    <main className="analysis-shell">
      <div className="analysis-heading"><span className="eyebrow">YOUR PERSONAL READOUT · PREVIEW</span><h1 className="display" style={{ fontSize: "clamp(40px,6vw,62px)" }}>A clearer<br /><em>starting point.</em></h1><p className="lede">Your answers, possible opportunities, and what remains unknown.</p></div>
      <div className="analysis-grid">
        <article className="analysis-card"><div className="card-kicker"><span className="kicker-mark">◎</span>Reported by you <span className="kind-tag">Your answers</span></div><h3>Your starting point</h3>{facts.length > 0 ? <ul>{facts.map((fact) => <li key={fact}><span className="bullet">·</span><span>{fact}</span></li>)}</ul> : <p>You have not shared details yet. You can review the questions or continue with a general preview.</p>}</article>
        {opportunityList.map(({ goal, text }) => <article className="analysis-card" key={goal}><div className="card-kicker"><span className="kicker-mark">↗</span>{goalChoices.find((item) => item.id === goal)?.title} <span className="kind-tag hypothesis">To explore</span></div><h3>A useful next question</h3><p>{text}</p></article>)}
        <article className="analysis-card wide"><div className="card-kicker"><span className="kicker-mark">…</span>Not yet known <span className="kind-tag missing">Open questions</span></div><h3>What remains uncertain</h3><p>{missingFacts.length ? missingFacts.join(" · ") : "Some context may still be missing."} We have not established a cause or assessed a health condition. Nothing is passively monitored; this preview uses only what you chose to share.</p></article>
      </div>
      <div className="form-footer"><button className="button-text" onClick={onEdit}>← Review my answers</button><button className="button" onClick={onContinue}>View my first plan <span className="arrow">→</span></button></div>
    </main>
  );
}

function DemoBanner() {
  return <div className="demo-banner"><span aria-hidden="true">✳</span><span><strong>Prototype preview.</strong> Plan suggestions use simple local rules and illustrative content, not an AI provider or reviewed clinical evidence. Nothing is saved or sent from this browser.</span></div>;
}

function Dashboard({
  profile,
  simplified,
  setSimplified,
  safetyPause,
  setSafetyPause,
  reviewNote,
  setReviewNote,
}: {
  profile: Profile;
  simplified: boolean;
  setSimplified: (value: boolean) => void;
  safetyPause: boolean;
  setSafetyPause: (value: boolean) => void;
  reviewNote: string;
  setReviewNote: (value: string) => void;
}) {
  const [tab, setTab] = useState<AppTab>("today");
  const [done, setDone] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: "coach", text: "I’m a local prototype coach, not a live AI. I can help you explore this demo plan. What would you like to make easier?" },
  ]);
  useEffect(() => {
    scrollToTop();
  }, [tab]);
  const recommendations = useMemo(() => buildRecommendations(profile, simplified), [profile, simplified]);
  const activeRecommendations = safetyPause ? recommendations.filter((item) => item.id === "inventory") : recommendations;
  const toggleDone = (id: string) => setDone((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const toggleExpanded = (id: string) => setExpanded((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const selectTab = (value: AppTab) => {
    setTab(value);
    scrollToTop();
  };

  const applyFeedback = () => {
    if (feedback === "less-time") {
      setSimplified(true);
      setReviewNote("We simplified the preview to two low-effort actions. Your plan stays editable; this is a local demo adjustment.");
    } else if (feedback === "reaction") {
      setSafetyPause(true);
      setReviewNote("We paused routine-change suggestions in this preview. If a real product causes a concerning or persistent reaction, stop using it and seek advice from a qualified professional.");
    } else if (feedback === "no-change") {
      setReviewNote("We have noted that you have not noticed a change. This preview will not claim a cause or escalate products; review what you tried before deciding on a next step.");
    } else if (feedback === "working") {
      setReviewNote("Good to know. We will keep the current preview plan steady rather than adding extra steps automatically.");
    }
    setShowFeedback(false);
    setTab("today");
  };

  const submitChat = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const question = chatInput.trim();
    if (!question) return;
    const lower = question.toLowerCase();
    const currentGoal = profile.goals[0] ?? "other";
    const goalName = goalChoices.find((item) => item.id === currentGoal)?.title.toLowerCase() ?? "your focus";
    let answer = `This is a local demo, so I can only refer to what you shared about ${goalName} and the sample plan. We do not yet know the cause. A useful next step is to clarify what you notice and what feels manageable.`;
    if (/cheap|budget|cost|expensive/i.test(lower)) answer = `You chose “${profile.budget}”. The current plan starts with reviewing what you already own, so it does not require a purchase. We can compare product options in a later, evidence-reviewed version.`;
    else if (/miss|forgot|busy|time|simpl/i.test(lower)) answer = "Missing a day is not a failure. Your plan is a guide, not a streak. We can keep just the first low-effort action this week; use “Adjust plan” to see the simplified preview.";
    else if (/irrit|reaction|itch|burn|rash/i.test(lower)) answer = "This prototype cannot assess a reaction. Avoid adding another new product based on this chat. For a concerning or persistent reaction, stop the product and seek advice from a qualified professional.";
    else if (currentGoal === "hair" && /why|heat|dry/i.test(lower)) answer = profile.heat === "Often" || profile.heat === "Most wash days"
      ? `You reported heat use ${profile.heat.toLowerCase()}, so the plan treats it as a possible factor worth reviewing—not a proven cause. The first step is a small observation, not a promise.`
      : "Your answers do not establish why your hair feels dry. We start by noticing when it happens and reviewing your existing routine rather than guessing.";
    setChatMessages((current) => [...current, { role: "user", text: question }, { role: "coach", text: answer }]);
    setChatInput("");
  };

  return (
    <main className="dashboard-layout">
      <aside className="sidebar">
        <p className="sidebar-intro">YOUR SPACE · PRIVATE PREVIEW</p>
        <nav className="side-nav" aria-label="Main navigation">
          {(["today", "plan", "progress", "coach"] as AppTab[]).map((value) => {
            const label = value === "today" ? "Today" : value === "plan" ? "My plan" : value === "progress" ? "Progress" : "Ask your coach";
            const icon = value === "today" ? "⌂" : value === "plan" ? "▤" : value === "progress" ? "◷" : "✳";
            return <button key={value} className={tab === value ? "active" : ""} onClick={() => selectTab(value)} aria-current={tab === value ? "page" : undefined}><span className="side-icon" aria-hidden="true">{icon}</span>{label}</button>;
          })}
        </nav>
        <div className="sidebar-bottom"><strong>Care, at your pace.</strong><p>No streaks. No pressure to buy. You choose what fits.</p></div>
      </aside>

      <section className="dashboard-main">
        <header className="dashboard-head">
          <div><span className="eyebrow">YOUR PERSONAL CARE PLAN</span><h1>{tab === "today" ? "A thoughtful place to start." : tab === "plan" ? "Your first priorities." : tab === "progress" ? "Notice what changes." : "A little guidance, when you need it."}</h1><p>{tab === "today" ? "A few actions, shaped around your answers." : tab === "plan" ? "A small plan, with a reason for each step." : tab === "progress" ? "Your observations, not a score." : "A local preview using this session’s answers."}</p></div>
          <span className="date-chip">{dateLabel(profile)}</span>
        </header>

        {reviewNote && <div className="personal-note" role="status"><span className="spark">✳</span><p><strong>Plan adjusted from your feedback.</strong><br />{reviewNote}</p><button className="button-text" onClick={() => setReviewNote("")} aria-label="Dismiss update">×</button></div>}
        {safetyPause && <div className="personal-note" role="alert"><span className="spark">!</span><p><strong>Routine suggestions paused.</strong><br />Only a neutral product-list review is shown while you consider what feels right.</p></div>}

        {tab === "today" && <div className="tab-panel">
          <div className="personal-note"><span className="spark">✳</span><p><strong>Why this plan starts here</strong><br />{focusSummary(profile)}</p></div>
          <section className="today-card">
            <div className="section-head"><div><h2>Today’s gentle starts</h2><small>A few useful actions · no streaks</small></div><span className="kind-tag">{done.length}/{activeRecommendations.length} complete</span></div>
            {activeRecommendations.length === 0 ? <p className="empty-actions">No active actions. Your plan is paused while you review your feedback.</p> : <div className="action-list">{activeRecommendations.map((item, index) => <div className="action-row" key={item.id}>
              <button className={`action-check ${done.includes(item.id) ? "done" : ""}`} onClick={() => toggleDone(item.id)} aria-label={`${done.includes(item.id) ? "Mark incomplete" : "Mark complete"}: ${item.title}`} aria-pressed={done.includes(item.id)}>{done.includes(item.id) ? "✓" : ""}</button>
              <div className="action-copy"><strong>{item.title}</strong><p>{item.detail}</p><button className="why-link" onClick={() => toggleExpanded(item.id)} aria-expanded={expanded.includes(item.id)}>{expanded.includes(item.id) ? "Hide why this fits" : "Why this fits you"}</button>{expanded.includes(item.id) && <div className="action-detail"><strong>Based on your answers:</strong> {item.why}<br /><strong>Review:</strong> {item.review} · {item.cadence}</div>}</div>
              <span className={`priority-tag ${index === 0 ? "top" : ""}`}>{item.priority}</span>
            </div>)}</div>}
            <div className="form-footer" style={{ marginTop: 9, paddingTop: 15 }}><button className="button-text" onClick={() => selectTab("plan")}>Explore the full plan →</button><button className="button button-secondary button-small" onClick={() => setShowFeedback(true)}>Adjust plan</button></div>
          </section>
          <div className="dashboard-grid">
            <article className="panel"><span className="eyebrow">THIS WEEK</span><h3>A routine you can return to</h3><p>We’ll check what felt manageable and whether your observations changed. If life gets busy, simplify—there is no penalty for missing a day.</p><div className="plan-strip"><span>Next review</span><span>After a week of trying what feels right</span></div></article>
            <article className="panel"><span className="eyebrow">YOUR PACE</span><div className="review-count"><strong>{done.length}</strong><span>actions completed<br />in this preview</span></div><div className="week-dots" aria-label={`${done.length} actions completed`}>{[0,1,2,3,4,5,6].map((day) => <span key={day} className={day < done.length ? "done" : ""} />)}</div><p style={{ marginTop: 12 }}>A reflection, not a score.</p></article>
          </div>
        </div>}

        {tab === "plan" && <div className="tab-panel plan-cards">{activeRecommendations.map((item, index) => <article className="recommendation-card" key={item.id}><div className="recommendation-top"><span className="eyebrow">0{index + 1} · {item.category}</span><span className={`priority-tag ${index === 0 ? "top" : ""}`}>{item.priority}</span></div><h3>{item.title}</h3><p>{item.detail}</p><div className="why-box"><strong>Why it fits your answers</strong><br />{item.why}</div><div className="plan-strip"><span>{item.cadence}</span><span>Review: {item.review}</span></div></article>)}<div className="panel"><h3>What this preview does not know</h3><p>It has not checked product ingredients, assessed a scalp condition or reviewed clinical evidence. Costly treatments and supplements are not part of this first plan. A future version will connect recommendations to reviewed sources.</p></div></div>}

        {tab === "progress" && <div className="tab-panel">
          <article className="panel"><span className="eyebrow">YOUR OWN OBSERVATIONS</span><h3>What would you like to notice?</h3><p>For this hair journey, a simple note about softness, manageability or breakage is enough. You do not need a score or a photo.</p><div className="question-block"><p className="question-caption">This week, how has your routine felt?</p><div className="segmented">{["Manageable", "A bit much", "Not tried yet"].map((value) => <button key={value} className={`segment ${reviewNote.includes(value) ? "selected" : ""}`} onClick={() => setReviewNote(value === "A bit much" ? "Your check-in says the routine felt like a bit much. Use Adjust plan to simplify it." : `Check-in noted: ${value.toLowerCase()}. You can review the plan whenever you like.`)}>{value}</button>)}</div></div><div className="plan-strip"><span>Your selected date</span><span>{dateLabel(profile)}</span></div></article>
          <article className="panel" style={{ marginTop: 14 }}><span className="eyebrow">NO AUTOMATIC MONITORING</span><h3>Only what you tell us</h3><p>This prototype has no connected health data, passive tracking, photo assessment, or saved history. Progress notes remain on this page until you leave or refresh.</p></article>
        </div>}

        {tab === "coach" && <div className="tab-panel">
          <article className="panel"><span className="eyebrow">LOCAL COACH PREVIEW</span><h3>Ask about the plan</h3><p>This is a deterministic demo response, not a live AI service. It refers only to the answers entered in this browser session.</p><div className="chat-box" aria-live="polite">{chatMessages.map((message, index) => <div className={`chat-message ${message.role === "user" ? "user" : ""}`} key={`${index}-${message.role}`}>{message.text}</div>)}</div><form className="chat-form" onSubmit={submitChat}><input className="input" value={chatInput} onChange={(event) => setChatInput(event.target.value)} placeholder="Could I make this simpler?" aria-label="Ask the demo coach" maxLength={300} /><button className="button button-small" type="submit">Ask</button></form><p className="chat-disclaimer">Do not enter health details here. Nothing is transmitted or saved.</p></article>
        </div>}
        <DemoBanner />
      </section>

      {showFeedback && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setShowFeedback(false)}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="feedback-title"><div className="modal-head"><div><span className="eyebrow">A QUICK CHECK-IN</span><h2 id="feedback-title">How should we adapt?</h2></div><button className="modal-close" onClick={() => setShowFeedback(false)} aria-label="Close">×</button></div><p className="modal-copy">There is no wrong answer. The plan should work around your life, not the other way around.</p><div className="feedback-options">{[
        ["less-time", "I have less time than I expected"],
        ["no-change", "I have not noticed a change yet"],
        ["reaction", "Something felt uncomfortable or caused a reaction"],
        ["working", "This feels manageable; keep it steady"],
      ].map(([value, label]) => <button key={value} className={`feedback-option ${feedback === value ? "selected" : ""}`} onClick={() => setFeedback(value)}>{label}</button>)}</div><div className="modal-actions"><button className="button button-secondary" onClick={() => setShowFeedback(false)}>Cancel</button><button className="button" disabled={!feedback} onClick={applyFeedback}>Update my preview</button></div></section></div>}
    </main>
  );
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("home");
  const [profile, setProfile] = useState<Profile>(initialProfile);
  const [simplified, setSimplified] = useState(false);
  const [safetyPause, setSafetyPause] = useState(false);
  const [reviewNote, setReviewNote] = useState("");
  useEffect(() => {
    scrollToTop();
  }, [screen]);

  const reset = () => {
    setProfile(initialProfile);
    setSimplified(false);
    setSafetyPause(false);
    setReviewNote("");
    setScreen("home");
    scrollToTop();
  };
  const start = () => {
    setProfile(initialProfile);
    setScreen("onboarding");
  };
  return <div className="app-frame">
    <AppHeader onHome={() => { setScreen("home"); scrollToTop(); }} onReset={reset} showReset={screen !== "home"} />
    {screen === "home" &&
      <main className="page-wrap">
        <section className="home-hero">
          <div className="hero-copy"><h1 className="display">Your goals.<br />Your lifestyle.<br /><em>Your transformation.</em></h1><button className="button" onClick={start}>Begin your journey <span className="arrow">↗</span></button></div>
        </section>
      </main>
    }
    {screen === "onboarding" && <Onboarding profile={profile} setProfile={setProfile} onExit={() => setScreen("home")} onFinish={() => setScreen("analysis")} />}
    {screen === "analysis" && <Analysis profile={profile} onContinue={() => setScreen("app")} onEdit={() => setScreen("onboarding")} />}
    {screen === "app" && <Dashboard profile={profile} simplified={simplified} setSimplified={setSimplified} safetyPause={safetyPause} setSafetyPause={setSafetyPause} reviewNote={reviewNote} setReviewNote={setReviewNote} />}
  </div>;
}
