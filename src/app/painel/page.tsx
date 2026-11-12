import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { requireUser, type SessionUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { agencyKpis, recentTaps, tapsByDevice, tapsPerDay, topPlates } from "@/lib/nfc/stats";
import { DailyBars, DeviceSplit, Kpi, Panel } from "@/components/charts";
import { RecentTapsList } from "@/components/recent-taps";
import { PageHeader, PageSkeleton } from "@/components/page";
import { brl } from "@/lib/validation";
import { Term } from "@/components/term";

import { sql } from "drizzle-orm";
import { db } from "@/db";

export const metadata: Metadata = { title: "Visão geral" };

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Overview />
    </Suspense>
  );
}

async function Overview() {
  const user = await requireUser();
  return can(user.role, "dashboard:global") ? <AgencyOverview user={user} /> : <ClientOverview user={user} />;
}

/** O que precisa de atenção agora (avaliações, aprovações, sites). */
async function Pendencias({ clientId }: { clientId?: string }) {
  const scope = clientId ? sql`and client_id = ${clientId}` : sql``;
  const res = await db.execute<{ reviews: number; approvals: number; down: number }>(sql`
    select
      (select count(*) from reviews where reply_status in ('PENDING','DRAFTED') ${scope})::int as reviews,
      (select count(*) from posts where status = 'AGUARDANDO_APROVACAO' ${scope})::int as approvals,
      (select count(*) from monitors where active and state = 'DOWN' ${scope})::int as down`);
  const p = res.rows[0];
  const items = [
    // cada aviso usa a cor de quem cuida dele: erro (vermelho), Conteúdo (magenta), Operação (azul)
    { n: p.down, label: p.down === 1 ? "site fora do ar" : "sites fora do ar", href: "/painel/monitoramento", cor: "var(--destructive)" },
    {
      n: p.approvals,
      label: clientId ? (p.approvals === 1 ? "vídeo para você aprovar" : "vídeos para você aprovar") : (p.approvals === 1 ? "post aguardando o cliente" : "posts aguardando o cliente"),
      href: "/painel/conteudo?status=AGUARDANDO_APROVACAO", cor: "var(--area-conteudo)",
    },
    { n: p.reviews, label: p.reviews === 1 ? "avaliação sem resposta" : "avaliações sem resposta", href: "/painel/avaliacoes?status=PENDING", cor: "var(--area-operacao)" },
  ].filter((i) => i.n > 0);
  if (!items.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          style={{ "--aviso": i.cor } as React.CSSProperties}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[color-mix(in_oklab,var(--aviso)_40%,transparent)] bg-[color-mix(in_oklab,var(--aviso)_12%,transparent)] px-3 py-2 text-sm text-foreground transition-colors hover:bg-[color-mix(in_oklab,var(--aviso)_20%,transparent)]"
        >
          <span className="size-2 rounded-full bg-[var(--aviso)]" aria-hidden />
          <strong className="num text-base">{i.n}</strong> {i.label}
        </Link>
      ))}
    </div>
  );
}

/** Resumo do funil de vendas (prospecção → site → contato → cliente). */
async function ResumoVendas() {
  const res = await db.execute<{ novos: number; contatados: number; negociando: number; fechados: number; sites: number; publicados: number; contatos_hoje: number; visitas_7d: number }>(sql`
    select
      (select count(*) from prospects where stage = 'NOVO')::int as novos,
      (select count(*) from prospects where stage = 'CONTATADO')::int as contatados,
      (select count(*) from prospects where stage = 'NEGOCIANDO')::int as negociando,
      (select count(*) from prospects where stage = 'FECHADO' and updated_at > now() - interval '30 days')::int as fechados,
      (select count(*) from generated_sites)::int as sites,
      (select count(*) from generated_sites where published)::int as publicados,
      (select count(*) from sales_events where kind = 'contato' and created_at >= date_trunc('day', now()))::int as contatos_hoje,
      (select count(*) from sales_events where kind = 'visita' and created_at > now() - interval '7 days')::int as visitas_7d`);
  const v = res.rows[0];
  const etapas = [
    { label: "Novos", n: v.novos },
    { label: "Contatados", n: v.contatados },
    { label: "Negociando", n: v.negociando },
    { label: "Fechados (30 dias)", n: v.fechados },
  ];
  const max = Math.max(1, ...etapas.map((e) => e.n));
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <Panel
        title="Funil de vendas"
        className="lg:col-span-2"
        action={<Link href="/painel/funil" className="text-sm font-medium text-primary hover:underline">Abrir funil</Link>}
      >
        <div className="grid gap-2.5">
          {etapas.map((e) => (
            <div key={e.label} className="grid grid-cols-[130px_1fr_40px] items-center gap-3 text-sm">
              <span className="text-muted-foreground">{e.label}</span>
              <span className="h-2.5 overflow-hidden rounded-full bg-muted">
                <span className="block h-full rounded-full bg-primary" style={{ width: `${(e.n / max) * 100}%` }} />
              </span>
              <strong className="text-right tabular-nums">{e.n}</strong>
            </div>
          ))}
        </div>
      </Panel>
      <div className="grid grid-cols-2 gap-3">
        <Kpi label="Contatos hoje" value={v.contatos_hoje} hint="mensagens enviadas" />
        <Kpi label="Sites gerados" value={v.sites} hint={`${v.publicados} no ar`} />
        <Kpi label="Visitas (7 dias)" value={v.visitas_7d} hint="donos que abriram o site" className="col-span-2" />
      </div>
    </div>
  );
}

async function AgencyOverview({ user }: { user: SessionUser }) {
  const [kpi, daily, devices, top, recent] = await Promise.all([
    agencyKpis(),
    tapsPerDay({}, 30),
    tapsByDevice({}, 30),
    topPlates(30, 5),
    recentTaps({}, 8),
  ]);
  const showFinance = can(user.role, "finance:view");

  return (
    <div className="grid grid-cols-1 gap-5">
      <PageHeader title={`Olá, ${user.name.split(" ")[0]}`} subtitle="Resumo dos últimos 30 dias de todas as plaquinhas." />

      <Pendencias />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          featured
          className="col-span-2"
          label={
            <span className="inline-flex items-center gap-2.5">
              <span className="signal-pulse relative inline-block size-2.5 rounded-full bg-[var(--signal)]" aria-hidden />
              Toques nas plaquinhas nos últimos 30 dias
            </span>
          }
          value={kpi.taps30.toLocaleString("pt-BR")}
          hint={`${kpi.activePlates} plaquinhas ativas em ${kpi.clientsActive + kpi.clientsTrial} clientes`}
        />
        {showFinance ? (
          <Kpi label={<Term k="MRR" />} value={brl(kpi.mrrCents)} hint="contratos recorrentes ativos" />
        ) : (
          <Kpi label={<Term k="Trial">Em trial</Term>} value={kpi.clientsTrial} />
        )}
        <Kpi label="Clientes ativos" value={kpi.clientsActive} hint={`${kpi.clientsTrial} em trial · ${kpi.clientsSuspended} suspensos`} />
      </div>

      {can(user.role, "prospects:read") && <ResumoVendas />}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Panel title="Toques por dia" className="lg:col-span-2">
          <DailyBars data={daily} />
        </Panel>
        <Panel title="Dispositivos">
          <DeviceSplit data={devices} />
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Panel title="Plaquinhas mais tocadas">
          {top.length ? (
            <ol className="grid gap-2">
              {top.map((p, i) => (
                <li key={p.plateId}>
                  <Link href={`/painel/plaquinhas/${p.plateId}`} className="flex items-center gap-3 rounded-lg p-1.5 hover:bg-muted">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{p.client}</span>
                      <span className="block truncate text-xs text-muted-foreground">{p.label}</span>
                    </span>
                    <span className="text-sm tabular-nums">{Number(p.total)}</span>
                  </Link>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum toque registrado ainda.</p>
          )}
        </Panel>
        <Panel title="Últimos toques">
          <RecentTapsList taps={recent} />
        </Panel>
      </div>
    </div>
  );
}

async function ClientOverview({ user }: { user: SessionUser }) {
  if (!user.clientId) return <p className="text-sm text-muted-foreground">Seu usuário ainda não está ligado a um estabelecimento.</p>;
  const scope = { clientId: user.clientId };
  const [daily, devices, recent, top] = await Promise.all([
    tapsPerDay(scope, 30),
    tapsByDevice(scope, 30),
    recentTaps(scope, 8),
    topPlates(30, 10, user.clientId),
  ]);
  const total = daily.reduce((s, d) => s + d.total, 0);

  return (
    <div className="grid grid-cols-1 gap-5">
      <PageHeader title={`Olá, ${user.name.split(" ")[0]}`} subtitle="Como suas plaquinhas de avaliação estão performando." />
      <Pendencias clientId={user.clientId} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Toques (30 dias)" value={total} />
        <Kpi label="Plaquinhas com toque" value={top.length} />
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Panel title="Toques por dia" className="lg:col-span-2">
          <DailyBars data={daily} />
        </Panel>
        <Panel title="Dispositivos">
          <DeviceSplit data={devices} />
        </Panel>
      </div>
      <Panel title="Últimos toques">
        <RecentTapsList taps={recent} />
      </Panel>
    </div>
  );
}
