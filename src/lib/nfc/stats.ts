import "server-only";
import { and, count, desc, eq, gte, sql, type SQL } from "drizzle-orm";
import { db, t } from "@/db";

const TZ = "America/Sao_Paulo";

type Scope = { clientId?: string; plateId?: string };

function scopeWhere(scope: Scope, since: Date): SQL {
  const conds = [gte(t.plateTaps.occurredAt, since)];
  if (scope.clientId) conds.push(eq(t.plateTaps.clientId, scope.clientId));
  if (scope.plateId) conds.push(eq(t.plateTaps.plateId, scope.plateId));
  return and(...conds)!;
}

export function daysAgo(days: number) {
  return new Date(Date.now() - days * 86_400_000);
}

const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });

/**
 * Início da janela de N dias: meia-noite (horário de SP) de N-1 dias atrás.
 * Todas as métricas usam esta mesma janela, então gráfico e totais batem.
 * (Brasil sem horário de verão desde 2019 → offset fixo -03:00.)
 */
export function windowStart(days: number) {
  return new Date(`${ymd.format(daysAgo(days - 1))}T00:00:00-03:00`);
}

/** Série diária completa (dias sem toque aparecem com 0) no fuso de SP. */
export async function tapsPerDay(scope: Scope, days = 30) {
  // TZ é constante do código (não vem do usuário): embutido literal para o
  // GROUP BY casar com o SELECT (parâmetros $n distintos quebram o agrupamento).
  const day = sql<string>`to_char((${t.plateTaps.occurredAt} at time zone ${sql.raw(`'${TZ}'`)})::date, 'YYYY-MM-DD')`;
  const rows = await db
    .select({ day, total: count() })
    .from(t.plateTaps)
    .where(scopeWhere(scope, windowStart(days)))
    .groupBy(day);
  const map = new Map(rows.map((r) => [r.day, Number(r.total)]));

  return Array.from({ length: days }, (_, i) => {
    const key = ymd.format(daysAgo(days - 1 - i));
    return { day: key, total: map.get(key) ?? 0 };
  });
}

export async function tapsByDevice(scope: Scope, days = 30) {
  const rows = await db
    .select({ device: t.plateTaps.device, total: count() })
    .from(t.plateTaps)
    .where(scopeWhere(scope, windowStart(days)))
    .groupBy(t.plateTaps.device);
  return rows.map((r) => ({ device: r.device, total: Number(r.total) })).sort((a, b) => b.total - a.total);
}

export async function tapsByOutcome(scope: Scope, days = 30) {
  const rows = await db
    .select({ outcome: t.plateTaps.outcome, total: count() })
    .from(t.plateTaps)
    .where(scopeWhere(scope, windowStart(days)))
    .groupBy(t.plateTaps.outcome);
  return Object.fromEntries(rows.map((r) => [r.outcome, Number(r.total)])) as Partial<Record<string, number>>;
}

export async function recentTaps(scope: Scope, limit = 15) {
  return db
    .select({
      id: t.plateTaps.id,
      occurredAt: t.plateTaps.occurredAt,
      device: t.plateTaps.device,
      os: t.plateTaps.os,
      browser: t.plateTaps.browser,
      city: t.plateTaps.city,
      region: t.plateTaps.region,
      country: t.plateTaps.country,
      outcome: t.plateTaps.outcome,
      plateLabel: t.plates.label,
    })
    .from(t.plateTaps)
    .innerJoin(t.plates, eq(t.plates.id, t.plateTaps.plateId))
    .where(scopeWhere(scope, daysAgo(90)))
    .orderBy(desc(t.plateTaps.occurredAt))
    .limit(limit);
}

export async function topPlates(days = 30, limit = 5, clientId?: string) {
  const conds = [gte(t.plateTaps.occurredAt, windowStart(days))];
  if (clientId) conds.push(eq(t.plateTaps.clientId, clientId));
  return db
    .select({
      plateId: t.plates.id,
      label: t.plates.label,
      client: t.clients.tradeName,
      total: count(t.plateTaps.id),
    })
    .from(t.plateTaps)
    .innerJoin(t.plates, eq(t.plates.id, t.plateTaps.plateId))
    .innerJoin(t.clients, eq(t.clients.id, t.plates.clientId))
    .where(and(...conds))
    .groupBy(t.plates.id, t.plates.label, t.clients.tradeName)
    .orderBy(desc(count(t.plateTaps.id)))
    .limit(limit);
}

/** Indicadores do topo do painel da agência. */
export async function agencyKpis() {
  const [byStatus, [mrr], [plateCount], [taps30]] = await Promise.all([
    db.select({ status: t.clients.status, total: count() }).from(t.clients).groupBy(t.clients.status),
    db
      .select({ cents: sql<number>`coalesce(sum(${t.contracts.amountCents}), 0)::int` })
      .from(t.contracts)
      .where(and(eq(t.contracts.type, "RECURRING"), eq(t.contracts.status, "ACTIVE"))),
    db.select({ total: count() }).from(t.plates).where(eq(t.plates.active, true)),
    db.select({ total: count() }).from(t.plateTaps).where(gte(t.plateTaps.occurredAt, windowStart(30))),
  ]);
  const status = Object.fromEntries(byStatus.map((r) => [r.status, Number(r.total)]));
  return {
    clientsActive: status.ACTIVE ?? 0,
    clientsTrial: status.TRIAL ?? 0,
    clientsSuspended: status.SUSPENDED_PAYMENT ?? 0,
    mrrCents: Number(mrr?.cents ?? 0),
    activePlates: Number(plateCount?.total ?? 0),
    taps30: Number(taps30?.total ?? 0),
  };
}
