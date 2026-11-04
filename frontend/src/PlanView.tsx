import { useState } from "react";
import { Button, Icon } from "./ui";
import type { Journey } from "./Agent";

// Use the accepted backend plan; do not invent weekly schedules or example actions.
export function PlanView({ journey, busy, onCheckin }: {
  journey: Journey; busy: boolean; onCheckin: (message: string) => void;
}) {
  const [view, setView] = useState<"summary" | "details">("summary");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const version = journey.plans[journey.plans.length - 1];
  const plan = version.plan;
  return <div className="plan-view">
    {view === "summary" ? <>
      <header className="plan-page-heading"><span className="eyebrow">REVANA · VERSION {version.version}</span><h2>Your plan</h2></header>
      <section className="plan-summary-card">
        <span className="plan-card-label"><Icon name="sparkle" size={16} /> WHAT WE THINK MAY WORK</span>
        <h3>A direction shaped around you</h3><p>{plan.summary}</p>
        <div className="plan-topic-tags">{[...new Set(plan.actions.map(a => a.category))].map(category => <span key={category}>{category}</span>)}</div>
      </section>
      <section className="plan-reasons"><h3>Why this plan, for you</h3>{plan.actions.map(action => <p key={action.id}>{action.why}</p>)}</section>
      <section className="plan-upcoming">
        <div className="plan-upcoming-heading"><div><h3>Your suggested actions</h3><p>Timing comes from your accepted plan. Feedback can shape a proposed update.</p></div><span>{plan.actions.length} ideas</span></div>
        <div className="summary-weeks">{plan.actions.map(action => <section className="summary-week" key={action.id}>
          <header><span>{action.category}</span><span>{action.effort} effort</span></header><h4>{action.title}</h4><p>{action.timing}</p>
          <ul><li><span>{action.cost}</span><button disabled={busy} onClick={() => onCheckin(`This action is not for me: ${action.title}. Please propose an alternative.`)} type="button">Not for me</button></li></ul>
        </section>)}</div>
      </section>
      <p className="plan-disclaimer"><Icon name="info" size={15} />AI-generated guidance is not a diagnosis or a guarantee. Planned actions are separate from what you report completing. Changes require your acceptance.</p>
      <Button className="primary plan-continue" onClick={() => setView("details")}>Explore my plan <Icon name="arrow" /></Button>
    </> : <>
      <button className="plan-back" onClick={() => setView("summary")} type="button"><Icon name="chevron" size={16} /> Plan summary</button>
      <header className="plan-page-heading"><h2>Your plan in detail</h2></header>
      <div className="suggestion-list">{plan.actions.map(action => {
        const open = expanded === action.id;
        return <article className={`suggestion-card${open ? " expanded" : ""}`} key={action.id}>
          <button aria-expanded={open} className="suggestion-toggle" onClick={() => setExpanded(open ? null : action.id)} type="button"><span><strong>{action.title}</strong>{!open && <small>{action.timing}</small>}</span><Icon className={open ? "rotated" : ""} name="chevron" size={18} /></button>
          {open && <div className="suggestion-detail"><p>{action.detail}</p><h4>Why this, for you</h4><p>{action.why}</p><h4>Timing and fit</h4><p>{action.timing} · {action.cost} · {action.effort} effort</p><details className="suggestion-research"><summary><Icon name="info" size={15} /> What to observe</summary><p>{action.observation}</p></details><button className="suggestion-dismiss" disabled={busy} onClick={() => onCheckin(`This action is not for me: ${action.title}. Please propose an alternative.`)} type="button">Not for me</button></div>}
        </article>;
      })}</div>
      <section className="plan-note"><span className="eyebrow">IN YOUR WORDS · OPTIONAL</span><h3>Anything you tried or noticed?</h3><textarea aria-label="Plan observations" maxLength={2000} disabled={busy} value={note} onChange={event => setNote(event.target.value)} placeholder="A few words about what worked, what didn’t, or what you’d like to change." /><Button className="primary" disabled={busy || !note.trim()} onClick={() => onCheckin(note.trim())}>Discuss with Revana</Button><p className="agent-small">Starts a check-in. Your current plan stays active until you accept an update.</p></section>
    </>}
    <section className="plan-reasons"><h3>Fit & safety</h3>{plan.safety_notes.map((text, index) => <p key={index}>{text}</p>)}</section>
    <h3>Plan history</h3>{journey.plans.map(item => <details key={item.version}><summary>Version {item.version} · {new Date(item.created_at).toLocaleDateString()}</summary><p>{item.plan.changes}</p><ul>{item.plan.actions.map(action => <li key={action.id}>{action.title}: {action.detail}</li>)}</ul></details>)}
  </div>;
}
