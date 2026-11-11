import "server-only";
import { createHash } from "node:crypto";
import { and, eq, gte, sql } from "drizzle-orm";
import { db, t } from "@/db";
import { env } from "@/lib/env";
import { classifyDevice, tapContextFromHeaders } from "@/lib/nfc/telemetry";
import { windowStart } from "@/lib/nfc/stats";

/**
 * Visitas sem cookie e sem guardar IP: o visitante vira um hash diário
 * (sal + IP + navegador + data). Dá para contar visitantes únicos do dia,
 * mas não dá para seguir a pessoa entre dias nem descobrir quem é (LGPD).
 */
const BOTS = /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|preview|monitor|curl|wget|headless/i;

export async function recordPageEvent(pageId: string, headers: Headers, kind: "view" | "click", opts: { blockId?: string; utm?: string | null } = {}) {
  const ua = headers.get("user-agent") ?? "";
  if (BOTS.test(ua)) return; // robôs e prévias de link não contam
  const ctx = tapContextFromHeaders(headers);
  const day = new Date().toISOString().slice(0, 10);
  const visitorHash = ctx.ip ? createHash("sha256").update(`${env.IP_HASH_SALT}:${ctx.ip}:${ua}:${day}`).digest("hex") : null;
  let referrerHost: string | null = null;
  try {
    referrerHost = ctx.referer ? new URL(ctx.referer).hostname.slice(0, 120) : null;
  } catch {
    /* referer inválido */
  }
  await db.insert(t.pageViews).values({
    pageId,
    kind,
    blockId: opts.blockId?.slice(0, 40) ?? null,
    visitorHash,
    referrerHost,
    utmSource: opts.utm?.slice(0, 80) ?? null,
    device: classifyDevice(ua).device,
    country: ctx.country,
  });
}

export async function pageStats(pageId: string, days = 30) {
  const since = windowStart(days);
  const where = and(eq(t.pageViews.pageId, pageId), gte(t.pageViews.occurredAt, since));
  const day = sql<string>`to_char((${t.pageViews.occurredAt} at time zone 'America/Sao_Paulo')::date, 'YYYY-MM-DD')`;

  const [totals, perDay, clickList, sources, devices] = await Promise.all([
    db
      .select({
        views: sql<number>`count(*) filter (where ${t.pageViews.kind} = 'view')::int`,
        visitors: sql<number>`count(distinct ${t.pageViews.visitorHash}) filter (where ${t.pageViews.kind} = 'view')::int`,
        clicks: sql<number>`count(*) filter (where ${t.pageViews.kind} = 'click')::int`,
      })
      .from(t.pageViews)
      .where(where),
    db
      .select({ day, total: sql<number>`count(*)::int` })
      .from(t.pageViews)
      .where(and(where, eq(t.pageViews.kind, "view")))
      .groupBy(day),
    db
      .select({ blockId: t.pageViews.blockId, total: sql<number>`count(*)::int` })
      .from(t.pageViews)
      .where(and(where, eq(t.pageViews.kind, "click")))
      .groupBy(t.pageViews.blockId),
    db
      .select({ source: sql<string>`coalesce(${t.pageViews.utmSource}, ${t.pageViews.referrerHost}, 'direto')`, total: sql<number>`count(*)::int` })
      .from(t.pageViews)
      .where(and(where, eq(t.pageViews.kind, "view")))
      .groupBy(sql`1`)
      .orderBy(sql`2 desc`)
      .limit(8),
    db
      .select({ device: t.pageViews.device, total: sql<number>`count(*)::int` })
      .from(t.pageViews)
      .where(and(where, eq(t.pageViews.kind, "view")))
      .groupBy(t.pageViews.device),
  ]);

  const map = new Map(perDay.map((r) => [r.day, r.total]));
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" });
  const series = Array.from({ length: days }, (_, i) => {
    const key = fmt.format(new Date(Date.now() - (days - 1 - i) * 86_400_000));
    return { day: key, total: map.get(key) ?? 0 };
  });
  return { ...totals[0], series, clickList, sources, devices };
}
