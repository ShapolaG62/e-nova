import "server-only";
import { getSetting, setSetting } from "@/lib/settings";
import { decrypt, encrypt } from "@/lib/crypto";
import { env } from "@/lib/env";

/** Configurações do módulo Vendas (prospecção, sites e abordagem). Chaves ficam criptografadas. */
export type VendasConfig = {
  seuNome: string;
  suaEmpresa: string;
  metaDiaria: number;
  objetivo: string;
  temGoogle: boolean;
};

export async function vendasConfig(): Promise<VendasConfig> {
  const c = await getSetting<Partial<VendasConfig>>("vendas.config", {});
  return {
    seuNome: c.seuNome ?? "",
    suaEmpresa: c.suaEmpresa ?? "",
    metaDiaria: c.metaDiaria ?? 20,
    objetivo: c.objetivo ?? "agendar uma conversa",
    temGoogle: !!(await googlePlacesKey()),
  };
}

export async function salvarVendasConfig(c: Omit<VendasConfig, "temGoogle">) {
  await setSetting("vendas.config", c);
}

export async function googlePlacesKey(): Promise<string | null> {
  const enc = await getSetting<string | null>("vendas.googleKey", null);
  if (enc) {
    try { return decrypt(enc); } catch { /* chave antiga/ENCRYPTION_KEY trocada */ }
  }
  return process.env.GOOGLE_PLACES_KEY || null;
}

export async function salvarGooglePlacesKey(key: string | null) {
  await setSetting("vendas.googleKey", key ? encrypt(key) : null);
}

/** Endereço público dos sites: APP_URL (servidor) ou o endereço do Netlify, se configurado. */
export async function baseSites(): Promise<string> {
  const custom = await getSetting<string>("vendas.urlSites", "");
  return (custom || env.APP_URL).replace(/\/+$/, "");
}

/** Resultado do último teste real da chave do Google (guardado em "vendas.googleTeste"). */
export type GoogleTeste = { ok: boolean; quando: string; final: string; tipo?: string; titulo?: string };
export type EstadoGoogle = "sem-chave" | "ok" | "erro" | "nao-testada";

const finalDa = (k: string) => k.slice(-4);

export async function registrarTesteGoogle(chave: string, r: { ok: true } | { ok: false; erro: { tipo: string; titulo: string } }) {
  const v: GoogleTeste = { ok: r.ok, quando: new Date().toISOString(), final: finalDa(chave), ...(r.ok ? {} : { tipo: r.erro.tipo, titulo: r.erro.titulo }) };
  await setSetting("vendas.googleTeste", v);
}

/** Estado da conexão com o Google Maps, com base no último teste da chave atual. */
export async function statusGoogle(): Promise<{ estado: EstadoGoogle; final: string; teste: GoogleTeste | null; daVariavel: boolean }> {
  const chave = await googlePlacesKey();
  if (!chave) return { estado: "sem-chave", final: "", teste: null, daVariavel: false };
  const salva = !!(await getSetting<string | null>("vendas.googleKey", null));
  const t = await getSetting<GoogleTeste | null>("vendas.googleTeste", null);
  const teste = t && t.final === finalDa(chave) ? t : null; // teste de outra chave não vale
  return { estado: !teste ? "nao-testada" : teste.ok ? "ok" : "erro", final: finalDa(chave), teste, daVariavel: !salva };
}
