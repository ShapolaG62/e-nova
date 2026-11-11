"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, t } from "@/db";
import { requirePermission } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { enqueue } from "@/lib/jobs";
import { verifyUploadedVideo } from "@/lib/media";
import { deleteObject } from "@/lib/storage";
import { rateLimit } from "@/lib/cache";
import { youtubeId } from "@/lib/clips/youtube";
import { zodErrors, type ActionState } from "@/lib/validation";
import { registrar } from "@/lib/aprendizado";

/** Depois do upload: valida o arquivo, cria o projeto e começa a transcrição. */
export async function startClipProjectAction(assetId: string, title: string) {
  const user = await requirePermission("clips:use");
  const v = await verifyUploadedVideo(assetId);
  if (!v.ok) return v;
  const [p] = await db
    .insert(t.clipProjects)
    .values({
      clientId: v.asset.clientId,
      title: (title.trim() || v.asset.filename.replace(/\.(mp4|mov)$/i, "")).slice(0, 200),
      sourceAssetId: assetId,
      createdBy: user.id,
      stage: "Na fila",
    })
    .returning({ id: t.clipProjects.id });
  await enqueue("clip.transcribe", { id: p.id }, { dedupeKey: `clip-transcribe:${p.id}`, maxAttempts: 2 });
  await audit(user, "clips.project.create", { entity: "clip_project", entityId: p.id });
  revalidatePath("/painel/cortes");
  return { ok: true as const, projectId: p.id };
}

const rangeSchema = z.object({
  start: z.coerce.number().min(0),
  end: z.coerce.number().min(0),
  captions: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
});

/** Ajusta início/fim (se mudou) e manda renderizar o vertical 9:16. */
export async function renderClipAction(clipId: string, form: FormData) {
  await requirePermission("clips:use");
  const clip = await db.query.clips.findFirst({ where: eq(t.clips.id, clipId), with: { project: true } });
  if (!clip || clip.status === "RENDERIZANDO") return;
  const p = rangeSchema.safeParse(Object.fromEntries(form));
  if (p.success) {
    const dur = clip.project.durationSec ?? p.data.end;
    const start = Math.min(p.data.start, dur - 1);
    const end = Math.min(Math.max(p.data.end, start + 3), dur, start + 180); // 3 s a 3 min
    await db.update(t.clips).set({ start, end, captions: p.data.captions, status: "RENDERIZANDO" }).where(eq(t.clips.id, clipId));
  } else {
    await db.update(t.clips).set({ status: "RENDERIZANDO" }).where(eq(t.clips.id, clipId));
  }
  await enqueue("clip.render", { id: clipId }, { dedupeKey: `clip-render:${clipId}`, maxAttempts: 1 });
  revalidatePath(`/painel/cortes/${clip.projectId}`);
}

/** Leva o corte pronto para Publicações como rascunho (aprovação do cliente + agendamento). */
export async function clipToPostAction(form: FormData) {
  const user = await requirePermission("content:write");
  const clip = await db.query.clips.findFirst({ where: eq(t.clips.id, String(form.get("id"))), with: { project: true } });
  if (!clip?.outputAssetId || !clip.project.clientId) return;
  const caption = [clip.hook, clip.hashtags.map((h) => `#${h}`).join(" ")].filter(Boolean).join("\n\n");
  const [post] = await db
    .insert(t.posts)
    .values({ clientId: clip.project.clientId, mediaAssetId: clip.outputAssetId, title: clip.title.slice(0, 150), caption: caption.slice(0, 2200), createdBy: user.id })
    .returning({ id: t.posts.id });
  await registrar("cortes", clip.id, "publicado", { userId: user.id });
  redirect(`/painel/conteudo/${post.id}`);
}

export async function reanalyzeAction(form: FormData) {
  await requirePermission("clips:use");
  const id = String(form.get("id"));
  await db.update(t.clipProjects).set({ status: "ANALISANDO", stage: "Reavaliando", progress: 85, error: null }).where(eq(t.clipProjects.id, id));
  await enqueue("clip.analyze", { id }, { dedupeKey: `clip-analyze:${id}`, maxAttempts: 2 });
  revalidatePath(`/painel/cortes/${id}`);
}

export async function retryProjectAction(form: FormData) {
  await requirePermission("clips:use");
  const id = String(form.get("id"));
  const p = await db.query.clipProjects.findFirst({ where: eq(t.clipProjects.id, id), columns: { sourceAssetId: true, sourceUrl: true } });
  if (!p) return;
  await db.update(t.clipProjects).set({ status: "ENVIADO", stage: "Na fila", progress: 0, error: null }).where(eq(t.clipProjects.id, id));
  // Veio por link e o download não terminou: recomeça pelo download
  if (!p.sourceAssetId && p.sourceUrl) await enqueue("clip.download", { id }, { dedupeKey: `clip-download:${id}`, maxAttempts: 2 });
  else await enqueue("clip.transcribe", { id }, { dedupeKey: `clip-transcribe:${id}`, maxAttempts: 2 });
  revalidatePath(`/painel/cortes/${id}`);
}

// ─── Corte a partir de link do YouTube ───────────────────────────────────
const urlSchema = z.object({
  url: z
    .string()
    .trim()
    .refine((v) => youtubeId(v) !== null, "Cole um link do YouTube (youtube.com/watch, youtu.be, /shorts ou /live)"),
  clientId: z.uuid("Escolha o cliente"),
  title: z.string().trim().max(200).optional(),
  // Responsabilidade explícita: só vídeo do cliente ou com autorização
  authorized: z.literal("on", { error: "Confirme que o vídeo é do cliente ou que vocês têm autorização" }),
});

export async function startClipFromUrlAction(_: ActionState, form: FormData): Promise<ActionState & { projectId?: string }> {
  const user = await requirePermission("clips:use");
  if (!(await rateLimit(`yt:${user.id}`, 10, 3600))) return { ok: false, message: "Limite de 10 importações por hora atingido." };
  const p = urlSchema.safeParse(Object.fromEntries(form));
  if (!p.success) return zodErrors(p.error);
  const vid = youtubeId(p.data.url)!;
  const [proj] = await db
    .insert(t.clipProjects)
    .values({
      clientId: p.data.clientId,
      title: p.data.title || "Vídeo do YouTube",
      sourceUrl: `https://www.youtube.com/watch?v=${vid}`,
      createdBy: user.id,
      stage: "Na fila para baixar",
    })
    .returning({ id: t.clipProjects.id });
  await enqueue("clip.download", { id: proj.id }, { dedupeKey: `clip-download:${proj.id}`, maxAttempts: 2 });
  await audit(user, "clips.youtube_import", { entity: "clip_project", entityId: proj.id, meta: { url: `https://youtu.be/${vid}`, authorized: true } });
  redirect(`/painel/cortes/${proj.id}`);
}

export async function deleteClipProjectAction(form: FormData) {
  const user = await requirePermission("clips:use");
  const id = String(form.get("id"));
  const p = await db.query.clipProjects.findFirst({ where: eq(t.clipProjects.id, id), with: { source: true, clips: { with: { output: true } } } });
  if (!p) return;
  // Apaga vídeos renderizados que não viraram publicação, e o original
  for (const c of p.clips) {
    if (!c.output) continue;
    const used = await db.query.posts.findFirst({ where: eq(t.posts.mediaAssetId, c.output.id), columns: { id: true } });
    if (!used) {
      await deleteObject(c.output.storageKey).catch(() => {});
      await db.delete(t.mediaAssets).where(eq(t.mediaAssets.id, c.output.id));
    }
  }
  await db.delete(t.clipProjects).where(eq(t.clipProjects.id, id));
  if (p.source) {
    await deleteObject(p.source.storageKey).catch(() => {});
    await db.delete(t.mediaAssets).where(eq(t.mediaAssets.id, p.source.id));
  }
  await audit(user, "clips.project.delete", { entity: "clip_project", entityId: id, meta: { title: p.title } });
  revalidatePath("/painel/cortes");
  redirect("/painel/cortes");
}
