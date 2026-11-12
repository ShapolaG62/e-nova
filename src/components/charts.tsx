import { cn } from "@/lib/utils";

/**
 * Gráfico de barras leve, renderizado no servidor (sem JS no cliente).
 * Responsivo: no celular mostra só os últimos 14 dias.
 */
export function DailyBars({ data, className }: { data: { day: string; total: number }[]; className?: string }) {
  const max = Math.max(1, ...data.map((d) => d.total));
  const total = data.reduce((s, d) => s + d.total, 0);
  return (
    <div className={className}>
      <div className="flex h-36 items-end gap-[3px]" role="img" aria-label={`${total} toques em ${data.length} dias`}>
        {data.map((d, i) => {
          const [, m, day] = d.day.split("-");
          return (
            <div
              key={d.day}
              className={cn("group relative flex h-full flex-1 items-end", i < data.length - 14 && "hidden sm:flex")}
            >
              <div
                className="w-full rounded-t-sm bg-primary/75 transition-colors group-hover:bg-primary"
                style={{ height: `${Math.max(d.total ? 4 : 1.5, (d.total / max) * 100)}%`, opacity: d.total ? 1 : 0.25 }}
              />
              <span className="pointer-events-none absolute -top-7 left-1/2 z-10 hidden -translate-x-1/2 rounded bg-foreground px-1.5 py-0.5 text-[11px] whitespace-nowrap text-background group-hover:block">
                {day}/{m}: {d.total}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
        <span className="hidden sm:inline">{fmtDay(data[0]?.day)}</span>
        <span className="sm:hidden">{fmtDay(data[Math.max(0, data.length - 14)]?.day)}</span>
        <span>hoje</span>
      </div>
    </div>
  );
}

function fmtDay(d?: string) {
  if (!d) return "";
  const [, m, day] = d.split("-");
  return `${day}/${m}`;
}

const DEVICE_LABEL: Record<string, string> = { IOS: "iPhone", ANDROID: "Android", DESKTOP: "Computador", OTHER: "Outros" };

export function DeviceSplit({ data }: { data: { device: string; total: number }[] }) {
  const sum = data.reduce((s, d) => s + d.total, 0);
  if (!sum) return <p className="text-sm text-muted-foreground">Sem toques no período.</p>;
  return (
    <ul className="grid gap-2.5">
      {data.map((d) => {
        const pct = Math.round((d.total / sum) * 100);
        return (
          <li key={d.device} className="grid gap-1">
            <div className="flex justify-between text-sm">
              <span>{DEVICE_LABEL[d.device] ?? d.device}</span>
              <span className="tabular-nums text-muted-foreground">
                {d.total} · {pct}%
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Indicador. "featured" é o número principal da tela (fundo tinta, maior);
 * os demais ficam discretos — hierarquia em vez de cards idênticos.
 */
export function Kpi({ label, value, hint, featured, className }: { label: React.ReactNode; value: React.ReactNode; hint?: React.ReactNode; featured?: boolean; className?: string }) {
  if (featured) {
    return (
      <div className={cn("relative overflow-hidden rounded-2xl bg-ink p-5 text-white shadow-md ring-1 ring-white/5", className)}>
        <svg aria-hidden viewBox="0 0 120 120" className="pointer-events-none absolute -right-6 -bottom-8 size-36 text-white/[0.07]">
          <path d="M20 100a30 30 0 0 1 30-30M20 100a55 55 0 0 1 55-55M20 100a80 80 0 0 1 80-80" stroke="currentColor" strokeWidth="9" fill="none" strokeLinecap="round" />
        </svg>
        <p className="text-sm text-white/70">{label}</p>
        <p className="num mt-1 text-4xl font-bold">{value}</p>
        {hint && <p className="mt-1 text-xs text-white/60">{hint}</p>}
      </div>
    );
  }
  return (
    <div className={cn("rounded-2xl border bg-card px-4 py-3.5 shadow-xs", className)}>
      <p className="text-[0.8rem] font-medium text-muted-foreground">{label}</p>
      <p className="num mt-1 text-[1.7rem] leading-tight font-semibold">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function Panel({ title, action, children, className }: { title: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl border bg-card p-4 shadow-xs sm:p-5", className)}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[1.05rem] leading-snug font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export const OUTCOME_LABEL: Record<string, string> = {
  REDIRECT_REVIEW: "Foi para o Google",
  SUSPENDED: "Bloqueado (pagamento)",
  TRIAL_EXPIRED: "Bloqueado (trial)",
  NO_DESTINATION: "Sem Place ID",
};
