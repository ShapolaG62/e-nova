"use client";

import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/** Indicador de passos do assistente (Setor → Negócio → …). */
export function Passos({ passos, atual, className }: { passos: string[]; atual: number; className?: string }) {
  return (
    <ol className={cn("flex flex-wrap gap-1.5", className)} aria-label="Etapas">
      {passos.map((p, i) => {
        const feito = i < atual;
        const on = i === atual;
        return (
          <li
            key={p}
            aria-current={on ? "step" : undefined}
            className={cn(
              "flex items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-xs font-semibold tracking-wide uppercase",
              on ? "border-primary/40 bg-primary/10 text-primary" : "bg-card text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "grid size-6 place-items-center rounded-full border text-[0.7rem]",
                on && "border-primary bg-primary text-primary-foreground",
                feito && "border-emerald-600 bg-emerald-600 text-white",
                !on && !feito && "bg-muted",
              )}
            >
              {feito ? <Check className="size-3.5" /> : i + 1}
            </span>
            <span className={cn(!on && "hidden sm:inline")}>{p}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** Anel de progresso cônico (0–100). */
export function AnelProgresso({ pct, pronto, rotulo }: { pct: number; pronto?: boolean; rotulo?: React.ReactNode }) {
  const cor = pronto ? "#059669" : "var(--primary)";
  return (
    <div
      className="grid size-28 shrink-0 place-items-center rounded-full transition-[background] duration-300"
      style={{ background: `conic-gradient(${cor} ${pronto ? 100 : pct}%, var(--muted) 0)` }}
      role="progressbar"
      aria-valuenow={Math.round(pronto ? 100 : pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span className="grid size-[5.6rem] place-items-center rounded-full bg-popover text-xl font-bold tabular-nums">
        {rotulo ?? (pronto ? <Check className="size-8 text-emerald-600" /> : `${Math.round(pct)}%`)}
      </span>
    </div>
  );
}

/** Mini terminal com as etapas concluídas. */
export function Terminal({ titulo, linhas, final }: { titulo?: string; linhas: { ok?: boolean; texto: string }[]; final?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight });
  }, [linhas.length, final]);
  return (
    <div
      ref={ref}
      className="max-h-52 min-h-36 w-full overflow-y-auto rounded-xl bg-[#0f1a1c] px-4 py-3 text-left font-mono text-[12.5px] leading-relaxed text-[#bfe5e2]"
      aria-live="polite"
    >
      {titulo && <div className="text-[#7fa9a6]">$ {titulo}</div>}
      {linhas.map((l, i) => (
        <div key={i}>
          {l.ok !== false ? <span className="text-emerald-400">✓</span> : <span className="text-[#7fa9a6]">…</span>} {l.texto}
        </div>
      ))}
      {final && <div className="mt-1 font-semibold text-emerald-400">{final}</div>}
    </div>
  );
}

/** Progresso simulado enquanto uma ação longa roda (sobe devagar até ~94%). */
export function useProgressoSimulado(ativo: boolean, lento: boolean) {
  const [pct, setPct] = useState(0);
  useEffect(() => {
    if (!ativo) return;
    const t = setInterval(() => setPct((p) => Math.min(94, p + (lento ? 1.2 : 6) * Math.random() + (lento ? 0.15 : 1))), 170);
    return () => {
      clearInterval(t);
      setPct(0);
    };
  }, [ativo, lento]);
  return pct;
}

/**
 * Iframe de um site renderizado a 1280px de largura e reduzido para caber no contêiner.
 * Com `rolarAoPassar`, a página desliza até o fim enquanto o mouse está sobre o cartão
 * (o elemento pai com a classe `group`). A rolagem é feita dentro do iframe (mesma origem),
 * para não distorcer seções com altura em "vh".
 */
export function MiniaturaSite({
  src,
  titulo,
  largura = 1280,
  rolarAoPassar = false,
  className,
}: {
  src: string;
  titulo: string;
  largura?: number;
  rolarAoPassar?: boolean;
  className?: string;
}) {
  const caixa = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const [dim, setDim] = useState({ k: 0, h: 0 });
  const [carregado, setCarregado] = useState(false);

  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const medir = () => setDim({ k: el.clientWidth / largura, h: el.clientHeight });
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, [largura]);

  useEffect(() => {
    if (!rolarAoPassar) return;
    const alvo = (caixa.current?.closest(".group") as HTMLElement | null) ?? caixa.current;
    if (!alvo) return;
    let raf = 0;
    const animar = (paraFim: boolean) => {
      cancelAnimationFrame(raf);
      const w = frame.current?.contentWindow;
      if (!w) return;
      let inicio = 0;
      let de = 0;
      const passo = (t: number) => {
        try {
          const max = Math.max(0, w.document.documentElement.scrollHeight - w.innerHeight);
          if (!inicio) { inicio = t; de = w.scrollY; }
          const para = paraFim ? max : 0;
          const dur = paraFim ? Math.min(9000, Math.max(2500, Math.abs(para - de) * 1.1)) : 600;
          const p = Math.min(1, (t - inicio) / dur);
          const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
          w.scrollTo({ top: de + (para - de) * e, behavior: "instant" });
          if (p < 1) raf = requestAnimationFrame(passo);
        } catch { /* iframe de outra origem ou descarregado */ }
      };
      raf = requestAnimationFrame(passo);
    };
    const entrar = () => animar(true);
    const sair = () => animar(false);
    alvo.addEventListener("mouseenter", entrar);
    alvo.addEventListener("mouseleave", sair);
    return () => {
      cancelAnimationFrame(raf);
      alvo.removeEventListener("mouseenter", entrar);
      alvo.removeEventListener("mouseleave", sair);
    };
  }, [rolarAoPassar]);

  return (
    <div ref={caixa} className={cn("relative overflow-hidden bg-muted", className)}>
      {!carregado && <div className="absolute inset-0 animate-pulse bg-muted" />}
      {dim.k > 0 && (
        <iframe
          ref={frame}
          src={src}
          title={titulo}
          loading="lazy"
          tabIndex={-1}
          aria-hidden
          onLoad={() => setCarregado(true)}
          className="pointer-events-none absolute top-0 left-0 origin-top-left border-0 bg-white"
          style={{ width: largura, height: dim.h / dim.k, transform: `scale(${dim.k})` }}
        />
      )}
    </div>
  );
}
