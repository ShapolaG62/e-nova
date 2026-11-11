"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, t } from "@/db";
import type { VideoRoteiro } from "@/db/schema";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { audit } from "@/lib/audit";
import { rateLimit } from "@/lib/cache";
import { deleteObject } from "@/lib/storage";
import { FORMATOS } from "@/lib/gerador/formatos";
import { enfileirarMontagem, enfileirarProducao, enfileirarRoteiro } from "@/lib/gerador/motor";
import { zodErrors, type ActionState } from "@/lib/validation";
import { registrar } from "@/lib/aprendizado";

const uuid = z.string().uuid();
const EM_ANDAMENTO = new Set(["ROTEIRIZANDO", "PRODUZINDO"]);

const briefSchema = z.object({
  tema: z.string().trim().min(8, "Conte em uma frase do que é o vídeo.").max(2000),
  estilo: z.enum(["fotos", "animacao"]).default("animacao"),
  formato: z.enum(FORMATOS.map((f) => f.id) as [string, ...string[]]),
  duracaoAlvo: z.coerce.number().int().min(10, "Mínimo de 10 segundos.").max(180, "Máximo de 3 minutos."),
  proporcao: z.enum(["9:16", "16:9", "1:1"]),
  publico: z.string().trim().max(300).optional(),
  tom: z.string().trim().max(200).optional(),
  visual: z.enum(["imagem", "video", "misto"]),
  estiloVisual: z.string().trim().max(400).optional(),
  voz: z.string().trim().max(100).optional(),
  cta: z.string().trim().max(200).optional(),
  legendas: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
  musica: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
  clientId: z.union([uuid, z.literal("")]).optional(),
});

export async function criarVideoAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await requirePermission("ai:use");
  const p = briefSchema.safeParse(Object.fromEntries(form));
  if (!p.success) return zodErrors(p.error);
  if (!(await rateLimit(`gerador:${me.id}`, 20, 3600))) return { ok: false, message: "Muitos vídeos em pouco tempo. Espere alguns minutos." };
  const { clientId, ...brief } = p.data;
  // a animação desenhada é sempre vertical e não usa IA de imagem
  if (brief.estilo === "animacao") { brief.proporcao = "9:16"; brief.visual = "imagem"; brief.musica = false; }
  const [row] = await db.insert(t.videoProjetos).values({
    titulo: brief.tema.slice(0, 120), brief: { ...brief, publico: brief.publico || undefined, tom: brief.tom || undefined, estiloVisual: brief.estiloVisual || undefined, voz: brief.voz || undefined, cta: brief.cta || undefined },
    clientId: clientId || null, userId: me.id, etapa: "Na fila do diretor…",
  }).returning({ id: t.videoProjetos.id });
  await enfileirarRoteiro(row.id);
  await audit(me, "gerador.criar", { entity: "video_projeto", entityId: row.id });
  revalidatePath("/painel/gerador");
  redirect(`/painel/gerador/${row.id}`);
}

async function projetoDoUsuario(id: string) {
  const me = await requirePermission("ai:use");
  if (!uuid.safeParse(id).success) return { me, p: null };
  const p = await db.query.videoProjetos.findFirst({ where: eq(t.videoProjetos.id, id) });
  if (p && p.userId !== me.id && !can(me.role, "system:view")) return { me, p: null };
  return { me, p };
}

const cenaEdit = z.object({
  id: z.string().max(20),
  narracao: z.string().trim().min(2, "A narração não pode ficar vazia.").max(800),
  textoNaTela: z.string().trim().max(80).optional(),
  tipo: z.enum(["imagem", "video"]),
  prompt: z.string().trim().max(1500),
  camera: z.string().trim().max(40).optional(),
});
const roteiroEdit = z.object({ cenas: z.array(cenaEdit).min(1, "Deixe pelo menos uma cena.").max(20) });

/** Salva o roteiro editado na tela. Cenas com texto/imagem alterados voltam a ser geradas. */
export async function salvarRoteiroAction(id: string, dados: unknown): Promise<ActionState> {
  const { me, p } = await projetoDoUsuario(id);
  if (!p?.roteiro) return { ok: false, message: "Projeto não encontrado." };
  if (EM_ANDAMENTO.has(p.status)) return { ok: false, message: "Espere terminar o que está rodando." };
  const r = roteiroEdit.safeParse(dados);
  if (!r.success) return { ok: false, message: r.error.issues[0]?.message ?? "Roteiro inválido." };
  const antigo = new Map(p.roteiro.cenas.map((c) => [c.id, c]));
  let seq = Math.max(0, ...p.roteiro.cenas.map((c) => Number(c.id.slice(1)) || 0));
  const cenas: VideoRoteiro["cenas"] = r.data.cenas.map((c) => {
    const a = antigo.get(c.id);
    const id2 = a ? c.id : `c${++seq}`;
    const palavras = c.narracao.split(/\s+/).length;
    return { id: id2, narracao: c.narracao, textoNaTela: c.textoNaTela || undefined, visual: { tipo: c.tipo, prompt: c.prompt, camera: c.camera || undefined }, duracaoAlvo: a?.narracao === c.narracao ? a.duracaoAlvo : Math.max(2, Math.round(palavras / 2.5)), ...(a?.anim ? { anim: a.anim } : {}) };
  });
  // o que mudou precisa ser gerado de novo (a montagem também)
  const producao = cenas.map((c) => {
    const a = antigo.get(c.id);
    const prod = p.cenas.find((x) => x.id === c.id);
    const igual = a && a.narracao === c.narracao && (p.brief.estilo === "animacao" || (a.visual.prompt === c.visual.prompt && a.visual.tipo === c.visual.tipo));
    return igual && prod ? prod : { id: c.id, status: "PENDENTE" as const };
  });
  const mudouSoCameraOuTexto = producao.every((x) => x.status === "PRONTA");
  await db.update(t.videoProjetos).set({
    roteiro: { ...p.roteiro, cenas }, cenas: producao, updatedAt: new Date(),
    ...(p.status === "PRONTO" ? { status: mudouSoCameraOuTexto ? "PRONTO" : "ROTEIRO_PRONTO" } : {}),
  }).where(eq(t.videoProjetos.id, id));
  // autoaprendizado: o "antes → depois" das falas mostra o estilo que a equipe prefere
  for (const c of cenas) {
    const a = antigo.get(c.id);
    if (a && a.narracao !== c.narracao) await registrar("videos", id, "editado", { userId: me.id, dados: { antes: a.narracao, depois: c.narracao } });
  }
  await audit(me, "gerador.roteiro", { entity: "video_projeto", entityId: id });
  revalidatePath(`/painel/gerador/${id}`);
  return { ok: true, message: "Roteiro salvo." };
}

export async function produzirAction(id: string): Promise<ActionState> {
  const { me, p } = await projetoDoUsuario(id);
  if (!p?.roteiro) return { ok: false, message: "Projeto não encontrado." };
  if (EM_ANDAMENTO.has(p.status)) return { ok: false, message: "Já está rodando." };
  await db.update(t.videoProjetos).set({ status: "PRODUZINDO", progresso: 2, etapa: "Na fila de produção…", erro: null, updatedAt: new Date() }).where(eq(t.videoProjetos.id, id));
  await enfileirarProducao(id);
  await audit(me, "gerador.produzir", { entity: "video_projeto", entityId: id });
  revalidatePath(`/painel/gerador/${id}`);
  return { ok: true, message: "Produção iniciada." };
}

export async function refazerCenaAction(id: string, cenaId: string): Promise<ActionState> {
  const { p } = await projetoDoUsuario(id);
  if (!p?.roteiro?.cenas.some((c) => c.id === cenaId)) return { ok: false, message: "Cena não encontrada." };
  if (EM_ANDAMENTO.has(p.status)) return { ok: false, message: "Espere terminar o que está rodando." };
  await db.update(t.videoProjetos).set({ status: "PRODUZINDO", progresso: 2, etapa: `Refazendo a cena ${cenaId}…`, erro: null, updatedAt: new Date() }).where(eq(t.videoProjetos.id, id));
  await enfileirarProducao(id, [cenaId]);
  await registrar("videos", id, "refeito", { dados: { cena: cenaId } });
  revalidatePath(`/painel/gerador/${id}`);
  return { ok: true, message: "Refazendo a cena." };
}

export async function remontarAction(id: string): Promise<ActionState> {
  const { p } = await projetoDoUsuario(id);
  if (!p?.roteiro) return { ok: false, message: "Projeto não encontrado." };
  if (EM_ANDAMENTO.has(p.status)) return { ok: false, message: "Espere terminar o que está rodando." };
  if (p.cenas.some((c) => c.status !== "PRONTA")) return { ok: false, message: "Há cenas sem imagem ou voz. Use Produzir." };
  await db.update(t.videoProjetos).set({ status: "PRODUZINDO", progresso: 80, etapa: "Na fila de montagem…", erro: null, updatedAt: new Date() }).where(eq(t.videoProjetos.id, id));
  await enfileirarMontagem(id);
  revalidatePath(`/painel/gerador/${id}`);
  return { ok: true, message: "Montando de novo." };
}

export async function reescreverAction(id: string): Promise<ActionState> {
  const { p } = await projetoDoUsuario(id);
  if (!p) return { ok: false, message: "Projeto não encontrado." };
  if (EM_ANDAMENTO.has(p.status)) return { ok: false, message: "Espere terminar o que está rodando." };
  await db.update(t.videoProjetos).set({ status: "ROTEIRIZANDO", progresso: 5, etapa: "Na fila do diretor…", erro: null, updatedAt: new Date() }).where(eq(t.videoProjetos.id, id));
  await enfileirarRoteiro(id);
  revalidatePath(`/painel/gerador/${id}`);
  return { ok: true, message: "Pedindo um roteiro novo." };
}

export async function excluirVideoAction(id: string): Promise<ActionState> {
  const { me, p } = await projetoDoUsuario(id);
  if (!p) return { ok: false, message: "Projeto não encontrado." };
  const chaves = [
    ...p.cenas.flatMap((c) => [c.visualChave, c.audioChave]),
    p.resultado?.capaChave, p.resultado?.folhaChave, p.resultado?.musicaChave,
    p.outputAssetId ? undefined : p.resultado?.videoChave, // vídeo ligado a um cliente fica na biblioteca dele
  ].filter((k): k is string => !!k);
  await Promise.all(chaves.map((k) => deleteObject(k).catch(() => {})));
  if (p.status === "PRONTO") await registrar("videos", id, "excluido", { userId: me.id });
  await db.delete(t.videoProjetos).where(eq(t.videoProjetos.id, id));
  await audit(me, "gerador.excluir", { entity: "video_projeto", entityId: id });
  revalidatePath("/painel/gerador");
  redirect("/painel/gerador");
}
