import "server-only";
import { eq, inArray } from "drizzle-orm";
import { db, t } from "@/db";
import { kv } from "@/lib/cache";
import { env } from "@/lib/env";
import type { ClientStatus } from "@/db/schema";

/** O que fica no cache para cada slug: o mínimo para decidir o redirect. */
export type PlateRoute = {
  plateId: string;
  clientId: string;
  status: ClientStatus;
  trialEndsAt: string | null;
  target: string | null; // URL final quando o cliente está liberado
  assistant?: boolean; // passa pela página de sugestão com IA antes do Google
};

const NOT_FOUND = "__none__" as const;
const key = (slug: string) => `plate:${slug}`;

export const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/;

export function googleReviewUrl(placeId: string) {
  return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId)}`;
}

async function loadFromDb(slug: string): Promise<PlateRoute | null> {
  const [row] = await db
    .select({
      plateId: t.plates.id,
      clientId: t.plates.clientId,
      active: t.plates.active,
      override: t.plates.destinationOverride,
      status: t.clients.status,
      trialEndsAt: t.clients.trialEndsAt,
      placeId: t.clients.googlePlaceId,
      assistant: t.clients.reviewAssistant,
    })
    .from(t.plates)
    .innerJoin(t.clients, eq(t.clients.id, t.plates.clientId))
    .where(eq(t.plates.slug, slug))
    .limit(1);

  if (!row || !row.active) return null;
  return {
    plateId: row.plateId,
    clientId: row.clientId,
    status: row.status,
    trialEndsAt: row.trialEndsAt?.toISOString() ?? null,
    target: row.override || (row.placeId ? googleReviewUrl(row.placeId) : null),
    // Destino alternativo (campanha) ignora o assistente
    assistant: row.assistant && !row.override && !!row.placeId,
  };
}

/** Cache-aside: Redis/memória primeiro, banco só no miss. Cacheia também o "não existe". */
export async function getPlateRoute(slug: string): Promise<PlateRoute | null> {
  try {
    const hit = await kv.get<PlateRoute | typeof NOT_FOUND>(key(slug));
    if (hit) return hit === NOT_FOUND ? null : hit;
  } catch {
    // cache fora do ar → segue para o banco
  }
  const route = await loadFromDb(slug);
  kv.set(key(slug), route ?? NOT_FOUND, route ? env.REDIRECT_CACHE_TTL_SECONDS : 60).catch(() => {});
  return route;
}

export type Decision =
  | { kind: "redirect"; url: string; outcome: "REDIRECT_REVIEW" }
  | { kind: "blocked"; outcome: "SUSPENDED" | "TRIAL_EXPIRED" | "NO_DESTINATION" };

export function decide(route: PlateRoute, now = new Date(), slug?: string): Decision {
  if (route.status === "SUSPENDED_PAYMENT") return { kind: "blocked", outcome: "SUSPENDED" };
  if (route.status === "TRIAL" && route.trialEndsAt && new Date(route.trialEndsAt) < now)
    return { kind: "blocked", outcome: "TRIAL_EXPIRED" };
  if (!route.target) return { kind: "blocked", outcome: "NO_DESTINATION" };
  if (route.assistant && slug) return { kind: "redirect", url: `/avaliar/${slug}`, outcome: "REDIRECT_REVIEW" };
  return { kind: "redirect", url: route.target, outcome: "REDIRECT_REVIEW" };
}

// ─── Invalidação: chamar sempre que plaquinha ou cliente mudar ───────────
export async function invalidateSlugs(...slugs: string[]) {
  await kv.del(...slugs.map(key)).catch(() => {});
}

export async function invalidateClient(clientId: string) {
  const rows = await db.select({ slug: t.plates.slug }).from(t.plates).where(eq(t.plates.clientId, clientId));
  await invalidateSlugs(...rows.map((r) => r.slug));
}

export async function invalidateClients(clientIds: string[]) {
  if (!clientIds.length) return;
  const rows = await db
    .select({ slug: t.plates.slug })
    .from(t.plates)
    .where(inArray(t.plates.clientId, clientIds));
  await invalidateSlugs(...rows.map((r) => r.slug));
}
