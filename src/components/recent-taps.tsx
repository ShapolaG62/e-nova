import { Monitor, Smartphone } from "lucide-react";
import { OUTCOME_LABEL } from "@/components/charts";
import { cn } from "@/lib/utils";

type Tap = {
  id: number;
  occurredAt: Date;
  device: string;
  os: string | null;
  browser: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  outcome: string;
  plateLabel: string;
};

const when = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export function RecentTapsList({ taps }: { taps: Tap[] }) {
  if (!taps.length) return <p className="text-sm text-muted-foreground">Nenhum toque registrado ainda.</p>;
  return (
    <ul className="divide-y">
      {taps.map((tp) => {
        const Icon = tp.device === "DESKTOP" ? Monitor : Smartphone;
        const place = [tp.city, tp.region, tp.country].filter(Boolean).join(", ");
        const ok = tp.outcome === "REDIRECT_REVIEW";
        return (
          <li key={tp.id} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
            <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">
                {tp.plateLabel}
                <span className="text-muted-foreground"> · {[tp.os, tp.browser].filter(Boolean).join(" / ") || "aparelho desconhecido"}</span>
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {when.format(tp.occurredAt)}
                {place && ` · ${place}`}
              </p>
            </div>
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-[11px]",
                ok ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
              )}
            >
              {ok ? "Google" : OUTCOME_LABEL[tp.outcome]}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
