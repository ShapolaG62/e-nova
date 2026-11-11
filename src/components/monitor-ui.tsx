import { cn } from "@/lib/utils";

export function StateDot({ state, active = true }: { state: "UP" | "DOWN" | "UNKNOWN"; active?: boolean }) {
  const s = !active
    ? { label: "Pausado", dot: "bg-muted-foreground/40", text: "text-muted-foreground" }
    : state === "UP"
      ? { label: "No ar", dot: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-400" }
      : state === "DOWN"
        ? { label: "Fora do ar", dot: "bg-red-500 animate-pulse", text: "text-red-700 dark:text-red-400" }
        : { label: "Verificando", dot: "bg-amber-400", text: "text-amber-700 dark:text-amber-400" };
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap", s.text)}>
      <span className={cn("size-2 rounded-full", s.dot)} />
      {s.label}
    </span>
  );
}

export function sslInfo(expires: Date | null) {
  if (!expires) return { label: "—", tone: "muted" as const };
  const days = Math.floor((expires.getTime() - Date.now()) / 86_400_000);
  if (days < 0) return { label: "Expirado", tone: "bad" as const };
  if (days <= 15) return { label: `${days} dias`, tone: "warn" as const };
  return { label: `${days} dias`, tone: "ok" as const };
}

export function SslBadge({ expires }: { expires: Date | null }) {
  const s = sslInfo(expires);
  return (
    <span
      className={cn(
        "text-xs whitespace-nowrap tabular-nums",
        s.tone === "bad" && "font-medium text-red-600",
        s.tone === "warn" && "font-medium text-amber-600",
        s.tone === "ok" && "text-muted-foreground",
        s.tone === "muted" && "text-muted-foreground",
      )}
    >
      SSL {s.label}
    </span>
  );
}

export const pct = (v: number | null) => (v === null ? "—" : `${v.toFixed(v >= 99.95 || v < 10 ? 1 : 2).replace(".", ",")}%`);

/** Barras de latência (ms) das últimas verificações; vermelho = falha. */
export function LatencyBars({ checks }: { checks: { ok: boolean; latencyMs: number | null; checkedAt: Date }[] }) {
  if (!checks.length) return <p className="text-sm text-muted-foreground">Sem verificações ainda.</p>;
  const max = Math.max(100, ...checks.map((c) => c.latencyMs ?? 0));
  const fmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
  return (
    <div className="flex h-28 items-end gap-px" role="img" aria-label="Latência das últimas verificações">
      {checks.map((c, i) => (
        <div
          key={i}
          title={`${fmt.format(c.checkedAt)} · ${c.ok ? `${c.latencyMs} ms` : "falhou"}`}
          className={cn("flex-1 rounded-t-[2px]", c.ok ? "bg-primary/70 hover:bg-primary" : "bg-red-500")}
          style={{ height: c.ok ? `${Math.max(4, ((c.latencyMs ?? 0) / max) * 100)}%` : "100%" }}
        />
      ))}
    </div>
  );
}
