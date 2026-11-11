"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Crop, FlipHorizontal2, RotateCcw, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BotaoAcao, Painel, SeletorArquivos } from "./comum";

type Caixa = { x: number; y: number; w: number; h: number }; // frações (0..1) da imagem já girada
const PROPORCOES = [
  { id: "livre", rotulo: "Livre", r: 0 },
  { id: "1:1", rotulo: "1:1", dica: "Feed", r: 1 },
  { id: "4:5", rotulo: "4:5", dica: "Retrato", r: 4 / 5 },
  { id: "9:16", rotulo: "9:16", dica: "Stories", r: 9 / 16 },
  { id: "16:9", rotulo: "16:9", dica: "YouTube", r: 16 / 9 },
  { id: "3:4", rotulo: "3:4", dica: "Foto", r: 3 / 4 },
] as const;

/** Desenha a imagem com giro/espelho num canvas do tamanho pedido. */
function desenhar(img: HTMLImageElement, giro: number, espelho: boolean, alvo: HTMLCanvasElement, escala = 1) {
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  const deitada = giro % 180 !== 0;
  alvo.width = Math.round((deitada ? H : W) * escala);
  alvo.height = Math.round((deitada ? W : H) * escala);
  const ctx = alvo.getContext("2d")!;
  ctx.save();
  ctx.translate(alvo.width / 2, alvo.height / 2);
  ctx.scale(espelho ? -escala : escala, escala);
  ctx.rotate((giro * Math.PI) / 180);
  ctx.drawImage(img, -W / 2, -H / 2);
  ctx.restore();
}

function caixaInicial(prop: number, ow: number, oh: number): Caixa {
  if (!prop) return { x: 0.05, y: 0.05, w: 0.9, h: 0.9 };
  // maior caixa com a proporção (em pixels) que cabe
  let wpx = ow;
  let hpx = wpx / prop;
  if (hpx > oh) {
    hpx = oh;
    wpx = hpx * prop;
  }
  const w = wpx / ow;
  const h = hpx / oh;
  return { x: (1 - w) / 2, y: (1 - h) / 2, w, h };
}

export function RecortarImagem() {
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [giro, setGiro] = useState(0);
  const [espelho, setEspelho] = useState(false);
  const [prop, setProp] = useState<(typeof PROPORCOES)[number]["id"]>("1:1");
  const [caixa, setCaixa] = useState<Caixa>({ x: 0.05, y: 0.05, w: 0.9, h: 0.9 });
  const [salvando, setSalvando] = useState(false);
  const tela = useRef<HTMLCanvasElement>(null);
  const area = useRef<HTMLDivElement>(null);
  const arraste = useRef<{ modo: "mover" | "redimensionar"; px: number; py: number; inicio: Caixa } | null>(null);

  const ow = img ? (giro % 180 ? img.naturalHeight : img.naturalWidth) : 1;
  const oh = img ? (giro % 180 ? img.naturalWidth : img.naturalHeight) : 1;
  const razao = PROPORCOES.find((p) => p.id === prop)?.r ?? 0;

  // carrega a imagem escolhida
  useEffect(() => {
    const arq = arquivos[0];
    if (!arq) return;
    const url = URL.createObjectURL(arq);
    const i = new Image();
    i.onload = () => {
      setImg(i);
      setGiro(0);
      setEspelho(false);
      setCaixa(caixaInicial(1, i.naturalWidth, i.naturalHeight));
      setProp("1:1");
    };
    i.onerror = () => toast.error("Não consegui abrir essa imagem.");
    i.src = url;
    return () => URL.revokeObjectURL(url);
  }, [arquivos]);

  // redesenha a prévia (reduzida) quando gira ou espelha
  useEffect(() => {
    if (!img || !tela.current) return;
    const k = Math.min(1, 1400 / Math.max(img.naturalWidth, img.naturalHeight));
    desenhar(img, giro, espelho, tela.current, k);
  }, [img, giro, espelho]);

  function mudarProporcao(id: (typeof PROPORCOES)[number]["id"]) {
    setProp(id);
    setCaixa(caixaInicial(PROPORCOES.find((p) => p.id === id)?.r ?? 0, ow, oh));
  }

  function girar(delta: number) {
    const novo = (giro + delta + 360) % 360;
    setGiro(novo);
    if (img) {
      const w2 = novo % 180 ? img.naturalHeight : img.naturalWidth;
      const h2 = novo % 180 ? img.naturalWidth : img.naturalHeight;
      setCaixa(caixaInicial(razao, w2, h2));
    }
  }

  function aoPressionar(e: React.PointerEvent, modo: "mover" | "redimensionar") {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    arraste.current = { modo, px: e.clientX, py: e.clientY, inicio: caixa };
  }

  function aoMover(e: React.PointerEvent) {
    const a = arraste.current;
    const r = area.current?.getBoundingClientRect();
    if (!a || !r) return;
    const dx = (e.clientX - a.px) / r.width;
    const dy = (e.clientY - a.py) / r.height;
    const c = a.inicio;
    if (a.modo === "mover") {
      setCaixa({ ...c, x: Math.min(1 - c.w, Math.max(0, c.x + dx)), y: Math.min(1 - c.h, Math.max(0, c.y + dy)) });
      return;
    }
    let w = Math.max(0.05, Math.min(1 - c.x, c.w + dx));
    let h = Math.max(0.05, Math.min(1 - c.y, c.h + dy));
    if (razao) {
      // mantém a proporção em pixels: h = w * ow / (oh * razao)
      h = (w * ow) / (oh * razao);
      if (c.y + h > 1) {
        h = 1 - c.y;
        w = (h * oh * razao) / ow;
      }
    }
    setCaixa({ ...c, w, h });
  }

  async function salvar() {
    const arq = arquivos[0];
    if (!img || !arq) return;
    setSalvando(true);
    try {
      const inteira = document.createElement("canvas");
      desenhar(img, giro, espelho, inteira);
      const sx = Math.round(caixa.x * inteira.width);
      const sy = Math.round(caixa.y * inteira.height);
      const sw = Math.max(1, Math.round(caixa.w * inteira.width));
      const sh = Math.max(1, Math.round(caixa.h * inteira.height));
      const saida = document.createElement("canvas");
      saida.width = sw;
      saida.height = sh;
      saida.getContext("2d")!.drawImage(inteira, sx, sy, sw, sh, 0, 0, sw, sh);
      const tipo = /png|webp/.test(arq.type) ? arq.type : "image/jpeg";
      const blob = await new Promise<Blob | null>((ok) => saida.toBlob(ok, tipo, 0.95));
      if (!blob) throw new Error("Não deu para gerar a imagem.");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${arq.name.replace(/\.[^.]+$/, "")} (recortada).${tipo === "image/png" ? "png" : tipo === "image/webp" ? "webp" : "jpg"}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 3000);
      toast.success(`Imagem recortada: ${sw}×${sh} px`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao recortar.");
    } finally {
      setSalvando(false);
    }
  }

  const pxW = Math.round(caixa.w * ow);
  const pxH = Math.round(caixa.h * oh);

  return (
    <Painel titulo="Recortar imagem" descricao="Recorte fotos em formatos prontos para redes sociais. Tudo acontece no seu navegador e a imagem sai no tamanho original.">
      {!img ? (
        <SeletorArquivos aceita="image/*" arquivos={arquivos} onChange={setArquivos} rotulo="Toque para escolher a imagem" />
      ) : (
        <div className="grid gap-3">
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
            {PROPORCOES.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => mudarProporcao(p.id)}
                aria-pressed={prop === p.id}
                className={cn("flex min-h-11 flex-col items-center justify-center rounded-lg border text-sm sm:min-h-10", prop === p.id ? "border-signal bg-signal/10 font-medium" : "hover:bg-muted")}
              >
                {p.rotulo}
                {"dica" in p && <span className="text-[0.68rem] text-muted-foreground">{p.dica}</span>}
              </button>
            ))}
          </div>
          <div className="flex justify-center overflow-hidden rounded-xl bg-muted/60 p-4">
            <div ref={area} className="relative inline-block max-w-full touch-none select-none" onPointerMove={aoMover} onPointerUp={() => (arraste.current = null)} onPointerCancel={() => (arraste.current = null)}>
              <canvas ref={tela} className="block max-h-[60vh] max-w-full" />
              <div
                role="presentation"
                onPointerDown={(e) => aoPressionar(e, "mover")}
                className="absolute cursor-move border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] outline outline-1 outline-black/40"
                style={{ left: `${caixa.x * 100}%`, top: `${caixa.y * 100}%`, width: `${caixa.w * 100}%`, height: `${caixa.h * 100}%` }}
              >
                <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
                  {Array.from({ length: 9 }).map((_, i) => <span key={i} className="border border-white/25" />)}
                </div>
                <span
                  role="presentation"
                  onPointerDown={(e) => aoPressionar(e, "redimensionar")}
                  className="absolute -right-3.5 -bottom-3.5 size-7 cursor-nwse-resize rounded-full border-2 border-white bg-signal shadow"
                />
              </div>
            </div>
          </div>
          <p className="text-center text-xs text-muted-foreground">Arraste a área para mover; puxe a bolinha do canto para mudar o tamanho. Recorte: {pxW}×{pxH} px</p>
          <div className="grid grid-cols-3 gap-2 sm:flex">
            <Button type="button" variant="outline" className="h-11 sm:h-8" onClick={() => girar(-90)} aria-label="Girar para a esquerda"><RotateCcw /> <span className="hidden sm:inline">Girar</span></Button>
            <Button type="button" variant="outline" className="h-11 sm:h-8" onClick={() => girar(90)} aria-label="Girar para a direita"><RotateCw /> <span className="hidden sm:inline">Girar</span></Button>
            <Button type="button" variant={espelho ? "secondary" : "outline"} className="h-11 sm:h-8" onClick={() => setEspelho(!espelho)} aria-pressed={espelho} aria-label="Espelhar"><FlipHorizontal2 /> <span className="hidden sm:inline">Espelhar</span></Button>
          </div>
          <div className="grid gap-2 sm:flex">
            <BotaoAcao ocupado={salvando} onClick={salvar} icone={<Crop data-icon="inline-start" />}>Recortar e baixar</BotaoAcao>
            <Button type="button" variant="ghost" className="h-11 sm:h-9" onClick={() => { setImg(null); setArquivos([]); }}>Escolher outra imagem</Button>
          </div>
        </div>
      )}
    </Painel>
  );
}
