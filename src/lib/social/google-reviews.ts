import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db, t } from "@/db";
import { getAccessToken } from "./oauth";

/**
 * Google Business Profile API (oficial). Lê avaliações da localização do cliente
 * e publica respostas. Requer o app aprovado para a Business Profile API.
 */
const API = "https://mybusiness.googleapis.com/v4";
const STARS: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };

type GReview = {
  name: string; // accounts/x/locations/y/reviews/z
  reviewer?: { displayName?: string };
  starRating?: string;
  comment?: string;
  createTime: string;
  reviewReply?: { comment: string; updateTime: string };
};

export async function syncGoogleReviews(clientId: string) {
  const client = await db.query.clients.findFirst({ where: eq(t.clients.id, clientId) });
  if (!client?.googleLocationName) throw new Error("Cliente sem localização do Google configurada.");
  const { token } = await getAccessToken(clientId, "GOOGLE_BUSINESS");

  let pageToken: string | undefined;
  let imported = 0;
  for (let page = 0; page < 10; page++) {
    const u = new URL(`${API}/${client.googleLocationName}/reviews`);
    u.searchParams.set("pageSize", "50");
    u.searchParams.set("orderBy", "updateTime desc");
    if (pageToken) u.searchParams.set("pageToken", pageToken);
    const res = await fetch(u, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error(`Google reviews HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const body = (await res.json()) as { reviews?: GReview[]; nextPageToken?: string };

    for (const r of body.reviews ?? []) {
      const replied = !!r.reviewReply;
      await db
        .insert(t.reviews)
        .values({
          clientId,
          source: "GOOGLE",
          externalId: r.name,
          authorName: r.reviewer?.displayName?.slice(0, 200) ?? null,
          rating: STARS[r.starRating ?? ""] ?? 0,
          text: r.comment ?? null,
          reviewedAt: new Date(r.createTime),
          replyStatus: replied ? "PUBLISHED" : "PENDING",
          replyText: r.reviewReply?.comment ?? null,
          repliedAt: r.reviewReply ? new Date(r.reviewReply.updateTime) : null,
        })
        .onConflictDoUpdate({
          target: [t.reviews.clientId, t.reviews.externalId],
          set: {
            rating: sql`excluded.rating`,
            text: sql`excluded.text`,
            // Se alguém respondeu direto no Google, refletimos aqui
            ...(replied ? { replyStatus: sql`'PUBLISHED'`, replyText: sql`excluded.reply_text`, repliedAt: sql`excluded.replied_at` } : {}),
          },
        });
      imported++;
    }
    pageToken = body.nextPageToken;
    if (!pageToken) break;
  }
  return imported;
}

export async function publishGoogleReply(reviewId: string) {
  const review = await db.query.reviews.findFirst({ where: and(eq(t.reviews.id, reviewId), eq(t.reviews.source, "GOOGLE")) });
  if (!review?.externalId || !review.replyText) throw new Error("Avaliação sem resposta para publicar.");
  const { token } = await getAccessToken(review.clientId, "GOOGLE_BUSINESS");
  const res = await fetch(`${API}/${review.externalId}/reply`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ comment: review.replyText }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Google reply HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  await db.update(t.reviews).set({ replyStatus: "PUBLISHED", repliedAt: new Date() }).where(eq(t.reviews.id, reviewId));
}
