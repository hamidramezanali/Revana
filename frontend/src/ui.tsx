type IconName = "arrow" | "calendar" | "check" | "chevron" | "clock" | "hair" | "heart" | "home" | "info" | "location" | "plus" | "search" | "skin" | "sparkle" | "star" | "user";
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

function Button({ children, className = "", disabled, onClick, type = "button" }: { children: React.ReactNode; className?: string; disabled?: boolean; onClick?: () => void; type?: "button" | "submit" }) {
  return <button className={`button ${className}`} disabled={disabled} onClick={onClick} type={type}>{children}</button>;
}

function Brand() {
  return <div className="brand"><span><Icon name="sparkle" size={16} /></span><b>Revana</b></div>;
}

function SafetyStrip() {
  return <div className="safety-strip"><Icon name="info" size={14} /><span><strong>General information, not medical care.</strong> Revana does not diagnose, prescribe, or replace qualified medical, nutrition, or cosmetic advice.</span></div>;
}


export { Brand, Button, Icon, SafetyStrip };
export type { IconName };
