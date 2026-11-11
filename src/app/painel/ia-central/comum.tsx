// Peças visuais e textos compartilhados entre a Central de IA e o Estúdio de mídia.
import { Check, X } from "lucide-react";
import { CATALOGO, CREDENCIAIS } from "@/lib/ia-hub/catalogo";
import type { Rota } from "@/lib/ia-hub/tipos";
import { cn } from "@/lib/utils";

export type TentativaView = { item: string; via: string; provedor: string; modelo?: string; ok: boolean; ms: number; erro?: string };

export const nomeItem = (id?: string | null) => {
  const i = CATALOGO.find((x) => x.id === id);
  return i ? i.nome.split(" (")[0] : (id ?? "—");
};
export const nomeCredencial = (id: string) => CREDENCIAIS.find((c) => c.id === id)?.nome ?? id;

/** "via fal.ai", "direto", "via Replicate", "no computador"… */
export function rotuloRota(r: { via: Rota["via"] | string; provedor: string }) {
  if (r.via === "fal") return "via fal.ai";
  if (r.via === "replicate") return "via Replicate";
  if (r.via === "ollama" || r.via === "local") return "no computador";
  if (r.via === "openai-compat") return ["openai", "deepseek", "mistral", "qwen"].includes(r.provedor) ? "direto" : `via ${nomeCredencial(r.provedor)}`;
  return "direto";
}

/** Motivo da falha em poucas palavras, para a linha do tempo. */
export function motivoCurto(erro?: string) {
  const e = (erro ?? "").toLowerCase();
  if (/limite|crédito|credito|quota|429|402/.test(e)) return "limite";
  if (/chave|401|403|permiss/.test(e)) return "chave recusada";
  if (/fora do ar|50\d|timeout|abort|tempo|offline|econnrefused|fetch failed/.test(e)) return "fora do ar";
  if (/formato|json/.test(e)) return "resposta inválida";
  if (/faltou|não faz|nao-suporta|só /.test(e)) return "não serve para isso";
  return "erro";
}

/** "Kling falhou (limite) → Hailuo assumiu" */
export function resumoRevezamento(ts: TentativaView[]) {
  if (!ts.length) return "";
  const ok = ts.find((t) => t.ok);
  const falhas = ts.filter((t) => !t.ok);
  const partes = falhas.map((f) => `${nomeItem(f.item)} falhou (${motivoCurto(f.erro)})`);
  if (ok) partes.push(falhas.length ? `${nomeItem(ok.item)} assumiu` : `${nomeItem(ok.item)} resolveu de primeira`);
  else partes.push("ninguém conseguiu");
  return partes.join(" → ");
}

const seg = (ms: number) => (ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)} s`);

/** Linha do tempo das tentativas: falhas em vermelho, quem assumiu em verde. */
export function CadeiaTentativas({ tentativas, compacta }: { tentativas: TentativaView[]; compacta?: boolean }) {
  if (!tentativas.length) return null;
  return (
    <ol className="flex flex-wrap items-center gap-x-1 gap-y-1.5 text-xs">
      {tentativas.map((t, i) => (
        <li key={i} className="flex min-w-0 items-center gap-1">
          {i > 0 && <span aria-hidden className="h-px w-3 bg-border" />}
          <span
            title={t.erro ?? undefined}
            className={cn(
              "inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5",
              t.ok
                ? "border-emerald-600/30 bg-emerald-600/10 text-emerald-800 dark:text-emerald-300"
                : "border-destructive/30 bg-destructive/10 text-destructive",
            )}
          >
            {t.ok ? <Check className="size-3" aria-hidden /> : <X className="size-3" aria-hidden />}
            <span className="truncate font-medium">{nomeItem(t.item)}</span>
            {!compacta && <span className="opacity-70">{t.ok ? seg(t.ms) : motivoCurto(t.erro)}</span>}
            <span className="sr-only">{t.ok ? "deu certo" : `falhou: ${t.erro ?? ""}`}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Nota de qualidade 1..10 em barrinhas. */
export function BarraNota({ nota }: { nota: number }) {
  return (
    <span className="inline-flex items-center gap-1.5" title={`Qualidade ${nota} de 10`}>
      <span aria-hidden className="flex gap-[2px]">
        {Array.from({ length: 10 }).map((_, i) => (
          <span key={i} className={cn("h-2.5 w-1 rounded-[1px]", i < nota ? "bg-signal" : "bg-muted-foreground/20")} />
        ))}
      </span>
      <span className="num text-xs text-muted-foreground">{nota}</span>
      <span className="sr-only">Qualidade {nota} de 10</span>
    </span>
  );
}

/** Custo de grátis a $$$. */
export function Custo({ custo }: { custo: number }) {
  if (custo === 0) return <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">grátis</span>;
  return (
    <span className="text-xs font-semibold tracking-wider" title={["", "barato", "médio", "caro"][custo]}>
      <span>{"$".repeat(custo)}</span>
      <span className="text-muted-foreground/30">{"$".repeat(3 - custo)}</span>
      <span className="sr-only">custo {["", "baixo", "médio", "alto"][custo]}</span>
    </span>
  );
}
