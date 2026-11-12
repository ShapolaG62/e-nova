"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { ImageUp, Save } from "lucide-react";
import type { MarcaConfig, MarcaPosicao } from "@/db/schema";
import { enviarMarcaAction, salvarMarcaAction } from "@/app/actions/clipador";

type Formato = "vertical" | "horizontal";

const POSICOES: [string, string, "esq" | "centro" | "dir", "topo" | "centro" | "base"][] = [
  ["↖", "Canto superior esquerdo", "esq", "topo"], ["↑", "Centro superior", "centro", "topo"], ["↗", "Canto superior direito", "dir", "topo"],
  ["←", "Lateral esquerda, no meio", "esq", "centro"], ["•", "Centro", "centro", "centro"], ["→", "Lateral direita, no meio", "dir", "centro"],
  ["↙", "Canto inferior esquerdo", "esq", "base"], ["↓", "Centro inferior", "centro", "base"], ["↘", "Canto inferior direito", "dir", "base"],
];

/**
 * Preview de Short (9:16) e de vídeo (16:9) com a marca d'água arrastável.
 * A posição é guardada em frações da tela (0..1), então vale para qualquer resolução.
 */
export function MarcaEditor({ canalId, marca, fundoShort, fundoVideo }: { canalId: string; marca: MarcaConfig; fundoShort?: string; fundoVideo?: string }) {
  const [pos, setPos] = useState<Record<Formato, MarcaPosicao>>({ vertical: marca.vertical, horizontal: marca.horizontal });
  const [formato, setFormato] = useState<Formato>("vertical");
  const [versao, setVersao] = useState(marca.chave ?? "");
  const [salvando, salvar] = useTransition();
  const [enviando, enviar] = useTransition();
  const caixa = useRef<HTMLDivElement>(null);
  const arrastando = useRef<{ dx: number; dy: number } | null>(null);
  const marcaRef = useRef<HTMLDivElement>(null);
  const p = pos[formato];
  const alterar = (m: Partial<MarcaPosicao>) => setPos((s) => ({ ...s, [formato]: { ...s[formato], ...m } }));

  // linhas-guia que aparecem quando a marca "gruda" num alinhamento (frações da tela)
  const [guias, setGuias] = useState<{ v: number[]; h: number[] }>({ v: [], h: [] });
  const MARGEM = 0.05; // distância segura das bordas (as redes cobrem as pontas com botões e textos)
  const IMA = 0.03;    // quão perto precisa chegar para grudar

  /** Meia largura e meia altura da marca, em frações do preview. */
  function metade() {
    const rc = caixa.current?.getBoundingClientRect(), rm = marcaRef.current?.getBoundingClientRect();
    if (!rc || !rm || !rc.width || !rc.height) return { hw: p.largura / 2, hh: 0.03 };
    return { hw: rm.width / rc.width / 2, hh: rm.height / rc.height / 2 };
  }

  /** Alvos de alinhamento: centro, borda esquerda/direita (com margem) e topo/base (com margem). */
  function alvos() {
    const { hw, hh } = metade();
    return {
      x: [{ pos: 0.5, linha: 0.5 }, { pos: MARGEM + hw, linha: MARGEM }, { pos: 1 - MARGEM - hw, linha: 1 - MARGEM }],
      y: [{ pos: 0.5, linha: 0.5 }, { pos: MARGEM + hh, linha: MARGEM }, { pos: 1 - MARGEM - hh, linha: 1 - MARGEM }],
    };
  }

  function mover(e: React.PointerEvent) {
    if (!arrastando.current || !caixa.current) return;
    const r = caixa.current.getBoundingClientRect();
    let x = Math.min(1, Math.max(0, (e.clientX - r.left - arrastando.current.dx) / r.width));
    let y = Math.min(1, Math.max(0, (e.clientY - r.top - arrastando.current.dy) / r.height));
    const a = alvos();
    const v: number[] = [], h: number[] = [];
    const gx = a.x.reduce((m, c) => (Math.abs(c.pos - x) < Math.abs(m.pos - x) ? c : m));
    if (Math.abs(gx.pos - x) < IMA) { x = gx.pos; v.push(gx.linha); }
    const gy = a.y.reduce((m, c) => (Math.abs(c.pos - y) < Math.abs(m.pos - y) ? c : m));
    if (Math.abs(gy.pos - y) < IMA * (r.width / r.height)) { y = gy.pos; h.push(gy.linha); } // mesmo ímã em pixels na vertical
    setGuias({ v, h });
    alterar({ x, y });
  }

  const soltar = () => { arrastando.current = null; setGuias({ v: [], h: [] }); };

  /** Botões de posição: usam as mesmas margens das guias. */
  function irPara(px: "esq" | "centro" | "dir", py: "topo" | "centro" | "base") {
    const a = alvos();
    alterar({ x: a.x[px === "centro" ? 0 : px === "esq" ? 1 : 2].pos, y: a.y[py === "centro" ? 0 : py === "topo" ? 1 : 2].pos });
  }

  function teclado(e: React.KeyboardEvent) {
    const passo = e.shiftKey ? 0.05 : 0.01;
    const d = { ArrowLeft: [-passo, 0], ArrowRight: [passo, 0], ArrowUp: [0, -passo], ArrowDown: [0, passo] }[e.key];
    if (!d) return;
    e.preventDefault();
    alterar({ x: Math.min(1, Math.max(0, p.x + d[0])), y: Math.min(1, Math.max(0, p.y + d[1])) });
  }

  const fundo = formato === "vertical" ? fundoShort : fundoVideo;

  return (
    <div className="grid gap-3">
      <div role="tablist" aria-label="Formato do preview" className="flex gap-1.5">
        {(["vertical", "horizontal"] as const).map((f) => (
          <button key={f} type="button" role="tab" aria-selected={f === formato} onClick={() => setFormato(f)}
            className={`h-9 rounded-full border px-3 text-xs font-medium ${f === formato ? "border-signal bg-signal/10" : "text-muted-foreground hover:bg-muted"}`}>
            {f === "vertical" ? "Short (9:16)" : "Vídeo (16:9)"}
          </button>
        ))}
      </div>

      <div className={formato === "vertical" ? "mx-auto w-full max-w-[15rem]" : "w-full"}>
        <div
          ref={caixa}
          className={`relative w-full touch-none select-none overflow-hidden rounded-xl border bg-gradient-to-br from-zinc-700 via-zinc-800 to-zinc-950 ${formato === "vertical" ? "aspect-[9/16]" : "aspect-video"}`}
          onPointerDown={(e) => {
            // tocou na marca: arrasta mantendo o ponto onde pegou; tocou fora: a marca pula para o dedo e segue
            const r = marcaRef.current?.getBoundingClientRect();
            const naMarca = !!r && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
            arrastando.current = naMarca && r ? { dx: e.clientX - (r.left + r.width / 2), dy: e.clientY - (r.top + r.height / 2) } : { dx: 0, dy: 0 };
            e.currentTarget.setPointerCapture(e.pointerId);
            mover(e);
          }}
          onPointerMove={mover}
          onPointerUp={soltar}
          onPointerCancel={soltar}
        >
          {guias.v.map((g) => <span key={`v${g}`} aria-hidden className={`pointer-events-none absolute inset-y-0 z-10 w-px ${g === 0.5 ? "bg-fuchsia-400" : "bg-sky-400"}`} style={{ left: `${g * 100}%` }} />)}
          {guias.h.map((g) => <span key={`h${g}`} aria-hidden className={`pointer-events-none absolute inset-x-0 z-10 h-px ${g === 0.5 ? "bg-fuchsia-400" : "bg-sky-400"}`} style={{ top: `${g * 100}%` }} />)}
          {(guias.v.length > 0 || guias.h.length > 0) && <span aria-hidden className="pointer-events-none absolute inset-[5%] z-0 rounded border border-dashed border-white/20" />}
          {fundo && <img src={fundo} alt="" draggable={false} className="pointer-events-none absolute inset-0 size-full object-cover opacity-80" />}
          {!fundo && <span className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-xs text-white/50">prévia do vídeo</span>}
          <div
            ref={marcaRef}
            role="slider"
            tabIndex={0}
            aria-label="Marca d'água: arraste ou use as setas para mudar a posição"
            aria-valuetext={`${Math.round(p.x * 100)}% da esquerda, ${Math.round(p.y * 100)}% do topo`}
            onKeyDown={teclado}
            className="absolute cursor-grab outline-none ring-signal focus-visible:ring-2 active:cursor-grabbing"
            style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%`, width: `${p.largura * 100}%`, opacity: p.opacidade, transform: "translate(-50%, -50%)" }}
          >
            {versao ? (
              <img src={`/api/clipador/marca/${canalId}?v=${encodeURIComponent(versao)}`} alt="" draggable={false} className="pointer-events-none block w-full" />
            ) : (
              // exemplo até a imagem ser enviada: obedece tamanho e transparência como a marca de verdade
              <svg viewBox="0 0 300 100" className="pointer-events-none block w-full" aria-hidden>
                <rect x="4" y="4" width="292" height="92" rx="18" fill="#000" fillOpacity="0.55" stroke="#ffd23f" strokeWidth="6" />
                <text x="150" y="64" textAnchor="middle" fontFamily="Arial Black, Arial" fontSize="40" fill="#ffd23f">SUA MARCA</text>
              </svg>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-[auto_1fr] items-center gap-3">
        <div role="group" aria-label="Posições prontas" className="grid grid-cols-3 gap-1">
          {POSICOES.map(([seta, nome, px, py]) => (
            <button key={nome} type="button" onClick={() => irPara(px, py)} aria-label={nome} title={nome}
              className="grid size-10 place-items-center rounded-lg border text-sm hover:bg-muted sm:size-9">
              {seta}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Toque numa posição pronta ou arraste: perto do centro e das margens a marca gruda e aparece a linha-guia (rosa = centro, azul = margem).</p>
      </div>
      <label className="grid gap-1 text-xs">
        <span className="font-medium">Tamanho: {Math.round(p.largura * 100)}% da largura</span>
        <input type="range" min={4} max={60} value={Math.round(p.largura * 100)} onChange={(e) => alterar({ largura: Number(e.target.value) / 100 })} className="accent-[var(--primary)]" />
      </label>
      <label className="grid gap-1 text-xs">
        <span className="font-medium">Transparência: {Math.round(p.opacidade * 100)}% visível</span>
        <input type="range" min={10} max={100} value={Math.round(p.opacidade * 100)} onChange={(e) => alterar({ opacidade: Number(e.target.value) / 100 })} className="accent-[var(--primary)]" />
      </label>

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 text-sm font-medium hover:bg-muted has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50 sm:h-9">
          <ImageUp className="size-4" aria-hidden /> {enviando ? "Enviando…" : versao ? "Trocar imagem" : "Enviar a marca d'água"}
          <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={enviando}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const fd = new FormData();
              fd.set("arquivo", f);
              enviar(async () => {
                const r = await enviarMarcaAction(canalId, fd);
                if (r.ok) { toast.success(r.message ?? "Enviada"); setVersao(String(Date.now())); } else toast.error(r.message ?? "Não consegui enviar");
              });
              e.target.value = "";
            }} />
        </label>
        <button type="button" disabled={salvando}
          onClick={() => salvar(async () => {
            const r = await salvarMarcaAction(canalId, pos);
            if (r.ok) toast.success(r.message ?? "Salvo"); else toast.error(r.message ?? "Não consegui salvar");
          })}
          className="flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60 sm:h-9">
          <Save className="size-4" aria-hidden /> {salvando ? "Salvando…" : "Salvar posição"}
        </button>
      </div>
      <p className="text-xs text-muted-foreground">Dica: PNG com fundo transparente fica melhor.</p>
    </div>
  );
}
