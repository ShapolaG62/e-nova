import Link from "next/link";
import { cn } from "@/lib/utils";
import type { QuemFaz } from "@/lib/gerador/quem";

const STATUS: Record<string, { rotulo: string; cls: string }> = {
  ROTEIRIZANDO: { rotulo: "Escrevendo o roteiro", cls: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300" },
  ROTEIRO_PRONTO: { rotulo: "Roteiro para revisar", cls: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" },
  PRODUZINDO: { rotulo: "Produzindo", cls: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300" },
  PRONTO: { rotulo: "Pronto", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" },
  FALHOU: { rotulo: "Precisa de atenção", cls: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300" },
};

export function StatusVideo({ status }: { status: string }) {
  const s = STATUS[status] ?? { rotulo: status, cls: "bg-muted text-muted-foreground" };
  return <span className={cn("inline-flex w-fit items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", s.cls)}>{s.rotulo}</span>;
}

/** Quem a Central vai usar em cada etapa — aparece antes de gastar. */
export function QuemFazLista({ quem, podeConfigurar }: { quem: QuemFaz[]; podeConfigurar: boolean }) {
  return (
    <div className="grid gap-2 rounded-2xl border bg-card p-4 text-sm">
      <h3 className="font-semibold">Quem vai fazer cada parte</h3>
      <ul className="grid gap-1.5">
        {quem.map((q) => (
          <li key={q.cap} className="flex flex-wrap items-baseline justify-between gap-x-3">
            <span className="text-muted-foreground">{q.rotulo}</span>
            <span className={cn("text-right font-medium", !q.ia && "text-muted-foreground")}>
              {q.ia ?? "nenhuma IA ligada"}
              {q.ia && <span className={cn("ml-1.5 rounded px-1.5 py-0.5 text-[0.7rem]", q.gratis ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300")}>{q.gratis ? "grátis" : "pago"}</span>}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        Se uma IA falhar ou acabar o crédito, a próxima assume sozinha. Sem IA de vídeo, as cenas viram imagens; sem IA de música, o vídeo sai só com a voz.
        {podeConfigurar && <> Ordem e chaves na <Link href="/painel/ia-central" className="font-medium text-signal underline">Central de IA</Link>.</>}
      </p>
    </div>
  );
}
