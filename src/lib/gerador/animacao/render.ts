import "server-only";
import { spawn } from "node:child_process";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";
import sharp from "sharp";
import { argsVideo, ffmpeg } from "@/lib/clips/ffmpeg";
import { quadro } from "./desenho";
import { camCorte, quadroCorte } from "./corte";
import { camDaCena, quadro3D } from "./mundo3d";
import { gerarAmbiente, gerarSom } from "./sons";
import type { AnimCena, AnimVideo, Cena3D, CorteCena, CorteVideo, Mundo3D, Som } from "./tipos";

// Render da animação por código: cada quadro é desenhado em SVG, rasterizado pelo sharp
// e enviado direto para o FFmpeg. Depois entram a narração, os efeitos e o clima de fundo.

export type CenaRender = { anim: AnimCena; dur: number; fala: number; narracao: string; audio: string; corte?: CorteCena; mundo3d?: Cena3D };

const LIGA = new Set("a o as os um uma uns umas de do da dos das em no na nos nas num numa por pelo pela pra pro para com sem e ou que se não nem ao à aos às".split(" "));

/** Blocos de 1 a 3 palavras, sem deixar palavra de ligação sozinha no fim. */
function blocos(texto: string, curto = false) {
  const ws = texto.split(/\s+/).filter(Boolean);
  const out: string[][] = [];
  let at: string[] = [];
  for (const w of ws) {
    at.push(w);
    const fim = /[.!?…;:,]$/.test(w);
    // curto (mundo em corte): 1 ou 2 palavras por vez, como nos Shorts de "como funciona"
    const max = curto ? 2 : 3, letras = curto ? 14 : 16;
    if (fim || at.join(" ").length >= 22 || (!LIGA.has(w.toLowerCase()) && (at.length >= max || at.join(" ").length >= letras))) { out.push(at); at = []; }
  }
  if (at.length) out.push(at);
  return out;
}

/** Em que bloco/palavra a fala está no instante t (proporcional ao tamanho das palavras). */
function legendaEm(narracao: string, fala: number, t: number, curto = false) {
  const bs = blocos(narracao, curto);
  const peso = (w: string) => Math.max(2, w.replace(/[^\p{L}\p{N}]/gu, "").length) + (/[.,!?;:…]$/.test(w) ? 3 : 0);
  const total = bs.flat().reduce((a, w) => a + peso(w), 0) || 1;
  let acc = 0.05;
  for (const b of bs) {
    for (const [i, w] of b.entries()) {
      const d = (fala * peso(w)) / total;
      if (t < acc + d) return { palavras: b, atual: i };
      acc += d;
    }
  }
  return t < fala + 0.3 && bs.length ? { palavras: bs[bs.length - 1], atual: bs[bs.length - 1].length - 1 } : undefined;
}

export async function renderAnimacao(o: {
  dir: string; W: number; H: number; fps?: number;
  cenas: CenaRender[]; video: AnimVideo; legendas: boolean; clima: "tensao" | "leve";
  corte?: CorteVideo; // mundo em corte: desenha com o corte.ts em vez do desenho.ts
  mundo3d?: Mundo3D;  // maquete 3D: desenha com o mundo3d.ts
  progresso?: (pct: number) => Promise<void> | void;
}): Promise<string> {
  const fps = o.fps ?? 24;
  const total = o.cenas.reduce((a, c) => a + c.dur, 0);
  const nq = Math.ceil(total * fps);
  const videoArq = path.join(o.dir, "anim.mp4");

  // 1) imagem: quadros em ordem, com 4 sendo desenhados em paralelo
  const ff = spawn(ffmpegPath as unknown as string, ["-hide_banner", "-loglevel", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", `${o.W}x${o.H}`, "-r", String(fps), "-i", "-",
    ...(await argsVideo("alta")), videoArq], { windowsHide: true });
  let erro = "";
  ff.stderr.on("data", (d) => (erro += d));
  const fim = new Promise<void>((ok, falha) => ff.on("close", (c) => (c === 0 ? ok() : falha(new Error(`ffmpeg (animação): ${erro.slice(-400)}`)))));
  const ultima = o.cenas.length - 1;
  // mundo em corte: peças já construídas em cada cena (acumulando o que entra e tirando o que sai)
  const visiveis: string[][] = [];
  if (o.corte || o.mundo3d) {
    const atual = new Set<string>();
    for (const c of o.cenas) { const k = o.mundo3d ? c.mundo3d : c.corte; for (const id of k?.adiciona ?? []) atual.add(id); for (const id of k?.remove ?? []) atual.delete(id); visiveis.push([...atual]); }
  }
  // maquete 3D: a câmera de cada cena sai de onde a anterior parou
  const camsCorte = o.corte ? o.cenas.map((c, i) => camCorte(o.corte!, c.corte ?? {}, visiveis[i], o.W, o.H)) : [];
  const cams = o.mundo3d ? o.cenas.map((c, i) => camDaCena(o.mundo3d!, c.mundo3d ?? {}, visiveis[i])) : [];
  const desenhar = (i: number) => {
    let t = i / fps, k = 0;
    while (k < ultima && t >= o.cenas[k].dur) { t -= o.cenas[k].dur; k++; }
    const c = o.cenas[k];
    const svg = o.mundo3d ? quadro3D({
      W: o.W, H: o.H, t, dur: c.dur, mundo: o.mundo3d, cena: c.mundo3d ?? {}, visiveis: visiveis[k],
      camAntes: k > 0 ? cams[k - 1] : undefined,
      ceuAntes: [...o.cenas.slice(0, k)].reverse().find((x) => x.mundo3d?.ceu)?.mundo3d?.ceu,
      legenda: o.legendas ? legendaEm(c.narracao, c.fala, t, true) : undefined,
    }) : o.corte ? quadroCorte({
      W: o.W, H: o.H, t, dur: c.dur, seed: 77, video: o.corte, cena: c.corte ?? {}, visiveis: visiveis[k],
      camAntes: k > 0 ? camsCorte[k - 1] : undefined,
      ceuAntes: [...o.cenas.slice(0, k)].reverse().find((x) => x.corte?.ceu)?.corte?.ceu,
      legenda: o.legendas ? legendaEm(c.narracao, c.fala, t, true) : undefined,
    }) : quadro({
      W: o.W, H: o.H, cena: c.anim, t, dur: c.dur, seed: 1000 + k * 17, video: o.video,
      legenda: o.legendas ? legendaEm(c.narracao, c.fala, t) : undefined,
      escolhaProg: k === ultima && o.video.escolha ? Math.min(1, t / Math.max(1, c.dur * 0.6)) : undefined,
    });
    return sharp(Buffer.from(svg)).raw().toBuffer();
  };
  const fila: Promise<Buffer>[] = [];
  const AHEAD = 4;
  for (let i = 0; i < Math.min(AHEAD, nq); i++) fila.push(desenhar(i));
  for (let i = 0; i < nq; i++) {
    const buf = await fila.shift()!;
    if (i + AHEAD < nq) fila.push(desenhar(i + AHEAD));
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
    if (i % (fps * 2) === 0) await o.progresso?.(i / nq);
  }
  ff.stdin.end();
  await fim;

  // 2) som: narração em sequência + efeitos no início de cada cena + clima de fundo
  const entradas: string[] = [];
  const filtros: string[] = [];
  o.cenas.forEach((c, i) => { entradas.push("-i", c.audio); filtros.push(`[${i}:a]aresample=48000,aformat=channel_layouts=stereo,apad,atrim=0:${c.dur.toFixed(3)}[n${i}]`); });
  filtros.push(`${o.cenas.map((_, i) => `[n${i}]`).join("")}concat=n=${o.cenas.length}:v=0:a=1,loudnorm=I=-16:TP=-1.5:LRA=11[voz]`);
  let idx = o.cenas.length;
  const mix = ["[voz]"];
  const cache = new Map<Som, string>();
  let t0 = 0;
  for (const c of o.cenas) {
    const som = c.mundo3d?.som ?? c.corte?.som ?? c.anim.som;
    if (som && som !== "nenhum") {
      if (!cache.has(som)) cache.set(som, await gerarSom(som, o.dir));
      entradas.push("-i", cache.get(som)!);
      const ms = Math.round((t0 + 0.08) * 1000);
      filtros.push(`[${idx}:a]volume=0.55,adelay=${ms}|${ms}[s${idx}]`);
      mix.push(`[s${idx}]`);
      idx++;
    }
    t0 += c.dur;
  }
  entradas.push("-i", await gerarAmbiente(total, o.dir, o.clima));
  filtros.push(`[${idx}:a]volume=${o.clima === "tensao" ? 0.5 : 0.35}[amb]`);
  mix.push("[amb]");
  filtros.push(`${mix.join("")}amix=inputs=${mix.length}:duration=first:normalize=0,alimiter=limit=0.95[out]`);
  const audioArq = path.join(o.dir, "anim.wav");
  await ffmpeg([...entradas, "-filter_complex", filtros.join(";"), "-map", "[out]", "-ar", "48000", audioArq], { cwd: o.dir });

  // 3) junta imagem e som
  const final = path.join(o.dir, "final.mp4");
  await ffmpeg(["-i", videoArq, "-i", audioArq, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", final], { cwd: o.dir });
  return final;
}
