"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Brain, Plus, RefreshCw, RotateCcw, Trash2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { adicionarLicaoAction, apagarLicaoAction, reaprenderAction, zerarAjustesAction } from "@/app/actions/aprendizado";
import type { Area, Perfil, PesosCortes } from "@/lib/aprendizado";
import type { ActionState } from "@/lib/validation";

const TITULO: Record<Area, { nome: string; vazio: string }> = {
  cortes: { nome: "Cortes virais", vazio: "Ainda sem lições. Use 👍/👎 nos cortes, gere e publique: com uns 5 sinais a ferramenta começa a aprender." },
  videos: { nome: "Gerador de vídeos", vazio: "Ainda sem lições. Avalie os vídeos prontos e edite as falas do roteiro: cada edição ensina o estilo da equipe." },
};
const NOME_SINAL: Record<string, string> = {
  curtiu: "👍 gostei", "nao-curtiu": "👎 não gostei", publicado: "publicados", baixado: "baixados", renderizado: "gerados", excluido: "excluídos", refeito: "refeitos", editado: "falas editadas",
};
const NOME_PESO: Record<keyof PesosCortes, string> = { gancho: "Gancho", emocao: "Emoção", valor: "Valor", ritmo: "Ritmo", energia: "Energia" };

export function PainelArea({ area, perfil, sinais, padrao, podeEditar }: { area: Area; perfil: Perfil; sinais: Record<string, number>; padrao: PesosCortes; podeEditar: boolean }) {
  const [pend, start] = useTransition();
  const [nova, setNova] = useState("");
  const rodar = (fn: () => Promise<ActionState>, depois?: () => void) =>
    start(async () => { const r = await fn(); (r.ok ? toast.success : toast.error)(r.message ?? "Pronto."); if (r.ok) depois?.(); });
  const total = Object.values(sinais).reduce((a, b) => a + b, 0);

  return (
    <section aria-labelledby={`ap-${area}`} className="grid content-start gap-4 rounded-xl border bg-card p-4 sm:p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id={`ap-${area}`} className="text-xl font-bold tracking-wide uppercase">{TITULO[area].nome}</h2>
          <p className="text-xs text-muted-foreground">
            {total} sinais nos últimos 30 dias{perfil.atualizadoEm ? ` · lições atualizadas em ${new Date(perfil.atualizadoEm).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}` : ""}
          </p>
        </div>
        {podeEditar && (
          <Button variant="outline" className="h-10 sm:h-9" disabled={pend} onClick={() => rodar(() => reaprenderAction(area))}><RefreshCw /> Aprender agora</Button>
        )}
      </header>

      {total > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Sinais recebidos">
          {Object.entries(sinais).map(([s, n]) => (
            <li key={s} className="rounded-md border px-2 py-1 text-xs"><strong className="font-semibold">{n}</strong> {NOME_SINAL[s] ?? s}</li>
          ))}
        </ul>
      )}

      <div className="grid gap-2">
        <h3 className="text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">Lições em uso</h3>
        {perfil.licoes.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">{TITULO[area].vazio}</p>
        ) : (
          <ol className="grid gap-1.5">
            {perfil.licoes.map((l) => (
              <li key={l.id} className="flex items-start gap-2.5 rounded-lg border-l-2 border-primary bg-muted/40 px-3 py-2 text-sm">
                {l.origem === "equipe" ? <UserRound className="mt-0.5 size-4 shrink-0 text-primary" aria-label="Escrita pela equipe" /> : <Brain className="mt-0.5 size-4 shrink-0 text-primary" aria-label="Aprendida pela IA" />}
                <span className="flex-1">{l.texto}</span>
                {podeEditar && (
                  <button type="button" disabled={pend} aria-label="Apagar lição" title="Apagar (a IA não vai recriar)"
                    onClick={() => confirm("Apagar esta lição? A IA não vai recriá-la.") && rodar(() => apagarLicaoAction(area, l.id))}
                    className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                    <Trash2 className="size-4" />
                  </button>
                )}
              </li>
            ))}
          </ol>
        )}
        {podeEditar && (
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); rodar(() => adicionarLicaoAction(area, nova), () => setNova("")); }}>
            <input value={nova} onChange={(e) => setNova(e.target.value)} maxLength={220} placeholder={area === "cortes" ? "Ex.: Prefira trechos com história pessoal" : "Ex.: Sempre termine com uma pergunta ao público"}
              aria-label="Nova lição" className="h-10 min-w-0 flex-1 rounded-md border border-input bg-transparent px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:h-9 sm:text-sm" />
            <Button type="submit" className="h-10 sm:h-9" disabled={pend || nova.trim().length < 8}><Plus /> Ensinar</Button>
          </form>
        )}
      </div>

      {area === "cortes" && (
        <div className="grid gap-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">Como a nota de viralidade pesa cada critério</h3>
            {podeEditar && perfil.pesos && (
              <button type="button" disabled={pend} onClick={() => confirm("Voltar os pesos e a duração ao padrão?") && rodar(() => zerarAjustesAction(area))} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                <RotateCcw className="size-3.5" /> Padrão
              </button>
            )}
          </div>
          <ul className="grid gap-1.5">
            {(Object.keys(padrao) as (keyof PesosCortes)[]).map((k) => {
              const v = perfil.pesos?.[k] ?? padrao[k];
              const dif = v - padrao[k];
              return (
                <li key={k} className="grid grid-cols-[5.5rem_1fr_3.5rem] items-center gap-2 text-sm">
                  <span>{NOME_PESO[k]}</span>
                  <span className="h-2 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-primary" style={{ width: `${Math.round(v * 200)}%` }} /></span>
                  <span className="text-right text-xs tabular-nums text-muted-foreground">{Math.round(v * 100)}%{Math.abs(dif) >= 0.01 ? (dif > 0 ? " ↑" : " ↓") : ""}</span>
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-muted-foreground">
            {perfil.duracao ? `Duração que a equipe aprova: ${perfil.duracao.min}–${perfil.duracao.max} s (alvo ${perfil.duracao.alvo} s).` : "Duração: padrão de 20–60 s até haver aprovações suficientes."}
            {perfil.pesos ? " Os pesos já foram ajustados pelos cortes aprovados e reprovados." : " Pesos no padrão até ter pelo menos 3 cortes aprovados."}
          </p>
        </div>
      )}

      {perfil.exemplos && perfil.exemplos.length > 0 && (
        <div className="grid gap-1.5">
          <h3 className="text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">Exemplos que a IA usa como referência</h3>
          <ul className="grid gap-1 text-sm">
            {perfil.exemplos.map((e, i) => <li key={i} className="truncate">“{e.titulo}”{e.gancho ? <span className="text-muted-foreground"> — {e.gancho}</span> : null}</li>)}
          </ul>
        </div>
      )}
    </section>
  );
}
