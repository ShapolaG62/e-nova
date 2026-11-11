import "server-only";
import { randomBytes } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, readdir, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { sign, verifySignature } from "@/lib/crypto";
import { env } from "@/lib/env";
import { putFile } from "@/lib/storage";

/**
 * Arquivos das Ferramentas (sem tabela no banco):
 * - Entradas enviadas pelo navegador ficam numa pasta temporária do servidor (somem em poucas horas).
 * - Resultados vão para o storage sob o prefixo "ferramentas/" e voltam como link assinado com validade.
 */
export const PASTA_TMP = path.join(os.tmpdir(), "enova-ferramentas");
export const MAX_BYTES = env.MAX_UPLOAD_MB * 1024 * 1024;
const VALIDADE_TMP_MS = 3 * 3600_000;
const ID_RE = /^[a-f0-9]{24}$/;

export const novoId = () => randomBytes(12).toString("hex");

/** Nome de arquivo seguro (sem pastas, sem caracteres proibidos no Windows). */
export function nomeSeguro(nome: string, padrao = "arquivo") {
  const base = path.basename(String(nome || "")).replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").replace(/^\.+/, "").trim().slice(0, 140);
  return base || padrao;
}

export const extDe = (nome: string) => path.extname(nome).slice(1).toLowerCase();
export const semExt = (nome: string) => path.parse(nome).name || "arquivo";

function pastaUsuario(userId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(userId)) throw new Error("Usuário inválido");
  return path.join(PASTA_TMP, userId);
}

/** Pasta de trabalho nova (para saídas intermediárias). Lembre de apagar com rm no fim. */
export async function pastaTrabalho() {
  const dir = path.join(PASTA_TMP, "trabalho", novoId());
  await mkdir(dir, { recursive: true });
  return dir;
}

/** Recebe um upload em stream e grava na pasta temporária do usuário. */
export async function salvarUpload(userId: string, nome: string, corpo: ReadableStream<Uint8Array>, maxBytes = MAX_BYTES) {
  void limparAntigos();
  const id = novoId();
  const dir = path.join(pastaUsuario(userId), id);
  await mkdir(dir, { recursive: true });
  const seguro = nomeSeguro(nome);
  const destino = path.join(dir, seguro);
  let total = 0;
  const entrada = Readable.fromWeb(corpo as import("node:stream/web").ReadableStream).on("data", (c: Buffer) => {
    total += c.length;
    if (total > maxBytes) entrada.destroy(new Error(`Arquivo maior que o limite de ${Math.round(maxBytes / 1024 / 1024)} MB`));
  });
  try {
    await pipeline(entrada, createWriteStream(destino));
  } catch (e) {
    await rm(dir, { recursive: true, force: true });
    throw e;
  }
  if (!total) {
    await rm(dir, { recursive: true, force: true });
    throw new Error("Arquivo vazio");
  }
  return { id, nome: seguro, tamanho: total };
}

/** Caminho no disco de um upload feito por este usuário. */
export async function arquivoDoUpload(userId: string, id: string) {
  if (!ID_RE.test(id)) throw new Error("Arquivo não encontrado. Envie de novo.");
  const dir = path.join(pastaUsuario(userId), id);
  const itens = await readdir(dir).catch(() => [] as string[]);
  if (!itens[0]) throw new Error("O arquivo expirou. Envie de novo.");
  const caminho = path.join(dir, itens[0]);
  return { caminho, nome: itens[0], tamanho: (await stat(caminho)).size };
}

export async function apagarUpload(userId: string, id: string) {
  if (!ID_RE.test(id)) return;
  await rm(path.join(pastaUsuario(userId), id), { recursive: true, force: true });
}

let ultimaLimpeza = 0;
/** Apaga entradas e pastas de trabalho com mais de 3 horas. */
export async function limparAntigos() {
  if (Date.now() - ultimaLimpeza < 10 * 60_000) return;
  ultimaLimpeza = Date.now();
  const limite = Date.now() - VALIDADE_TMP_MS;
  try {
    for (const usuario of await readdir(PASTA_TMP)) {
      const pasta = path.join(PASTA_TMP, usuario);
      for (const item of await readdir(pasta).catch(() => [] as string[])) {
        const p = path.join(pasta, item);
        const s = await stat(p).catch(() => null);
        if (s && s.mtimeMs < limite) await rm(p, { recursive: true, force: true });
      }
    }
  } catch {
    /* pasta ainda não existe */
  }
}

// ───────── links assinados ─────────
export const MIME: Record<string, string> = {
  mp4: "video/mp4", mov: "video/quicktime", mkv: "video/x-matroska", webm: "video/webm", avi: "video/x-msvideo", m4v: "video/mp4",
  gif: "image/gif", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", avif: "image/avif", tiff: "image/tiff",
  bmp: "image/bmp", ico: "image/x-icon", svg: "image/svg+xml", pdf: "application/pdf", zip: "application/zip",
  mp3: "audio/mpeg", wav: "audio/wav", flac: "audio/flac", ogg: "audio/ogg", m4a: "audio/mp4", opus: "audio/ogg", aac: "audio/aac", txt: "text/plain",
};
export const mimeDe = (nome: string) => MIME[extDe(nome)] ?? "application/octet-stream";

export type ArquivoPronto = { nome: string; tamanho: number; url: string; mime: string };

const b64 = (s: string) => Buffer.from(s).toString("base64url");

/** Link relativo assinado para baixar/ver um arquivo de "ferramentas/" (vale 24 h por padrão). */
export function linkAssinado(key: string, nome: string, ttlSegundos = 24 * 3600) {
  const exp = Math.floor(Date.now() / 1000) + ttlSegundos;
  const k = b64(key);
  const n = b64(nome);
  return `/api/ferramentas/arquivo?k=${k}&n=${n}&exp=${exp}&sig=${sign(`ferramentas:${k}:${n}:${exp}`)}`;
}

export function conferirLink(k: string, n: string, exp: string, sig: string) {
  if (!k || !n || !exp || !sig || !/^\d+$/.test(exp) || Number(exp) < Date.now() / 1000) return null;
  if (!verifySignature(`ferramentas:${k}:${n}:${exp}`, sig)) return null;
  const key = Buffer.from(k, "base64url").toString();
  if (!key.startsWith("ferramentas/") || key.includes("..")) return null;
  return { key, nome: Buffer.from(n, "base64url").toString() };
}

/** Sobe um arquivo pronto para o storage e devolve o link assinado. */
export async function publicar(userId: string, caminho: string, nome: string): Promise<ArquivoPronto> {
  const seguro = nomeSeguro(nome);
  const key = `ferramentas/${userId}/${novoId()}/${seguro}`;
  const mime = mimeDe(seguro);
  const tamanho = await putFile(key, caminho, mime);
  return { nome: seguro, tamanho, url: linkAssinado(key, seguro), mime };
}
