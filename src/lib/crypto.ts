import "server-only";
import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

function key(): Buffer {
  if (!env.ENCRYPTION_KEY) throw new Error("ENCRYPTION_KEY não configurada (32 bytes em base64). Veja .env.example.");
  const k = Buffer.from(env.ENCRYPTION_KEY, "base64url");
  if (k.length !== 32) throw new Error("ENCRYPTION_KEY precisa ter exatamente 32 bytes.");
  return k;
}

/** AES-256-GCM. Formato: v1.<iv>.<tag>.<cifrado> (base64url). */
export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv.toString("base64url"), c.getAuthTag().toString("base64url"), data.toString("base64url")].join(".");
}

export function decrypt(token: string): string {
  const [v, iv, tag, data] = token.split(".");
  if (v !== "v1" || !iv || !tag || !data) throw new Error("Valor criptografado inválido");
  const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(data, "base64url")), d.final()]).toString("utf8");
}

export const encryptJson = (v: unknown) => encrypt(JSON.stringify(v));
export const decryptJson = <T>(s: string) => JSON.parse(decrypt(s)) as T;

/** Assinatura HMAC para links temporários (ex.: plataformas baixarem o vídeo). */
export function sign(value: string): string {
  return createHmac("sha256", env.AUTH_SECRET).update(value).digest("base64url");
}

export function verifySignature(value: string, signature: string): boolean {
  const a = Buffer.from(sign(value));
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}
