import { useEffect, useRef } from "react";
import { Button } from "./ui";

export function AppDialog({title, children, onClose, busy = false}: {title: string; children: React.ReactNode; onClose: () => void; busy?: boolean}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {dialog.current?.showModal();}, []);
  return <dialog ref={dialog} className="profile-dialog" aria-labelledby="profile-dialog-title" onCancel={event => {event.preventDefault(); if (!busy) onClose();}}>
    <header><h2 id="profile-dialog-title">{title}</h2><button type="button" disabled={busy} aria-label="Close dialog" onClick={onClose}>×</button></header>
    {children}
  </dialog>;
}

export function ProfileSettings({busy, onClose, onExport, onRestart}: {busy: boolean; onClose: () => void; onExport: () => void; onRestart: () => void}) {
  return <AppDialog title="Profile & settings" onClose={onClose} busy={busy}>
    <section><h3>Your saved profile</h3><p>Your answers, reviewed photo notes, plans and kept actions are saved on this computer’s backend. Original questionnaire photos aren’t saved by Revana.</p><Button className="secondary" disabled={busy} onClick={onExport}>Export my data</Button></section>
    <section className="restart-settings"><h3>Start fresh</h3><p>Delete this profile and return to the first questions. This also removes your saved plans, suggestions and progress from this backend.</p><Button className="danger" disabled={busy} onClick={onRestart}>Delete profile & start over</Button></section>
  </AppDialog>;
}
