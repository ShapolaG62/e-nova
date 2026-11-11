import "server-only";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, rm, stat, readFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env, features } from "@/lib/env";
import { sign } from "@/lib/crypto";

/**
 * Armazenamento de arquivos (vídeos, backups de páginas).
 * - R2/S3 configurado → upload direto do navegador por URL pré-assinada.
 * - Senão → disco local em .data/uploads (bom para dev ou VPS única).
 */
const LOCAL_ROOT = path.resolve(".data/uploads");

let s3: S3Client | null = null;
function client() {
  if (!features.s3) return null;
  s3 ??= new S3Client({
    region: env.S3_REGION,
    endpoint: env.S3_ENDPOINT,
    credentials: { accessKeyId: env.S3_ACCESS_KEY_ID!, secretAccessKey: env.S3_SECRET_ACCESS_KEY! },
  });
  return s3;
}

function localPath(key: string) {
  const p = path.resolve(LOCAL_ROOT, key);
  // Impede path traversal (../) para fora da pasta de uploads
  if (!p.startsWith(LOCAL_ROOT + path.sep)) throw new Error("Chave de arquivo inválida");
  return p;
}

export const storageMode = () => (client() ? "s3" : "local");

/** URL para o navegador enviar o arquivo. S3: pré-assinada (PUT). Local: rota do app. */
export async function uploadTarget(key: string, mime: string, assetId: string) {
  const c = client();
  if (c) {
    const url = await getSignedUrl(c, new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: key, ContentType: mime }), { expiresIn: 3600 });
    return { method: "PUT" as const, url, headers: { "Content-Type": mime } };
  }
  return { method: "PUT" as const, url: `/api/midia/${assetId}/upload`, headers: { "Content-Type": mime } };
}

/** Grava um stream no disco local (usado pela rota de upload local), com limite de tamanho. */
export async function writeLocalStream(key: string, body: ReadableStream<Uint8Array>, maxBytes: number) {
  const dest = localPath(key);
  await mkdir(path.dirname(dest), { recursive: true });
  let total = 0;
  const limited = Readable.fromWeb(body as import("node:stream/web").ReadableStream).on("data", (chunk: Buffer) => {
    total += chunk.length;
    if (total > maxBytes) limited.destroy(new Error("Arquivo maior que o limite"));
  });
  try {
    await pipeline(limited, createWriteStream(dest));
  } catch (e) {
    await rm(dest, { force: true });
    throw e;
  }
  return total;
}

export async function putObject(key: string, data: Buffer | string, mime: string) {
  const c = client();
  if (c) {
    await c.send(new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: key, Body: data, ContentType: mime }));
    return;
  }
  const dest = localPath(key);
  await mkdir(path.dirname(dest), { recursive: true });
  await pipeline(Readable.from([typeof data === "string" ? Buffer.from(data) : data]), createWriteStream(dest));
}

/** Grava um arquivo do disco no storage em stream (vídeos grandes não passam pela memória). */
export async function putFile(key: string, filePath: string, mime: string) {
  const size = (await stat(filePath)).size;
  const c = client();
  if (c) {
    await c.send(new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: key, Body: createReadStream(filePath), ContentType: mime, ContentLength: size }));
    return size;
  }
  const dest = localPath(key);
  await mkdir(path.dirname(dest), { recursive: true });
  await pipeline(createReadStream(filePath), createWriteStream(dest));
  return size;
}

export async function getObjectBuffer(key: string): Promise<Buffer> {
  const c = client();
  if (c) {
    const r = await c.send(new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
    return Buffer.from(await r.Body!.transformToByteArray());
  }
  return readFile(localPath(key));
}

/** Primeiros bytes do arquivo (para validar o formato pelo conteúdo, não pela extensão). */
export async function readHead(key: string, n = 16): Promise<Buffer> {
  const c = client();
  if (c) {
    const r = await c.send(new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key, Range: `bytes=0-${n - 1}` }));
    return Buffer.from(await r.Body!.transformToByteArray());
  }
  const { open } = await import("node:fs/promises");
  const fh = await open(localPath(key), "r");
  try {
    const buf = Buffer.alloc(n);
    const { bytesRead } = await fh.read(buf, 0, n, 0);
    return buf.subarray(0, bytesRead);
  } finally {
    await fh.close();
  }
}

export async function objectSize(key: string): Promise<number | null> {
  const c = client();
  if (c) {
    try {
      const r = await c.send(new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key, Range: "bytes=0-0" }));
      const total = r.ContentRange?.split("/")[1];
      return total ? Number(total) : (r.ContentLength ?? null);
    } catch {
      return null;
    }
  }
  try {
    return (await stat(localPath(key))).size;
  } catch {
    return null;
  }
}

/** Stream do arquivo inteiro (S3 ou disco) — para enviar vídeos grandes sem carregar na memória. */
export async function openObjectStream(key: string): Promise<{ stream: Readable; size: number }> {
  const c = client();
  if (c) {
    const r = await c.send(new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
    return { stream: r.Body as Readable, size: Number(r.ContentLength ?? 0) };
  }
  const p = localPath(key);
  return { stream: createReadStream(p), size: (await stat(p)).size };
}

/** Caminho de arquivo no disco para ferramentas como o ffmpeg (baixa do S3 para pasta temporária). */
export async function toLocalFile(key: string, tmpDir: string): Promise<string> {
  if (!client()) return localPath(key);
  const dest = path.join(tmpDir, path.basename(key));
  const { stream } = await openObjectStream(key);
  await pipeline(stream, createWriteStream(dest));
  return dest;
}

export function localReadStream(key: string, range?: { start: number; end: number }) {
  return createReadStream(localPath(key), range);
}

export async function deleteObject(key: string) {
  const c = client();
  if (c) await c.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
  else await rm(localPath(key), { force: true });
}

/**
 * URL pública temporária do arquivo — é o que Meta/TikTok baixam ao publicar.
 * S3: URL pré-assinada. Local: rota assinada com HMAC e validade.
 */
export async function temporaryUrl(key: string, assetId: string, ttlSeconds = 6 * 3600) {
  const c = client();
  if (c) return getSignedUrl(c, new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }), { expiresIn: Math.min(ttlSeconds, 7 * 86400) });
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  return `${env.APP_URL}/api/midia/${assetId}/arquivo?exp=${exp}&sig=${sign(`${assetId}:${exp}`)}`;
}
