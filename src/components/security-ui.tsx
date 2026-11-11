import { AlertTriangle, CheckCircle2, Info, OctagonAlert } from "lucide-react";
import type { SecurityFinding } from "@/db/schema";
import { cn } from "@/lib/utils";

export function GradeBadge({ grade, className }: { grade: string | null; className?: string }) {
  const tone = !grade
    ? "bg-muted text-muted-foreground"
    : grade.startsWith("A")
      ? "bg-accent text-accent-foreground"
      : grade === "B"
        ? "bg-sky-100 text-sky-900"
        : grade === "C"
          ? "bg-amber-100 text-amber-900"
          : "bg-red-100 text-red-800";
  return <span className={cn("num grid size-12 shrink-0 place-items-center rounded-xl text-xl font-bold", tone, className)}>{grade ?? "–"}</span>;
}

const ICON = { critica: OctagonAlert, alta: AlertTriangle, media: AlertTriangle, baixa: Info, ok: CheckCircle2 };
const COLOR = { critica: "text-red-600", alta: "text-red-500", media: "text-amber-600", baixa: "text-sky-600", ok: "text-primary" };
const LABEL = { critica: "Crítico", alta: "Alto", media: "Médio", baixa: "Baixo", ok: "OK" };

export function FindingList({ findings }: { findings: SecurityFinding[] }) {
  const problems = findings.filter((f) => f.severity !== "ok");
  const ok = findings.filter((f) => f.severity === "ok");
  return (
    <div className="grid gap-3">
      {problems.length === 0 && <p className="text-sm text-primary">Nenhum problema encontrado.</p>}
      <ul className="grid gap-2.5">
        {problems.map((f) => {
          const Icon = ICON[f.severity];
          return (
            <li key={f.id} className="flex gap-2.5">
              <Icon className={cn("mt-0.5 size-4 shrink-0", COLOR[f.severity])} />
              <div className="min-w-0 text-sm">
                <p className="font-medium">
                  {f.title} <span className={cn("text-xs font-normal", COLOR[f.severity])}>· {LABEL[f.severity]}</span>
                </p>
                <p className="break-words text-muted-foreground">{f.detail}</p>
                {f.fix && <p className="mt-0.5 text-xs">Como corrigir: {f.fix}</p>}
              </div>
            </li>
          );
        })}
      </ul>
      {ok.length > 0 && (
        <p className="text-xs text-muted-foreground">
          <CheckCircle2 className="mr-1 inline size-3.5 text-primary" />
          Em ordem: {ok.map((f) => f.title.replace(/ presente$/, "")).join(" · ")}
        </p>
      )}
    </div>
  );
}
