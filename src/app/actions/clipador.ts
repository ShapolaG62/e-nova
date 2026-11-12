"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import sharp from "sharp";
import { z } from "zod";
import { db, t } from "@/db";
import type { MarcaConfig } from "@/db/schema";
import { requirePermission } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { rateLimit } from "@/lib/cache";
import { enqueue } from "@/lib/jobs";
import { putObject } from "@/lib/storage";
import { resolverOrigem } from "@/lib/clipador";
import { TEXTO_AUTORIZACAO } from "@/lib/clipador/textos";
import { zodErrors, type ActionState } from "@/lib/validation";

const MARCA_PADRAO: MarcaConfig = {
  vertical: { x: 0.8, y: 0.12, largura: 0.24, opacidade: 0.85 },
  horizontal: { x: 0.9, y: 0.12, largura: 0.14, opacidade: 0.85 },
};

const novoSchema = z.object({
  url: z.string().trim().min(3, "Cole o link do perfil (YouTube, TikTok ou Instagram).").max(300),
  clientId: z.string().uuid("Escolha o cliente cujas redes vão postar."),
  destinos: z.array(z.enum(["INSTAGRAM", "TIKTOK", "YOUTUBE"])).default([]),
  tipos: z.enum(["vertical", "horizontal", "ambos"]).default("vertical"),
  legenda: z.enum(["ia", "original"]).default("ia"),
  creditar: z.boolean().default(true),
  aprovacao: z.enum(["automatico", "revisar"]).default("automatico"),
  autorizado: z.literal(true, { message: "Confirme que você tem autorização do dono do perfil." }),
  comoAutorizado: z.string().trim().min(5, "Conte em poucas palavras como você tem a autorização.").max(300),
});

export async function adicionarCanalAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await requirePermission("content:write");
  const p = novoSchema.safeParse({
    url: form.get("url"), clientId: form.get("clientId"), destinos: form.getAll("destinos"), tipos: form.get("tipos") ?? undefined,
    legenda: form.get("legenda") ?? undefined, creditar: form.get("creditar") === "on", aprovacao: form.get("aprovacao") ?? undefined,
    autorizado: form.get("autorizado") === "on", comoAutorizado: form.get("comoAutorizado"),
  });
  if (!p.success) return zodErrors(p.error);
  if (!(await rateLimit(`clipador:${me.id}`, 30, 3600))) return { ok: false, message: "Muitos canais em pouco tempo. Espere alguns minutos." };
  let canal;
  try { canal = await resolverOrigem(p.data.url); } catch (e) { return { ok: false, errors: { url: [e instanceof Error ? e.message : "Perfil não encontrado."] } }; }
  const [ja] = await db.select({ id: t.canaisVigiados.id }).from(t.canaisVigiados)
    .where(and(eq(t.canaisVigiados.plataforma, canal.plataforma), eq(t.canaisVigiados.youtubeId, canal.youtubeId), eq(t.canaisVigiados.clientId, p.data.clientId))).limit(1);
  if (ja) return { ok: false, errors: { url: ["Esse perfil já está sendo vigiado para esse cliente."] } };
  const [row] = await db.insert(t.canaisVigiados).values({
    nome: canal.nome, plataforma: canal.plataforma, youtubeId: canal.youtubeId, url: canal.url, clientId: p.data.clientId, destinos: p.data.destinos, tipos: p.data.tipos,
    legenda: p.data.legenda, creditar: p.data.creditar, aprovacao: p.data.aprovacao, marca: MARCA_PADRAO, userId: me.id,
    autorizacao: { texto: `${TEXTO_AUTORIZACAO} Como: ${p.data.comoAutorizado}`, aceitoEm: new Date().toISOString(), userId: me.id },
  }).returning({ id: t.canaisVigiados.id });
  // 1ª verificação agora: registra o que já existe (sem repostar o passado); daí em diante só vídeos novos
  await enqueue("clipador.verificar", { id: row.id }, { dedupeKey: `clipador-canal:${row.id}:novo`, maxAttempts: 1 });
  await audit(me, "clipador.canal.criar", { entity: "canal_vigiado", entityId: row.id, meta: { plataforma: canal.plataforma, conta: canal.youtubeId } });
  revalidatePath("/painel/clipador", "layout");
  // vai direto para a página do perfil (marca d'água, vídeos e repostagens)
  redirect(`/painel/clipador/${row.id}`);
}

async function meuCanal(id: string) {
  await requirePermission("content:write");
  if (!z.string().uuid().safeParse(id).success) throw new Error("Canal inválido");
  const [c] = await db.select().from(t.canaisVigiados).where(eq(t.canaisVigiados.id, id)).limit(1);
  if (!c) throw new Error("Canal não encontrado");
  return c;
}

const posSchema = z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1), largura: z.number().min(0.04).max(0.9), opacidade: z.number().min(0.1).max(1) });

export async function salvarMarcaAction(id: string, marca: { vertical: unknown; horizontal: unknown }): Promise<ActionState> {
  const c = await meuCanal(id);
  const v = posSchema.safeParse(marca.vertical), h = posSchema.safeParse(marca.horizontal);
  if (!v.success || !h.success) return { ok: false, message: "Posição inválida." };
  await db.update(t.canaisVigiados).set({ marca: { ...c.marca, vertical: v.data, horizontal: h.data }, updatedAt: new Date() }).where(eq(t.canaisVigiados.id, id));
  revalidatePath("/painel/clipador", "layout");
  return { ok: true, message: "Posição da marca d'água salva." };
}

/** Recebe a imagem da marca d'água (PNG/JPG/WebP até 3 MB) e guarda como PNG. */
export async function enviarMarcaAction(id: string, form: FormData): Promise<ActionState> {
  const c = await meuCanal(id);
  const f = form.get("arquivo");
  if (!(f instanceof File) || f.size === 0) return { ok: false, message: "Escolha a imagem da marca d'água." };
  if (f.size > 3 * 1024 * 1024) return { ok: false, message: "A imagem pode ter no máximo 3 MB." };
  let png: Buffer;
  try {
    png = await sharp(Buffer.from(await f.arrayBuffer()), { limitInputPixels: 25_000_000 })
      .resize(1200, 1200, { fit: "inside", withoutEnlargement: true }).png().toBuffer();
  } catch { return { ok: false, message: "Não consegui ler essa imagem. Use PNG, JPG ou WebP." }; }
  const chave = `clipador/${id}/marca-${Date.now().toString(36)}.png`;
  await putObject(chave, png, "image/png");
  await db.update(t.canaisVigiados).set({ marca: { ...c.marca, chave }, updatedAt: new Date() }).where(eq(t.canaisVigiados.id, id));
  revalidatePath("/painel/clipador", "layout");
  return { ok: true, message: "Marca d'água enviada. Agora arraste para a posição que quiser." };
}

const configSchema = z.object({
  destinos: z.array(z.enum(["INSTAGRAM", "TIKTOK", "YOUTUBE"])),
  tipos: z.enum(["vertical", "horizontal", "ambos"]),
  legenda: z.enum(["ia", "original"]),
  creditar: z.boolean(),
  aprovacao: z.enum(["automatico", "revisar"]),
  ativo: z.boolean(),
});

export async function salvarConfigAction(id: string, _: ActionState, form: FormData): Promise<ActionState> {
  await meuCanal(id);
  const p = configSchema.safeParse({
    destinos: form.getAll("destinos"), tipos: form.get("tipos"), legenda: form.get("legenda"), creditar: form.get("creditar") === "on",
    aprovacao: form.get("aprovacao"), ativo: form.get("ativo") === "on",
  });
  if (!p.success) return zodErrors(p.error);
  await db.update(t.canaisVigiados).set({ ...p.data, updatedAt: new Date() }).where(eq(t.canaisVigiados.id, id));
  revalidatePath("/painel/clipador", "layout");
  return { ok: true, message: "Configuração salva." };
}

export async function verificarAgoraAction(id: string): Promise<ActionState> {
  await meuCanal(id);
  await enqueue("clipador.verificar", { id }, { dedupeKey: `clipador-canal:${id}:agora:${Math.floor(Date.now() / 60_000)}`, maxAttempts: 1 });
  return { ok: true, message: "Verificando o canal agora. Atualize a página em alguns segundos." };
}

/** Manda um vídeo da lista para repostar (inclusive um anterior ao cadastro ou um que falhou). */
export async function repostarAction(videoId: string): Promise<ActionState> {
  await requirePermission("content:write");
  if (!z.string().uuid().safeParse(videoId).success) return { ok: false, message: "Vídeo inválido." };
  const [v] = await db.select({ id: t.videosVigiados.id }).from(t.videosVigiados)
    .where(and(eq(t.videosVigiados.id, videoId), inArray(t.videosVigiados.status, ["IGNORADO", "FALHOU"]))).limit(1);
  if (!v) return { ok: false, message: "Esse vídeo já está na fila ou foi postado." };
  await db.update(t.videosVigiados).set({ status: "NOVO", etapa: "Na fila", erro: null, updatedAt: new Date() }).where(eq(t.videosVigiados.id, videoId));
  await enqueue("clipador.processar", { id: videoId }, { dedupeKey: `clipador:${videoId}:${Date.now()}`, maxAttempts: 3 });
  revalidatePath("/painel/clipador", "layout");
  return { ok: true, message: "Na fila: vou baixar, colocar a marca d'água e postar." };
}

export async function excluirCanalAction(id: string): Promise<ActionState> {
  const me = await requirePermission("content:write");
  await meuCanal(id);
  await db.delete(t.canaisVigiados).where(eq(t.canaisVigiados.id, id));
  await audit(me, "clipador.canal.excluir", { entity: "canal_vigiado", entityId: id });
  revalidatePath("/painel/clipador", "layout");
  return { ok: true, message: "Canal removido. Os posts já criados continuam em Conteúdo." };
}
