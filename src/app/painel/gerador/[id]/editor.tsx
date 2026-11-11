"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Clapperboard, ImageIcon, Loader2, Plus, RefreshCw, Trash2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ActionState } from "@/lib/validation";
import { excluirVideoAction, produzirAction, reescreverAction, refazerCenaAction, remontarAction, salvarRoteiroAction } from "@/app/actions/gerador";

type Cena = {
  id: string; narracao: string; textoNaTela: string; tipo: "imagem" | "video"; prompt: string; camera: string;
  status: string; erro?: string; visual: { url: string; video: boolean } | null; audio: string | null; usado: string; resumo?: string;
};

function useAcao() {
  const router = useRouter();
  const [pendente, start] = useTransition();
  const rodar = (fn: () => Promise<ActionState | void>) =>
    start(async () => {
      const r = await fn();
      if (r && r.message) (r.ok ? toast.success : toast.error)(r.message);
      router.refresh();
    });
  return { pendente, rodar };
}

export function Acoes({ id, status, temRoteiro, todasProntas, temResultado }: { id: string; status: string; temRoteiro: boolean; todasProntas: boolean; temResultado: boolean }) {
  const { pendente, rodar } = useAcao();
  const rodando = status === "ROTEIRIZANDO" || status === "PRODUZINDO";
  return (
    <div className="flex flex-wrap gap-2">
      {temRoteiro && !todasProntas && (
        <Button className="h-11 flex-1 sm:h-10 sm:flex-none" disabled={pendente || rodando} onClick={() => rodar(() => produzirAction(id))}>
          {pendente ? <Loader2 className="animate-spin" /> : <Clapperboard />} Produzir o vídeo
        </Button>
      )}
      {temRoteiro && todasProntas && (
        <Button className="h-11 flex-1 sm:h-10 sm:flex-none" variant={temResultado ? "outline" : "default"} disabled={pendente || rodando} onClick={() => rodar(() => remontarAction(id))}>
          <RefreshCw /> {temResultado ? "Montar de novo" : "Montar o vídeo"}
        </Button>
      )}
      {!temRoteiro && status === "FALHOU" && (
        <Button className="h-11 sm:h-10" disabled={pendente} onClick={() => rodar(() => reescreverAction(id))}><Wand2 /> Tentar o roteiro de novo</Button>
      )}
      {temRoteiro && (
        <Button variant="outline" className="h-11 sm:h-10" disabled={pendente || rodando} onClick={() => confirm("Pedir um roteiro totalmente novo? As cenas atuais serão descartadas.") && rodar(() => reescreverAction(id))}>
          <Wand2 /> Novo roteiro
        </Button>
      )}
      <Button variant="ghost" className="h-11 text-destructive sm:h-10" disabled={pendente || rodando} onClick={() => confirm("Excluir este vídeo e os arquivos dele?") && rodar(() => excluirVideoAction(id))}>
        <Trash2 /> Excluir
      </Button>
    </div>
  );
}

const area = "w-full rounded-lg border border-input bg-transparent px-3 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60 sm:text-sm dark:bg-input/30";

export function EditorRoteiro({ id, cenas: iniciais, bloqueado, vertical, animado = false }: { id: string; cenas: Cena[]; bloqueado: boolean; vertical: boolean; animado?: boolean }) {
  const [cenas, setCenas] = useState(iniciais);
  const [base, setBase] = useState(iniciais);
  if (base !== iniciais) { setBase(iniciais); setCenas(iniciais); } // dados novos do servidor
  const { pendente, rodar } = useAcao();
  const mudou = JSON.stringify(cenas.map(({ id, narracao, textoNaTela, tipo, prompt, camera }) => [id, narracao, textoNaTela, tipo, prompt, camera]))
    !== JSON.stringify(iniciais.map(({ id, narracao, textoNaTela, tipo, prompt, camera }) => [id, narracao, textoNaTela, tipo, prompt, camera]));
  const set = (i: number, v: Partial<Cena>) => setCenas((cs) => cs.map((c, j) => (j === i ? { ...c, ...v } : c)));
  const mover = (i: number, d: number) => setCenas((cs) => { const n = [...cs]; const [x] = n.splice(i, 1); n.splice(i + d, 0, x); return n; });
  const palavras = cenas.reduce((a, c) => a + c.narracao.split(/\s+/).filter(Boolean).length, 0);

  return (
    <section aria-labelledby="roteiro" className="grid gap-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="roteiro" className="text-lg font-semibold">Roteiro — {cenas.length} cenas</h2>
          <p className="text-xs text-muted-foreground">≈ {Math.round(palavras / 2.5)} s de narração. Edite o que quiser: só as cenas alteradas são geradas de novo.</p>
        </div>
        {mudou && (
          <div className="flex gap-2">
            <Button variant="outline" className="h-10" disabled={pendente} onClick={() => setCenas(iniciais)}>Desfazer</Button>
            <Button className="h-10" disabled={pendente || bloqueado} onClick={() => rodar(() => salvarRoteiroAction(id, { cenas: cenas.map(({ id, narracao, textoNaTela, tipo, prompt, camera }) => ({ id, narracao, textoNaTela, tipo, prompt, camera })) }))}>
              {pendente && <Loader2 className="animate-spin" />} Salvar roteiro
            </Button>
          </div>
        )}
      </div>

      <ol className="grid gap-3">
        {cenas.map((c, i) => (
          <li key={c.id} className="grid gap-3 rounded-2xl border bg-card p-3 sm:grid-cols-[8rem_minmax(0,1fr)] sm:p-4">
            <div className="flex gap-3 sm:grid sm:content-start">
              <div className={cn("grid shrink-0 place-items-center overflow-hidden rounded-lg bg-muted", vertical ? "aspect-[9/16] w-24 sm:w-32" : "aspect-video w-32")}>
                {c.visual ? (
                  c.visual.video
                    ? <video src={c.visual.url} muted loop playsInline autoPlay preload="metadata" className="size-full object-cover" />
                    : <img src={c.visual.url} alt={`Imagem da cena ${i + 1}`} className="size-full object-cover" loading="lazy" />
                ) : c.status === "GERANDO" ? <Loader2 className="size-5 animate-spin text-muted-foreground" aria-label="Gerando" /> : <ImageIcon className="size-5 text-muted-foreground" aria-hidden />}
              </div>
              <div className="grid min-w-0 content-start gap-1.5 text-xs text-muted-foreground sm:text-[0.7rem]">
                <span className="font-semibold text-foreground">Cena {i + 1}</span>
                <span>{{ PENDENTE: "Ainda não gerada", GERANDO: "Gerando…", PRONTA: "Pronta", FALHOU: "Falhou" }[c.status] ?? c.status}</span>
                {c.usado && !animado && <span className="break-words">{c.usado}</span>}
                {c.resumo && <span className="break-words">{c.resumo}</span>}
              </div>
            </div>
            <div className="grid min-w-0 gap-2.5">
              <label className="grid gap-1 text-sm">
                <span className="font-medium">Narração</span>
                <textarea rows={2} value={c.narracao} disabled={bloqueado} onChange={(e) => set(i, { narracao: e.target.value })} className={area} />
              </label>
              {c.audio && <audio src={c.audio} controls preload="none" className="h-9 w-full" />}
              <div className={cn("grid gap-2.5", !animado && "sm:grid-cols-2")}>
                <label className="grid gap-1 text-sm">
                  <span className="font-medium">Texto na tela <span className="font-normal text-muted-foreground">(opcional)</span></span>
                  <input value={c.textoNaTela} maxLength={80} disabled={bloqueado} onChange={(e) => set(i, { textoNaTela: e.target.value })} className={cn(area, "h-10")} />
                </label>
                {!animado && <div className="grid grid-cols-2 gap-2">
                  <label className="grid gap-1 text-sm">
                    <span className="font-medium">Tipo</span>
                    <select value={c.tipo} disabled={bloqueado} onChange={(e) => set(i, { tipo: e.target.value as Cena["tipo"] })} className={cn(area, "h-10 px-2")}>
                      <option value="imagem">Imagem</option>
                      <option value="video">Clipe</option>
                    </select>
                  </label>
                  <label className="grid gap-1 text-sm">
                    <span className="font-medium">Câmera</span>
                    <select value={c.camera} disabled={bloqueado || c.tipo === "video"} onChange={(e) => set(i, { camera: e.target.value })} className={cn(area, "h-10 px-2")}>
                      <option value="">Automática</option>
                      <option value="aproximar">Aproximar</option>
                      <option value="afastar">Afastar</option>
                      <option value="panoramica-direita">Para a direita</option>
                      <option value="panoramica-esquerda">Para a esquerda</option>
                      <option value="parado">Parada</option>
                    </select>
                  </label>
                </div>}
              </div>
              {!animado && <details>
                <summary className="cursor-pointer text-sm font-medium">Descrição da imagem para a IA</summary>
                <textarea rows={3} value={c.prompt} disabled={bloqueado} onChange={(e) => set(i, { prompt: e.target.value })} className={cn(area, "mt-1.5")} aria-label="Descrição da imagem" />
                <p className="mt-1 text-xs text-muted-foreground">Em inglês, porque os geradores de imagem entendem melhor. O estilo visual do vídeo é somado sozinho.</p>
              </details>}
              {c.erro && <p className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200">{c.erro}</p>}
              <div className="flex flex-wrap gap-1.5">
                <Button size="sm" variant="ghost" className="h-9" disabled={bloqueado || i === 0} onClick={() => mover(i, -1)} aria-label="Subir cena"><ArrowUp /></Button>
                <Button size="sm" variant="ghost" className="h-9" disabled={bloqueado || i === cenas.length - 1} onClick={() => mover(i, 1)} aria-label="Descer cena"><ArrowDown /></Button>
                <Button size="sm" variant="ghost" className="h-9 text-destructive" disabled={bloqueado || cenas.length <= 1} onClick={() => setCenas((cs) => cs.filter((_, j) => j !== i))}><Trash2 /> Tirar</Button>
                {c.status === "PRONTA" && !mudou && (
                  <Button size="sm" variant="outline" className="ml-auto h-9" disabled={bloqueado || pendente} onClick={() => rodar(() => refazerCenaAction(id, c.id))}><RefreshCw /> Refazer cena</Button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>
      <Button variant="outline" className="h-11 w-full sm:h-10 sm:w-fit" disabled={bloqueado || cenas.length >= 20}
        onClick={() => setCenas((cs) => [...cs, { id: `nova-${cs.length + 1}`, narracao: "", textoNaTela: "", tipo: "imagem", prompt: "", camera: "", status: "PENDENTE", visual: null, audio: null, usado: "" }])}>
        <Plus /> Adicionar cena
      </Button>
    </section>
  );
}
