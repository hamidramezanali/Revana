"use client";

import { useMemo, useState } from "react";
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
};

const goalChoices: Array<{ id: Goal; icon: string; title: string; description: string; enabled: boolean }> = [
  { id: "hair", icon: "⌁", title: "My hair", description: "Dryness, shine, breakage or routine", enabled: true },
  { id: "skin", icon: "◌", title: "My face & skin", description: "A future guided journey", enabled: false },
  { id: "body", icon: "↗", title: "My body & fitness", description: "A future guided journey", enabled: false },
  { id: "energy", icon: "✳", title: "Energy & lifestyle", description: "A future guided journey", enabled: false },
];

function buildRecommendations(profile: Profile, simplified: boolean): Recommendation[] {
  const items: Recommendation[] = [
    {
      id: "inventory",
      category: "Start here",
      title: profile.currentProducts.trim() ? "Review what you already use" : "Note what you use on wash day",
      detail: profile.currentProducts.trim()
        ? "Look at the products you listed and when you use them. Keep the routine as it is for now; there is no need to add or replace anything."
        : "If you feel comfortable, note the shampoo, conditioner or leave-in products you use and when. It is fine to leave this blank; no purchase is suggested.",
      why: profile.currentProducts.trim()
        ? `You mentioned “${profile.currentProducts.trim().slice(0, 90)}${profile.currentProducts.trim().length > 90 ? "…" : ""}”. Reviewing when you use these is a useful first step before considering anything new.`
        : "You have not listed your current products yet, so we are starting with observation rather than guessing or recommending a brand.",
      cadence: "Once · 3 minutes",
      review: "Today",
      priority: "First step",
    },
  ];

  if (profile.heat === "Often" || profile.heat === "Most wash days") {
    items.push({
      id: "heat",
      category: "Routine review",
      title: "Make one heat-styling session gentler",
      detail: "For one wash day, try air-drying for part of the time or using a lower comfortable setting. Follow the instructions for any styling product you already own.",
      why: `You said you use heat ${profile.heat.toLowerCase()}. That makes heat exposure worth reviewing as one possible contributor; it does not establish the cause of dryness.` ,
      cadence: "Try once this week",
      review: "At your next wash",
      priority: "High relevance",
    });
  } else {
    items.push({
      id: "wash-day",
      category: "Gentle experiment",
      title: profile.washFrequency ? "Notice how your hair feels after washing" : "Notice when the dryness appears",
      detail: "On your next wash, notice whether the dryness is present right away or develops later. Keep the rest of your routine familiar so the observation is easier to interpret.",
      why: profile.washFrequency
        ? `You wash about ${profile.washFrequency.toLowerCase()}. The timing of the dry feeling can help make the next conversation more specific, without assuming a cause.`
        : "You have not shared your wash frequency yet. The plan avoids assuming a routine and starts with a simple observation.",
      cadence: profile.washFrequency ? "Next wash day" : "When you next notice it",
      review: "After it dries",
      priority: "Low effort",
    });
  }

  const explicitlyLacksConditioner = /(?:\b(?:no|not|without|never|don't|do not)\b.{0,40}\bcondition(?:er|ing)\b|\bcondition(?:er|ing)\b.{0,30}\b(?:not|never|rarely|seldom)\b)/i.test(profile.currentProducts);
  const mentionsConditioner = /condition(er|ing)/i.test(profile.currentProducts) && !explicitlyLacksConditioner;
  if (!mentionsConditioner) {
    items.push({
      id: "conditioner",
      category: "Explore what you own",
      title: "Check whether you already have a conditioner",
      detail: "If one is already in your bathroom, review its label and how you use it before deciding whether anything needs to change. This plan does not ask you to buy a product.",
      why: profile.currentProducts.trim()
        ? "Your product notes did not clearly mention conditioner. We do not know whether you use one, so this is a question to check—not a conclusion that your routine is missing something."
        : "You have not listed products yet. We do not know whether you use conditioner, so this is a question to check—not a conclusion that your routine is missing something.",
      cadence: "Once · 2 minutes",
      review: "This week",
      priority: "Worth checking",
    });
  } else {
    items.push({
      id: "observe",
      category: "Progress note",
      title: "Keep a simple softness note",
      detail: "After your usual wash, note softness and manageability in your own words. One observation is enough; no score or photo is needed.",
      why: `You listed a conditioning product (${profile.currentProducts.trim().slice(0, 70)}${profile.currentProducts.trim().length > 70 ? "…" : ""}). First notice how your current routine feels before adding another step.`,
      cadence: "Once this week",
      review: "At the weekly check-in",
      priority: "Easy to track",
    });
  }

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

function AppHeader({ onHome, onReset, showReset }: { onHome: () => void; onReset: () => void; showReset: boolean }) {
  return (
    <header className="topbar">
      <button className="brand" onClick={onHome} aria-label={`${brand.name} home`}>
        <span className="brand-mark" aria-hidden="true">R</span>
        <span><span className="brand-name">{brand.name}</span><span className="brand-subtitle">{brand.descriptor}</span></span>
      </button>
      <div className="topbar-right">
        <span className="local-label" title="This prototype runs in your browser only"><i className="local-dot" />Local preview</span>
        {showReset && <button className="top-link" onClick={onReset}>Start over</button>}
      </div>
    </header>
  );
}

function ArtCard() {
  return (
    <div className="hero-art" aria-label="Sculptural illustration of flowing hair-like strands" role="img">
      <div className="art-glow" />
      <div className="art-orbit orbit-one" />
      <div className="art-orbit orbit-two" />
      <div className="art-orbit orbit-three" />
      <svg className="strand-art" viewBox="0 0 600 620" fill="none" aria-hidden="true">
        <path d="M70 566C191 452 155 286 286 176C369 107 479 91 555 44" stroke="#454E3A" strokeWidth="30" strokeLinecap="round" />
        <path d="M123 594C244 470 206 323 336 214C408 154 492 139 569 94" stroke="#7D846B" strokeWidth="19" strokeLinecap="round" />
        <path d="M172 612C292 499 259 368 376 271C436 222 502 205 583 159" stroke="#B8795F" strokeWidth="10" strokeLinecap="round" />
        <path d="M212 615C326 517 302 411 414 326C462 290 515 274 594 232" stroke="#D0B58C" strokeWidth="5" strokeLinecap="round" />
      </svg>
      <span className="art-caption">A considered kind of change</span>
      <div className="hero-card">
        <span className="hero-card-label">RENEVA · YOUR FIRST JOURNEY</span>
        <strong>Start with what’s real.</strong>
        <p>Your routine. Your pace. One thoughtful next step.</p>
      </div>
    </div>
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
  const labels = ["Your timeline", "Your focus", "Your routine", "Your preferences"];
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
    if (step < 3) setStep((current) => current + 1);
    else onFinish();
  };
  const back = () => {
    setMessage("");
    if (step === 0) onExit();
    else setStep((current) => current - 1);
  };
  const toggleGoal = (goal: Goal) => {
    if (goal !== "hair") return;
    update("goals", profile.goals.includes(goal) ? profile.goals.filter((item) => item !== goal) : [...profile.goals, goal]);
  };
  const skipCurrentStep = () => {
    const stepFields = [
      ["timeline", "targetDate", "timeframe"],
      ["goals", "concern"],
      ["dryness", "washFrequency", "currentProducts", "heat", "color", "hairChange"],
      ["sensitivity", "timeAvailable", "budget", "approach"],
    ];
    setProfile((current) => {
      const unanswered = (stepFields[step] ?? []).filter((field) => {
        const value = current[field as keyof Profile];
        return Array.isArray(value) ? value.length === 0 : !value;
      });
      return { ...current, skipped: [...new Set([...current.skipped, ...unanswered])] };
    });
    setMessage("");
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
          <p className="step-copy">Choose hair for this preview, or tell us in your own words.</p>
          <div className="choice-grid">
            {goalChoices.map((goal) => <button key={goal.id} disabled={!goal.enabled} className={`choice-card ${profile.goals.includes(goal.id) ? "selected" : ""} ${!goal.enabled ? "disabled" : ""}`} onClick={() => toggleGoal(goal.id)} aria-pressed={profile.goals.includes(goal.id)}>
              <span className="choice-icon">{goal.icon}</span><span><strong>{goal.title}</strong><small>{goal.enabled ? goal.description : "Coming later"}</small></span>
            </button>)}
          </div>
          <label><span className="form-label">In your own words, what have you noticed?</span><textarea className="textarea" value={profile.concern} onChange={(event) => update("concern", event.target.value)} placeholder="For example: My hair feels dry and looks dull, especially at the ends…" maxLength={600} /></label>
          <p className="field-hint">Your words guide the next questions. Nothing is sent anywhere in this local preview.</p>
        </>}

        {step === 2 && <>
          <span className="eyebrow">LET’S UNDERSTAND THE ROUTINE</span>
          <h1 className="step-title">What is your hair routine like?</h1>
          <p className="step-copy">A few details help us avoid guessing. Skip anything.</p>
          <div className="question-block">
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

        {step === 3 && <>
          <span className="eyebrow">A PLAN THAT FITS YOUR LIFE</span>
          <h1 className="step-title">What feels doable?</h1>
          <p className="step-copy">Tell us what fits your time and comfort. Skip any question.</p>
          <div className="question-block">
            <h2 className="question-title">Any sensitivity or reaction we should know about?</h2>
            <p className="question-caption">This is optional. We will not assume an ingredient is suitable for you.</p>
            <div className="segmented">{["No known sensitivity", "I have had reactions", "Not sure", "Prefer to skip"].map((value) => <button key={value} className={`segment ${profile.sensitivity === value ? "selected" : ""}`} onClick={() => update("sensitivity", value)} aria-pressed={profile.sensitivity === value}>{value}</button>)}</div>
          </div>
          <div className="form-grid">
            <label><span className="form-label">How much time feels manageable?</span><select className="select" value={profile.timeAvailable} onChange={(event) => update("timeAvailable", event.target.value)}><option value="">Choose if you wish</option><option>Under 5 minutes</option><option>5–10 minutes</option><option>10–20 minutes</option><option>It depends on the day</option></select></label>
            <label><span className="form-label">What would you like to prioritize?</span><select className="select" value={profile.approach} onChange={(event) => update("approach", event.target.value)}><option value="">Choose if you wish</option><option>At-home routine first</option><option>Use what I already own</option><option>Open to professional advice</option><option>A balanced mix</option></select></label>
          </div>
          <details className="optional-details preference-details">
            <summary>Budget preference <span>Optional</span></summary>
            <label><span className="form-label">What budget feels comfortable?</span><select className="select" value={profile.budget} onChange={(event) => update("budget", event.target.value)}><option value="">Not answered</option><option>Prefer to use what I own</option><option>Keep any changes low-cost</option><option>Open to a considered purchase</option><option>I would rather not say</option></select></label>
          </details>
          <div className="demo-banner"><span aria-hidden="true">✳</span><span><strong>Optional safety context.</strong> We will not provide supplement or medical recommendations in this prototype. You have not been asked for health details that are not relevant to this hair-care preview.</span></div>
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
  const hypothesis = profile.heat === "Often" || profile.heat === "Most wash days"
    ? "Heat styling may be one factor worth reviewing. Your answers suggest a possibility, not a confirmed cause."
    : !profile.heat
      ? "You have not shared how often you use heat yet, so we are not treating it as a contributor. Observing when dryness appears is a low-effort place to begin."
      : "We do not yet have enough detail to identify a likely contributor. Observing when dryness appears is a low-effort place to begin.";
  const facts = [
    profile.concern.trim() ? `You described: “${profile.concern.trim().slice(0, 160)}${profile.concern.trim().length > 160 ? "…" : ""}”` : "",
    profile.dryness ? `You notice dryness around your ${profile.dryness.toLowerCase()}.` : "",
    profile.washFrequency ? `You wash your hair ${profile.washFrequency.toLowerCase()}.` : "",
    profile.heat ? `You use heat styling ${profile.heat.toLowerCase()}.` : "",
    profile.currentProducts.trim() ? `You listed: ${profile.currentProducts.trim().slice(0, 120)}${profile.currentProducts.trim().length > 120 ? "…" : ""}` : "",
  ].filter(Boolean);
  const missingFacts = [
    ["dryness", "where you notice dryness"],
    ["washFrequency", "how often you wash your hair"],
    ["heat", "how often you use heat styling"],
    ["currentProducts", "the products you currently use"],
    ["sensitivity", "sensitivity or past reactions"],
  ].filter(([key]) => !profile[key as keyof Profile])
    .map(([key, label]) => `${profile.skipped.includes(key) ? "Skipped for now" : "Not answered"}: ${label}`);

  return (
    <main className="analysis-shell">
      <div className="analysis-heading"><span className="eyebrow">YOUR PERSONALIZED READOUT · PREVIEW</span><h1 className="display" style={{ fontSize: "clamp(43px,6vw,66px)" }}>Let’s connect<br /><em>the dots.</em></h1><p className="lede">A first look at what you shared, what might be worth exploring, and what we still do not know.</p></div>
      <div className="analysis-grid">
        <article className="analysis-card"><div className="card-kicker"><span className="kicker-mark">◎</span>Reported by you <span className="kind-tag">Your answers</span></div><h3>Your starting point</h3>{facts.length > 0 ? <ul>{facts.map((fact) => <li key={fact}><span className="bullet">·</span><span>{fact}</span></li>)}</ul> : <p>You have not shared details yet. You can review the questions or continue with a general preview.</p>}</article>
        <article className="analysis-card"><div className="card-kicker"><span className="kicker-mark">↗</span>Worth exploring <span className="kind-tag hypothesis">Hypothesis</span></div><h3>A possible opportunity</h3><p>{hypothesis} We can start with your existing routine before adding products or cost.</p></article>
        <article className="analysis-card wide"><div className="card-kicker"><span className="kicker-mark">…</span>Still uncertain <span className="kind-tag missing">Not yet known</span></div><h3>What we have not established</h3><p>We have not established the cause of dryness, assessed a scalp or hair condition, or reviewed product ingredients. {missingFacts.join(" · ") || "A few details remain unknown."} This preview does not monitor your routine or health data. The plan starts with observation and simple routine review.</p></article>
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
  const recommendations = useMemo(() => buildRecommendations(profile, simplified), [profile, simplified]);
  const activeRecommendations = safetyPause ? recommendations.filter((item) => item.id === "inventory") : recommendations;
  const toggleDone = (id: string) => setDone((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const toggleExpanded = (id: string) => setExpanded((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const selectTab = (value: AppTab) => setTab(value);

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
    let answer = "This is a local demo, so I can only refer to the answers and sample plan shown here. A useful next step is to review what you already use and decide what feels manageable.";
    if (/cheap|budget|cost|expensive/i.test(lower)) answer = `You chose “${profile.budget}”. The current plan starts with reviewing what you already own, so it does not require a purchase. We can compare product options in a later, evidence-reviewed version.`;
    else if (/miss|forgot|busy|time|simpl/i.test(lower)) answer = "Missing a day is not a failure. Your plan is a guide, not a streak. We can keep just the first low-effort action this week; use “Adjust plan” to see the simplified preview.";
    else if (/irrit|reaction|itch|burn|rash/i.test(lower)) answer = "This prototype cannot assess a reaction. Avoid adding another new product based on this chat. For a concerning or persistent reaction, stop the product and seek advice from a qualified professional.";
    else if (/why|heat|dry/i.test(lower)) answer = profile.heat === "Often" || profile.heat === "Most wash days"
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
          <div className="personal-note"><span className="spark">✳</span><p><strong>Why this plan starts here</strong><br />{profile.heat === "Often" || profile.heat === "Most wash days" ? `You mentioned frequent heat styling${profile.dryness ? ` and dryness around your ${profile.dryness.toLowerCase()}` : ""}. We’ll explore routine factors first, without assuming they are the cause.` : profile.washFrequency ? `You notice dryness${profile.dryness ? ` around your ${profile.dryness.toLowerCase()}` : ""} and wash ${profile.washFrequency.toLowerCase()}. We’ll start by observing your routine rather than adding products.` : "Some routine details are still unanswered or skipped. We’ll begin with observation rather than assuming a cause or adding products."}</p></div>
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

  const reset = () => {
    setProfile(initialProfile);
    setSimplified(false);
    setSafetyPause(false);
    setReviewNote("");
    setScreen("home");
  };
  const start = () => {
    setProfile(initialProfile);
    setScreen("onboarding");
  };
  const trySample = () => {
    setProfile({
      ...initialProfile,
      timeline: "range",
      timeframe: "About 1–3 months",
      goals: ["hair"],
      concern: "My hair feels dry and looks dull, especially at the ends.",
      dryness: "Lengths, Ends",
      washFrequency: "2–3 times a week",
      currentProducts: "Clarifying shampoo, no regular conditioner",
      heat: "Often",
      color: "No",
      sensitivity: "Not sure",
      timeAvailable: "5–10 minutes",
      budget: "Prefer to use what I own",
      approach: "At-home routine first",
    });
    setScreen("app");
  };

  return <div className="app-frame">
    <AppHeader onHome={() => setScreen("home")} onReset={reset} showReset={screen !== "home"} />
    {screen === "home" && <>
      <main className="page-wrap">
        <section className="home-hero">
          <div className="hero-copy"><span className="eyebrow"><i className="eyebrow-dot" />A MORE PERSONAL KIND OF CARE</span><h1 className="display">Care that<br />starts with <em>you.</em></h1><p className="lede">Your routines, your real life, your next best step. Thoughtful guidance for feeling more like yourself.</p><div className="hero-actions"><button className="button" onClick={start}>Begin your hair journey <span className="arrow">↗</span></button><button className="button-text" onClick={trySample}>See a sample plan <span className="arrow">↗</span></button></div><div className="micro-trust"><span>Made around you</span><span>No pressure</span><span>Private preview</span></div></div>
          <ArtCard />
        </section>
        <div className="home-note"><span className="note-spark">✳</span><span><strong>Dry-hair journey preview.</strong> Your answers stay in this browser and clear when you leave.</span><span className="note-name">{brand.name} · working name</span></div>
      </main>
    </>}
    {screen === "onboarding" && <Onboarding profile={profile} setProfile={setProfile} onExit={() => setScreen("home")} onFinish={() => setScreen("analysis")} />}
    {screen === "analysis" && <Analysis profile={profile} onContinue={() => setScreen("app")} onEdit={() => setScreen("onboarding")} />}
    {screen === "app" && <Dashboard profile={profile} simplified={simplified} setSimplified={setSimplified} safetyPause={safetyPause} setSafetyPause={setSafetyPause} reviewNote={reviewNote} setReviewNote={setReviewNote} />}
  </div>;
}
