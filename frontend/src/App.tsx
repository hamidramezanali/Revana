import { useEffect, useState } from "react";
import { Brand, Button, Icon, SafetyStrip, type IconName } from "./ui";
import { AdaptiveQuestions, AgentAnalysis, AgentDashboard, AgentError, agentRequest, forgetToken, savedToken, startJourney, type Journey } from "./Agent";

import { AppDialog } from "./ProfileSettings";
import { navigate, useScreenNavigation, type Screen } from "./navigation";
import type { ApiFitOptions } from "./api.generated";
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

function Safety({ profile, setProfile, next, journey, onBack }: { profile: Profile; setProfile: (p: Profile) => void; next: () => void; journey: Journey; onBack: () => void }) {
  const [fit, setFit] = useState<ApiFitOptions | null>(null);
  const [fitError, setFitError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setFit(null); setFitError("");
    void agentRequest<ApiFitOptions>("fit-options", {revision: journey.revision}).then(result => {
      if (!cancelled) setFit(result);
    }).catch(() => {
      if (!cancelled) setFitError("We couldn’t load tailored choices. You can retry or describe relevant limits below.");
    });
    return () => { cancelled = true; };
  }, [journey.revision, attempt]);
  const none = "No known allergies or limitations";
  const unsure = "Not sure yet";
  const options = [none, ...new Set([...(fit?.options ?? []), ...profile.sensitivities].filter(item => item !== none && item !== unsure)), unsure];
  const toggle = (item: string) => setProfile({ ...profile, sensitivities: profile.sensitivities.includes(item)
    ? profile.sensitivities.filter(x => x !== item)
    : item === none || item === unsure ? [item] : [...profile.sensitivities.filter(x => x !== none && x !== unsure), item] });
  return (
    <div className="question-page wide-question">
      <span className="eyebrow">YOUR BOUNDARIES · 4 OF 4</span>
      <h2>Anything we should keep in mind?</h2>
      <p>You can skip sensitive questions. Your preferences help shape your plan.</p>
      <Button className="secondary" onClick={onBack}>← Back to questions</Button>
      <div className="safety-sections">
        <section className="safety-card">
          <h3>Anything we should account for?</h3>
          {!fit && !fitError && <p role="status">Tailoring these choices to your goals and answers…</p>}
          {fitError && <p role="status">{fitError} <button type="button" className="button secondary" onClick={() => setAttempt(value => value + 1)}>Retry choices</button></p>}
          <div className="goal-grid safety-options">{options.map((item) => {
            const selected = profile.sensitivities.includes(item);
            return <button aria-pressed={selected} className={selected ? "selected" : ""} key={item} onClick={() => toggle(item)} type="button"><span className="goal-icon"><Icon name={item === none ? "check" : "info"} size={17} /></span><strong>{item}</strong><i>{selected && <Icon name="check" size={15} />}</i></button>;
          })}</div>
        </section>
        <section className="safety-card">
          <h3>Any other limitations or allergies?</h3>
          <label className="safety-notes-label" htmlFor="safety-limitations">Share anything else you’d like your plan to take into account</label>
          <textarea id="safety-limitations" maxLength={800} onChange={event => setProfile({ ...profile, limitations: event.target.value })} placeholder={fit?.limitations_hint ?? "Any limits or preferences relevant to the help you’re asking for…"} value={profile.limitations} />
        </section>
        <section className="safety-card plan-preferences"><h3>Plan preferences</h3><label>Monthly budget<select onChange={e => setProfile({ ...profile, budget: e.target.value })} value={profile.budget}><option>Under $100 / month</option><option>$100–250 / month</option><option>$250–500 / month</option><option>Flexible</option></select></label><label>Preferred plan style<select onChange={e => setProfile({ ...profile, effort: e.target.value })} value={profile.effort}><option>Three high-impact actions</option><option>A balanced weekly routine</option><option>A detailed optimization plan</option></select></label></section>
      </div>
      <div className="privacy-note"><Icon name="info" /><span><strong>You stay in control.</strong> Your answers are saved by this Revana deployment and sent to OpenAI when generating questions or plans. Some questions allow optional photos. Photos are processed temporarily; reviewed visual notes can be saved.</span></div>
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
      } catch (e) { if (!cancelled) { setConfigured(false); setError(e instanceof Error ? e.message : "Could not restore your journey."); } }
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
    setDeleteConfirm(false); setError(""); navigate("timeline", true);
  });
  if (restoring) return <main className="question-page"><p role="status">Restoring your journey…</p></main>;
  return <>
    {error && <div className="agent-banner"><AgentError error={error} /><Button className="secondary" disabled={busy} onClick={() => window.location.reload()}>Reload saved journey</Button>{!journey && savedToken() && <><p className="agent-small">If this backend no longer has your journey, you can forget this browser link and start again. This does not delete data from another backend or a backup.</p><Button className="secondary" disabled={busy} onClick={() => { forgetToken(); setError(""); setScreen("welcome"); }}>Forget browser link and start again</Button></>}</div>}
    {deleteConfirm && <AppDialog title="Delete profile and start over?" busy={busy} onClose={() => setDeleteConfirm(false)}><p>This permanently deletes your current answers, photo notes, plans, kept actions and progress from this backend. You’ll start again from the first questions.</p><p>Export first if you want a copy. Existing exports, backups and data already sent to OpenAI are separate.</p><div className="agent-buttons"><Button className="secondary" disabled={busy} onClick={() => setDeleteConfirm(false)}>Keep my profile</Button><Button className="danger" disabled={busy} onClick={deleteJourney}>{busy ? "Deleting…" : "Delete & start over"}</Button></div>{error && <AgentError error={error} />}</AppDialog>}
    {screen === "dashboard" && journey && journey.plans.length > 0 ? <AgentDashboard journey={journey} update={setJourney} busy={busy} run={task => void run(task)} onDelete={() => setDeleteConfirm(true)} onBack={() => setScreen("analysis")} />
    : screen === "analysis" && journey && journey.plans.length > 0 ? <AgentAnalysis journey={journey} onPlan={() => setScreen("dashboard")} onBack={() => setScreen("welcome")} />
    : <OnboardingShell screen={screen} setScreen={setScreen}>
      {screen === "welcome" && <><Welcome returning={!!journey?.plans.length} onStart={() => setScreen(journey?.plans.length ? "dashboard" : "timeline")} />{configured === false && <p className="agent-banner">The coaching service is not ready. Check the setup message above, then reload to retry.</p>}</>}
      {screen === "timeline" && <Timeline profile={profile} setProfile={setProfile} next={() => setScreen("goals")} />}
      {screen === "goals" && <Goals profile={profile} setProfile={setProfile} next={() => setScreen("details")} />}
      {screen === "details" && (!journey ? <div className="question-page"><span className="eyebrow">YOUR BEAUTY AGENT</span><h2>A few questions, shaped around you.</h2><p>Revana adapts each question to your answers and asks only what helps. You can skip any question or finish whenever you’re ready.</p><label className="agent-consent"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} /> I am 18 or older and agree to send my selected goals and answers to OpenAI for personalized guidance. My journey is saved by this Revana deployment; an access token is saved in this browser. I can export or delete it.</label><Button className="primary" disabled={busy || !consent || configured === false} onClick={() => void run(async () => {
        setJourney(await startJourney({ goals: profile.goals.length ? profile.goals : ["other"], description: profile.ownWords.slice(0, 2000), target_date: profile.targetDate }));
      })}>{busy ? "Preparing your first question…" : "Start my assessment"}</Button></div> : <AdaptiveQuestions journey={journey} update={setJourney} busy={busy} run={task => void run(task)} onFinish={() => setScreen("safety")} />)}
      {screen === "safety" && journey && <fieldset className="agent-fieldset" disabled={busy}><Safety profile={profile} setProfile={setProfile} journey={journey} onBack={() => setScreen("details")} next={buildPlan} />{busy && <p className="agent-banner" role="status">Building your personal plan…</p>}</fieldset>}
      {journey && !journey.plans.length && <div className="agent-banner"><Button className="secondary" disabled={busy} onClick={() => setDeleteConfirm(true)}>Delete profile & start over</Button></div>}
    </OnboardingShell>}
  </>;
}

export default App;
