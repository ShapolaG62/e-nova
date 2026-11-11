import "server-only";
import { randomBytes } from "node:crypto";
import { safeFetch } from "@/lib/net-safety";
import { MOEDAS } from "./catalogo";

/** Serviços públicos grátis (o navegador não pode chamá-los direto por causa da CSP do painel). */
async function json<T>(url: string, init: RequestInit = {}, timeoutMs = 15_000): Promise<{ status: number; ok: boolean; data: T | null }> {
  const r = await safeFetch(url, { ...init, headers: { Accept: "application/json", "User-Agent": "E-Nova/1.0", ...(init.headers ?? {}) }, signal: AbortSignal.timeout(timeoutMs) });
  const texto = await r.text();
  let data: T | null = null;
  try {
    data = JSON.parse(texto) as T;
  } catch {
    /* resposta não-JSON */
  }
  return { status: r.status, ok: r.ok, data };
}

// ───────── Câmbio ─────────
const par = (c: string) => (c === "USDT" ? "USD-BRLT" : `${c}-BRL`);

const cache = new Map<string, { at: number; v: unknown }>();
async function emCache<T>(k: string, ms: number, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(k);
  if (hit && Date.now() - hit.at < ms) return hit.v as T;
  const v = await fn();
  cache.set(k, { at: Date.now(), v });
  return v;
}

/** Quanto vale 1 unidade de cada moeda em reais. */
export function cotacoes(): Promise<{ taxas: Record<string, number>; fonte: string; atualizado: string }> {
  return emCache("cotacoes", 60_000, async () => {
    const taxas: Record<string, number> = { BRL: 1 };
    const pares = MOEDAS.filter(([c]) => c !== "BRL").map(([c]) => par(c)).join(",");
    try {
      const r = await json<Record<string, { bid: string; create_date?: string }>>(`https://economia.awesomeapi.com.br/json/last/${pares}`);
      if (!r.ok || !r.data) throw new Error();
      let quando = "";
      for (const [c] of MOEDAS) {
        const k = par(c).replace("-", "");
        if (r.data[k]) {
          taxas[c] = Number.parseFloat(r.data[k].bid);
          quando ||= r.data[k].create_date ?? "";
        }
      }
      return { taxas, fonte: "AwesomeAPI (ao vivo)", atualizado: quando || new Date().toISOString() };
    } catch {
      // reserva: cotação diária
      const r = await json<{ rates?: Record<string, number>; time_last_update_utc?: string }>("https://open.er-api.com/v6/latest/BRL");
      if (!r.data?.rates) throw new Error("Os serviços de cotação não responderam. Tente de novo em instantes.");
      for (const [c] of MOEDAS) if (r.data.rates[c]) taxas[c] = 1 / r.data.rates[c];
      taxas.USDT ??= taxas.USD;
      return { taxas, fonte: "ExchangeRate-API (cotação do dia)", atualizado: r.data.time_last_update_utc ?? new Date().toISOString() };
    }
  });
}

/** Últimos 30 dias da moeda em reais (mais antigo primeiro). */
export function historico(moeda: string): Promise<{ data: string; valor: number }[]> {
  return emCache(`hist:${moeda}`, 30 * 60_000, async () => {
    const r = await json<{ bid: string; timestamp: string }[]>(`https://economia.awesomeapi.com.br/json/daily/${par(moeda)}/30`);
    if (!Array.isArray(r.data)) return [];
    return r.data.map((x) => ({ data: new Date(Number(x.timestamp) * 1000).toISOString(), valor: Number.parseFloat(x.bid) })).filter((x) => Number.isFinite(x.valor)).reverse();
  });
}

// ───────── E-mail temporário (mail.tm) ─────────
const MT = "https://api.mail.tm";
type Lista<T> = T[] | { "hydra:member"?: T[] };
const itens = <T>(d: Lista<T> | null): T[] => (Array.isArray(d) ? d : (d?.["hydra:member"] ?? []));

export async function criarCaixa(): Promise<{ endereco: string; token: string }> {
  const d = await json<Lista<{ domain: string; isActive?: boolean }>>(`${MT}/domains`);
  const dominio = itens(d.data).find((x) => x.isActive !== false)?.domain;
  if (!dominio) throw new Error("O mail.tm está sem domínios disponíveis agora. Tente mais tarde.");
  const endereco = `${randomBytes(5).toString("hex")}${Date.now().toString(36).slice(-3)}@${dominio}`;
  const senha = `En${randomBytes(9).toString("base64url")}9!`;
  const corpo = { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ address: endereco, password: senha }) };
  const a = await json<{ detail?: string }>(`${MT}/accounts`, corpo);
  if (a.status === 429) throw new Error("Muitos endereços criados seguidos. Espere um minuto.");
  if (!a.ok) throw new Error(`O mail.tm não criou o endereço (${a.status}).`);
  const t = await json<{ token?: string }>(`${MT}/token`, corpo);
  if (!t.data?.token) throw new Error("O mail.tm não liberou a caixa. Tente de novo.");
  return { endereco, token: t.data.token };
}

export type MensagemResumo = { id: string; assunto: string; de: string; resumo: string; em: string; codigo: string | null };

export async function listarMensagens(token: string): Promise<MensagemResumo[] | "expirou"> {
  const r = await json<Lista<{ id: string; subject?: string; intro?: string; createdAt: string; from?: { address?: string; name?: string } }>>(`${MT}/messages`, { headers: { Authorization: `Bearer ${token}` } });
  if (r.status === 401) return "expirou";
  if (!r.ok) throw new Error(`O mail.tm não respondeu (${r.status}).`);
  return itens(r.data).map((m) => ({
    id: m.id,
    assunto: m.subject || "(sem assunto)",
    de: m.from?.name ? `${m.from.name} <${m.from.address ?? ""}>` : (m.from?.address ?? ""),
    resumo: m.intro ?? "",
    em: m.createdAt,
    codigo: /\b\d{4,8}\b/.exec(`${m.subject ?? ""} ${m.intro ?? ""}`)?.[0] ?? null,
  }));
}

export async function lerMensagem(token: string, id: string): Promise<string> {
  const r = await json<{ text?: string; html?: string[] }>(`${MT}/messages/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok || !r.data) throw new Error("Não deu para abrir a mensagem.");
  if (r.data.text) return r.data.text;
  // sem versão em texto: tira as tags do HTML (exibido como texto puro na tela)
  return (r.data.html ?? []).join("\n").replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, "").replace(/<br\s*\/?>|<\/p>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/\n{3,}/g, "\n\n").trim() || "(sem texto)";
}
