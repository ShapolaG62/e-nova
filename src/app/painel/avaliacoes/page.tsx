import { Suspense } from "react";
import type { Metadata } from "next";
import { RefreshCw, Sparkles, Star } from "lucide-react";
import { and, avg, count, desc, eq, sql } from "drizzle-orm";
import { db, t } from "@/db";
import { requirePermission, scopeClientId } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { features } from "@/lib/env";
import { addManualReviewAction, draftRepliesAction, ignoreReviewAction, publishReplyAction, syncReviewsAction } from "@/app/actions/ai";
import { ActionForm, FormMessage, SubmitButton } from "@/components/action-form";
import { ReplyComposer } from "@/components/reply-composer";
import { ClientFilter, ClientSelect } from "@/components/client-filter";
import { Field, selectClass } from "@/components/field";
import { Kpi, Panel } from "@/components/charts";
import { PageHeader, PageSkeleton } from "@/components/page";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Avaliações" };

const STATUS_LABEL = { PENDING: "Sem resposta", DRAFTED: "Rascunho pronto", PUBLISHED: "Respondida", IGNORED: "Ignorada" } as const;
const SENTIMENT = {
  POSITIVE: { label: "Positiva", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" },
  NEUTRAL: { label: "Neutra", cls: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  NEGATIVE: { label: "Negativa", cls: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300" },
} as const;
const when = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "short", year: "numeric" });

export default function Page(props: PageProps<"/painel/avaliacoes">) {
  return (
    <div className="grid grid-cols-1 gap-5">
      <PageHeader title="Avaliações" subtitle="Avaliações do Google e respostas sugeridas pela IA, aprovadas com 1 clique." />
      <Suspense fallback={<PageSkeleton />}>
        <Reviews searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

function Stars({ n }: { n: number }) {
  return (
    <span className="inline-flex" aria-label={`${n} de 5 estrelas`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={cn("size-3.5", i <= n ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30")} />
      ))}
    </span>
  );
}

async function Reviews({ searchParams }: { searchParams: PageProps<"/painel/avaliacoes">["searchParams"] }) {
  const user = await requirePermission("reviews:read");
  const sp = await searchParams;
  const clientId = scopeClientId(user, typeof sp.cliente === "string" ? sp.cliente : null);
  const status = typeof sp.status === "string" && sp.status in STATUS_LABEL ? (sp.status as keyof typeof STATUS_LABEL) : null;
  const staff = can(user.role, "reviews:reply");

  const where = and(clientId ? eq(t.reviews.clientId, clientId) : undefined, status ? eq(t.reviews.replyStatus, status) : undefined);
  const [rows, [stats], googleConnected] = await Promise.all([
    db.query.reviews.findMany({ where, with: { client: { columns: { tradeName: true, id: true } } }, orderBy: desc(t.reviews.reviewedAt), limit: 100 }),
    db
      .select({
        total: count(),
        avg: avg(t.reviews.rating),
        answered: sql<number>`count(*) filter (where ${t.reviews.replyStatus} = 'PUBLISHED')::int`,
        negative: sql<number>`count(*) filter (where ${t.reviews.rating} <= 2)::int`,
      })
      .from(t.reviews)
      .where(clientId ? eq(t.reviews.clientId, clientId) : undefined),
    clientId
      ? db.query.integrations.findFirst({ where: and(eq(t.integrations.clientId, clientId), eq(t.integrations.provider, "GOOGLE_BUSINESS")), columns: { id: true } })
      : Promise.resolve(undefined),
  ]);
  const total = Number(stats.total);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Avaliações" value={total} />
        <Kpi label="Nota média" value={stats.avg ? Number(stats.avg).toFixed(1).replace(".", ",") : "—"} />
        <Kpi label="Respondidas" value={total ? `${Math.round((stats.answered / total) * 100)}%` : "—"} />
        <Kpi label="Notas 1–2" value={stats.negative} hint="prioridade de resposta" />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        {user.role !== "CLIENT" ? (
          <ClientFilter selected={clientId}>
            <select name="status" defaultValue={status ?? ""} className="h-10 rounded-lg border border-input bg-transparent px-2.5 text-sm sm:h-9 sm:w-44" aria-label="Status">
              <option value="">Todos os status</option>
              {Object.entries(STATUS_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </ClientFilter>
        ) : (
          <span />
        )}
        {staff && clientId && googleConnected && (
          <form action={syncReviewsAction}>
            <input type="hidden" name="clientId" value={clientId} />
            <button className="inline-flex h-10 items-center gap-1.5 rounded-lg border px-3 text-sm hover:bg-muted sm:h-9">
              <RefreshCw className="size-4" /> Sincronizar com o Google
            </button>
          </form>
        )}
      </div>

      {!features.ai && staff && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          IA desligada: configure <code>ANTHROPIC_API_KEY</code> no servidor para gerar respostas automaticamente. Você ainda pode responder manualmente.
        </p>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_340px]">
        <div className="grid content-start gap-3">
          {rows.length === 0 && (
            <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
              Nenhuma avaliação {status ? "com esse status" : "ainda"}. Conecte o Google Meu Negócio no cadastro do cliente ou adicione manualmente.
            </div>
          )}
          {rows.map((r) => (
            <article key={r.id} className="rounded-xl border bg-card p-4">
              <header className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-medium">{r.authorName ?? "Anônimo"}</span>
                <Stars n={r.rating} />
                <span className="text-xs text-muted-foreground">
                  {when.format(r.reviewedAt)} · {r.client.tradeName} · {r.source === "GOOGLE" ? "Google" : "Manual"}
                </span>
                <span className="ml-auto flex gap-1.5">
                  {r.sentiment && <span className={cn("rounded-full px-2 py-0.5 text-[11px]", SENTIMENT[r.sentiment].cls)}>{SENTIMENT[r.sentiment].label}</span>}
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px]">{STATUS_LABEL[r.replyStatus]}</span>
                </span>
              </header>
              <p className="mt-2 text-sm whitespace-pre-line">{r.text || <em className="text-muted-foreground">Só a nota, sem comentário.</em>}</p>

              {r.replyStatus === "PUBLISHED" && r.replyText && (
                <div className="mt-3 rounded-lg border-l-2 border-primary bg-muted/50 px-3 py-2 text-sm">
                  <p className="mb-0.5 text-xs font-medium text-muted-foreground">Resposta do estabelecimento</p>
                  {r.replyText}
                </div>
              )}

              {staff && r.replyStatus !== "PUBLISHED" && r.replyStatus !== "IGNORED" && (
                <div className="mt-3 grid gap-3 border-t pt-3">
                  {features.ai && (
                    <ActionForm action={draftRepliesAction.bind(null, r.id)} className="flex flex-wrap items-center gap-2">
                      <SubmitButton variant="outline" className="h-9">
                        <Sparkles /> {r.replyDrafts.length ? "Gerar outras 3 respostas" : "Gerar 3 respostas com IA"}
                      </SubmitButton>
                      <FormMessage />
                    </ActionForm>
                  )}
                  <ReplyComposer
                    drafts={r.replyDrafts}
                    initial={r.replyText ?? ""}
                    action={publishReplyAction.bind(null, r.id)}
                    publishLabel={r.source === "GOOGLE" ? "Aprovar e publicar no Google" : "Marcar como respondida"}
                  />
                  <form action={ignoreReviewAction}>
                    <input type="hidden" name="id" value={r.id} />
                    <button className="text-xs text-muted-foreground underline-offset-2 hover:underline">Ignorar esta avaliação</button>
                  </form>
                </div>
              )}
            </article>
          ))}
        </div>

        {staff && (
          <Panel title="Adicionar avaliação manual" className="self-start">
            <p className="mb-3 text-xs text-muted-foreground">Para clientes ainda sem Google conectado: cole a avaliação para gerar a resposta com IA.</p>
            <ActionForm action={addManualReviewAction} resetOnSuccess className="grid gap-3">
              <Field name="clientId" label="Cliente">
                <ClientSelect defaultValue={clientId} required emptyLabel="Escolha…" />
              </Field>
              <Field name="authorName" label="Autor" />
              <Field name="rating" label="Nota">
                <select id="rating" name="rating" defaultValue="5" className={selectClass}>
                  {[5, 4, 3, 2, 1].map((n) => (
                    <option key={n} value={n}>
                      {n} ★
                    </option>
                  ))}
                </select>
              </Field>
              <Field name="text" label="Texto da avaliação">
                <Textarea id="text" name="text" rows={4} />
              </Field>
              <FormMessage />
              <SubmitButton className="h-10 sm:h-9">Adicionar</SubmitButton>
            </ActionForm>
          </Panel>
        )}
      </div>
    </>
  );
}
