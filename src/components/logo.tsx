import { cn } from "@/lib/utils";

/** Marca: um ponto de toque emitindo ondas de sinal — o gesto da plaquinha NFC. */
export function SignalMark({ className, inverted }: { className?: string; inverted?: boolean }) {
  const wave = inverted ? "var(--ink)" : "#fff";
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-7 shrink-0", inverted ? "text-sidebar-primary" : "text-primary", className)}>
      <rect width="32" height="32" rx="9" fill="currentColor" />
      <circle cx="10" cy="22" r="2.6" fill={inverted ? "var(--ink)" : "var(--star)"} />
      <path d="M10 15.5a6.5 6.5 0 0 1 6.5 6.5" stroke={wave} strokeWidth="2.4" strokeLinecap="round" fill="none" />
      <path d="M10 9.5A12.5 12.5 0 0 1 22.5 22" stroke={wave} strokeOpacity=".55" strokeWidth="2.4" strokeLinecap="round" fill="none" />
    </svg>
  );
}

export function Logo({ className, inverted }: { className?: string; inverted?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <SignalMark inverted={inverted} />
      <span className={cn("font-display text-[1.15rem] font-bold tracking-tight", inverted ? "text-white" : "text-foreground")}>E-Nova</span>
    </span>
  );
}
