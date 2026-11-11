import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { WaveFile } from "wavefile";
import type { TranscriptSegment } from "@/db/schema";

/**
 * Transcrição local com Whisper (transformers.js + ONNX na CPU).
 * O modelo é baixado do Hugging Face uma vez e fica em .data/models.
 */
const MODEL = process.env.WHISPER_MODEL ?? "Xenova/whisper-small";
const SAMPLE_RATE = 16_000;

type Asr = (audio: Float32Array, opts: Record<string, unknown>) => Promise<{ text: string; chunks?: { timestamp: [number, number | null]; text: string }[] }>;
let asr: Promise<Asr> | null = null;

async function getAsr(): Promise<Asr> {
  asr ??= (async () => {
    const { pipeline, env } = await import("@huggingface/transformers");
    env.cacheDir = path.resolve(".data/models");
    env.allowLocalModels = true;
    return (await pipeline("automatic-speech-recognition", MODEL, { dtype: "q8" })) as unknown as Asr;
  })();
  return asr;
}

/** Lê o WAV mono 16 kHz gerado pelo ffmpeg. */
export async function readWav(file: string): Promise<Float32Array> {
  const wav = new WaveFile(await readFile(file));
  wav.toBitDepth("32f");
  const samples = wav.getSamples(false, Float32Array) as unknown as Float32Array | Float32Array[];
  return Array.isArray(samples) ? samples[0] : samples;
}

/** Volume (RMS) por segundo, normalizado 0..1 — usado na nota de "energia" dos cortes. */
export function energyPerSecond(audio: Float32Array): number[] {
  const out: number[] = [];
  for (let i = 0; i < audio.length; i += SAMPLE_RATE) {
    let sum = 0;
    const end = Math.min(audio.length, i + SAMPLE_RATE);
    for (let j = i; j < end; j++) sum += audio[j] * audio[j];
    out.push(Math.sqrt(sum / Math.max(1, end - i)));
  }
  const sorted = [...out].sort((a, b) => a - b);
  const p95 = sorted[Math.floor(sorted.length * 0.95)] || 1;
  return out.map((v) => Math.round(Math.min(1, v / p95) * 1000) / 1000);
}

/**
 * Transcreve em blocos de 30 s (o tamanho de janela do Whisper), reportando o progresso.
 * Devolve segmentos com início/fim em segundos do vídeo.
 */
export async function transcribe(audio: Float32Array, onProgress: (pct: number) => Promise<void> | void): Promise<TranscriptSegment[]> {
  const run = await getAsr();
  const CHUNK = 30 * SAMPLE_RATE;
  const segments: TranscriptSegment[] = [];
  const total = Math.ceil(audio.length / CHUNK);
  for (let c = 0; c < total; c++) {
    const offset = c * 30;
    const slice = audio.subarray(c * CHUNK, Math.min(audio.length, (c + 1) * CHUNK));
    if (slice.length < SAMPLE_RATE / 2) break;
    const r = await run(slice, { language: "portuguese", task: "transcribe", return_timestamps: true });
    for (const ch of r.chunks ?? []) {
      const text = ch.text.trim();
      if (!text) continue;
      const start = offset + (ch.timestamp[0] ?? 0);
      const end = offset + (ch.timestamp[1] ?? Math.min(30, slice.length / SAMPLE_RATE));
      segments.push({ start: Math.round(start * 100) / 100, end: Math.round(Math.max(end, start + 0.3) * 100) / 100, text });
    }
    if (!r.chunks?.length && r.text.trim()) segments.push({ start: offset, end: offset + slice.length / SAMPLE_RATE, text: r.text.trim() });
    await onProgress(Math.round(((c + 1) / total) * 100));
  }
  return segments;
}

/**
 * Energia por segundo lida direto dos bytes do WAV (PCM 16 bits, mono, 16 kHz), sem converter o arquivo inteiro
 * para float. Num vídeo de 9 min isso cai de ~25 s para menos de 1 s.
 */
export async function energiaRapida(file: string): Promise<number[]> {
  const buf = await readFile(file);
  let pos = 12, ini = -1, tam = 0;
  while (pos + 8 <= buf.length) {
    const id = buf.toString("ascii", pos, pos + 4);
    const n = buf.readUInt32LE(pos + 4);
    if (id === "data") { ini = pos + 8; tam = Math.min(n, buf.length - ini); break; }
    pos += 8 + n + (n % 2);
  }
  if (ini < 0) return [];
  const amostras = Math.floor(tam / 2);
  const out: number[] = [];
  for (let i = 0; i < amostras; i += SAMPLE_RATE) {
    const fim = Math.min(amostras, i + SAMPLE_RATE);
    let soma = 0;
    for (let j = i; j < fim; j++) { const v = buf.readInt16LE(ini + j * 2) / 32768; soma += v * v; }
    out.push(Math.sqrt(soma / Math.max(1, fim - i)));
  }
  const ord = [...out].sort((a, b) => a - b);
  const p95 = ord[Math.floor(ord.length * 0.95)] || 1;
  return out.map((v) => Math.round(Math.min(1, v / p95) * 1000) / 1000);
}
