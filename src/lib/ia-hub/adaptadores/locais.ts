import "server-only";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";
import { FalhaProvedor, type Adaptador } from "../tipos";
import { arquivoDaEntrada } from "./index";

/* eslint-disable @typescript-eslint/no-explicit-any */

function ffmpeg(args: string[], sinal: AbortSignal) {
  return new Promise<void>((ok, falha) => {
    const p = spawn(ffmpegPath as unknown as string, ["-y", "-hide_banner", "-loglevel", "error", ...args]);
    let err = "";
    p.stderr.on("data", (c) => (err += c));
    sinal.addEventListener("abort", () => p.kill(), { once: true });
    p.on("exit", (code) => (code === 0 ? ok() : falha(new FalhaProvedor(`ffmpeg: ${err.slice(0, 200)}`, "erro"))));
  });
}

/** Adaptadores que rodam no próprio servidor: sempre ficam como reserva grátis. */
export const LOCAIS: Record<string, Adaptador> = {
  // Whisper local (o mesmo dos Cortes virais): áudio 16 kHz mono → texto com tempos
  whisper: async (cap, e, { sinal, progresso }) => {
    if (cap !== "transcricao") throw new FalhaProvedor("só transcreve", "nao-suporta");
    const arq = await arquivoDaEntrada(e, sinal);
    const dir = await mkdtemp(path.join(tmpdir(), "enova-tr-"));
    try {
      const ent = path.join(dir, "entrada"), wav = path.join(dir, "a.wav");
      await writeFile(ent, arq.buffer);
      await ffmpeg(["-i", ent, "-ac", "1", "-ar", "16000", wav], sinal);
      const { readWav, transcribe } = await import("@/lib/clips/transcribe");
      const segs = await transcribe(await readWav(wav), (pct) => progresso?.(pct, "Transcrevendo no computador…"));
      const segmentos = segs.map((s: any) => ({ inicio: s.start, fim: s.end, texto: s.text }));
      return { texto: segmentos.map((s) => s.texto).join(" ").trim(), segmentos };
    } finally { await rm(dir, { recursive: true, force: true }); }
  },
  // Filtro de ruído com FFmpeg (afftdn + highpass/lowpass)
  denoise: async (cap, e, { sinal }) => {
    if (cap !== "limpar-audio") throw new FalhaProvedor("só limpa áudio", "nao-suporta");
    const arq = await arquivoDaEntrada(e, sinal);
    const dir = await mkdtemp(path.join(tmpdir(), "enova-dn-"));
    try {
      const ent = path.join(dir, "entrada"), out = path.join(dir, "limpo.mp3");
      await writeFile(ent, arq.buffer);
      await ffmpeg(["-i", ent, "-af", "highpass=f=80,lowpass=f=12000,afftdn=nf=-25,loudnorm", "-vn", out], sinal);
      return { arquivos: [{ buffer: await readFile(out), mime: "audio/mpeg", nome: "audio-limpo.mp3" }] };
    } finally { await rm(dir, { recursive: true, force: true }); }
  },
  // O motor de cortes do E-Nova é um fluxo próprio (tela Cortes virais); aqui ele só indica isso.
  cortes: async () => {
    throw new FalhaProvedor("Use a tela Cortes virais para o motor local.", "nao-suporta");
  },
};
