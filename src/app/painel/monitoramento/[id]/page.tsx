import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, Download, ExternalLink } from "lucide-react";
import { desc, eq, sql } from "drizzle-orm";
import { db, t } from "@/db";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { checkNowAction, deleteMonitorAction, snapshotNowAction, toggleMonitorAction } from "@/app/actions/monitors";
import { Kpi, Panel } from "@/components/charts";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { LatencyBars, pct, sslInfo, StateDot } from "@/components/monitor-ui";
import { PageHeader, PageSkeleton } from "@/components/page";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Term } from "@/components/term";


export const metadata: Metadata = { title: "Site" };
const dt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
const monthFmt = new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit", timeZone: "UTC" });

export default function Page(props: PageProps<"/painel/monitoramento/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Detail params={props.params} />
    </Suspense>
  );
}

async function Detail({ params }: { params: PageProps<"/painel/monitoramento/[id]">["params"] }) {
  const user = await requirePermission("monitors:read");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const m = await db.query.monitors.findFirst({ where: eq(t.monitors.id, id), with: { client: { columns: { tradeName: true } } } });
  if (!m || (user.role === "CLIENT" && m.clientId !== user.clientId)) notFound();
  const writer = can(user.role, "monitors:write");

  const [checks, monthly, snapshots, events, [day]] = await Promise.all([
    db.select().from(t.monitorChecks).where(eq(t.monitorChecks.monitorId, id)).orderBy(desc(t.monitorChecks.checkedAt)).limit(96),
    db.execute<{ month: string; uptime: number; total: number }>(sql`
      select to_char(date_trunc('month', checked_at at time zone 'America/Sao_Paulo'), 'YYYY-MM-01') as month,
             (count(*) filter (where ok))::float * 100 / count(*) as uptime, count(*)::int as total
      from monitor_checks where monitor_id = ${id} and checked_at > now() - interval '6 months'
      group by 1 order by 1 desc`),
    db.select().from(t.siteSnapshots).where(eq(t.siteSnapshots.monitorId, id)).orderBy(desc(t.siteSnapshots.createdAt)).limit(10),
    db.select().from(t.alertEvents).where(eq(t.alertEvents.monitorId, id)).orderBy(desc(t.alertEvents.createdAt)).limit(10),
    db
      .select({
        avg: sql<number | null>`avg(${t.monitorChecks.latencyMs}) filter (where ${t.monitorChecks.ok})`,
        up: sql<number | null>`(count(*) filter (where ${t.monitorChecks.ok}))::float * 100 / nullif(count(*),0)`,
      })
      .from(t.monitorChecks)
      .where(sql`${t.monitorChecks.monitorId} = ${id} and ${t.monitorChecks.checkedAt} > now() - interval '24 hours'`),
  ]);
  const ssl = sslInfo(m.sslExpiresAt);

  return (
    <div className="grid grid-cols-1 gap-5">
      <Link href="/painel/monitoramento" className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Sites
      </Link>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {m.name} <StateDot state={m.state} active={m.active} />
          </span>
        }
        subtitle={
          <a href={m.url} target="_blank" rel="noopener" className="inline-flex items-center gap-1 break-all hover:underline">
            {m.url} <ExternalLink className="size-3" />
          </a>
        }
        action={
          writer && (
            <div className="flex flex-wrap gap-2">
              <form action={checkNowAction}>
                <input type="hidden" name="id" value={m.id} />
                <button className={buttonVariants({ variant: "outline", size: "sm" })}>Verificar agora</button>
              </form>
              <form action={toggleMonitorAction}>
                <input type="hidden" name="id" value={m.id} />
                <input type="hidden" name="active" value={String(!m.active)} />
                <button className={buttonVariants({ variant: "ghost", size: "sm" })}>{m.active ? "Pausar" : "Retomar"}</button>
              </form>
            </div>
          )
        }
      />

      {m.state === "DOWN" && m.lastError && (
        <p className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          Fora do ar desde a última verificação: <strong>{m.lastError}</strong>
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label={<><Term k="Uptime" /> 24h</>} value={pct(day?.up === null || day?.up === undefined ? null : Number(day.up))} />
        <Kpi label="Latência média 24h" value={day?.avg ? `${Math.round(Number(day.avg))} ms` : "—"} />
        <Kpi
          label={<>Certificado <Term k="SSL" /></>}
          value={<span className={cn(ssl.tone === "bad" && "text-red-600", ssl.tone === "warn" && "text-amber-600")}>{ssl.label}</span>}
          hint={m.sslExpiresAt ? `vence ${dt.format(m.sslExpiresAt)}${m.sslIssuer ? ` · ${m.sslIssuer}` : ""}` : "sem HTTPS ou não lido"}
        />
        <Kpi label="Última verificação" value={m.lastCheckedAt ? dt.format(m.lastCheckedAt).split(" ")[1] : "—"} hint={m.lastStatusCode ? `HTTP ${m.lastStatusCode}` : undefined} />
      </div>

      <Panel title={`Latência — últimas ${checks.length} verificações`}>
        <LatencyBars checks={[...checks].reverse()} />
      </Panel>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Panel title="Uptime mensal">
          {monthly.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem dados ainda.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody className="divide-y">
                {monthly.rows.map((r) => (
                  <tr key={r.month}>
                    <td className="py-1.5 capitalize">{monthFmt.format(new Date(r.month))}</td>
                    <td className="py-1.5 text-right font-medium tabular-nums">{pct(Number(r.uptime))}</td>
                    <td className="py-1.5 text-right text-xs text-muted-foreground tabular-nums">{r.total} verificações</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <Panel title="Alertas enviados">
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum alerta.</p>
          ) : (
            <ul className="divide-y text-sm">
              {events.map((e) => (
                <li key={e.id} className="py-2">
                  <p>{e.message}</p>
                  <p className="text-xs text-muted-foreground">
                    {dt.format(e.createdAt)} · {e.deliveries.length ? e.deliveries.map((d) => `${d.channel} ${d.ok ? "✓" : "✗"}`).join(" · ") : "nenhum canal configurado"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel
        title="Cópias da página (backup diário)"
        action={
          writer && (
            <form action={snapshotNowAction}>
              <input type="hidden" name="id" value={m.id} />
              <button className={buttonVariants({ variant: "outline", size: "sm" })}>Copiar agora</button>
            </form>
          )
        }
      >
        <p className="mb-3 text-xs text-muted-foreground">
          Guardamos o HTML publicado uma vez por dia. Se o conteúdo mudar sem ninguém da equipe mexer, pode ser sinal de invasão ou desfiguração do site.
          {m.contentChangedAt && ` Última alteração detectada: ${dt.format(m.contentChangedAt)}.`}
        </p>
        {snapshots.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma cópia ainda.</p>
        ) : (
          <ul className="divide-y text-sm">
            {snapshots.map((s) => (
              <li key={s.id} className="flex items-center gap-3 py-2">
                <span className="flex-1">{dt.format(s.createdAt)}</span>
                {s.changed && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] text-amber-800 dark:bg-amber-950 dark:text-amber-300">conteúdo mudou</span>}
                <span className="text-xs text-muted-foreground tabular-nums">{(s.sizeBytes / 1024).toFixed(0)} KB</span>
                <a href={`/api/snapshots/${s.id}`} className="text-muted-foreground hover:text-foreground" aria-label="Baixar cópia">
                  <Download className="size-4" />
                </a>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {writer && (
        <form action={deleteMonitorAction} className="text-right">
          <input type="hidden" name="id" value={m.id} />
          <ConfirmSubmit message="Remover este monitor e todo o histórico? Não dá para desfazer." className="text-xs text-destructive underline-offset-2 hover:underline">
            Remover monitor
          </ConfirmSubmit>
        </form>
      )}
    </div>
  );
}
