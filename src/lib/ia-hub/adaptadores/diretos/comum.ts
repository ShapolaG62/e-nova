import "server-only";
import { createHmac } from "node:crypto";
import { checarResposta } from "../../roteador";
import { FalhaProvedor, type ContextoAdaptador, type EntradaIA, type SaidaIA } from "../../tipos";
import { esperar, mimeDaUrl } from "../index";

/* eslint-disable @typescript-eslint/no-explicit-any */

export { checarResposta, esperar, mimeDaUrl, FalhaProvedor };

/** fetch com o sinal de cancelamento e checagem de erro HTTP (motivo certo para o revezamento). */
export async function pedir(url: string, init: RequestInit & { quem: string; sinal: AbortSignal }): Promise<Response> {
  const { quem, sinal, ...resto } = init;
  const r = await fetch(url, { ...resto, signal: sinal });
  await checarResposta(r, quem);
  return r;
}

export async function pedirJson<T = any>(url: string, init: RequestInit & { quem: string; sinal: AbortSignal; json?: unknown }): Promise<T> {
  const { json, headers, ...resto } = init;
  const r = await pedir(url, {
    ...resto,
    headers: json !== undefined ? { "Content-Type": "application/json", ...(headers as Record<string, string>) } : headers,
    body: json !== undefined ? JSON.stringify(json) : resto.body,
  });
  const txt = await r.text();
  try { return (txt ? JSON.parse(txt) : {}) as T; } catch { throw new FalhaProvedor(`${init.quem}: resposta inesperada`, "formato"); }
}

/**
 * Laço de espera padrão: 2 s nas primeiras voltas, depois 5 s (ou o mínimo pedido pelo provedor).
 * `checar` devolve o resultado quando pronto, `undefined` enquanto processa, ou lança FalhaProvedor.
 */
export async function aguardar<T>(
  ctx: ContextoAdaptador,
  checar: (volta: number) => Promise<T | undefined>,
  o: { etapa: string; minimoMs?: number; inicio?: number } = { etapa: "Gerando…" },
): Promise<T> {
  for (let i = 0; ; i++) {
    await esperar(Math.max(i < 5 ? 2000 : 5000, o.minimoMs ?? 0), ctx.sinal);
    const r = await checar(i);
    if (r !== undefined) return r;
    await ctx.progresso?.(Math.min(95, (o.inicio ?? 10) + i * 2), o.etapa);
  }
}

/** Bytes de uma imagem de entrada (upload da tela ou link). */
export async function imagemDaEntrada(e: EntradaIA, sinal: AbortSignal): Promise<{ buffer: Buffer; mime: string; nome: string } | null> {
  if (e.arquivo && e.arquivo.mime.startsWith("image/")) return e.arquivo;
  if (!e.imagemUrl) return null;
  if (e.imagemUrl.startsWith("data:")) {
    const m = /^data:([^;,]+)(;base64)?,([\s\S]*)$/.exec(e.imagemUrl);
    if (!m) throw new FalhaProvedor("imagem de entrada inválida", "formato");
    return { buffer: Buffer.from(decodeURIComponent(m[3]), m[2] ? "base64" : "utf8"), mime: m[1], nome: "imagem" };
  }
  const r = await fetch(e.imagemUrl, { signal: sinal });
  if (!r.ok) throw new FalhaProvedor("não consegui baixar a imagem de entrada", "erro");
  const mime = r.headers.get("content-type")?.split(";")[0] || mimeDaUrl(e.imagemUrl, "image/png");
  return { buffer: Buffer.from(await r.arrayBuffer()), mime, nome: e.imagemUrl.split("/").pop()?.split("?")[0] || "imagem" };
}

export const dataUri = (a: { buffer: Buffer; mime: string }) => `data:${a.mime};base64,${a.buffer.toString("base64")}`;
export const blobDe = (a: { buffer: Buffer; mime: string }) => new Blob([new Uint8Array(a.buffer)], { type: a.mime });

/** Link que um serviço externo consegue baixar sozinho (não pode ser do próprio computador). */
export function linkPublico(url: string | undefined, quem: string, oque = "o arquivo"): string {
  if (!url) throw new FalhaProvedor(`${quem}: faltou o link para ${oque}`, "formato");
  let host = "";
  try { host = new URL(url).hostname; } catch { throw new FalhaProvedor(`${quem}: link inválido`, "formato"); }
  if (!/^https?:/i.test(url) || /^(localhost|127\.|10\.|192\.168\.|0\.0\.0\.0|\[?::1\]?$)/i.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host) || host.endsWith(".local"))
    throw new FalhaProvedor(`${quem} precisa de um link público para ${oque} (o E-Nova está rodando em ${host}). Publique o arquivo ou use outra IA.`, "nao-suporta");
  return url;
}

export const naoFaz = (quem: string, cap: string) => new FalhaProvedor(`${quem} não faz "${cap}" por esta integração`, "nao-suporta");

export function exigirPrompt(e: EntradaIA, quem: string) {
  const p = e.prompt?.trim();
  if (!p) throw new FalhaProvedor(`${quem}: faltou o texto (prompt)`, "formato");
  return p;
}

/** Dimensões aproximadas (múltiplos de 32/64) para cada proporção. */
export function tamanho(prop: EntradaIA["proporcao"], base = 1024, multiplo = 32) {
  const r = (n: number) => Math.round(n / multiplo) * multiplo;
  if (prop === "16:9") return { width: r(base * 1.333), height: r(base * 0.75) };
  if (prop === "9:16") return { width: r(base * 0.75), height: r(base * 1.333) };
  return { width: base, height: base };
}

export const arquivoUrl = (url: string, padrao: string): SaidaIA => ({ arquivos: [{ url, mime: mimeDaUrl(url, padrao) }] });

export const sem = (s: string) => s.replace(/\/+$/, "");

// ───────── JWT HS256 (Kling) sem dependências ─────────
const b64url = (b: Buffer | string) => Buffer.from(b).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
export function jwtHs256(payload: Record<string, unknown>, segredo: string): string {
  const cab = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const corpo = b64url(JSON.stringify(payload));
  const assinatura = b64url(createHmac("sha256", segredo).update(`${cab}.${corpo}`).digest());
  return `${cab}.${corpo}.${assinatura}`;
}
