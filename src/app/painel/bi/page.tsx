import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { requirePermission } from "@/lib/auth/session";
import { Kpi, Panel } from "@/components/charts";
import { PageHeader, PageSkeleton } from "@/components/page";
import { brl } from "@/lib/validation";
import { pct } from "@/components/monitor-ui";
import { Term } from "@/components/term";


export const metadata: Metadata = { title: "BI" };
const monthShort = new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "UTC" });

export default function Page() {
  return (
    <div className="grid grid-cols-1 gap-5">
      <PageHeader title="BI da agência" subtitle="Receita recorrente, carteira e desempenho consolidado dos clientes." />
      <Suspense fallback={<PageSkeleton />}>
        <Bi />
      </Suspense>
    </div>
  );
}

/** Barras verticais simples com rótulo por mês. */
function MonthBars({ data, format }: { data: { month: string; value: number }[]; format: (n: number) => string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div>
      <div className="flex h-40 items-end gap-1.5">
        {data.map((d) => (
          <div key={d.month} className="group relative flex h-full flex-1 items-end">
            <div className="w-full rounded-t-sm bg-primary/80 group-hover:bg-primary" style={{ height: `${Math.max(d.value ? 3 : 1, (d.value / max) * 100)}%` }} />
            <span className="pointer-events-none absolute -top-7 left-1/2 z-10 hidden -translate-x-1/2 rounded bg-foreground px-1.5 py-0.5 text-[11px] whitespace-nowrap text-background group-hover:block">
              {format(d.value)}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-1.5 text-[10px] text-muted-foreground">
        {data.map((d) => (
          <span key={d.month} className="flex-1 text-center capitalize">
            {monthShort.format(new Date(`${d.month}-15T12:00:00Z`)).replace(".", "")}
          </span>
        ))}
      </div>
    </div>
  );
}

async function Bi() {
  await requirePermission("bi:view");

  const [mrrHistory, oneOff, portfolio, ranking, ops] = await Promise.all([
    // MRR de cada um dos últimos 12 meses: contratos recorrentes vigentes no fim do mês
    db.execute<{ month: string; mrr: number }>(sql`
      with months as (
        select generate_series(date_trunc('month', now() at time zone 'America/Sao_Paulo') - interval '11 months',
                               date_trunc('month', now() at time zone 'America/Sao_Paulo'), interval '1 month') as m
      )
      select to_char(m, 'YYYY-MM') as month,
        coalesce((select sum(c.amount_cents) from contracts c
          where c.type = 'RECURRING' and c.status <> 'PAUSED'
            and c.starts_at < ((m + interval '1 month') at time zone 'America/Sao_Paulo')
            and (c.ended_at is null or c.ended_at >= ((m + interval '1 month') at time zone 'America/Sao_Paulo'))), 0)::int as mrr
      from months order by m`),
    db.execute<{ month: string; total: number }>(sql`
      with months as (
        select generate_series(date_trunc('month', now() at time zone 'America/Sao_Paulo') - interval '11 months',
                               date_trunc('month', now() at time zone 'America/Sao_Paulo'), interval '1 month') as m
      )
      select to_char(m, 'YYYY-MM') as month,
        coalesce((select sum(c.amount_cents) from contracts c where c.type = 'ONE_OFF' and c.status <> 'CANCELED'
          and date_trunc('month', c.starts_at at time zone 'America/Sao_Paulo') = m), 0)::int as total
      from months order by m`),
    db.execute<{ active: number; trial: number; suspended: number; new30: number; canceled30: number; arpa: number | null }>(sql`
      select
        count(*) filter (where status = 'ACTIVE')::int as active,
        count(*) filter (where status = 'TRIAL')::int as trial,
        count(*) filter (where status = 'SUSPENDED_PAYMENT')::int as suspended,
        count(*) filter (where created_at > now() - interval '30 days')::int as new30,
        (select count(distinct client_id) from contracts where status = 'CANCELED' and ended_at > now() - interval '30 days')::int as canceled30,
        (select sum(amount_cents)::float / nullif(count(distinct client_id), 0) from contracts where type = 'RECURRING' and status = 'ACTIVE') as arpa
      from clients`),
    // Desempenho por cliente nos últimos 30 dias
    db.execute<{ id: string; name: string; status: string; mrr: number; taps: number; reviews: number; rating: number | null; posts: number; uptime: number | null }>(sql`
      select c.id, c.trade_name as name, c.status,
        coalesce((select sum(amount_cents) from contracts k where k.client_id = c.id and k.type = 'RECURRING' and k.status = 'ACTIVE'), 0)::int as mrr,
        (select count(*) from plate_taps p where p.client_id = c.id and p.occurred_at > now() - interval '30 days')::int as taps,
        (select count(*) from reviews r where r.client_id = c.id and r.reviewed_at > now() - interval '30 days')::int as reviews,
        (select avg(rating)::float from reviews r where r.client_id = c.id) as rating,
        (select count(*) from post_targets pt join posts po on po.id = pt.post_id
          where po.client_id = c.id and pt.status = 'PUBLISHED' and pt.published_at > now() - interval '30 days')::int as posts,
        (select (count(*) filter (where mc.ok))::float * 100 / nullif(count(*), 0) from monitor_checks mc join monitors m on m.id = mc.monitor_id
          where m.client_id = c.id and mc.checked_at > now() - interval '30 days') as uptime
      from clients c order by mrr desc, taps desc limit 50`),
    db.execute<{ pending_reviews: number; awaiting_approval: number; down: number; ai_usd: number }>(sql`
      select
        (select count(*) from reviews where reply_status in ('PENDING','DRAFTED'))::int as pending_reviews,
        (select count(*) from posts where status = 'AGUARDANDO_APROVACAO')::int as awaiting_approval,
        (select count(*) from monitors where active and state = 'DOWN')::int as down,
        (select coalesce(sum(input_tokens),0) * 4.0 / 1e6 + coalesce(sum(output_tokens),0) * 20.0 / 1e6 from ai_generations where created_at > now() - interval '30 days' and model like 'anthropic:%')::float as ai_usd`),
  ]);

  const mrrNow = mrrHistory.rows.at(-1)?.mrr ?? 0;
  const mrrPrev = mrrHistory.rows.at(-2)?.mrr ?? 0;
  const growth = mrrPrev ? Math.round(((mrrNow - mrrPrev) / mrrPrev) * 100) : null;
  const pf = portfolio.rows[0];
  const o = ops.rows[0];

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi featured label={<Term k="MRR">MRR · receita recorrente do mês</Term>} value={brl(mrrNow)} hint={growth === null ? "sem mês anterior" : `${growth >= 0 ? "+" : ""}${growth}% vs mês anterior`} />
        <Kpi label={<Term k="ARR" />} value={brl(mrrNow * 12)} />
        <Kpi label={<Term k="ARPA">Ticket médio (ARPA)</Term>} value={pf.arpa ? brl(Math.round(Number(pf.arpa))) : "—"} hint="por cliente com recorrência" />
        <Kpi label="Clientes" value={pf.active} hint={`${pf.trial} trial · ${pf.suspended} suspensos · +${pf.new30} em 30d · ${pf.canceled30} cancelaram`} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Panel title={<><Term k="MRR" /> nos últimos 12 meses</>}>
          <MonthBars data={mrrHistory.rows.map((r) => ({ month: r.month, value: r.mrr }))} format={brl} />
        </Panel>
        <Panel title="Serviços avulsos — faturado por mês">
          <MonthBars data={oneOff.rows.map((r) => ({ month: r.month, value: r.total }))} format={brl} />
        </Panel>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Avaliações sem resposta" value={o.pending_reviews} />
        <Kpi label="Posts aguardando cliente" value={o.awaiting_approval} />
        <Kpi label="Sites fora do ar" value={<span className={o.down ? "text-red-600" : ""}>{o.down}</span>} />
        <Kpi label="Custo de IA (30d)" value={`US$ ${Number(o.ai_usd).toFixed(2)}`} hint="IA local = R$ 0; só a Claude API custa" />
      </div>

      <Panel title="Clientes — últimos 30 dias">
        <div className="-mx-4 overflow-x-auto sm:-mx-5">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr className="border-b">
                <th className="px-4 py-2 font-medium sm:px-5">Cliente</th>
                <th className="px-2 py-2 text-right font-medium">MRR</th>
                <th className="px-2 py-2 text-right font-medium">Toques</th>
                <th className="px-2 py-2 text-right font-medium">Avaliações</th>
                <th className="px-2 py-2 text-right font-medium">Nota</th>
                <th className="px-2 py-2 text-right font-medium">Posts</th>
                <th className="px-4 py-2 text-right font-medium sm:px-5"><Term k="Uptime" /></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {ranking.rows.map((r) => (
                <tr key={r.id} className="hover:bg-muted/40">
                  <td className="px-4 py-2 sm:px-5">
                    <Link href={`/painel/clientes/${r.id}`} className="font-medium hover:underline">
                      {r.name}
                    </Link>
                    {r.status !== "ACTIVE" && <span className="ml-1.5 text-[11px] text-muted-foreground">({r.status === "TRIAL" ? "trial" : "suspenso"})</span>}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">{r.mrr ? brl(r.mrr) : "—"}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{r.taps}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{r.reviews}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{r.rating ? Number(r.rating).toFixed(1).replace(".", ",") : "—"}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{r.posts}</td>
                  <td className="px-4 py-2 text-right tabular-nums sm:px-5">{pct(r.uptime === null ? null : Number(r.uptime))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
