import "server-only";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import { ffmpeg, probe } from "@/lib/clips/ffmpeg";
import { chavesLista } from "@/lib/ia-hub/config";
import { getObjectBuffer, putObject, deleteObject } from "@/lib/storage";

// "Minha voz": prepara a amostra, clona na Cartesia (nuvem) e fala pelo modelo local (Chatterbox, grátis).

export const TEXTO_CONSENTIMENTO =
  "Confirmo que esta voz é minha, ou que tenho autorização por escrito do dono da voz para criar e usar esta cópia em narrações da agência. Sei que não posso usá-la para enganar pessoas ou me passar por outra pessoa.";

/** Texto para ler na gravação: frases variadas cobrem os sons do português (~45 s em ritmo normal). */
export const TEXTO_LEITURA = `Oi! Tudo bem com você? Hoje eu vou contar uma história rápida.
Num sábado de manhã, o João abriu a padaria às seis e meia, como sempre.
O cheiro de pão quentinho tomou conta da rua, e logo chegaram os primeiros clientes.
— Bom dia! Vai querer o de sempre? — perguntou ele, sorrindo.
Às vezes a gente esquece, mas são os pequenos detalhes que fazem a diferença:
um café bem passado, um bolo de cenoura com chocolate, e alguém que lembra o seu nome.
Se você gostou, comenta aqui embaixo e compartilha com um amigo. Até a próxima!`;

const SEG_MAX = 60;

/** Limpa a gravação: mono 24 kHz, sem silêncio nas pontas, volume normalizado, no máximo 60 s. */
export async function prepararAmostra(entrada: string, dir: string) {
  const wav = path.join(dir, "amostra.wav");
  await ffmpeg([
    "-i", entrada, "-vn", "-ac", "1", "-ar", "24000", "-t", String(SEG_MAX + 5),
    "-af", "highpass=f=70,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.2,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.3,areverse,loudnorm=I=-18:TP=-2",
    "-t", String(SEG_MAX), wav,
  ]);
  const info = await probe(wav);
  return { wav, duracao: info.durationSec ?? 0 };
}

// ───────── Cartesia ─────────
const CA = "https://api.cartesia.ai";
const VERSAO = "2026-08-14";

async function chaveCartesia(): Promise<string | null> {
  return (await chavesLista("cartesia"))[0]?.apiKey ?? null;
}

export async function clonarCartesia(nome: string, wav: Buffer): Promise<string> {
  const chave = await chaveCartesia();
  if (!chave) throw new Error("Sem chave da Cartesia na Central de IA.");
  const fd = new FormData();
  fd.append("clip", new Blob([new Uint8Array(wav)], { type: "audio/wav" }), "amostra.wav");
  fd.append("name", nome.slice(0, 60));
  fd.append("language", "pt");
  fd.append("accent", "brazilian-portuguese");
  fd.append("description", "Voz clonada no E-Nova");
  const r = await fetch(`${CA}/voices/clone`, { method: "POST", headers: { Authorization: `Bearer ${chave}`, "Cartesia-Version": VERSAO }, body: fd, signal: AbortSignal.timeout(120_000) });
  const txt = await r.text();
  if (!r.ok) throw new Error(`Cartesia recusou a clonagem (${r.status}): ${txt.slice(0, 200)}`);
  const id = (JSON.parse(txt) as { id?: string }).id;
  if (!id) throw new Error("Cartesia não devolveu o id da voz.");
  return id;
}

export async function apagarCartesia(id: string) {
  const chave = await chaveCartesia();
  if (!chave) return;
  await fetch(`${CA}/voices/${encodeURIComponent(id)}`, { method: "DELETE", headers: { Authorization: `Bearer ${chave}`, "Cartesia-Version": VERSAO }, signal: AbortSignal.timeout(30_000) }).catch(() => {});
}

export async function falarCartesia(chave: string, vozId: string, texto: string, sinal: AbortSignal): Promise<Response> {
  return fetch(`${CA}/tts/bytes`, {
    method: "POST", signal: sinal,
    headers: { Authorization: `Bearer ${chave}`, "Cartesia-Version": VERSAO, "Content-Type": "application/json" },
    body: JSON.stringify({ model_id: "sonic-3.6", transcript: texto.slice(0, 5000), voice: { id: vozId }, language: "pt", output_format: { container: "mp3", sample_rate: 44100, bit_rate: 128000 } }),
  });
}

// ───────── Modelo local (Chatterbox, licença MIT) ─────────
const PORTA = Number(process.env.VOZ_LOCAL_PORTA ?? 7861);
const PASTA = path.resolve("tools", "voz-local");
const g = globalThis as unknown as { __vozLocal?: ChildProcess | null; __vozLocalSubindo?: Promise<void> | null };

function uvExe(): string {
  const cands = [process.env.UV_PATH, path.join(os.homedir(), "AppData", "Local", "Microsoft", "WinGet", "Links", "uv.exe"), path.join(os.homedir(), ".local", "bin", process.platform === "win32" ? "uv.exe" : "uv")];
  return cands.find((c) => c && existsSync(c)) ?? "uv";
}

async function saude(): Promise<{ ok: boolean; dispositivo?: string } | null> {
  try {
    const r = await fetch(`http://127.0.0.1:${PORTA}/saude`, { signal: AbortSignal.timeout(2500) });
    return r.ok ? ((await r.json()) as { ok: boolean; dispositivo?: string }) : null;
  } catch { return null; }
}

/** O modelo local está instalado nesta máquina? (pasta preparada com `uv sync`) */
export function vozLocalInstalada() {
  return existsSync(path.join(PASTA, ".venv"));
}

/** Sobe o servidor local se ainda não estiver no ar (o primeiro carregamento leva ~30–90 s). */
export async function garantirVozLocal(): Promise<void> {
  if (await saude()) return;
  if (!vozLocalInstalada()) throw new Error("A voz no computador não está instalada (tools/voz-local).");
  g.__vozLocalSubindo ??= (async () => {
    const env = {
      ...process.env,
      UV_PYTHON_INSTALL_DIR: process.env.UV_PYTHON_INSTALL_DIR ?? path.join(os.homedir(), ".cache", "uv", "python"),
      HF_HOME: path.resolve(".data", "models", "hf"),
      VOZ_LOCAL_PORTA: String(PORTA),
    };
    const p = spawn(uvExe(), ["run", "--no-sync", "python", "servidor.py"], { cwd: PASTA, env, windowsHide: true, stdio: "ignore" });
    g.__vozLocal = p;
    p.on("exit", () => { g.__vozLocal = null; });
    for (let i = 0; i < 90; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      if (await saude()) return;
      if (!g.__vozLocal) throw new Error("O servidor de voz local fechou ao iniciar.");
    }
    throw new Error("O servidor de voz local não respondeu a tempo.");
  })().finally(() => { g.__vozLocalSubindo = null; });
  return g.__vozLocalSubindo;
}

/** Fala com a voz clonada no computador. Devolve MP3. */
export async function falarLocal(amostraChave: string, texto: string, sinal: AbortSignal): Promise<Buffer> {
  await garantirVozLocal();
  const dir = await mkdtemp(path.join(os.tmpdir(), "enova-voz-"));
  try {
    const ref = path.join(dir, "referencia.wav");
    await writeFile(ref, await getObjectBuffer(amostraChave));
    const r = await fetch(`http://127.0.0.1:${PORTA}/falar`, {
      method: "POST", signal: sinal, headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texto, referencia: ref, idioma: "pt", expressividade: 0.5 }),
    });
    if (!r.ok) throw new Error(`voz local: ${(await r.text()).slice(0, 200)}`);
    const wav = path.join(dir, "saida.wav");
    await writeFile(wav, Buffer.from(await r.arrayBuffer()));
    const mp3 = path.join(dir, "saida.mp3");
    await ffmpeg(["-i", wav, "-ac", "1", "-c:a", "libmp3lame", "-b:a", "128k", mp3]);
    return await readFile(mp3);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

// ───────── criação (roda no worker) ─────────
export async function criarVoz(vozId: string) {
  const v = await db.query.vozes.findFirst({ where: eq(t.vozes.id, vozId) });
  if (!v) return;
  let cartesiaId: string | null = null;
  let cartesiaErro: string | null = null;
  if (await chaveCartesia()) {
    try { cartesiaId = await clonarCartesia(v.nome, await getObjectBuffer(v.amostraChave)); }
    catch (e) { cartesiaErro = e instanceof Error ? e.message.slice(0, 500) : String(e); }
  } else cartesiaErro = "Sem chave da Cartesia: a voz vai usar só o modelo do computador.";
  const local = vozLocalInstalada();
  await db.update(t.vozes).set({
    cartesiaId, cartesiaErro,
    status: cartesiaId || local ? "PRONTA" : "FALHOU",
    updatedAt: new Date(),
  }).where(eq(t.vozes.id, vozId));
}

export async function salvarAmostra(vozId: string, wav: string) {
  const chave = `vozes/${vozId}/amostra.wav`;
  await putObject(chave, await readFile(wav), "audio/wav");
  return chave;
}

export async function apagarVoz(vozId: string) {
  const v = await db.query.vozes.findFirst({ where: eq(t.vozes.id, vozId) });
  if (!v) return;
  if (v.cartesiaId) await apagarCartesia(v.cartesiaId);
  await deleteObject(v.amostraChave).catch(() => {});
  await db.delete(t.vozes).where(eq(t.vozes.id, vozId));
}

/** Converte qualquer id "minha:<uuid>" no registro da voz. */
export async function vozDoId(voz?: string) {
  const id = voz?.startsWith("minha:") ? voz.slice(6) : null;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  return (await db.query.vozes.findFirst({ where: eq(t.vozes.id, id) })) ?? null;
}
