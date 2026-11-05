import { useEffect, useState } from "react";
import { Brand, Button, Icon, SafetyStrip, type IconName } from "./ui";
import { AdaptiveQuestions, AgentAnalysis, AgentDashboard, AgentError, agentRequest, forgetToken, savedToken, startJourney, type Journey } from "./Agent";

import { navigate, useScreenNavigation, type Screen } from "./navigation";
type Goal = "skin" | "hair" | "body" | "energy" | "other";

function scrollToTop() {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
}

const goalData: { id: Goal; title: string; icon: IconName }[] = [
  { id: "skin", title: "Face & skin", icon: "skin" },
  { id: "hair", title: "Hair", icon: "hair" },
  { id: "body", title: "Body & fitness", icon: "heart" },
  { id: "energy", title: "Energy & lifestyle", icon: "sparkle" },
  { id: "other", title: "Something else", icon: "plus" },
];

type Profile = {
  deadlineType: "event" | "journey";
  targetDate: string;
  goals: Goal[];
  ownWords: string;
  sensitivities: string[];
  limitations: string;
  budget: string;
  effort: string;
};

const initialProfile: Profile = {
  deadlineType: "journey",
  targetDate: "",
  goals: [],
  ownWords: "",
  sensitivities: [],
  limitations: "",
  budget: "Under $100 / month",
  effort: "Three high-impact actions",
};

const order: Screen[] = ["welcome", "timeline", "goals", "details", "safety", "analysis", "dashboard"];

function OnboardingShell({ children, screen, setScreen }: { children: React.ReactNode; screen: Screen; setScreen: (screen: Screen) => void }) {
  const index = order.indexOf(screen);
  return (
    <div className="onboarding">
      <header className="onboarding-header">
        <Brand />
        {screen !== "welcome" && screen !== "analysis" && <><div className="stepper">{["Direction", "Goals", "Understand", "Safety"].map((item, i) => <span className={i <= index - 1 ? "active" : ""} key={item}><i />{item}</span>)}</div><span className="save-exit">Saved after each agent answer</span></>}
      </header>
      <div className="onboarding-body">{children}</div>
      {screen !== "welcome" && <SafetyStrip />}
      {screen !== "welcome" && screen !== "analysis" && screen !== "details" && screen !== "safety" && <button className="back-link" onClick={() => setScreen(order[Math.max(0, index - 1)])} type="button">← Back</button>}
    </div>
  );
}

function Welcome({ onStart, returning = false }: { onStart: () => void; returning?: boolean }) {
  return (
    <div className="welcome">
      <div className="welcome-copy">
        <h1>Your goals. Your lifestyle.<br /><em>Your transformation</em></h1>
        <Button className="primary large" onClick={onStart}>{returning ? "Return to my plan" : "Begin your journey"} <Icon name="arrow" /></Button>
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
      <span className="eyebrow">YOUR DIRECTION · 1 OF 4</span>
      <h2>When would you like to feel your best?</h2>
      <div className="timeline-options">
        <button className={profile.deadlineType === "event" ? "selected" : ""} onClick={() => setProfile({ ...profile, deadlineType: "event" })} type="button"><Icon name="calendar" /><span><strong>A specific event</strong><small>Choose an exact date</small></span><i>{profile.deadlineType === "event" && <Icon name="check" size={15} />}</i></button>
        <button className={profile.deadlineType === "journey" ? "selected" : ""} onClick={() => setProfile({ ...profile, deadlineType: "journey", targetDate: "" })} type="button"><Icon name="sparkle" /><span><strong>No deadline</strong><small>An ongoing improvement journey</small></span><i>{profile.deadlineType === "journey" && <Icon name="check" size={15} />}</i></button>
      </div>
      {profile.deadlineType === "event" && <div className="date-field"><label>Event date</label><input min={new Date().toISOString().split("T")[0]} onChange={(e) => setProfile({ ...profile, targetDate: e.target.value })} type="date" value={profile.targetDate} />{days !== null && days > 0 && <span>{days} days away</span>}</div>}
      <Button className="primary continue" disabled={profile.deadlineType === "event" && (!profile.targetDate || profile.targetDate < new Date().toISOString().slice(0, 10))} onClick={next}>Continue <Icon name="arrow" /></Button>
    </div>
  );
}

function Goals({ profile, setProfile, next }: { profile: Profile; setProfile: (p: Profile) => void; next: () => void }) {
  const toggle = (id: Goal) => setProfile({ ...profile, goals: profile.goals.includes(id) ? profile.goals.filter((g) => g !== id) : [...profile.goals, id] });
  return (
    <div className="question-page wide-question">
      <span className="eyebrow">WHAT MATTERS · 2 OF 4</span>
      <h2>What would you like to improve?</h2>
      <p>Choose one or several areas.</p>
      <div className="goal-grid">
        {goalData.map((goal) => <button aria-pressed={profile.goals.includes(goal.id)} className={profile.goals.includes(goal.id) ? "selected" : ""} key={goal.id} onClick={() => toggle(goal.id)} type="button"><span className="goal-icon"><Icon name={goal.icon} /></span><strong>{goal.title}</strong><i>{profile.goals.includes(goal.id) && <Icon name="check" size={15} />}</i></button>)}
      </div>
      <label className="text-field"><span>Tell us in your own words <small>OPTIONAL</small></span><textarea maxLength={2000} onChange={(e) => setProfile({ ...profile, ownWords: e.target.value })} placeholder="For example: My face looks tired even when I sleep, and my hair feels dry after washing…" value={profile.ownWords} /></label>
      <Button className="primary continue" disabled={!profile.goals.length && !profile.ownWords} onClick={next}>Continue <Icon name="arrow" /></Button>
    </div>
  );
}

function Safety({ profile, setProfile, next }: { profile: Profile; setProfile: (p: Profile) => void; next: () => void }) {
  const options = ["No known allergies or reactions", "Food allergies or dietary restrictions", "Sensitive skin or scalp", "Ingredient reactions", "Medication or ongoing medical care", "Pregnant or breastfeeding"];
  const toggle = (item: string) => setProfile({ ...profile, sensitivities: profile.sensitivities.includes(item)
    ? profile.sensitivities.filter(x => x !== item)
    : item === options[0] ? [item] : [...profile.sensitivities.filter(x => x !== options[0]), item] });
  return (
    <div className="question-page wide-question">
      <span className="eyebrow">YOUR BOUNDARIES · 4 OF 4</span>
      <h2>Anything we should keep in mind?</h2>
      <p>You can skip sensitive questions. Your preferences help shape your plan.</p>
      <div className="safety-sections">
        <section className="safety-card">
          <h3>Anything we should account for?</h3>
          <div className="goal-grid safety-options">{options.map((item, index) => {
            const selected = profile.sensitivities.includes(item);
            const icons: IconName[] = ["check", "heart", "skin", "info", "heart", "user"];
            return <button aria-pressed={selected} className={selected ? "selected" : ""} key={item} onClick={() => toggle(item)} type="button"><span className="goal-icon"><Icon name={icons[index]} size={17} /></span><strong>{item}</strong><i>{selected && <Icon name="check" size={15} />}</i></button>;
          })}</div>
        </section>
        <section className="safety-card">
          <h3>Any other limitations or allergies?</h3>
          <label className="safety-notes-label" htmlFor="safety-limitations">Share anything else you’d like your plan to take into account</label>
          <textarea id="safety-limitations" maxLength={800} onChange={event => setProfile({ ...profile, limitations: event.target.value })} placeholder="Ingredients you avoid, movement limitations, or anything you’d rather leave out…" value={profile.limitations} />
        </section>
        <section className="safety-card plan-preferences"><h3>Plan preferences</h3><label>Monthly budget<select onChange={e => setProfile({ ...profile, budget: e.target.value })} value={profile.budget}><option>Under $100 / month</option><option>$100–250 / month</option><option>$250–500 / month</option><option>Flexible</option></select></label><label>Preferred plan style<select onChange={e => setProfile({ ...profile, effort: e.target.value })} value={profile.effort}><option>Three high-impact actions</option><option>A balanced weekly routine</option><option>A detailed optimization plan</option></select></label></section>
      </div>
      <div className="privacy-note"><Icon name="info" /><span><strong>You stay in control.</strong> Your answers are saved on this computer’s backend and sent to OpenAI when generating questions or plans. Photo uploads are not supported.</span></div>
      <Button className="primary continue" onClick={next}>Connect the dots <Icon name="arrow" /></Button>
    </div>
  );
}


function App() {
  const [screen, setScreen] = useScreenNavigation();
  const [profile, setProfile] = useState(initialProfile);
  const [journey, setJourney] = useState<Journey | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [consent, setConsent] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const run = async (task: () => Promise<void>) => {
    if (busy) return;
    setBusy(true); setError("");
    try { await task(); } catch (e) { setError(e instanceof Error ? e.message : "Please retry."); }
    finally { setBusy(false); }
  };
  useEffect(() => { scrollToTop(); }, [screen]);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const status = await agentRequest<{ configured: boolean }>("status");
        if (!cancelled) setConfigured(status.configured);
        if (savedToken()) {
          const saved = await agentRequest<Journey>("session");
          if (cancelled) return;
          setJourney(saved);
          setProfile({ ...initialProfile, goals: saved.context.goals, ownWords: saved.context.description,
            targetDate: saved.context.target_date, deadlineType: saved.context.target_date ? "event" : "journey",
            ...(saved.preferences ?? {}) });
          const route = window.location.hash;
          const canResume = saved.plans.length && ["#/welcome", "#/analysis", "#/dashboard/today", "#/dashboard/plan", "#/dashboard/coach", "#/dashboard/insights"].includes(route);
          if (!canResume) navigate(saved.plans.length ? "dashboard" : "details", true);
        }
      } catch (e) { if (!cancelled) setError(e instanceof Error ? e.message : "Could not restore your journey."); }
      finally { if (!cancelled) setRestoring(false); }
    })();
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    if (restoring) return;
    if (journey?.plans.length && !["welcome", "analysis", "dashboard"].includes(screen)) navigate("analysis", true);
    else if (journey && !journey.plans.length && ["timeline", "goals"].includes(screen)) navigate("details", true);
    else if (!journey?.plans.length && ["analysis", "dashboard"].includes(screen)) navigate(journey ? "details" : "welcome", true);
  }, [screen, journey, restoring]);
  const buildPlan = () => void run(async () => {
    if (!journey) return;
    const saved = await agentRequest<Journey>("plan", { revision: journey.revision,
      preferences: { sensitivities: profile.sensitivities, limitations: profile.limitations, budget: profile.budget, effort: profile.effort } });
    setJourney(saved); setScreen("analysis");
  });
  const deleteJourney = () => void run(async () => {
    await agentRequest("session", undefined, "DELETE");
    forgetToken(); setJourney(null); setProfile(initialProfile); setConsent(false);
    setDeleteConfirm(false); setScreen("welcome");
  });
  if (restoring) return <main className="question-page"><p role="status">Restoring your journey…</p></main>;
  return <>
    {error && <div className="agent-banner"><AgentError error={error} /><Button className="secondary" disabled={busy} onClick={() => window.location.reload()}>Reload saved journey</Button>{!journey && savedToken() && <><p className="agent-small">If this backend no longer has your journey, you can forget this browser link and start again. This does not delete data from another backend or a backup.</p><Button className="secondary" disabled={busy} onClick={() => { forgetToken(); setError(""); setScreen("welcome"); }}>Forget browser link and start again</Button></>}</div>}
    {deleteConfirm && <div className="agent-banner" role="alert"><p>Delete this saved journey, all answers and plan versions? Export first if you want a copy.</p><Button className="secondary" disabled={busy} onClick={() => setDeleteConfirm(false)}>Keep journey</Button> <Button className="primary" disabled={busy} onClick={deleteJourney}>Delete permanently</Button></div>}
    {screen === "dashboard" && journey && journey.plans.length > 0 ? <AgentDashboard journey={journey} update={setJourney} busy={busy} run={task => void run(task)} onDelete={() => setDeleteConfirm(true)} onBack={() => setScreen("analysis")} />
    : screen === "analysis" && journey && journey.plans.length > 0 ? <AgentAnalysis journey={journey} onPlan={() => setScreen("dashboard")} onBack={() => setScreen("welcome")} />
    : <OnboardingShell screen={screen} setScreen={setScreen}>
      {screen === "welcome" && <><Welcome returning={!!journey?.plans.length} onStart={() => setScreen(journey?.plans.length ? "dashboard" : "timeline")} />{configured === false && <p className="agent-banner">Connect an OpenAI key and structured-output model in the backend configuration to enable your beauty agent.</p>}</>}
      {screen === "timeline" && <Timeline profile={profile} setProfile={setProfile} next={() => setScreen("goals")} />}
      {screen === "goals" && <Goals profile={profile} setProfile={setProfile} next={() => setScreen("details")} />}
      {screen === "details" && (!journey ? <div className="question-page"><span className="eyebrow">YOUR BEAUTY AGENT</span><h2>A few questions, shaped around you.</h2><p>Revana asks at most six questions, one at a time, based on each answer. You can skip any question or finish early.</p><label className="agent-consent"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} /> I am 18 or older and agree to send my selected goals and answers to OpenAI for personalized guidance. My journey is saved on this computer’s backend; an access token is saved in this browser. I can export or delete it.</label><Button className="primary" disabled={busy || !consent || configured === false} onClick={() => void run(async () => {
        setJourney(await startJourney({ goals: profile.goals.length ? profile.goals : ["other"], description: profile.ownWords.slice(0, 2000), target_date: profile.targetDate }));
      })}>{busy ? "Preparing your first question…" : "Start my assessment"}</Button></div> : <AdaptiveQuestions journey={journey} update={setJourney} busy={busy} run={task => void run(task)} onFinish={() => setScreen("safety")} />)}
      {screen === "safety" && <fieldset className="agent-fieldset" disabled={busy}><Safety profile={profile} setProfile={setProfile} next={buildPlan} />{busy && <p className="agent-banner" role="status">Building your personal plan…</p>}</fieldset>}
      {journey && !journey.plans.length && <div className="agent-banner"><Button className="secondary" disabled={busy} onClick={() => setDeleteConfirm(true)}>Delete assessment and start again</Button></div>}
    </OnboardingShell>}
  </>;
}

export default App;
