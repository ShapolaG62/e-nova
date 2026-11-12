import { cn } from "@/lib/utils";

/**
 * Marca oficial do E-Nova: o "E" recortado num círculo claro, com a estrela laranja,
 * sobre a placa roxa-noite (#1B1035). Mesma geometria de public/logo-enova.svg e do ícone do app.
 */
export function SignalMark({ className }: { className?: string; inverted?: boolean }) {
  return (
    <svg viewBox="200 85 740 740" aria-hidden className={cn("size-7 shrink-0 rounded-[7px]", className)}>
      <rect x="200" y="85" width="740" height="740" fill="#1B1035" />
      <circle cx="520" cy="470" r="260" fill="#F1EEFD" />
      <path d="M430 314H800V626H430V522H660V418H430Z" fill="#1B1035" />
      <path d="M820 177C826 225 842 243 895 252C842 261 826 279 820 327C814 279 798 261 745 252C798 243 814 225 820 177Z" fill="#FF7A3D" />
    </svg>
  );
}

export function Logo({ className, inverted }: { className?: string; inverted?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <SignalMark />
      <span className={cn("font-display text-[1.1rem] font-extrabold uppercase tracking-[0.04em]", inverted ? "text-[#F1EEFD]" : "text-foreground")}>E-Nova</span>
    </span>
  );
}
