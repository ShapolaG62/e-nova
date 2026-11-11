"use server";

import { revalidatePath } from "next/cache";
import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db, t } from "@/db";
import { requirePermission } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { rateLimit } from "@/lib/cache";
import { setSetting } from "@/lib/settings";
import { encrypt } from "@/lib/crypto";
import { generate } from "@/lib/ai/client";
import { googlePlacesKey, registrarTesteGoogle, salvarGooglePlacesKey, salvarVendasConfig, statusGoogle, vendasConfig } from "@/lib/sites/config";
import { erroGoogleDe, type ErroGoogle } from "@/lib/sites/google-erros";
import { buscarPlaces, setor as pegarSetor, novoBloco, type SiteDoc, telefoneBR } from "@/lib/sites/engine";
import {
  criarSite, outroVisual, publicar, garantirProspect, registrarContato, addHistorico, converterEmCliente,
  salvarImagem, baixarImagemUrl, prospectParaLead, buscaComNoFunil, linkPublico,
} from "@/lib/sites/service";
import { abordagem as gerarAbordagem, ligacao as gerarLigacao, pedidoLivre } from "@/lib/sites/ai";

/* eslint-disable @typescript-eslint/no-explicit-any */
type R<T = unknown> = { ok: true; data: T } | { ok: false; message: string };
const falha = (e: unknown): { ok: false; message: string } => ({ ok: false, message: (e as any)?.userMessage ?? (e instanceof Error ? e.message : "Erro inesperado.") });
const uuid = z.uuid();

// ───────── Prospecção ─────────
const buscaSchema = z.object({
  setor: z.string().max(40), termo: z.string().max(80).optional().default(""),
  pais: z.string().length(2).default("BR"), uf: z.string().max(40).optional().default(""), cidade: z.string().min(2, "Escolha a cidade.").max(120),
  quantidade: z.coerce.number().int().min(1).max(60).default(10), soSemSite: z.boolean().default(true),
  demo: z.boolean().optional().default(false), // força o modo demonstração mesmo com chave salva
});

export async function prospectarAction(input: z.input<typeof buscaSchema>): Promise<R<Awaited<ReturnType<typeof buscarPlaces>>> | { ok: false; message: string; google: ErroGoogle }> {
  const user = await requirePermission("prospects:read");
  const p = buscaSchema.safeParse(input);
  if (!p.success) return { ok: false, message: p.error.issues[0]?.message ?? "Dados inválidos." };
  if (!(await rateLimit(`busca:${user.id}`, 20, 600))) return { ok: false, message: "Muitas buscas seguidas. Aguarde alguns minutos." };
  let chave: string | undefined;
  try {
    const st = pegarSetor(p.data.setor);
    chave = p.data.demo ? undefined : ((await googlePlacesKey()) ?? undefined);
    const r = await buscarPlaces({ termo: p.data.termo || st.busca || st.nome, cidade: p.data.cidade, uf: p.data.uf, pais: p.data.pais, quantidade: p.data.quantidade, chave, soSemSite: p.data.soSemSite });
    if (chave && (await statusGoogle()).estado !== "ok") await registrarTesteGoogle(chave, { ok: true });
    const ids = r.leads.map((l) => l.placeId).filter(Boolean) as string[];
    const existentes = ids.length ? await db.select({ placeId: t.prospects.placeId }).from(t.prospects).where(inArray(t.prospects.placeId, ids)) : [];
    r.leads = buscaComNoFunil(r.leads.map((l) => ({ ...l, setor: st.id })), new Set(existentes.map((e) => e.placeId!)));
    return { ok: true, data: r };
  } catch (e) {
    // Erro do Google: explica em português e marca a conexão como "com erro"
    const g = erroGoogleDe(e);
    if (g) {
      if (chave && g.tipo !== "rede") await registrarTesteGoogle(chave, { ok: false, erro: g });
      return { ok: false, message: g.titulo, google: g };
    }
    return falha(e);
  }
}

export async function adicionarAoFunilAction(leads: Record<string, any>[]): Promise<R<number>> {
  const user = await requirePermission("prospects:write");
  let n = 0;
  for (const l of leads.slice(0, 60)) { await garantirProspect(l, l.setor || "outro", user.id); n++; }
  revalidatePath("/painel/funil");
  return { ok: true, data: n };
}

const manualSchema = z.object({
  nome: z.string().trim().min(2, "Informe o nome.").max(200), setor: z.string().max(40), telefone: z.string().max(40).optional().default(""),
  cidade: z.string().max(120).optional().default(""), uf: z.string().max(40).optional().default(""), endereco: z.string().max(300).optional().default(""), instagram: z.string().max(80).optional().default(""),
});
export async function cadastrarManualAction(input: z.input<typeof manualSchema>): Promise<R<string>> {
  const user = await requirePermission("prospects:write");
  const p = manualSchema.safeParse(input);
  if (!p.success) return { ok: false, message: p.error.issues[0]?.message ?? "Dados inválidos." };
  const tel = telefoneBR(p.data.telefone);
  const id = await garantirProspect({ ...p.data, whatsapp: tel.whatsapp, situacaoSite: "sem", origem: "manual", oportunidade: 50 }, p.data.setor, user.id);
  revalidatePath("/painel/funil");
  return { ok: true, data: id };
}

// ───────── Funil ─────────
const prospectPatch = z.object({
  stage: z.enum(["NOVO", "CONTATADO", "NEGOCIANDO", "FECHADO", "PERDIDO"]).optional(),
  notes: z.string().max(4000).optional(), phone: z.string().max(40).optional(), whatsapp: z.string().max(20).optional(),
  instagram: z.string().max(80).optional(), nextContactAt: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/).optional(),
  proposalCents: z.number().int().min(0).nullable().optional(), sector: z.string().max(40).optional(), name: z.string().min(2).max(200).optional(),
});

export async function atualizarProspectAction(id: string, input: z.input<typeof prospectPatch>, nota?: string): Promise<R<null>> {
  await requirePermission("prospects:write");
  const p = prospectPatch.safeParse(input);
  if (!uuid.safeParse(id).success || !p.success) return { ok: false, message: "Dados inválidos." };
  const antes = await db.query.prospects.findFirst({ where: eq(t.prospects.id, id) });
  if (!antes) return { ok: false, message: "Contato não encontrado." };
  const d = { ...p.data, whatsapp: p.data.whatsapp !== undefined ? p.data.whatsapp.replace(/\D/g, "") : undefined, nextContactAt: p.data.nextContactAt === "" ? null : p.data.nextContactAt };
  await db.update(t.prospects).set(d).where(eq(t.prospects.id, id));
  if (p.data.stage && p.data.stage !== antes.stage) await addHistorico(id, "etapa", `Etapa: ${antes.stage} → ${p.data.stage}`);
  if (nota?.trim()) await addHistorico(id, "nota", nota.trim().slice(0, 500));
  revalidatePath("/painel/funil");
  return { ok: true, data: null };
}

export async function apagarProspectAction(id: string): Promise<R<null>> {
  const user = await requirePermission("prospects:write");
  if (!uuid.safeParse(id).success) return { ok: false, message: "Inválido." };
  await db.delete(t.prospects).where(eq(t.prospects.id, id));
  await audit(user, "prospects.delete", { entity: "prospect", entityId: id });
  revalidatePath("/painel/funil");
  return { ok: true, data: null };
}

export async function registrarContatoAction(prospectId: string, texto?: string): Promise<R<null>> {
  const user = await requirePermission("prospects:write");
  if (!uuid.safeParse(prospectId).success) return { ok: false, message: "Inválido." };
  await registrarContato(prospectId, user.id, texto);
  revalidatePath("/painel/funil");
  return { ok: true, data: null };
}

export async function fichaProspectAction(id: string) {
  await requirePermission("prospects:read");
  if (!uuid.safeParse(id).success) return null;
  const p = await db.query.prospects.findFirst({ where: eq(t.prospects.id, id) });
  if (!p) return null;
  const site = await db.query.generatedSites.findFirst({ where: eq(t.generatedSites.prospectId, id) });
  return { prospect: p, site: site ? { id: site.id, published: site.published, link: site.published ? await linkPublico(site) : "" } : null };
}

const converterSchema = z.object({ setup: z.string().max(20), mensal: z.string().max(20), servico: z.string().max(120) });
const centavos = (s: string) => Math.max(0, Math.round(Number(String(s || "0").replace(/\./g, "").replace(",", ".")) * 100) || 0);

export async function converterClienteAction(prospectId: string, input: z.input<typeof converterSchema>): Promise<R<string>> {
  const user = await requirePermission("contracts:write");
  const p = converterSchema.safeParse(input);
  if (!uuid.safeParse(prospectId).success || !p.success) return { ok: false, message: "Dados inválidos." };
  try {
    const clientId = await converterEmCliente(prospectId, { setupCents: centavos(p.data.setup), mensalCents: centavos(p.data.mensal), servico: p.data.servico }, user.id);
    await audit(user, "prospects.convert", { entity: "client", entityId: clientId, meta: { prospectId } });
    revalidatePath("/painel/funil"); revalidatePath("/painel/clientes"); revalidatePath("/painel/bi");
    return { ok: true, data: clientId };
  } catch (e) { return falha(e); }
}

// ───────── Sites ─────────
const criarSchema = z.object({
  lead: z.record(z.string(), z.any()), setor: z.string().max(40), servicos: z.array(z.string().max(80)).max(12),
  cores: z.array(z.string().regex(/^#[0-9a-fA-F]{6}$/)).max(2), tom: z.string().max(20), layout: z.string().max(20).optional(),
  fotosUrls: z.array(z.url({ protocol: /^https?$/ })).max(10).default([]), comIA: z.boolean().default(false), nome: z.string().max(200).optional(),
});

export async function criarSiteAction(input: z.input<typeof criarSchema>): Promise<R<{ id: string; ms: number; aviso: string | null }>> {
  const user = await requirePermission("sites:write");
  const p = criarSchema.safeParse(input);
  if (!p.success) return { ok: false, message: p.error.issues[0]?.message ?? "Dados inválidos." };
  if (!(await rateLimit(`site:${user.id}`, 40, 600))) return { ok: false, message: "Muitos sites seguidos. Aguarde alguns minutos." };
  const t0 = Date.now();
  try {
    const site = await criarSite(p.data, user.id);
    await audit(user, "sites.create", { entity: "generated_site", entityId: site.id, meta: { nome: site.name } });
    revalidatePath("/painel/sites"); revalidatePath("/painel/funil");
    return { ok: true, data: { id: site.id, ms: Date.now() - t0, aviso: site.aiNotice } };
  } catch (e) { return falha(e); }
}

export async function criarSitesEmMassaAction(itens: { lead: Record<string, any>; setor: string; servicos?: string[] }[], layout: string, comIA: boolean): Promise<R<{ resultados: { ok: boolean; id?: string; nome: string; erro?: string }[]; ms: number }>> {
  const user = await requirePermission("sites:write");
  const t0 = Date.now();
  const lista = itens.slice(0, 10);
  // IA local roda uma por vez (memória da placa); sem IA, tudo em paralelo
  const fazer = async (it: (typeof lista)[number]) => {
    try {
      const st = pegarSetor(it.setor);
      const s = await criarSite({ lead: it.lead, setor: it.setor, servicos: it.servicos ?? st.servicos.slice(0, 6).map((x) => x[0]), layout: layout === "auto" ? undefined : layout, comIA }, user.id);
      return { ok: true, id: s.id, nome: s.name };
    } catch (e) { return { ok: false, nome: String(it.lead?.nome ?? ""), erro: falha(e).message }; }
  };
  const resultados = comIA ? [] as Awaited<ReturnType<typeof fazer>>[] : await Promise.all(lista.map(fazer));
  if (comIA) for (const it of lista) resultados.push(await fazer(it));
  await audit(user, "sites.bulk", { meta: { total: lista.length } });
  revalidatePath("/painel/sites"); revalidatePath("/painel/funil");
  return { ok: true, data: { resultados, ms: Date.now() - t0 } };
}

async function pegarSite(id: string) {
  if (!uuid.safeParse(id).success) return null;
  return db.query.generatedSites.findFirst({ where: eq(t.generatedSites.id, id) });
}

export async function outroVisualAction(id: string, direcao: 1 | -1): Promise<R<{ layout: string; layouts: string[]; layoutIndex: number }>> {
  await requirePermission("sites:write");
  const s = await pegarSite(id);
  if (!s) return { ok: false, message: "Site não encontrado." };
  const n = await outroVisual(s, direcao === -1 ? -1 : 1);
  revalidatePath(`/painel/sites/${id}`);
  return { ok: true, data: { layout: (n.doc as any).layout, layouts: n.layouts, layoutIndex: n.layoutIndex } };
}

const docSchema = z.object({ layout: z.string().max(20), blocos: z.array(z.object({ id: z.string().max(40), tipo: z.string().max(20), visivel: z.boolean().optional(), dados: z.record(z.string(), z.any()) })).max(40) }).passthrough();

export async function salvarSiteAction(id: string, doc: unknown): Promise<R<null>> {
  const user = await requirePermission("sites:write");
  const p = docSchema.safeParse(doc);
  if (!p.success) return { ok: false, message: "Documento do site inválido." };
  if (JSON.stringify(p.data).length > 400_000) return { ok: false, message: "Site grande demais." };
  const s = await pegarSite(id);
  if (!s) return { ok: false, message: "Site não encontrado." };
  const layouts = s.layouts.includes(p.data.layout) ? s.layouts : [...s.layouts, p.data.layout];
  await db.update(t.generatedSites).set({ doc: p.data as any, layouts, layoutIndex: layouts.indexOf(p.data.layout), name: String((p.data as any).negocio?.nome || s.name).slice(0, 200) }).where(eq(t.generatedSites.id, id));
  await audit(user, "sites.update", { entity: "generated_site", entityId: id });
  revalidatePath(`/painel/sites/${id}`);
  return { ok: true, data: null };
}

export async function publicarSiteAction(id: string, slug: string): Promise<R<{ link: string; mensagem: string; whatsapp: string; slug: string }>> {
  const user = await requirePermission("sites:write");
  const s = await pegarSite(id);
  if (!s) return { ok: false, message: "Site não encontrado." };
  try {
    const r = await publicar(s, slug, user.id);
    await audit(user, "sites.publish", { entity: "generated_site", entityId: id, meta: { slug: r.site.slug } });
    revalidatePath(`/painel/sites/${id}`); revalidatePath("/painel/funil");
    return { ok: true, data: { link: r.link, mensagem: r.mensagem, whatsapp: r.whatsapp, slug: r.site.slug! } };
  } catch (e) { return falha(e); }
}

export async function despublicarSiteAction(id: string): Promise<R<null>> {
  const user = await requirePermission("sites:write");
  if (!uuid.safeParse(id).success) return { ok: false, message: "Inválido." };
  await db.update(t.generatedSites).set({ published: false }).where(eq(t.generatedSites.id, id));
  await audit(user, "sites.unpublish", { entity: "generated_site", entityId: id });
  revalidatePath(`/painel/sites/${id}`);
  return { ok: true, data: null };
}

export async function excluirSiteAction(id: string): Promise<R<null>> {
  const user = await requirePermission("sites:write");
  if (!uuid.safeParse(id).success) return { ok: false, message: "Inválido." };
  await db.delete(t.generatedSites).where(eq(t.generatedSites.id, id));
  await audit(user, "sites.delete", { entity: "generated_site", entityId: id });
  revalidatePath("/painel/sites");
  return { ok: true, data: null };
}

export async function pedirIAAction(id: string, doc: SiteDoc, instrucao: string, blocoId: string | null): Promise<R<SiteDoc>> {
  const user = await requirePermission("sites:write");
  if (!(await rateLimit(`ai:${user.id}`, 20, 60))) return { ok: false, message: "Muitas gerações seguidas. Aguarde 1 minuto." };
  if (!instrucao.trim() || !(await pegarSite(id))) return { ok: false, message: "Escreva o que quer mudar." };
  try { return { ok: true, data: await pedidoLivre(structuredClone(doc), instrucao.slice(0, 600), blocoId, user.id) }; }
  catch (e) { return falha(e); }
}

export async function enviarImagemAction(id: string, dataUrl: string): Promise<R<string>> {
  await requirePermission("sites:write");
  const m = /^data:image\/(png|jpe?g|webp);base64,(.+)$/.exec(dataUrl || "");
  if (!m || !(await pegarSite(id))) return { ok: false, message: "Formato de imagem não suportado (use JPG, PNG ou WebP)." };
  try { return { ok: true, data: await salvarImagem(id, Buffer.from(m[2], "base64"), m[1].replace("jpeg", "jpg")) }; }
  catch (e) { return falha(e); }
}

export async function imagemPorUrlAction(id: string, url: string): Promise<R<string>> {
  await requirePermission("sites:write");
  if (!z.url({ protocol: /^https?$/ }).safeParse(url).success || !(await pegarSite(id))) return { ok: false, message: "Endereço inválido." };
  try { return { ok: true, data: await baixarImagemUrl(url, id) }; }
  catch (e) { return falha(e); }
}

const MODELOS_BLOCO = (setorId: string): Record<string, Record<string, unknown>> => {
  const st = pegarSetor(setorId);
  return {
    galeria: { etiqueta: "Galeria", titulo: "Nosso espaço", destaques: [], fotos: [] },
    faq: { etiqueta: "Dúvidas", titulo: "Perguntas frequentes", destaques: [], itens: [{ pergunta: "Nova pergunta?", resposta: "Resposta aqui." }] },
    depoimentos: { etiqueta: "Depoimentos", titulo: "O que dizem sobre nós", destaques: [], itens: [{ nome: "Cliente", texto: "Escreva aqui um depoimento real.", nota: 5, exemplo: true }] },
    pacotes: { etiqueta: "Planos", titulo: "Escolha o seu", destaques: [], intro: "Opções para todos os momentos.", itens: [{ nome: "Essencial", descricao: "O básico bem feito.", itens: st.servicos.slice(0, 2).map((s) => s[0]) }, { nome: "Completo", descricao: "O mais escolhido.", itens: st.servicos.slice(0, 4).map((s) => s[0]), destaque: true }, { nome: "Premium", descricao: "Tudo incluso.", itens: st.servicos.slice(0, 6).map((s) => s[0]) }] },
    numeros: { itens: [{ valor: "10+", rotulo: "anos" }, { valor: "500+", rotulo: st.vocab.clientes }, { valor: "5,0", rotulo: "nota" }, { valor: "100%", rotulo: "satisfação" }] },
    passos: { etiqueta: "Como funciona", titulo: "Simples assim", destaques: [], itens: [{ titulo: "Chame", texto: "Mande uma mensagem." }, { titulo: "Combine", texto: "Escolha o horário." }, { titulo: "Pronto", texto: "Seja bem atendido." }] },
    cta: { titulo: "Vamos conversar?", destaques: [], texto: "Chame no WhatsApp.", botao: st.vocab.cta },
    historia: { etiqueta: "Sobre", titulo: "Nossa história", destaques: [], texto: "Conte aqui a história do negócio." },
    diferenciais: { etiqueta: "Por que nós", titulo: "Nossos diferenciais", destaques: [], itens: [{ titulo: "Diferencial", texto: "Descreva." }] },
  };
};
export async function novoBlocoAction(tipo: string, setorId: string) {
  await requirePermission("sites:write");
  const m = MODELOS_BLOCO(setorId)[tipo];
  return m ? novoBloco(tipo, m) : null;
}

// ───────── Abordagem ─────────
async function leadDe(input: { prospectId?: string; lead?: Record<string, any>; setor?: string }) {
  if (input.prospectId && uuid.safeParse(input.prospectId).success) {
    const p = await db.query.prospects.findFirst({ where: eq(t.prospects.id, input.prospectId) });
    if (p) {
      const site = await db.query.generatedSites.findFirst({ where: eq(t.generatedSites.prospectId, p.id) });
      return { lead: { ...prospectParaLead(p), setor: input.setor || p.sector }, link: site?.published ? await linkPublico(site) : "" };
    }
  }
  return { lead: { situacaoSite: "sem", ...(input.lead ?? {}), nome: String(input.lead?.nome || "o negócio"), setor: input.setor || input.lead?.setor }, link: "" };
}

export async function abordagemAction(input: { prospectId?: string; lead?: Record<string, any>; setor?: string; link?: string; ia?: boolean }) {
  const user = await requirePermission("prospects:read");
  const { lead, link } = await leadDe(input);
  const usarIA = input.ia !== false && (await rateLimit(`ai:${user.id}`, 20, 60));
  return gerarAbordagem(lead, await vendasConfig(), input.link ?? link, user.id, usarIA);
}

export async function ligacaoAction(input: { prospectId?: string; lead?: Record<string, any>; setor?: string; ia?: boolean }) {
  const user = await requirePermission("prospects:read");
  const { lead } = await leadDe(input);
  const usarIA = input.ia !== false && (await rateLimit(`ai:${user.id}`, 20, 60));
  return gerarLigacao(lead, await vendasConfig(), user.id, usarIA);
}

// ───────── Configurações ─────────
const cfgSchema = z.object({
  seuNome: z.string().max(80), suaEmpresa: z.string().max(80), metaDiaria: z.coerce.number().int().min(1).max(500), objetivo: z.string().max(120),
  googleKey: z.string().max(200).optional(), urlSites: z.string().max(200).optional(),
  aiProvider: z.enum(["local", "gemini"]), geminiKey: z.string().max(200).optional(), geminiModel: z.string().max(60).optional(),
});

export async function salvarConfigVendasAction(input: z.input<typeof cfgSchema>): Promise<R<null>> {
  const user = await requirePermission("vendas:config");
  const p = cfgSchema.safeParse(input);
  if (!p.success) return { ok: false, message: p.error.issues[0]?.message ?? "Dados inválidos." };
  const d = p.data;
  await salvarVendasConfig({ seuNome: d.seuNome, suaEmpresa: d.suaEmpresa, metaDiaria: d.metaDiaria, objetivo: d.objetivo });
  if (d.googleKey !== undefined && !d.googleKey.startsWith("••")) await salvarGooglePlacesKey(d.googleKey.trim() || null);
  if (d.geminiKey !== undefined && !d.geminiKey.startsWith("••")) await setSetting("ai.geminiKey", d.geminiKey.trim() ? encrypt(d.geminiKey.trim()) : null);
  if (d.urlSites !== undefined) {
    const u = d.urlSites.trim();
    if (u && !z.url({ protocol: /^https?$/ }).safeParse(u).success) return { ok: false, message: "Endereço público inválido (use https://…)." };
    await setSetting("vendas.urlSites", u);
  }
  await setSetting("ai.provider", d.aiProvider);
  if (d.geminiModel) await setSetting("ai.geminiModel", d.geminiModel.trim());
  await audit(user, "vendas.config", { meta: { aiProvider: d.aiProvider } });
  revalidatePath("/painel/configuracoes");
  return { ok: true, data: null };
}

export async function testarIAAction(): Promise<R<string>> {
  const user = await requirePermission("ai:use");
  try {
    const { data } = await generate({ kind: "SALES_SCRIPT", schema: z.object({ frase: z.string().max(200) }), system: "Seja breve.", prompt: "Escreva uma frase curta de boas-vindas para um painel de vendas.", effort: "low", log: { userId: user.id, title: "Teste de IA", input: {} } });
    return { ok: true, data: data.frase };
  } catch (e) { return falha(e); }
}
