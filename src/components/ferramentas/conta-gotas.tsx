"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Copy, Pipette, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BotaoAcao, copiar, Painel, SeletorArquivos, useArmazenado } from "./comum";

type RGB = [number, number, number];
const hex = ([r, g, b]: RGB) => `#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
const deHex = (h: string): RGB => [1, 3, 5].map((i) => Number.parseInt(h.slice(i, i + 2), 16)) as RGB;
function hsl([r, g, b]: RGB): [number, number, number] {
  const [R, G, B] = [r / 255, g / 255, b / 255];
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, Math.round(l * 100)];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === R ? (G - B) / d + (G < B ? 6 : 0) : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
  return [Math.round(h * 60), Math.round(s * 100), Math.round(l * 100)];
}
const misturar = (a: RGB, b: RGB, t: number): RGB => a.map((x, i) => Math.round(x + (b[i] - x) * t)) as RGB;
const temEyeDropper = () => typeof window !== "undefined" && "EyeDropper" in window;
const nada = () => () => {};

type EyeDropperCtor = new () => { open: () => Promise<{ sRGBHex: string }> };

export function ContaGotas() {
  const suportaTela = useSyncExternalStore(nada, temEyeDropper, () => false);
  const [cor, setCor] = useState<RGB | null>(null);
  const [historicoBruto, setHistoricoBruto] = useArmazenado("enova.ferramentas.cores");
  const historico = useMemo<string[]>(() => {
    try {
      const v = JSON.parse(historicoBruto ?? "[]");
      return Array.isArray(v) ? v.filter((x) => typeof x === "string" && /^#[0-9A-F]{6}$/i.test(x)).slice(0, 16) : [];
    } catch {
      return [];
    }
  }, [historicoBruto]);
  const [imagem, setImagem] = useState<File[]>([]);
  const [sobre, setSobre] = useState<RGB | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  function escolher(c: RGB) {
    setCor(c);
    const h = hex(c);
    setHistoricoBruto(JSON.stringify([h, ...historico.filter((x) => x !== h)].slice(0, 16)));
  }

  async function daTela() {
    try {
      const Ctor = (window as unknown as { EyeDropper: EyeDropperCtor }).EyeDropper;
      const r = await new Ctor().open();
      escolher(deHex(r.sRGBHex.startsWith("#") ? r.sRGBHex : hex((r.sRGBHex.match(/\d+/g) ?? ["0", "0", "0"]).map(Number) as RGB)));
    } catch {
      /* cancelado com Esc */
    }
  }

  // desenha a imagem enviada no canvas
  useEffect(() => {
    const arq = imagem[0];
    const c = canvas.current;
    if (!arq || !c) return;
    const url = URL.createObjectURL(arq);
    const img = new Image();
    img.onload = () => {
      const max = 2000;
      const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      c.width = Math.round(img.naturalWidth * k);
      c.height = Math.round(img.naturalHeight * k);
      c.getContext("2d", { willReadFrequently: true })?.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
    };
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [imagem]);

  function corNoPonto(e: React.PointerEvent<HTMLCanvasElement>): RGB | null {
    const c = canvas.current;
    if (!c) return null;
    const r = c.getBoundingClientRect();
    const x = Math.floor(((e.clientX - r.left) / r.width) * c.width);
    const y = Math.floor(((e.clientY - r.top) / r.height) * c.height);
    const d = c.getContext("2d", { willReadFrequently: true })?.getImageData(Math.max(0, x), Math.max(0, y), 1, 1).data;
    return d ? [d[0], d[1], d[2]] : null;
  }

  const formatos = cor ? [
    { rotulo: "HEX", valor: hex(cor) },
    { rotulo: "RGB", valor: `rgb(${cor.join(", ")})` },
    { rotulo: "HSL", valor: (([h, s, l]) => `hsl(${h}, ${s}%, ${l}%)`)(hsl(cor)) },
  ] : [];
  const tons = cor ? [0.8, 0.6, 0.4, 0.2].map((t) => misturar(cor, [255, 255, 255], t)).concat([cor], [0.2, 0.4, 0.6, 0.8].map((t) => misturar(cor, [0, 0, 0], t))) : [];

  return (
    <Painel titulo="Conta-gotas" descricao="Pegue a cor de qualquer ponto da tela ou de uma imagem e copie em HEX, RGB ou HSL.">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
        <div className="grid gap-3">
          {suportaTela ? (
            <div>
              <BotaoAcao onClick={daTela} icone={<Pipette data-icon="inline-start" />}>Pegar cor da tela</BotaoAcao>
              <p className="mt-1.5 text-xs text-muted-foreground">Clique em qualquer ponto da tela (até fora do navegador, no Chrome e Edge). Esc cancela.</p>
            </div>
          ) : (
            <p className="rounded-xl bg-muted px-3 py-2 text-sm">Este navegador não pega cor direto da tela. Envie uma imagem (ou print) e toque no ponto que quer.</p>
          )}
          <SeletorArquivos aceita="image/*" arquivos={imagem} onChange={setImagem} rotulo="Pegar cor de uma imagem" dica="Depois toque no ponto da imagem." />
          {imagem[0] && (
            <div className="relative">
              <canvas
                ref={canvas}
                className="max-h-[60vh] w-full cursor-crosshair touch-none rounded-xl border object-contain"
                onPointerMove={(e) => setSobre(corNoPonto(e))}
                onPointerLeave={() => setSobre(null)}
                onPointerUp={(e) => { const c = corNoPonto(e); if (c) escolher(c); }}
                aria-label="Imagem: toque para pegar a cor"
              />
              {sobre && (
                <span className="pointer-events-none absolute top-2 left-2 flex items-center gap-1.5 rounded-md bg-background/90 px-2 py-1 font-mono text-xs shadow">
                  <span className="size-4 rounded border" style={{ background: hex(sobre) }} /> {hex(sobre)}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="grid gap-3">
          <div className="h-24 rounded-xl border" style={{ background: cor ? hex(cor) : "repeating-conic-gradient(var(--muted) 0 25%, transparent 0 50%) 0 0/16px 16px" }} aria-hidden />
          {cor ? (
            <>
              <ul className="grid gap-1.5">
                {formatos.map((f) => (
                  <li key={f.rotulo}>
                    <button type="button" onClick={() => copiar(f.valor, `${f.valor} copiado`)} className="flex min-h-11 w-full items-center gap-2 rounded-lg border px-3 text-left text-sm hover:bg-muted sm:min-h-9">
                      <span className="w-10 text-xs text-muted-foreground">{f.rotulo}</span>
                      <span className="min-w-0 flex-1 truncate font-mono">{f.valor}</span>
                      <Copy className="size-4 text-muted-foreground" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
              <div>
                <p className="mb-1.5 text-sm font-medium">Tons</p>
                <div className="grid grid-cols-9 overflow-hidden rounded-lg border">
                  {tons.map((t, i) => (
                    <button key={i} type="button" title={hex(t)} aria-label={`Copiar ${hex(t)}`} onClick={() => copiar(hex(t), `${hex(t)} copiado`)} className={cn("h-11", i === 4 && "ring-2 ring-foreground ring-inset")} style={{ background: hex(t) }} />
                  ))}
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhuma cor escolhida ainda.</p>
          )}
          {historico.length > 0 && (
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <p className="text-sm font-medium">Últimas cores</p>
                <Button variant="ghost" size="sm" className="h-8 text-muted-foreground" onClick={() => setHistoricoBruto(null)}>
                  <Trash2 data-icon="inline-start" /> Limpar
                </Button>
              </div>
              <div className="grid grid-cols-8 gap-1.5">
                {historico.map((h) => (
                  <button key={h} type="button" title={h} aria-label={`Usar ${h}`} onClick={() => setCor(deHex(h))} className="aspect-square rounded-md border" style={{ background: h }} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </Painel>
  );
}
