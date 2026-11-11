import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { AlertTriangle, ArrowLeft, CheckCircle2, ExternalLink, Send, XCircle } from "lucide-react";
import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import { canAccessClient, requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import {
  approvePostAction,
  deletePostAction,
  publishNowAction,
  requestChangesAction,
  retryPostAction,
  submitForApprovalAction,
  unschedulePostAction,
  updatePostAction,
} from "@/app/actions/content";
import { ActionForm, FormMessage, SubmitButton } from "@/components/action-form";
import { Field } from "@/components/field";
import { Panel } from "@/components/charts";
import { CHANNEL_LABEL, PostStatusBadge } from "@/components/post-status";
import { PageHeader, PageSkeleton } from "@/components/page";
import { Textarea } from "@/components/ui/textarea";
import { buttonVariants } from "@/components/ui/button";
import { ConfirmSubmit } from "@/components/confirm-submit";

export const metadata: Metadata = { title: "Post" };

const CHANNELS = [
  { id: "INSTAGRAM", provider: "META" },
  { id: "TIKTOK", provider: "TIKTOK" },
  { id: "YOUTUBE", provider: "YOUTUBE" },
] as const;
const when = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
/** Date → "YYYY-MM-DDTHH:mm" no horário de São Paulo (para <input type="datetime-local">) */
const toLocalInput = (d: Date | null) => (d ? new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(d).replace(" ", "T") : "");

export default function Page(props: PageProps<"/painel/conteudo/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <PostPage params={props.params} />
    </Suspense>
  );
}

async function PostPage({ params }: { params: PageProps<"/painel/conteudo/[id]">["params"] }) {
  const user = await requirePermission("content:read");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const post = await db.query.posts.findFirst({ where: eq(t.posts.id, id), with: { client: true, media: true, targets: true } });
  if (!post || !canAccessClient(user, post.clientId)) notFound();

  const integrations = await db.select({ provider: t.integrations.provider }).from(t.integrations).where(eq(t.integrations.clientId, post.clientId));
  const connected = new Set(integrations.map((i) => i.provider));
  const writer = can(user.role, "content:write");
  const approver = can(user.role, "content:approve");
  const editable = writer && ["RASCUNHO", "AGUARDANDO_APROVACAO", "FALHOU"].includes(post.status);
  const missing = post.channels.filter((c) => !connected.has(CHANNELS.find((x) => x.id === c)!.provider));

  return (
    <div className="grid grid-cols-1 gap-5">
      <Link href="/painel/conteudo" className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Conteúdo
      </Link>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {post.title} <PostStatusBadge status={post.status} />
          </span>
        }
        subtitle={`${post.client.tradeName}${post.scheduledAt ? ` · ${post.status === "PUBLICADO" ? "publicado" : "agendado para"} ${when.format(post.scheduledAt)}` : ""}`}
      />

      {post.reviewNote && post.status === "RASCUNHO" && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <strong>Ajuste pedido</strong> — {post.reviewNote}
        </p>
      )}
      {missing.length > 0 && writer && (
        <p className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>
            Sem conta conectada para: {missing.map((c) => CHANNEL_LABEL[c]).join(", ")}. Conecte em{" "}
            <Link href={`/painel/clientes/${post.clientId}`} className="underline">
              Clientes → Contas conectadas
            </Link>
            , senão a publicação nesses canais vai falhar.
          </span>
        </p>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[300px_1fr]">
        <Panel title="Vídeo">
          {post.media?.status === "READY" ? (
            <video src={`/api/midia/${post.media.id}/arquivo`} controls playsInline preload="metadata" className="mx-auto aspect-[9/16] max-h-[60vh] w-full rounded-lg bg-black object-contain" />
          ) : (
            <p className="text-sm text-muted-foreground">Vídeo indisponível.</p>
          )}
          {post.media && <p className="mt-2 truncate text-xs text-muted-foreground">{post.media.filename} · {(post.media.sizeBytes / 1024 / 1024).toFixed(1)} MB</p>}
        </Panel>

        <div className="grid content-start grid-cols-1 gap-5">
          {/* Ações do fluxo */}
          <Panel title="Andamento">
            <ol className="mb-4 flex flex-wrap gap-x-2 gap-y-1 text-xs text-muted-foreground">
              {["Rascunho", "Aprovação", "Agendado", "Publicado"].map((s, i) => {
                const step = { RASCUNHO: 0, AGUARDANDO_APROVACAO: 1, AGENDADO: 2, PUBLICANDO: 2, PUBLICADO: 3, FALHOU: 2 }[post.status];
                return (
                  <li key={s} className={i <= step ? "font-medium text-foreground" : ""}>
                    {i > 0 && "→ "}
                    {s}
                  </li>
                );
              })}
            </ol>

            <div className="flex flex-wrap gap-2">
              {post.status === "RASCUNHO" && writer && (
                <form action={submitForApprovalAction}>
                  <input type="hidden" name="id" value={post.id} />
                  <button className={buttonVariants({ className: "h-10 sm:h-9" })} disabled={!post.channels.length}>
                    <Send /> Enviar para aprovação do cliente
                  </button>
                </form>
              )}
              {post.status === "AGUARDANDO_APROVACAO" && approver && (
                <form action={approvePostAction}>
                  <input type="hidden" name="id" value={post.id} />
                  <button className={buttonVariants({ className: "h-10 sm:h-9" })}>
                    <CheckCircle2 /> Aprovar {post.scheduledAt && post.scheduledAt > new Date() ? `para ${when.format(post.scheduledAt)}` : "e publicar agora"}
                  </button>
                </form>
              )}
              {post.status === "AGENDADO" && writer && (
                <>
                  <form action={publishNowAction}>
                    <input type="hidden" name="id" value={post.id} />
                    <button className={buttonVariants({ variant: "outline", className: "h-10 sm:h-9" })}>Publicar agora</button>
                  </form>
                  <form action={unschedulePostAction}>
                    <input type="hidden" name="id" value={post.id} />
                    <button className={buttonVariants({ variant: "ghost", className: "h-10 sm:h-9" })}>Cancelar agendamento</button>
                  </form>
                </>
              )}
              {post.status === "FALHOU" && writer && (
                <form action={retryPostAction}>
                  <input type="hidden" name="id" value={post.id} />
                  <button className={buttonVariants({ className: "h-10 sm:h-9" })}>Tentar de novo nos canais com falha</button>
                </form>
              )}
            </div>
            {post.status === "RASCUNHO" && !post.channels.length && writer && <p className="mt-2 text-xs text-muted-foreground">Escolha pelo menos um canal abaixo antes de enviar.</p>}

            {post.status === "AGUARDANDO_APROVACAO" && approver && (
              <ActionForm action={requestChangesAction.bind(null, post.id)} className="mt-4 grid gap-2 border-t pt-4">
                <Field name="note" label="Pedir ajuste (volta para a equipe)">
                  <Textarea id="note" name="note" rows={2} placeholder="Ex.: trocar a música e mencionar o horário de funcionamento" />
                </Field>
                <FormMessage />
                <div>
                  <SubmitButton variant="outline" className="h-10 sm:h-9">
                    Pedir ajuste
                  </SubmitButton>
                </div>
              </ActionForm>
            )}

            {post.targets.length > 0 && (
              <ul className="mt-4 grid gap-2 border-t pt-4">
                {post.targets.map((tg) => (
                  <li key={tg.id} className="flex flex-wrap items-center gap-2 text-sm">
                    {tg.status === "PUBLISHED" ? <CheckCircle2 className="size-4 text-emerald-600" /> : tg.status === "FAILED" ? <XCircle className="size-4 text-destructive" /> : <span className="size-4 rounded-full border-2" />}
                    <span className="font-medium">{CHANNEL_LABEL[tg.channel]}</span>
                    <span className="text-muted-foreground">{tg.status === "PUBLISHED" ? "publicado" : tg.status === "FAILED" ? "falhou" : "pendente"}</span>
                    {tg.externalUrl && (
                      <a href={tg.externalUrl} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-xs text-primary">
                        ver <ExternalLink className="size-3" />
                      </a>
                    )}
                    {tg.error && <span className="w-full pl-6 text-xs break-words text-destructive">{tg.error}</span>}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Publicação">
            {editable ? (
              <ActionForm action={updatePostAction.bind(null, post.id)} className="grid gap-3">
                <Field name="title" label="Título (YouTube / referência interna)" defaultValue={post.title} required />
                <Field name="caption" label="Legenda + hashtags">
                  <Textarea id="caption" name="caption" rows={6} defaultValue={post.caption} maxLength={2200} />
                </Field>
                <fieldset className="grid gap-2">
                  <legend className="mb-1 text-sm font-medium">Canais</legend>
                  <div className="flex flex-wrap gap-2">
                    {CHANNELS.map((c) => (
                      <label key={c.id} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm has-checked:border-primary has-checked:bg-primary/5">
                        <input type="checkbox" name="channels" value={c.id} defaultChecked={post.channels.includes(c.id)} className="size-4 accent-[var(--primary)]" />
                        {CHANNEL_LABEL[c.id]}
                        {!connected.has(c.provider) && <span className="text-[11px] text-muted-foreground">(não conectado)</span>}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <Field name="scheduledAt" label="Data e hora (Brasília)" type="datetime-local" defaultValue={toLocalInput(post.scheduledAt)} hint="Vazio = publica assim que for aprovado." />
                <FormMessage />
                <div className="flex flex-wrap items-center gap-2">
                  <SubmitButton className="h-10 sm:h-9">Salvar</SubmitButton>
                </div>
              </ActionForm>
            ) : (
              <div className="grid gap-2 text-sm">
                <p className="whitespace-pre-line">{post.caption || <em className="text-muted-foreground">Sem legenda.</em>}</p>
                <p className="text-xs text-muted-foreground">Canais: {post.channels.map((c) => CHANNEL_LABEL[c]).join(", ") || "—"}</p>
              </div>
            )}
          </Panel>

          {writer && post.status !== "PUBLICANDO" && (
            <form action={deletePostAction} className="text-right">
              <input type="hidden" name="id" value={post.id} />
              <ConfirmSubmit message="Excluir este post e o vídeo? Não dá para desfazer." className="text-xs text-destructive underline-offset-2 hover:underline">
                Excluir post
              </ConfirmSubmit>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
