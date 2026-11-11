"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray, ne, notInArray } from "drizzle-orm";
import { z } from "zod";
import { db, t } from "@/db";
import type { Channel } from "@/db/schema";
import { canAccessClient, requirePermission, requireUser, type SessionUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { env } from "@/lib/env";
import { deleteObject, objectSize, readHead, uploadTarget } from "@/lib/storage";
import { zodErrors, type ActionState } from "@/lib/validation";

const VIDEO_MIME = ["video/mp4", "video/quicktime"] as const;
const CHANNELS = ["INSTAGRAM", "TIKTOK", "YOUTUBE"] as const;

// ─── Upload em lote ──────────────────────────────────────────────────────
const uploadSchema = z.object({
  clientId: z.uuid(),
  filename: z.string().trim().min(1).max(255),
  mime: z.enum(VIDEO_MIME, { error: "Só vídeos .mp4 ou .mov" }),
  size: z.number().int().positive(),
});

export async function createUploadAction(input: z.input<typeof uploadSchema>) {
  const user = await requirePermission("content:write");
  const p = uploadSchema.safeParse(input);
  if (!p.success) return { ok: false as const, error: p.error.issues[0]?.message ?? "Arquivo inválido" };
  if (p.data.size > env.MAX_UPLOAD_MB * 1024 * 1024) return { ok: false as const, error: `Maior que ${env.MAX_UPLOAD_MB} MB` };

  const ext = p.data.mime === "video/quicktime" ? "mov" : "mp4";
  const storageKey = `media/${p.data.clientId}/${randomUUID()}.${ext}`;
  const [asset] = await db
    .insert(t.mediaAssets)
    .values({ clientId: p.data.clientId, storageKey, filename: p.data.filename, mime: p.data.mime, sizeBytes: p.data.size, createdBy: user.id })
    .returning({ id: t.mediaAssets.id });
  return { ok: true as const, assetId: asset.id, upload: await uploadTarget(storageKey, p.data.mime, asset.id) };
}

/** Confere tamanho e assinatura do arquivo (ftyp do MP4/MOV) e cria o rascunho do post. */
export async function finalizeUploadAction(assetId: string) {
  const user = await requirePermission("content:write");
  const asset = await db.query.mediaAssets.findFirst({ where: eq(t.mediaAssets.id, assetId) });
  if (!asset || asset.status !== "UPLOADING") return { ok: false as const, error: "Upload não encontrado" };

  const size = await objectSize(asset.storageKey);
  const head = size ? await readHead(asset.storageKey, 12) : Buffer.alloc(0);
  const isIsoMedia = head.subarray(4, 8).toString("latin1") === "ftyp";
  if (!size || !isIsoMedia) {
    await db.update(t.mediaAssets).set({ status: "FAILED" }).where(eq(t.mediaAssets.id, assetId));
    await deleteObject(asset.storageKey).catch(() => {});
    return { ok: false as const, error: "O arquivo não é um vídeo MP4/MOV válido" };
  }

  await db.update(t.mediaAssets).set({ status: "READY", sizeBytes: size }).where(eq(t.mediaAssets.id, assetId));
  const [post] = await db
    .insert(t.posts)
    .values({
      clientId: asset.clientId,
      mediaAssetId: asset.id,
      title: asset.filename.replace(/\.(mp4|mov)$/i, "").slice(0, 150),
      createdBy: user.id,
    })
    .returning({ id: t.posts.id });
  revalidatePath("/painel/conteudo");
  return { ok: true as const, postId: post.id };
}

// ─── Edição do post ──────────────────────────────────────────────────────
const postSchema = z.object({
  title: z.string().trim().min(2, "Dê um título").max(150),
  caption: z.string().trim().max(2200, "Legenda com no máximo 2.200 caracteres (limite do Instagram)"),
  channels: z.array(z.enum(CHANNELS)),
  scheduledAt: z.preprocess((v) => (v ? new Date(`${v}:00-03:00`) : null), z.date().nullable()),
});

async function loadPost(postId: string, user: SessionUser) {
  const post = await db.query.posts.findFirst({ where: eq(t.posts.id, postId) });
  if (!post || !canAccessClient(user, post.clientId)) throw new Error("Post não encontrado");
  return post;
}

async function syncTargets(postId: string, channels: Channel[]) {
  // Remove canais desmarcados que ainda não foram publicados; cria os novos
  await db
    .delete(t.postTargets)
    .where(and(eq(t.postTargets.postId, postId), ne(t.postTargets.status, "PUBLISHED"), channels.length ? notInArray(t.postTargets.channel, channels) : undefined));
  if (channels.length) {
    await db
      .insert(t.postTargets)
      .values(channels.map((channel) => ({ postId, channel })))
      .onConflictDoNothing();
  }
}

export async function updatePostAction(postId: string, _: ActionState, form: FormData): Promise<ActionState> {
  const user = await requirePermission("content:write");
  const post = await loadPost(postId, user);
  if (!["RASCUNHO", "AGUARDANDO_APROVACAO", "FALHOU"].includes(post.status)) return { ok: false, message: "Post agendado/publicado: cancele o agendamento para editar." };
  const parsed = postSchema.safeParse({
    title: form.get("title"),
    caption: form.get("caption") ?? "",
    channels: form.getAll("channels"),
    scheduledAt: form.get("scheduledAt"),
  });
  if (!parsed.success) return zodErrors(parsed.error);
  await db.update(t.posts).set(parsed.data).where(eq(t.posts.id, postId));
  await syncTargets(postId, parsed.data.channels);
  revalidatePath(`/painel/conteudo/${postId}`);
  return { ok: true, message: "Post salvo." };
}

// ─── Fluxo: RASCUNHO → AGUARDANDO_APROVACAO → AGENDADO → PUBLICADO ────────
export async function submitForApprovalAction(form: FormData) {
  const user = await requirePermission("content:write");
  const post = await loadPost(String(form.get("id")), user);
  if (post.status !== "RASCUNHO" || !post.channels.length || !post.mediaAssetId) return;
  await db.update(t.posts).set({ status: "AGUARDANDO_APROVACAO", reviewNote: null }).where(eq(t.posts.id, post.id));
  revalidatePath(`/painel/conteudo/${post.id}`);
  revalidatePath("/painel/conteudo");
}

export async function approvePostAction(form: FormData) {
  const user = await requirePermission("content:approve");
  const post = await loadPost(String(form.get("id")), user);
  if (post.status !== "AGUARDANDO_APROVACAO") return;
  // Sem data, ou data no passado → publica no próximo ciclo do worker
  const when = post.scheduledAt && post.scheduledAt > new Date() ? post.scheduledAt : new Date();
  await db.update(t.posts).set({ status: "AGENDADO", scheduledAt: when, approvedBy: user.id, approvedAt: new Date() }).where(eq(t.posts.id, post.id));
  revalidatePath(`/painel/conteudo/${post.id}`);
  revalidatePath("/painel/conteudo");
}

const changesSchema = z.object({ note: z.string().trim().min(3, "Explique o ajuste").max(1000) });

export async function requestChangesAction(postId: string, _: ActionState, form: FormData): Promise<ActionState> {
  const user = await requirePermission("content:approve");
  const post = await loadPost(postId, user);
  if (post.status !== "AGUARDANDO_APROVACAO") return { ok: false, message: "Este post não está aguardando aprovação." };
  const parsed = changesSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return zodErrors(parsed.error);
  await db.update(t.posts).set({ status: "RASCUNHO", reviewNote: `${user.name}: ${parsed.data.note}` }).where(eq(t.posts.id, postId));
  revalidatePath(`/painel/conteudo/${postId}`);
  return { ok: true, message: "Pedido de ajuste enviado para a equipe." };
}

export async function unschedulePostAction(form: FormData) {
  const user = await requirePermission("content:write");
  const post = await loadPost(String(form.get("id")), user);
  if (post.status !== "AGENDADO") return;
  await db.update(t.posts).set({ status: "RASCUNHO", approvedAt: null, approvedBy: null }).where(eq(t.posts.id, post.id));
  revalidatePath(`/painel/conteudo/${post.id}`);
}

export async function publishNowAction(form: FormData) {
  const user = await requirePermission("content:write");
  const post = await loadPost(String(form.get("id")), user);
  if (post.status !== "AGENDADO") return;
  await db.update(t.posts).set({ scheduledAt: new Date() }).where(eq(t.posts.id, post.id));
  revalidatePath(`/painel/conteudo/${post.id}`);
}

export async function retryPostAction(form: FormData) {
  const user = await requirePermission("content:write");
  const post = await loadPost(String(form.get("id")), user);
  if (post.status !== "FALHOU") return;
  await db.update(t.postTargets).set({ status: "PENDING", error: null }).where(and(eq(t.postTargets.postId, post.id), eq(t.postTargets.status, "FAILED")));
  await db.update(t.posts).set({ status: "AGENDADO", scheduledAt: new Date() }).where(eq(t.posts.id, post.id));
  revalidatePath(`/painel/conteudo/${post.id}`);
}

export async function deletePostAction(form: FormData) {
  const user = await requireUser();
  if (!can(user.role, "content:write")) return;
  const post = await loadPost(String(form.get("id")), user);
  if (post.status === "PUBLICANDO") return;
  await db.delete(t.posts).where(eq(t.posts.id, post.id));
  // Remove o vídeo se nenhum outro post usa
  if (post.mediaAssetId) {
    const other = await db.query.posts.findFirst({ where: eq(t.posts.mediaAssetId, post.mediaAssetId), columns: { id: true } });
    if (!other) {
      const asset = await db.query.mediaAssets.findFirst({ where: eq(t.mediaAssets.id, post.mediaAssetId) });
      if (asset) {
        await deleteObject(asset.storageKey).catch(() => {});
        await db.delete(t.mediaAssets).where(inArray(t.mediaAssets.id, [asset.id]));
      }
    }
  }
  revalidatePath("/painel/conteudo");
  redirect("/painel/conteudo");
}
