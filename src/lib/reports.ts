import "server-only";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import { db, t } from "@/db";

/** "2026-10" → limites do mês no horário de São Paulo (UTC-3, sem horário de verão). */
export function monthRange(month: string) {
  const [y, m] = month.split("-").map(Number);
  const start = new Date(`${month}-01T00:00:00-03:00`);
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  const end = new Date(`${next}-01T00:00:00-03:00`);
  const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
  return { start, end, prev };
}

export const currentMonth = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit" }).format(new Date());

export function monthLabel(month: string) {
  const s = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-15T12:00:00Z`));
  return s.charAt(0).toUpperCase() + s.slice(1); // "Outubro de 2026"
}

export function nextMonth(month: string) {
  const [y, m] = month.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

/** Último mês fechado — padrão dos relatórios (comparar mês parcial com mês cheio engana). */
export const lastClosedMonth = () => monthRange(currentMonth()).prev;

async function periodMetrics(clientId: string, start: Date, end: Date) {
  const [taps] = await db
    .select({
      total: sql<number>`count(*)::int`,
      google: sql<number>`count(*) filter (where ${t.plateTaps.outcome} = 'REDIRECT_REVIEW')::int`,
      ios: sql<number>`count(*) filter (where ${t.plateTaps.device} = 'IOS')::int`,
      android: sql<number>`count(*) filter (where ${t.plateTaps.device} = 'ANDROID')::int`,
    })
    .from(t.plateTaps)
    .where(and(eq(t.plateTaps.clientId, clientId), gte(t.plateTaps.occurredAt, start), lt(t.plateTaps.occurredAt, end)));

  const [reviews] = await db
    .select({
      total: sql<number>`count(*)::int`,
      avg: sql<number | null>`round(avg(${t.reviews.rating})::numeric, 2)::float`,
      replied: sql<number>`count(*) filter (where ${t.reviews.replyStatus} = 'PUBLISHED')::int`,
      negative: sql<number>`count(*) filter (where ${t.reviews.rating} <= 2)::int`,
    })
    .from(t.reviews)
    .where(and(eq(t.reviews.clientId, clientId), gte(t.reviews.reviewedAt, start), lt(t.reviews.reviewedAt, end)));

  const posts = await db
    .select({ channel: t.postTargets.channel, total: sql<number>`count(*)::int` })
    .from(t.postTargets)
    .innerJoin(t.posts, eq(t.posts.id, t.postTargets.postId))
    .where(and(eq(t.posts.clientId, clientId), eq(t.postTargets.status, "PUBLISHED"), gte(t.postTargets.publishedAt, start), lt(t.postTargets.publishedAt, end)))
    .groupBy(t.postTargets.channel);

  const sites = await db.execute<{ name: string; uptime: number | null; checks: number; incidents: number }>(sql`
    select m.name,
      (count(c.*) filter (where c.ok))::float * 100 / nullif(count(c.*), 0) as uptime,
      count(c.*)::int as checks,
      (select count(*)::int from alert_events e where e.monitor_id = m.id and e.kind = 'DOWN' and e.created_at >= ${start} and e.created_at < ${end}) as incidents
    from monitors m
    left join monitor_checks c on c.monitor_id = m.id and c.checked_at >= ${start} and c.checked_at < ${end}
    where m.client_id = ${clientId}
    group by m.id, m.name order by m.name`);

  return {
    taps: { total: taps.total, toGoogle: taps.google, iphone: taps.ios, android: taps.android },
    reviews: { received: reviews.total, avgRating: reviews.avg, replied: reviews.replied, negative: reviews.negative },
    posts: { published: posts.reduce((s, p) => s + p.total, 0), byChannel: Object.fromEntries(posts.map((p) => [p.channel, p.total])) as Record<string, number> },
    sites: sites.rows.map((s) => ({ name: s.name, uptime: s.uptime === null ? null : Math.round(Number(s.uptime) * 100) / 100, incidents: s.incidents })),
  };
}

export type ReportMetrics = Awaited<ReturnType<typeof periodMetrics>>;

export async function monthlyReport(clientId: string, month: string) {
  const { start, end, prev } = monthRange(month);
  const p = monthRange(prev);
  const [current, previous] = await Promise.all([periodMetrics(clientId, start, end), periodMetrics(clientId, p.start, p.end)]);
  return { month, prev, current, previous };
}

/** Variação % entre dois números (null quando não dá para comparar). */
export function delta(cur: number, prev: number) {
  if (!prev) return null;
  return Math.round(((cur - prev) / prev) * 100);
}
