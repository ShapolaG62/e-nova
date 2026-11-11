import "server-only";
import { getSetting, setSetting } from "@/lib/settings";
import { decrypt, encrypt } from "@/lib/crypto";
import { geminiKey } from "@/lib/ai/client";
import { env } from "@/lib/env";
import type { Capacidade } from "./tipos";

/**
 * Chaves das credenciais (criptografadas em app_settings → "iahub.chaves").
 * Cada serviço pode ter VÁRIAS chaves (lista): quando uma acaba o limite ou o crédito,
 * o roteador passa para a próxima chave do mesmo serviço. Formato antigo (uma só) continua valendo.
 */
type Campos = Record<string, string>;
type ChavesCripto = Record<string, Campos | Campos[]>;
const lista = (v: Campos | Campos[] | undefined): Campos[] => (!v ? [] : Array.isArray(v) ? v : [v]);
export const MAX_CHAVES = 10;

/** Serviços que funcionam sem chave (a chave, se houver, só melhora). */
const SEM_CHAVE = new Set(["ollama", "pollinations", "edge", "imagem-local", "voz-local"]);

function abrir(enc: Campos): Campos | null {
  try { return Object.fromEntries(Object.entries(enc).map(([k, v]) => [k, decrypt(v)])); } catch { return null; }
}

/** Todas as chaves de um serviço, na ordem de uso. Serviços sem chave devolvem [{}]. */
export async function chavesLista(provedor: string): Promise<Campos[]> {
  const todas = await getSetting<ChavesCripto>("iahub.chaves", {});
  const out = lista(todas[provedor]).map(abrir).filter((c): c is Campos => !!c && Object.keys(c).length > 0);
  if (out.length) return out;
  // compatibilidade com o que já existia antes da Central
  if (provedor === "gemini") { const k = await geminiKey(); if (k) return [{ apiKey: k }]; }
  if (provedor === "anthropic" && env.ANTHROPIC_API_KEY) return [{ apiKey: env.ANTHROPIC_API_KEY }];
  if (SEM_CHAVE.has(provedor)) return [{}];
  return [];
}

/** A primeira chave (para quem só precisa de uma). */
export async function chavesDe(provedor: string): Promise<Campos | null> {
  return (await chavesLista(provedor))[0] ?? null;
}

/**
 * Salva/remove UMA chave da lista. indice = posição (0…); indice >= tamanho adiciona no fim.
 * campos = null remove a chave daquela posição (ou todas, se indice for undefined).
 */
export async function salvarChaves(provedor: string, campos: Campos | null, indice?: number) {
  const todas = await getSetting<ChavesCripto>("iahub.chaves", {});
  const atual = lista(todas[provedor]);
  const vazio = !campos || !Object.values(campos).some((v) => v.trim());
  if (indice === undefined) {
    if (vazio) atual.length = 0;
    else atual.splice(0, 1, cifrar(campos!));
  } else if (vazio) {
    atual.splice(indice, 1);
  } else {
    if (indice >= atual.length) { if (atual.length >= MAX_CHAVES) throw new Error(`No máximo ${MAX_CHAVES} chaves por serviço.`); atual.push(cifrar(campos!)); }
    else atual[indice] = cifrar(campos!);
  }
  if (atual.length) todas[provedor] = atual; else delete todas[provedor];
  await setSetting("iahub.chaves", todas);
}
const cifrar = (c: Campos) => Object.fromEntries(Object.entries(c).filter(([, v]) => v.trim()).map(([k, v]) => [k, encrypt(v.trim())]));

/** Chaves salvas de cada serviço, mascaradas (só os 4 últimos caracteres do primeiro campo). */
export async function chavesMascaradas(): Promise<Record<string, string[]>> {
  const todas = await getSetting<ChavesCripto>("iahub.chaves", {});
  const out: Record<string, string[]> = {};
  for (const [id, v] of Object.entries(todas)) {
    out[id] = lista(v).map((enc) => {
      try { const p = Object.values(enc)[0]; const s = p ? decrypt(p) : ""; return s ? "••••" + s.slice(-4) : "••••"; } catch { return "••••"; }
    });
  }
  return out;
}

/** Quais credenciais têm chave salva (sem revelar o valor). */
export async function credenciaisConfiguradas(): Promise<Record<string, string>> {
  const masc = await chavesMascaradas();
  const out: Record<string, string> = {};
  for (const [id, ks] of Object.entries(masc)) if (ks.length) out[id] = ks.length > 1 ? `${ks[0]} +${ks.length - 1}` : ks[0];
  if (!out.gemini && (await geminiKey())) out.gemini = "••••";
  if (!out.anthropic && env.ANTHROPIC_API_KEY) out.anthropic = "••••";
  out.ollama = "local";
  for (const id of SEM_CHAVE) out[id] ??= "grátis";
  return out;
}

export type PreferenciasIA = {
  modo: "qualidade" | "economia";              // melhor primeiro × mais barato primeiro
  ordem: Partial<Record<Capacidade, string[]>>; // ordem manual por função (ids do catálogo)
  desligados: string[];                         // itens que nunca devem ser usados
  modelos: Record<string, string>;              // troca de modelo por item ("flux" → "fal-ai/flux/dev")
};

export async function preferencias(): Promise<PreferenciasIA> {
  const p = await getSetting<Partial<PreferenciasIA>>("iahub.preferencias", {});
  return { modo: p.modo ?? "qualidade", ordem: p.ordem ?? {}, desligados: p.desligados ?? [], modelos: p.modelos ?? {} };
}

export async function salvarPreferencias(p: PreferenciasIA) {
  await setSetting("iahub.preferencias", p);
}
