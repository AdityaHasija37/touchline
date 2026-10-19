import { cn } from "@/lib/utils";

/** Touchline mark: a pitch seen from the touchline, halfway line and centre circle. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-7", className)}>
      <rect x="1" y="1" width="30" height="30" rx="8" className="fill-primary" />
      <rect x="6.5" y="9" width="19" height="14" rx="1.5" fill="none" stroke="white" strokeWidth="1.6" />
      <line x1="16" y1="9" x2="16" y2="23" stroke="white" strokeWidth="1.6" />
      <circle cx="16" cy="16" r="3" fill="none" stroke="white" strokeWidth="1.6" />
      <rect x="6.5" y="13" width="3" height="6" fill="none" stroke="white" strokeWidth="1.2" />
      <rect x="22.5" y="13" width="3" height="6" fill="none" stroke="white" strokeWidth="1.2" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <LogoMark />
      <span>Touchline</span>
    </span>
  );
}
