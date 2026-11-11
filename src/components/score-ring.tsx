import { cn } from "@/lib/utils";

/** Anel da nota viral (0–100): a cor muda com a faixa, o número fica no centro. */
export function ScoreRing({ score, size = 64, className }: { score: number; size?: number; className?: string }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const color = score >= 75 ? "var(--signal)" : score >= 55 ? "var(--star)" : "var(--muted-foreground)";
  return (
    <div className={cn("relative shrink-0", className)} style={{ width: size, height: size }} role="img" aria-label={`Nota viral ${score} de 100`}>
      <svg viewBox="0 0 64 64" className="size-full -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--muted)" strokeWidth="6" />
        <circle cx="32" cy="32" r={r} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} />
      </svg>
      <span className="num absolute inset-0 grid place-items-center text-lg font-bold">{score}</span>
    </div>
  );
}

const LABELS = { gancho: "Gancho", emocao: "Emoção", valor: "Valor", ritmo: "Ritmo", energia: "Energia" } as const;

export function ScoreBars({ scores }: { scores: Record<keyof typeof LABELS, number> }) {
  return (
    <ul className="grid grid-cols-5 gap-1.5">
      {(Object.keys(LABELS) as (keyof typeof LABELS)[]).map((k) => (
        <li key={k} className="grid gap-1">
          <div className="flex h-10 flex-col justify-end overflow-hidden rounded-md bg-muted" title={`${LABELS[k]}: ${scores[k]}`}>
            <div className="w-full rounded-md bg-primary/70" style={{ height: `${scores[k]}%` }} />
          </div>
          <span className="text-center text-[0.65rem] text-muted-foreground">{LABELS[k]}</span>
        </li>
      ))}
    </ul>
  );
}
