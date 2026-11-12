import "server-only";
import { and, desc, eq, gte, isNull, lte, ne, or, sql } from "drizzle-orm";
import { db, t } from "@/db";
import type { Prospect, GeneratedSite } from "@/db/schema";
import { getObjectBuffer, putObject } from "@/lib/storage";
import { safeFetch } from "@/lib/net-safety";
import { googlePlacesKey, vendasConfig, baseSites } from "./config";
import {
  montarDocumento, renderSite, setor as pegarSetor, detectarSetor, LAYOUT_IDS, zipArquivos, slugSite,
  mensagemEnvio, notaOportunidade, negocioNoGoogle, type SiteDoc, type LeadBusca,
} from "./engine";
import { reescreverSite, abordagem as gerarAbordagem } from "./ai";

/* eslint-disable @typescript-eslint/no-explicit-any */

// ───────── conversão prospect (banco) ⇄ lead (motor) ─────────
export function prospectParaLead(p: Prospect) {
  return {
    id: p.id, placeId: p.placeId, nome: p.name, setor: p.sector, cidade: p.city ?? "", uf: p.uf ?? "", bairro: p.district ?? "",
    endereco: p.address ?? "", telefone: p.phone ?? "", whatsapp: p.whatsapp ?? "", instagram: p.instagram ?? "", site: p.website ?? "",
    situacaoSite: p.siteStatus, nota: p.rating, avaliacoes: p.reviewsCount, oportunidade: p.opportunity, horarios: p.hours,
    fotos: p.photoRefs, reviews: p.googleReviews, mapa: p.mapsUrl ?? "", lat: p.lat, lng: p.lng, pais: p.country,
  };
}

export function leadParaProspect(l: Record<string, any>, setorId: string) {
  return {
    placeId: l.placeId || null,
    name: String(l.nome).slice(0, 200),
    sector: setorId,
    city: l.cidade || null, uf: l.uf || null, district: l.bairro || null, country: (l.pais || "BR").slice(0, 2),
    address: l.endereco || null, phone: l.telefone || null, whatsapp: l.whatsapp ? String(l.whatsapp).replace(/\D/g, "").slice(0, 20) : null,
    instagram: l.instagram || null, website: l.site || l.redeSocial || null, siteStatus: l.situacaoSite || "sem",
    rating: l.nota ?? null, reviewsCount: l.avaliacoes ?? 0, opportunity: l.oportunidade ?? notaOportunidade(l),
    hours: l.horarios ?? [], photoRefs: l.fotos ?? [], googleReviews: l.reviews ?? [], mapsUrl: l.mapa || null,
    lat: l.lat ?? null, lng: l.lng ?? null, origin: l.demo ? "demo" : l.origem === "manual" ? "manual" : "google",
  };
}

/** Salva (ou reaproveita) um negócio no funil. Retorna o id do prospect. */
export async function garantirProspect(l: Record<string, any>, setorId: string, userId: string): Promise<string> {
  if (l.id && /^[0-9a-f-]{36}$/.test(l.id)) {
    const p = await db.query.prospects.findFirst({ where: eq(t.prospects.id, l.id) });
    if (p) { if (p.sector !== setorId) await db.update(t.prospects).set({ sector: setorId }).where(eq(t.prospects.id, p.id)); return p.id; }
  }
  if (l.placeId) {
    const p = await db.query.prospects.findFirst({ where: eq(t.prospects.placeId, l.placeId) });
    if (p) return p.id;
  }
  const [row] = await db.insert(t.prospects).values({
    ...leadParaProspect(l, setorId), createdBy: userId,
    history: [{ data: new Date().toISOString(), tipo: "criado", texto: "Adicionado ao funil" }],
  }).returning({ id: t.prospects.id });
  return row.id;
}

export async function addHistorico(prospectId: string, tipo: string, texto: string) {
  const entrada = JSON.stringify([{ data: new Date().toISOString(), tipo, texto }]);
  await db.update(t.prospects).set({ history: sql`(${entrada}::jsonb || ${t.prospects.history})` }).where(eq(t.prospects.id, prospectId));
}

export async function registrarEvento(kind: string, d: { prospectId?: string | null; siteId?: string | null; userId?: string | null; meta?: Record<string, unknown> }) {
  await db.insert(t.salesEvents).values({ kind, prospectId: d.prospectId ?? null, siteId: d.siteId ?? null, userId: d.userId ?? null, meta: d.meta ?? null });
}

// ───────── fotos ─────────
/** Foto da Places API com cache no armazenamento (a chave nunca vai para o navegador). */
export async function fotoPlaces(nome: string, largura: number): Promise<Buffer> {
  if (!/^places\/[\w-]+\/photos\/[\w-]+$/.test(nome)) throw new Error("foto inválida");
  const key = `places-cache/${nome.replace(/[^\w-]/g, "_")}_${largura}.jpg`;
  try { return await getObjectBuffer(key); } catch { /* sem cache */ }
  const chave = await googlePlacesKey();
  if (!chave) throw new Error("sem chave");
  const r = await fetch(`https://places.googleapis.com/v1/${nome}/media?maxWidthPx=${largura}&key=${encodeURIComponent(chave)}`, { signal: AbortSignal.timeout(20_000) });
  if (!r.ok) throw new Error("foto " + r.status);
  const buf = Buffer.from(await r.arrayBuffer());
  await putObject(key, buf, "image/jpeg");
  return buf;
}

const urlImagem = (siteId: string, arq: string) => `/sm/${siteId}/${arq}`;

export async function salvarImagem(siteId: string, buf: Buffer, ext: string) {
  if (buf.length > 12 * 1024 * 1024) throw new Error("Imagem muito grande (máx. 12 MB).");
  const arq = `u${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}.${ext}`;
  await putObject(`sites/${siteId}/${arq}`, buf, ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg");
  return urlImagem(siteId, arq);
}

export async function baixarImagemUrl(url: string, siteId: string) {
  const r = await safeFetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(20_000) });
  const tipo = r.headers.get("content-type") || "";
  if (!r.ok || !tipo.startsWith("image/")) throw new Error('Esse endereço não é de uma imagem. Use o link direto da foto (botão direito → "Copiar endereço da imagem").');
  return salvarImagem(siteId, Buffer.from(await r.arrayBuffer()), tipo.includes("png") ? "png" : tipo.includes("webp") ? "webp" : "jpg");
}

async function baixarFotosGoogle(refs: string[], siteId: string, max = 8, prefixo = "g") {
  const r = await Promise.all(refs.slice(0, max).map(async (nome, i) => {
    try {
      const buf = await fotoPlaces(nome, 1600);
      const arq = `${prefixo}${i + 1}.jpg`;
      await putObject(`sites/${siteId}/${arq}`, buf, "image/jpeg");
      return urlImagem(siteId, arq);
    } catch { return null; }
  }));
  return r.filter((x): x is string => !!x);
}

// ───────── criar site ─────────
export type CriarSiteInput = {
  lead: Record<string, any>; setor?: string; servicos?: string[]; cores?: string[]; tom?: string;
  fotosUrls?: string[]; layout?: string; comIA?: boolean; nome?: string;
};

/**
 * Site premium precisa de fotos: 10+ por página (topo, história, galeria) e uma por serviço.
 * Primeiro valem as fotos do próprio negócio (Google e as coladas); o que faltar vem do Pixabay
 * (fotos livres do ramo), baixado para o nosso armazenamento — o site nunca aponta para fora.
 */
async function fotosDoRamo(termo: string, siteId: string, quantas: number, usadas: Set<string>): Promise<string[]> {
  if (quantas <= 0) return [];
  const { chavePixabay, buscarPixabay } = await import("@/lib/ferramentas/pixabay");
  const chave = await chavePixabay();
  if (!chave) return [];
  try {
    const { itens } = await buscarPixabay(chave, { termo, tipo: "foto", pagina: 1, porPagina: Math.min(40, quantas * 3), orientacao: "horizontal", idioma: "pt" });
    const novas = itens.filter((i) => i.url && !usadas.has(i.id) && i.largura >= 1200).slice(0, quantas);
    novas.forEach((i) => usadas.add(i.id));
    const salvas = await Promise.all(novas.map((i) => baixarImagemUrl(i.url, siteId).catch(() => null)));
    return salvas.filter((x): x is string => !!x);
  } catch { return []; }
}

export async function criarSite(inp: CriarSiteInput, userId: string): Promise<GeneratedSite> {
  const setorId = inp.setor || inp.lead.setor || detectarSetor(inp.lead);
  const st = pegarSetor(setorId);
  const prospectId = await garantirProspect({ ...inp.lead, nome: inp.nome || inp.lead.nome }, setorId, userId);
  const [linha] = await db.insert(t.generatedSites).values({ name: (inp.nome || inp.lead.nome).slice(0, 200), sector: setorId, prospectId, doc: {}, createdBy: userId }).returning();
  const siteId = linha.id;
  const [fotosGoogle, coladas] = await Promise.all([
    (await googlePlacesKey()) ? baixarFotosGoogle(inp.lead.fotos ?? [], siteId) : Promise.resolve([] as string[]),
    Promise.all((inp.fotosUrls ?? []).slice(0, 10).map((u) => baixarImagemUrl(u, siteId).catch(() => null))).then((r) => r.filter((x): x is string => !!x)),
  ]);
  const ids = LAYOUT_IDS();
  const layout = inp.layout && ids.includes(inp.layout) ? inp.layout : st.visuais.find((v) => ids.includes(v)) ?? ids[0];
  // completa até 10 fotos do ramo quando o negócio tem poucas
  const usadas = new Set<string>();
  const proprias = [...coladas, ...fotosGoogle];
  const doRamo = await fotosDoRamo(st.busca || st.nome, siteId, 10 - proprias.length, usadas);
  let doc = montarDocumento({ ...inp.lead, nome: inp.nome || inp.lead.nome, setor: setorId }, { setor: setorId, servicos: inp.servicos, cores: inp.cores, tom: inp.tom, fotos: [...proprias, ...doRamo], layout });
  // uma foto por serviço, procurada pelo nome do serviço (só se a chave do Pixabay existir)
  const blocoServ = doc.blocos.find((b) => b.tipo === "servicos");
  const itensServ = (blocoServ?.dados.itens ?? []) as { titulo: string; foto?: string }[];
  const fotosServ = await Promise.all(itensServ.slice(0, 8).map((it) => it.foto ? Promise.resolve([it.foto]) : fotosDoRamo(it.titulo, siteId, 1, usadas).then(async (a) => a.length ? a : fotosDoRamo(`${it.titulo} ${st.busca || st.nome}`, siteId, 1, usadas))));
  itensServ.slice(0, 8).forEach((it, i) => { if (!it.foto && fotosServ[i][0]) it.foto = fotosServ[i][0]; });
  let aviso: string | null = null;
  if (inp.comIA) {
    try { doc = await reescreverSite(doc, userId); }
    catch (e: any) { aviso = "IA indisponível agora; usamos os textos prontos. " + (e?.userMessage ?? ""); }
  }
  const cfg = await vendasConfig();
  const ab = await gerarAbordagem({ ...inp.lead, nome: inp.nome || inp.lead.nome, setor: setorId } as any, cfg, "", userId, !!inp.comIA);
  const [site] = await db.update(t.generatedSites).set({ doc: doc as any, layouts: [layout], layoutIndex: 0, approach: ab as any, aiNotice: aviso?.slice(0, 300) ?? null }).where(eq(t.generatedSites.id, siteId)).returning();
  await registrarEvento("site_gerado", { prospectId, siteId, userId, meta: { nome: site.name } });
  await addHistorico(prospectId, "site", "Site gerado");
  return site;
}

/** "Gerar outro visual": percorre os visuais sugeridos do setor e depois os demais; dá para voltar. */
// ───────── conferir um site com o Google Maps ─────────
export type DiferencaGoogle = { campo: string; rotulo: string; site: string; google: string };
export type ConferenciaGoogle = { encontrado: string; endereco: string; mapa: string; diferencas: DiferencaGoogle[]; fotosGoogle: number; fotosSite: number; avaliacoesTexto: number };

async function acharNoGoogle(site: GeneratedSite) {
  const chave = await googlePlacesKey();
  if (!chave) throw Object.assign(new Error("sem chave"), { userMessage: "Cadastre a chave do Google Maps em Configurações de vendas para conferir." });
  const doc = site.doc as unknown as SiteDoc;
  const p = site.prospectId ? await db.query.prospects.findFirst({ where: eq(t.prospects.id, site.prospectId) }) : undefined;
  const n = doc.negocio ?? {};
  const lead = await negocioNoGoogle({ placeId: p?.placeId, nome: n.nome || site.name, cidade: n.cidade || p?.city || "", uf: n.uf || p?.uf || "", pais: p?.country || "BR", chave });
  if (!lead) throw Object.assign(new Error("não achou"), { userMessage: "Não encontrei esse negócio no Google Maps. Confira o nome e a cidade no editor." });
  return { doc, prospect: p, lead };
}

const txt = (v: unknown) => (Array.isArray(v) ? v.join(" · ") : v == null ? "" : String(v)).trim();

/** Compara o que está no site com o que está hoje no Google Maps (não muda nada). */
export async function conferirNoGoogle(site: GeneratedSite): Promise<ConferenciaGoogle> {
  const { doc, lead } = await acharNoGoogle(site);
  const n = doc.negocio ?? {};
  const campos: [string, string, unknown, unknown][] = [
    ["nome", "Nome", n.nome, lead.nome],
    ["endereco", "Endereço", n.endereco, lead.endereco],
    ["telefone", "Telefone", n.telefone, lead.telefone],
    ["whatsapp", "WhatsApp", n.whatsapp, lead.whatsapp],
    ["horarios", "Horários", n.horarios, lead.horarios],
    ["nota", "Nota no Google", n.nota, lead.nota],
    ["avaliacoes", "Nº de avaliações", n.avaliacoes, lead.avaliacoes],
    ["instagram", "Instagram", n.instagram, lead.instagram],
  ];
  const diferencas = campos
    .filter(([, , a, b]) => txt(b) && txt(a) !== txt(b))
    .map(([campo, rotulo, a, b]) => ({ campo, rotulo, site: txt(a) || "(vazio)", google: txt(b) }));
  return {
    encontrado: lead.nome, endereco: lead.endereco, mapa: lead.mapa || "",
    diferencas, fotosGoogle: lead.fotos?.length ?? 0, fotosSite: doc.fotos?.lista?.length ?? 0, avaliacoesTexto: lead.reviews?.length ?? 0,
  };
}

/** Troca os dados, as fotos e/ou os depoimentos do site pelos que estão no Google Maps. */
export async function aplicarDoGoogle(site: GeneratedSite, o: { dados: boolean; fotos: boolean; depoimentos: boolean }) {
  const { doc, prospect, lead } = await acharNoGoogle(site);
  const novo: SiteDoc = structuredClone(doc);
  const feito: string[] = [];
  if (o.dados) {
    const n = novo.negocio;
    for (const k of ["nome", "endereco", "telefone", "whatsapp", "instagram", "mapa", "cidade", "uf", "bairro"] as const) if (txt(lead[k])) n[k] = lead[k];
    if (lead.horarios?.length) n.horarios = lead.horarios;
    if (lead.nota) { n.nota = lead.nota; n.avaliacoes = lead.avaliacoes; }
    if (lead.lat != null) { n.lat = lead.lat; n.lng = lead.lng; }
    feito.push("dados");
  }
  if (o.fotos && lead.fotos?.length) {
    const novas = await baixarFotosGoogle(lead.fotos, site.id, 10, "g" + Date.now().toString(36) + "-");
    if (novas.length) {
      // as fotos do Google vêm primeiro (a primeira vira a capa); as antigas completam até 10
      const lista = [...novas, ...(novo.fotos?.lista ?? []).filter((u) => !novas.includes(u))].slice(0, Math.max(10, novas.length));
      novo.fotos = { capa: novas[0], lista };
      for (const b of novo.blocos) if (b.tipo === "galeria" && Array.isArray(b.dados.fotos)) b.dados.fotos = [];
      feito.push(novas.length + " fotos");
    }
  }
  if (o.depoimentos && lead.reviews?.length) {
    const dep = novo.blocos.find((b) => b.tipo === "depoimentos");
    if (dep) { dep.dados.itens = lead.reviews.slice(0, 3).map((r: any) => ({ nome: r.nome, texto: r.texto, nota: r.nota || 5 })); feito.push("depoimentos"); }
  }
  await db.update(t.generatedSites).set({ doc: novo as any, name: String(novo.negocio?.nome || site.name).slice(0, 200) }).where(eq(t.generatedSites.id, site.id));
  if (prospect) {
    await db.update(t.prospects).set({
      placeId: lead.placeId || prospect.placeId, phone: lead.telefone || prospect.phone, whatsapp: lead.whatsapp || prospect.whatsapp,
      address: lead.endereco || prospect.address, hours: lead.horarios?.length ? lead.horarios : prospect.hours, rating: lead.nota ?? prospect.rating,
      reviewsCount: lead.avaliacoes || prospect.reviewsCount, photoRefs: lead.fotos?.length ? lead.fotos : prospect.photoRefs,
      googleReviews: lead.reviews?.length ? lead.reviews : prospect.googleReviews, mapsUrl: lead.mapa || prospect.mapsUrl,
    }).where(eq(t.prospects.id, prospect.id));
    await addHistorico(prospect.id, "site", "Site conferido com o Google Maps: " + (feito.join(", ") || "nada mudou"));
  }
  return feito;
}

export async function outroVisual(site: GeneratedSite, direcao: 1 | -1) {
  const ids = LAYOUT_IDS();
  const ordem = [...new Set([...pegarSetor(site.sector).visuais, ...ids])].filter((v) => ids.includes(v));
  const doc = site.doc as unknown as SiteDoc;
  const visuais = site.layouts.length ? [...site.layouts] : [doc.layout];
  let i = site.layoutIndex;
  if (direcao < 0) i = Math.max(0, i - 1);
  else if (i < visuais.length - 1) i++;
  else {
    const prox = ordem.find((v) => !visuais.includes(v)) ?? ordem[(ordem.indexOf(visuais[i]) + 1) % ordem.length];
    visuais.push(prox); i = visuais.length - 1;
  }
  const [s] = await db.update(t.generatedSites).set({ doc: { ...doc, layout: visuais[i], tema: "auto" } as any, layouts: visuais, layoutIndex: i }).where(eq(t.generatedSites.id, site.id)).returning();
  return s;
}

export async function linkPublico(site: Pick<GeneratedSite, "slug">) {
  return `${await baseSites()}/s/${site.slug}`;
}

export async function publicar(site: GeneratedSite, slugPedido: string | undefined, userId: string) {
  const base = slugSite(slugPedido || site.slug || site.name).slice(0, 56);
  let slug = base;
  for (let i = 2; ; i++) {
    const outro = await db.query.generatedSites.findFirst({ where: and(eq(t.generatedSites.slug, slug), ne(t.generatedSites.id, site.id)) });
    if (!outro) break;
    slug = `${base}-${i}`;
  }
  const [s] = await db.update(t.generatedSites).set({ slug, published: true, publishedAt: new Date() }).where(eq(t.generatedSites.id, site.id)).returning();
  await registrarEvento("publicado", { prospectId: s.prospectId, siteId: s.id, userId });
  const link = await linkPublico(s);
  const p = s.prospectId ? await db.query.prospects.findFirst({ where: eq(t.prospects.id, s.prospectId) }) : null;
  const cfg = await vendasConfig();
  return { site: s, link, mensagem: mensagemEnvio(p ? prospectParaLead(p) : { nome: s.name, setor: s.sector }, cfg, link), whatsapp: p?.whatsapp ?? (s.doc as any).negocio?.whatsapp ?? "" };
}

/** HTML com imagens apontando para "img/…" (ZIP / hospedagem externa). */
export async function htmlEstatico(site: GeneratedSite) {
  const arquivos: { nome: string; dados: Buffer<ArrayBufferLike> }[] = [];
  const pend: Promise<void>[] = [];
  const midia = (u: string) => {
    const m = /^\/sm\/[^/]+\/([\w.-]+)$/.exec(u || "");
    if (!m) return u;
    const nome = "img/" + m[1];
    if (!arquivos.some((a) => a.nome === nome)) {
      const a: { nome: string; dados: Buffer<ArrayBufferLike> } = { nome, dados: Buffer.alloc(0) };
      arquivos.push(a);
      pend.push(getObjectBuffer(`sites/${site.id}/${m[1]}`).then((b) => { a.dados = b; }).catch(() => {}));
    }
    return nome;
  };
  const html = renderSite(site.doc as unknown as SiteDoc, { midia });
  await Promise.all(pend);
  return { html, arquivos: arquivos.filter((a) => a.dados.length) };
}

export async function zipSite(site: GeneratedSite) {
  const { html, arquivos } = await htmlEstatico(site);
  return zipArquivos([{ nome: "index.html", dados: html }, ...arquivos]);
}

// ───────── funil ─────────
export async function registrarContato(prospectId: string, userId: string, texto?: string, canal = "whatsapp") {
  const p = await db.query.prospects.findFirst({ where: eq(t.prospects.id, prospectId) });
  if (!p) return null;
  const hoje = new Date().toISOString().slice(0, 10);
  const prox = new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10);
  await db.update(t.prospects).set({
    stage: p.stage === "NOVO" ? "CONTATADO" : p.stage,
    lastContactAt: new Date(),
    nextContactAt: p.nextContactAt && p.nextContactAt > hoje ? p.nextContactAt : prox,
  }).where(eq(t.prospects.id, p.id));
  await addHistorico(p.id, "contato", texto ? `Mensagem enviada: ${texto.slice(0, 140)}…` : `Contato pelo ${canal}`);
  await registrarEvento("contato", { prospectId: p.id, userId, meta: { canal } });
  return p.id;
}

/** Aba "Hoje" do funil. */
export async function dadosHoje() {
  const cfg = await vendasConfig();
  const inicioDia = new Date(new Date().toDateString());
  const hoje = new Date().toISOString().slice(0, 10);
  const [{ n: feitos }] = await db.select({ n: sql<number>`count(*)::int` }).from(t.salesEvents).where(and(eq(t.salesEvents.kind, "contato"), gte(t.salesEvents.createdAt, inicioDia)));
  const novosComSite = await db.select({ p: t.prospects, s: t.generatedSites }).from(t.prospects)
    .innerJoin(t.generatedSites, eq(t.generatedSites.prospectId, t.prospects.id))
    .where(eq(t.prospects.stage, "NOVO")).orderBy(desc(t.generatedSites.createdAt)).limit(40);
  const vistos = new Set<string>();
  const prontos = [];
  for (const { p, s } of novosComSite) {
    if (vistos.has(p.id)) continue;
    vistos.add(p.id);
    const link = s.published ? await linkPublico(s) : "";
    prontos.push({ prospect: p, site: { id: s.id, published: s.published, link, capa: (s.doc as any).fotos?.capa || (s.doc as any).fotos?.lista?.[0] || "" }, mensagem: link ? mensagemEnvio(prospectParaLead(p), cfg, link) : "" });
  }
  const followups = await db.query.prospects.findMany({
    where: and(lte(t.prospects.nextContactAt, hoje), or(eq(t.prospects.stage, "CONTATADO"), eq(t.prospects.stage, "NEGOCIANDO"))),
    orderBy: [t.prospects.nextContactAt], limit: 30,
  });
  const semSite = await db.select({ p: t.prospects }).from(t.prospects)
    .leftJoin(t.generatedSites, eq(t.generatedSites.prospectId, t.prospects.id))
    .where(and(eq(t.prospects.stage, "NOVO"), isNull(t.generatedSites.id))).orderBy(desc(t.prospects.opportunity)).limit(30);
  const visitas = await db.select({ e: t.salesEvents, nome: t.generatedSites.name }).from(t.salesEvents)
    .leftJoin(t.generatedSites, eq(t.generatedSites.id, t.salesEvents.siteId))
    .where(eq(t.salesEvents.kind, "visita")).orderBy(desc(t.salesEvents.createdAt)).limit(10);
  return {
    meta: cfg.metaDiaria, feitos,
    esperando: prontos.length + followups.length + semSite.length,
    prontos, followups, semSite: semSite.map((x) => x.p),
    visitas: visitas.map((v) => ({ nome: v.nome ?? "Site", prospectId: v.e.prospectId, em: v.e.createdAt.toISOString() })),
  };
}

/** Fechou: vira Cliente do ERP com contrato de criação (avulso) e, se houver, mensalidade (MRR). */
export async function converterEmCliente(prospectId: string, o: { setupCents: number; mensalCents: number; servico: string }, userId: string) {
  const p = await db.query.prospects.findFirst({ where: eq(t.prospects.id, prospectId) });
  if (!p) throw new Error("Contato não encontrado");
  if (p.clientId) return p.clientId;
  return db.transaction(async (tx) => {
    const [c] = await tx.insert(t.clients).values({
      legalName: p.name, tradeName: p.name, niche: pegarSetor(p.sector).nome.slice(0, 80),
      contactPhone: (p.whatsapp || p.phone || "").replace(/\D/g, "").slice(-20) || null,
      googlePlaceId: p.placeId, status: "ACTIVE", notes: p.notes,
    }).returning({ id: t.clients.id });
    if (o.setupCents > 0) await tx.insert(t.contracts).values({ clientId: c.id, type: "ONE_OFF", service: o.servico.slice(0, 120) || "Criação de site", amountCents: o.setupCents });
    if (o.mensalCents > 0) await tx.insert(t.contracts).values({ clientId: c.id, type: "RECURRING", service: "Hospedagem e manutenção do site", amountCents: o.mensalCents });
    await tx.update(t.prospects).set({ clientId: c.id, stage: "FECHADO", proposalCents: o.setupCents || p.proposalCents }).where(eq(t.prospects.id, p.id));
    await tx.update(t.generatedSites).set({ clientId: c.id }).where(eq(t.generatedSites.prospectId, p.id));
    await tx.insert(t.salesEvents).values({ kind: "venda", prospectId: p.id, userId, meta: { setupCents: o.setupCents, mensalCents: o.mensalCents } });
    return c.id;
  });
}

export function buscaComNoFunil(leads: LeadBusca[], existentes: Set<string>) {
  return leads.map((l) => ({ ...l, noCrm: existentes.has(l.placeId || l.id) }));
}
