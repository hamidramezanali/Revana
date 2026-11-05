import { useState, type ReactNode } from "react";
import { Button } from "./ui";
import type { Journey } from "./Agent";

export function PlanView({ journey, busy, onCheckin, children }: {
  journey: Journey; busy: boolean; onCheckin: (message: string) => void; children: ReactNode;
}) {
  const [note, setNote] = useState("");
  const version = journey.plans[journey.plans.length - 1];
  const plan = version.plan;
  return <div className="plan-view">
    <header className="plan-page-heading"><span className="eyebrow">VERSION {version.version}</span><h2>Your plan</h2></header>
    <p className="plan-overview">{plan.summary}</p>
    {children}
    <section className="plan-safety-copy"><h3>Fit & safety</h3>{plan.safety_notes.map((text, index) => <p key={index}>{text}</p>)}</section>
    <details className="plan-observation"><summary>Record an observation</summary><p>Tell Revana what you tried or noticed to start a check-in.</p><textarea aria-label="Plan observations" maxLength={2000} disabled={busy} value={note} onChange={event => setNote(event.target.value)} placeholder="What worked, what didn’t, or what changed?" /><Button className="primary" disabled={busy || !note.trim()} onClick={() => onCheckin(note.trim())}>Discuss with Revana</Button></details>
    <details className="plan-history"><summary>Plan history</summary>{journey.plans.map(item => <details key={item.version}><summary>Version {item.version} · {new Date(item.created_at).toLocaleDateString()}</summary><p>{item.plan.changes}</p><ul>{item.plan.actions.map(action => <li key={action.id}>{action.title}: {action.detail}</li>)}</ul></details>)}</details>
  </div>;
}
