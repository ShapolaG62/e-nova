import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { Bell } from "lucide-react";
import { asc, eq, sql } from "drizzle-orm";
import { db, t } from "@/db";
import { requirePermission, scopeClientId } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { createMonitorAction } from "@/app/actions/monitors";
import { ActionForm, FormMessage, SubmitButton } from "@/components/action-form";
import { ClientSelect } from "@/components/client-filter";
import { Field, selectClass } from "@/components/field";
import { Kpi, Panel } from "@/components/charts";
import { PageHeader, PageSkeleton } from "@/components/page";
import { pct, SslBadge, sslInfo, StateDot } from "@/components/monitor-ui";
import { buttonVariants } from "@/components/ui/button";
import { Term } from "@/components/term";


export const metadata: Metadata = { title: "Sites" };

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Monitors />
    </Suspense>
  );
}

async function Monitors() {
  const user = await requirePermission("monitors:read");
  const clientId = scopeClientId(user, null);
  const writer = can(user.role, "monitors:write");

  // Uptime de 30 dias calculado no banco, numa consulta só
  const rows = await db
    .select({
      id: t.monitors.id,
      name: t.monitors.name,
      url: t.monitors.url,
      state: t.monitors.state,
      active: t.monitors.active,
      latency: t.monitors.lastLatencyMs,
      ssl: t.monitors.sslExpiresAt,
      client: t.clients.tradeName,
      uptime: sql<number | null>`(
        select (count(*) filter (where c.ok))::float * 100 / nullif(count(*), 0)
        from monitor_checks c where c.monitor_id = ${t.monitors.id} and c.checked_at > now() - interval '30 days')`,
    })
    .from(t.monitors)
    .leftJoin(t.clients, eq(t.clients.id, t.monitors.clientId))
    .where(clientId ? eq(t.monitors.clientId, clientId) : undefined)
    .orderBy(sql`case ${t.monitors.state} when 'DOWN' then 0 when 'UNKNOWN' then 1 else 2 end`, asc(t.monitors.name));

  const down = rows.filter((r) => r.active && r.state === "DOWN").length;
  const sslSoon = rows.filter((r) => ["warn", "bad"].includes(sslInfo(r.ssl).tone)).length;
  const ups = rows.map((r) => r.uptime).filter((v): v is number => v !== null);
  const avgUptime = ups.length ? ups.reduce((a, b) => a + Number(b), 0) / ups.length : null;

  return (
    <div className="grid grid-cols-1 gap-5">
      <PageHeader
        title="Sites e segurança"
        subtitle="Uptime a cada 5/15 min, certificado SSL, cópia diária da página e alertas."
        action={
          can(user.role, "alerts:manage") && (
            <Link href="/painel/monitoramento/alertas" className={buttonVariants({ variant: "outline", className: "h-10 sm:h-9" })}>
              <Bell /> Canais de alerta
            </Link>
          )
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Sites monitorados" value={rows.length} />
        <Kpi label="Fora do ar agora" value={<span className={down ? "text-red-600" : ""}>{down}</span>} />
        <Kpi label={<><Term k="Uptime" /> médio (30d)</>} value={pct(avgUptime)} />
        <Kpi label={<><Term k="SSL" /> vencendo (≤15d)</>} value={<span className={sslSoon ? "text-amber-600" : ""}>{sslSoon}</span>} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_340px]">
        {rows.length === 0 ? (
          <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">Nenhum site monitorado ainda.</div>
        ) : (
          <ul className="divide-y self-start overflow-hidden rounded-xl border bg-card">
            {rows.map((m) => (
              <li key={m.id}>
                <Link href={`/painel/monitoramento/${m.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/60">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{m.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {m.client ? `${m.client} · ` : ""}
                      {m.url.replace(/^https?:\/\//, "")}
                    </p>
                  </div>
                  <div className="hidden text-right sm:block">
                    <p className="text-sm tabular-nums">{pct(m.uptime === null ? null : Number(m.uptime))}</p>
                    <SslBadge expires={m.ssl} />
                  </div>
                  <div className="flex w-24 flex-col items-end gap-0.5">
                    <StateDot state={m.state} active={m.active} />
                    {m.latency !== null && m.active && <span className="text-[11px] text-muted-foreground tabular-nums">{m.latency} ms</span>}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {writer && (
          <Panel title="Monitorar novo site" className="self-start">
            <ActionForm action={createMonitorAction} resetOnSuccess className="grid gap-3">
              <Field name="name" label="Nome" placeholder="Site da Cantina" required />
              <Field name="url" label="Endereço" placeholder="https://cantinadanona.com.br" inputMode="url" required />
              <Field name="intervalMinutes" label="Verificar a cada">
                <select id="intervalMinutes" name="intervalMinutes" defaultValue="5" className={selectClass}>
                  <option value="5">5 minutos</option>
                  <option value="15">15 minutos</option>
                </select>
              </Field>
              <Field name="clientId" label="Cliente">
                <ClientSelect emptyLabel="— Agência —" />
              </Field>
              <FormMessage />
              <SubmitButton className="h-10 sm:h-9">Começar a monitorar</SubmitButton>
            </ActionForm>
          </Panel>
        )}
      </div>
    </div>
  );
}
