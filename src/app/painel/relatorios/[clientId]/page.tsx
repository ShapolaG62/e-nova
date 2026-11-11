import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import { and, desc, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { canAccessClient, requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { features } from "@/lib/env";
import { currentMonth, delta, lastClosedMonth, monthLabel, monthlyReport, nextMonth } from "@/lib/reports";
import type { ReportSummarySchema } from "@/lib/ai/tasks";
import { generateReportSummaryAction } from "@/app/actions/reports";
import { ActionForm, FormMessage, SubmitButton } from "@/components/action-form";
import { CHANNEL_LABEL } from "@/components/post-status";
import { PageSkeleton } from "@/components/page";
import { PrintButton } from "@/components/print-button";
import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";
import type { z } from "zod";

export const metadata: Metadata = { title: "Relatório mensal" };

export default function Page(props: PageProps<"/painel/relatorios/[clientId]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Report params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

function Metric({ label, value, cur, prev, suffix = "" }: { label: string; value: React.ReactNode; cur?: number; prev?: number; suffix?: string }) {
  const d = cur !== undefined && prev !== undefined ? delta(cur, prev) : null;
  return (
    <div className="rounded-xl border p-4 break-inside-avoid">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">
        {value}
        {suffix}
      </p>
      {d !== null && (
        <p className={cn("mt-0.5 inline-flex items-center gap-1 text-xs", d >= 0 ? "text-emerald-600" : "text-red-600")}>
          {d >= 0 ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
          {d > 0 ? "+" : ""}
          {d}% vs mês anterior
        </p>
      )}
      {d === null && prev !== undefined && <p className="mt-0.5 text-xs text-muted-foreground">mês anterior: {prev}</p>}
    </div>
  );
}

async function Report({ params, searchParams }: { params: PageProps<"/painel/relatorios/[clientId]">["params"]; searchParams: PageProps<"/painel/relatorios/[clientId]">["searchParams"] }) {
  const user = await requirePermission("reports:read");
  const { clientId } = await params;
  const { mes } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(clientId) || !canAccessClient(user, clientId)) notFound();
  const month = typeof mes === "string" && /^\d{4}-\d{2}$/.test(mes) ? mes : lastClosedMonth();
  const partial = month === currentMonth();

  const client = await db.query.clients.findFirst({ where: eq(t.clients.id, clientId) });
  if (!client) notFound();
  const [report, summaryRow] = await Promise.all([
    monthlyReport(clientId, month),
    db.query.aiGenerations.findFirst({
      where: and(eq(t.aiGenerations.kind, "REPORT_SUMMARY"), eq(t.aiGenerations.clientId, clientId), eq(t.aiGenerations.title, `Relatório ${monthLabel(month)}`), eq(t.aiGenerations.ok, true)),
      orderBy: desc(t.aiGenerations.createdAt),
    }),
  ]);
  const summary = summaryRow?.output as z.infer<typeof ReportSummarySchema> | undefined;
  const { current: c, previous: p } = report;
  const conv = c.taps.total ? Math.round((c.taps.toGoogle / c.taps.total) * 100) : null;

  return (
    <div className="mx-auto grid w-full max-w-4xl grid-cols-1 gap-5 print:max-w-none">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href="/painel/relatorios" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Relatórios
        </Link>
        <div className="flex flex-wrap gap-2">
          <Link href={`/painel/relatorios/${clientId}?mes=${report.prev}`} className="rounded-lg border px-3 py-1.5 text-sm hover:bg-muted">
            ← Mês anterior
          </Link>
          {!partial && (
            <Link href={`/painel/relatorios/${clientId}?mes=${nextMonth(month)}`} className="rounded-lg border px-3 py-1.5 text-sm hover:bg-muted">
              Próximo →
            </Link>
          )}
          <PrintButton />
        </div>
      </div>

      <header className="flex flex-wrap items-end justify-between gap-3 border-b pb-4">
        <div>
          <p className="text-sm text-muted-foreground">Relatório de impacto</p>
          <h1 className="text-2xl font-semibold tracking-tight">{client.tradeName}</h1>
          <p className="text-sm text-muted-foreground">
            {monthLabel(month)}
            {partial && " · mês em andamento (comparações parciais)"}
          </p>
        </div>
        <Logo />
      </header>

      <section className="rounded-xl border bg-primary/5 p-4 break-inside-avoid sm:p-5">
        <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
          <Sparkles className="size-4 text-primary" /> Resumo do mês
        </h2>
        {summary ? (
          <div className="grid gap-3 text-sm">
            <p>{summary.summary}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Destaques</p>
                <ul className="list-disc space-y-1 pl-5">
                  {summary.highlights.map((h, i) => (
                    <li key={i}>{h}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Próximos passos</p>
                <ul className="list-disc space-y-1 pl-5">
                  {summary.nextSteps.map((h, i) => (
                    <li key={i}>{h}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Ainda sem resumo escrito para este mês.</p>
        )}
        {can(user.role, "ai:use") && features.ai && (
          <ActionForm action={generateReportSummaryAction.bind(null, clientId, month)} className="mt-3 flex flex-wrap items-center gap-2 print:hidden">
            <SubmitButton variant="outline" className="h-9">
              <Sparkles /> {summary ? "Reescrever resumo com IA" : "Escrever resumo com IA"}
            </SubmitButton>
            <FormMessage />
          </ActionForm>
        )}
      </section>

      <section className="grid gap-3">
        <h2 className="text-sm font-semibold">Plaquinhas NFC / QR</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric label="Toques" value={c.taps.total} cur={c.taps.total} prev={p.taps.total} />
          <Metric label="Foram ao Google" value={c.taps.toGoogle} cur={c.taps.toGoogle} prev={p.taps.toGoogle} />
          <Metric label="Conversão para o Google" value={conv ?? "—"} suffix={conv !== null ? "%" : ""} />
          <Metric label="iPhone / Android" value={`${c.taps.iphone} / ${c.taps.android}`} />
        </div>
      </section>

      <section className="grid gap-3">
        <h2 className="text-sm font-semibold">Avaliações no Google</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric label="Novas avaliações" value={c.reviews.received} cur={c.reviews.received} prev={p.reviews.received} />
          <Metric label="Nota média do mês" value={c.reviews.avgRating?.toFixed(1).replace(".", ",") ?? "—"} />
          <Metric label="Respondidas" value={c.reviews.received ? `${Math.round((c.reviews.replied / c.reviews.received) * 100)}%` : "—"} />
          <Metric label="Notas 1–2" value={c.reviews.negative} />
        </div>
      </section>

      <section className="grid gap-3">
        <h2 className="text-sm font-semibold">Conteúdo publicado</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric label="Publicações" value={c.posts.published} cur={c.posts.published} prev={p.posts.published} />
          {(Object.keys(CHANNEL_LABEL) as (keyof typeof CHANNEL_LABEL)[]).map((ch) => (
            <Metric key={ch} label={CHANNEL_LABEL[ch]} value={c.posts.byChannel[ch] ?? 0} />
          ))}
        </div>
      </section>

      {c.sites.length > 0 && (
        <section className="grid gap-3 break-inside-avoid">
          <h2 className="text-sm font-semibold">Site</h2>
          <div className="overflow-hidden rounded-xl border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Site</th>
                  <th className="px-4 py-2 text-right font-medium">Disponibilidade</th>
                  <th className="px-4 py-2 text-right font-medium">Quedas</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {c.sites.map((s) => (
                  <tr key={s.name}>
                    <td className="px-4 py-2">{s.name}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{s.uptime === null ? "—" : `${s.uptime.toFixed(2).replace(".", ",")}%`}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{s.incidents}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <p className="text-xs text-muted-foreground">Gerado pelo E-Nova em {new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}. Comparações com {monthLabel(report.prev)}.</p>
    </div>
  );
}
