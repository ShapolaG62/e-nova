"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, t } from "@/db";
import { canAccessClient, requirePermission } from "@/lib/auth/session";
import { rateLimit } from "@/lib/cache";
import { AiError } from "@/lib/ai/client";
import { draftReviewReplies, emailInputSchema, scriptInputSchema, writeEmail, writeVideoScript, type EmailSchema, type VideoScriptSchema } from "@/lib/ai/tasks";
import { enqueue } from "@/lib/jobs";
import { publishGoogleReply } from "@/lib/social/google-reviews";
import { zodErrors, type ActionState } from "@/lib/validation";

const aiFail = (e: unknown): ActionState => ({ ok: false, message: e instanceof AiError ? e.userMessage : "Falha inesperada. Tente de novo." });

async function clientInfo(clientId: string | null) {
  if (!clientId) return null;
  return db.query.clients.findFirst({ where: eq(t.clients.id, clientId), columns: { tradeName: true, brandVoice: true, niche: true } });
}

// ─── Estúdio: roteiro ────────────────────────────────────────────────────
export type ScriptState = ActionState & { result?: z.infer<typeof VideoScriptSchema> };
export async function generateScriptAction(_: ScriptState, form: FormData): Promise<ScriptState> {
  const user = await requirePermission("ai:use");
  if (!(await rateLimit(`ai:${user.id}`, 20, 60))) return { ok: false, message: "Muitas gerações seguidas. Aguarde 1 minuto." };
  const parsed = scriptInputSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return zodErrors(parsed.error);
  const c = await clientInfo(parsed.data.clientId);
  try {
    const { data } = await writeVideoScript({ ...parsed.data, business: c?.tradeName, brandVoice: c?.brandVoice, userId: user.id });
    revalidatePath("/painel/ia");
    return { ok: true, result: data };
  } catch (e) {
    return aiFail(e);
  }
}

// ─── Estúdio: e-mail ─────────────────────────────────────────────────────
export type EmailState = ActionState & { result?: z.infer<typeof EmailSchema> };
export async function generateEmailAction(_: EmailState, form: FormData): Promise<EmailState> {
  const user = await requirePermission("ai:use");
  if (!(await rateLimit(`ai:${user.id}`, 20, 60))) return { ok: false, message: "Muitas gerações seguidas. Aguarde 1 minuto." };
  const parsed = emailInputSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return zodErrors(parsed.error);
  const c = await clientInfo(parsed.data.clientId);
  try {
    const { data } = await writeEmail({ ...parsed.data, business: c?.tradeName, userId: user.id });
    revalidatePath("/painel/ia");
    return { ok: true, result: data };
  } catch (e) {
    return aiFail(e);
  }
}

// ─── Avaliações ──────────────────────────────────────────────────────────
async function loadReview(reviewId: string) {
  const r = await db.query.reviews.findFirst({ where: eq(t.reviews.id, reviewId), with: { client: true } });
  if (!r) throw new Error("Avaliação não encontrada");
  return r;
}

export async function draftRepliesAction(reviewId: string): Promise<ActionState> {
  const user = await requirePermission("reviews:reply");
  if (!(await rateLimit(`ai:${user.id}`, 20, 60))) return { ok: false, message: "Muitas gerações seguidas. Aguarde 1 minuto." };
  const r = await loadReview(reviewId);
  try {
    const { data } = await draftReviewReplies({
      business: r.client.tradeName,
      niche: r.client.niche,
      brandVoice: r.client.brandVoice,
      authorName: r.authorName,
      rating: r.rating,
      text: r.text,
      clientId: r.clientId,
      userId: user.id,
    });
    await db
      .update(t.reviews)
      .set({ sentiment: data.sentiment, replyDrafts: data.replies.slice(0, 3), replyStatus: r.replyStatus === "PUBLISHED" ? "PUBLISHED" : "DRAFTED" })
      .where(eq(t.reviews.id, reviewId));
    revalidatePath("/painel/avaliacoes");
    return { ok: true, message: "3 sugestões prontas." };
  } catch (e) {
    return aiFail(e);
  }
}

const replySchema = z.object({ reply: z.string().trim().min(2, "Escreva a resposta").max(4000) });

export async function publishReplyAction(reviewId: string, _: ActionState, form: FormData): Promise<ActionState> {
  await requirePermission("reviews:reply");
  const parsed = replySchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return zodErrors(parsed.error);
  const r = await loadReview(reviewId);
  await db.update(t.reviews).set({ replyText: parsed.data.reply }).where(eq(t.reviews.id, reviewId));

  if (r.source === "GOOGLE") {
    try {
      await publishGoogleReply(reviewId); // aprovação com 1 clique → publicado no Google
    } catch (e) {
      await enqueue("review.reply.publish", { id: reviewId }, { dedupeKey: `reply:${reviewId}` }); // tenta de novo em background
      revalidatePath("/painel/avaliacoes");
      return { ok: false, message: `Não publicou agora (${e instanceof Error ? e.message.slice(0, 120) : "erro"}). Vamos tentar de novo automaticamente.` };
    }
  } else {
    await db.update(t.reviews).set({ replyStatus: "PUBLISHED", repliedAt: new Date() }).where(eq(t.reviews.id, reviewId));
  }
  revalidatePath("/painel/avaliacoes");
  return { ok: true, message: r.source === "GOOGLE" ? "Resposta publicada no Google." : "Marcada como respondida." };
}

export async function ignoreReviewAction(form: FormData) {
  await requirePermission("reviews:reply");
  await db.update(t.reviews).set({ replyStatus: "IGNORED" }).where(eq(t.reviews.id, String(form.get("id"))));
  revalidatePath("/painel/avaliacoes");
}

const manualReviewSchema = z.object({
  clientId: z.uuid("Escolha o cliente"),
  authorName: z.string().trim().max(200).optional(),
  rating: z.coerce.number().int().min(1).max(5),
  text: z.string().trim().max(4000).optional(),
});

export async function addManualReviewAction(_: ActionState, form: FormData): Promise<ActionState> {
  await requirePermission("reviews:reply");
  const parsed = manualReviewSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return zodErrors(parsed.error);
  await db.insert(t.reviews).values({ ...parsed.data, authorName: parsed.data.authorName || null, text: parsed.data.text || null, source: "MANUAL" });
  revalidatePath("/painel/avaliacoes");
  return { ok: true, message: "Avaliação adicionada." };
}

export async function syncReviewsAction(form: FormData) {
  const user = await requirePermission("reviews:reply");
  const clientId = String(form.get("clientId"));
  if (!canAccessClient(user, clientId)) return;
  await enqueue("reviews.sync", { id: clientId }, { dedupeKey: `reviews:${clientId}:manual`, maxAttempts: 2 });
  revalidatePath("/painel/avaliacoes");
}

// ─── Configuração do assistente/Google no cliente ────────────────────────
const assistantSchema = z.object({
  reviewAssistant: z.preprocess((v) => v === "on", z.boolean()),
  reviewTags: z.preprocess(
    (v) =>
      String(v ?? "")
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter(Boolean),
    z.array(z.string().max(40)).max(16, "No máximo 16 opções"),
  ),
  brandVoice: z.preprocess((v) => (String(v ?? "").trim() ? String(v).trim() : null), z.string().max(1000).nullable()),
  googleLocationName: z.preprocess(
    (v) => (String(v ?? "").trim() ? String(v).trim() : null),
    z.string().regex(/^accounts\/\d+\/locations\/\d+$/, "Formato: accounts/123/locations/456").nullable(),
  ),
});

export async function updateAssistantAction(clientId: string, _: ActionState, form: FormData): Promise<ActionState> {
  await requirePermission("clients:write");
  const parsed = assistantSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return zodErrors(parsed.error);
  await db.update(t.clients).set(parsed.data).where(eq(t.clients.id, clientId));
  const { invalidateClient } = await import("@/lib/nfc/resolve");
  await invalidateClient(clientId); // liga/desliga o assistente nas plaquinhas na hora
  revalidatePath(`/painel/clientes/${clientId}`);
  return { ok: true, message: "Configurações salvas." };
}

export async function disconnectIntegrationAction(form: FormData) {
  const me = await requirePermission("integrations:manage");
  const clientId = String(form.get("clientId"));
  const provider = String(form.get("provider")) as "META";
  await db.delete(t.integrations).where(and(eq(t.integrations.clientId, clientId), eq(t.integrations.provider, provider)));
  const { audit } = await import("@/lib/audit");
  await audit(me, "integration.disconnect", { entity: "client", entityId: clientId, meta: { provider } });
  revalidatePath(`/painel/clientes/${clientId}`);
}
