import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { asc, desc, inArray, sql } from "drizzle-orm";
import { db, t } from "@/db";
import { requirePermission } from "@/lib/auth/session";
import { features } from "@/lib/env";
import { generateEmailAction, generateScriptAction } from "@/app/actions/ai";
import { EmailStudio, ScriptStudio } from "@/components/ai-studio";
import { Kpi, Panel } from "@/components/charts";
import { PageHeader, PageSkeleton } from "@/components/page";
import { cn } from "@/lib/utils";
import { Term } from "@/components/term";


export const metadata: Metadata = { title: "Estúdio IA" };

const KIND_LABEL: Record<string, string> = {
  VIDEO_SCRIPT: "Roteiro",
  EMAIL: "E-mail",
  REVIEW_REPLY: "Resposta",
  REVIEW_SUGGESTION: "Sugestão pública",
  REPORT_SUMMARY: "Relatório",
};
const when = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export default function Page(props: PageProps<"/painel/ia">) {
  return (
    <div className="grid grid-cols-1 gap-5">
      <PageHeader title="Estúdio IA" subtitle={<>Roteiros de vídeos curtos e e-mails, gerados pela <Term k="IA local">IA da própria empresa</Term>.</>} />
      <Suspense fallback={<PageSkeleton />}>
        <Studio searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function Studio({ searchParams }: { searchParams: PageProps<"/painel/ia">["searchParams"] }) {
  await requirePermission("ai:use");
  const { aba } = await searchParams;
  const tab = aba === "email" ? "email" : "roteiro";

  const [clients, history, [usage]] = await Promise.all([
    db.select({ id: t.clients.id, name: t.clients.tradeName }).from(t.clients).orderBy(asc(t.clients.tradeName)),
    db.query.aiGenerations.findMany({
      where: inArray(t.aiGenerations.kind, ["VIDEO_SCRIPT", "EMAIL"]),
      orderBy: desc(t.aiGenerations.createdAt),
      limit: 15,
    }),
    db
      .select({
        total: sql<number>`count(*)::int`,
        failed: sql<number>`count(*) filter (where not ${t.aiGenerations.ok})::int`,
        inTok: sql<number>`coalesce(sum(${t.aiGenerations.inputTokens}),0)::int`,
        paidIn: sql<number>`coalesce(sum(${t.aiGenerations.inputTokens}) filter (where ${t.aiGenerations.model} like 'anthropic:%'),0)::int`,
        paidOut: sql<number>`coalesce(sum(${t.aiGenerations.outputTokens}) filter (where ${t.aiGenerations.model} like 'anthropic:%'),0)::int`,
        outTok: sql<number>`coalesce(sum(${t.aiGenerations.outputTokens}),0)::int`,
      })
      .from(t.aiGenerations)
      .where(sql`${t.aiGenerations.createdAt} > now() - interval '30 days'`),
  ]);
  // Estimativa com o preço de tabela do Claude Opus 5.5 (US$ 4 / 20 por milhão de tokens)
  // IA local custa zero; só gerações pela Claude API entram na estimativa
  const usd = (usage.paidIn * 4 + usage.paidOut * 20) / 1_000_000;

  return (
    <>
      {!features.ai && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          Configure <code>ANTHROPIC_API_KEY</code> no <code>.env.local</code> (ou no servidor) e reinicie para liberar as gerações.
        </p>
      )}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Gerações (30d)" value={usage.total} hint={usage.failed ? `${usage.failed} com erro` : undefined} />
        <Kpi label="Tokens (30d)" value={(usage.inTok + usage.outTok).toLocaleString("pt-BR")} />
        <Kpi label="Custo (30d)" value={`US$ ${usd.toFixed(2)}`} hint={usd ? "Claude API, preço de tabela" : "tudo rodou na IA local"} />
      </div>

      <div className="flex gap-1 rounded-lg bg-muted p-1 sm:w-fit">
        {[
          ["roteiro", "Roteiro de vídeo"],
          ["email", "E-mail"],
        ].map(([k, label]) => (
          <Link
            key={k}
            href={`/painel/ia?aba=${k}`}
            className={cn("flex-1 rounded-md px-4 py-1.5 text-center text-sm sm:flex-none", tab === k ? "bg-background font-medium shadow-sm" : "text-muted-foreground")}
          >
            {label}
          </Link>
        ))}
      </div>

      {tab === "roteiro" ? (
        <ScriptStudio action={generateScriptAction} clients={clients} aiEnabled={features.ai} />
      ) : (
        <EmailStudio action={generateEmailAction} clients={clients} aiEnabled={features.ai} />
      )}

      <Panel title="Histórico recente">
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nada gerado ainda.</p>
        ) : (
          <ul className="divide-y">
            {history.map((h) => (
              <li key={h.id} className="py-2">
                <details>
                  <summary className="flex cursor-pointer items-center gap-2 text-sm">
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[11px]">{KIND_LABEL[h.kind]}</span>
                    <span className="min-w-0 flex-1 truncate">{h.title ?? "(sem título)"}</span>
                    {!h.ok && <span className="text-xs text-destructive">erro</span>}
                    <span className="shrink-0 text-xs text-muted-foreground">{when.format(h.createdAt)}</span>
                  </summary>
                  <pre className="mt-2 max-h-80 overflow-auto rounded-lg bg-muted/60 p-3 text-xs whitespace-pre-wrap">
                    {h.ok ? JSON.stringify(h.output, null, 2) : h.error}
                  </pre>
                </details>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
