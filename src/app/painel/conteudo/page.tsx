import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { Film, Plus } from "lucide-react";
import { and, desc, eq } from "drizzle-orm";
import { db, t } from "@/db";
import type { PostStatus } from "@/db/schema";
import { requirePermission, scopeClientId } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { ClientFilter } from "@/components/client-filter";
import { CHANNEL_LABEL, POST_STATUS, PostStatusBadge } from "@/components/post-status";
import { PageHeader, PageSkeleton } from "@/components/page";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Conteúdo" };
const when = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export default function Page(props: PageProps<"/painel/conteudo">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Content({ searchParams }: { searchParams: PageProps<"/painel/conteudo">["searchParams"] }) {
  const user = await requirePermission("content:read");
  const sp = await searchParams;
  const clientId = scopeClientId(user, typeof sp.cliente === "string" ? sp.cliente : null);
  const status = typeof sp.status === "string" && sp.status in POST_STATUS ? (sp.status as PostStatus) : null;
  const writer = can(user.role, "content:write");

  const posts = await db.query.posts.findMany({
    where: and(clientId ? eq(t.posts.clientId, clientId) : undefined, status ? eq(t.posts.status, status) : undefined),
    with: { client: { columns: { tradeName: true } }, targets: true },
    orderBy: desc(t.posts.updatedAt),
    limit: 200,
  });
  const counts = posts.reduce<Record<string, number>>((acc, p) => ((acc[p.status] = (acc[p.status] ?? 0) + 1), acc), {});
  const waiting = posts.filter((p) => p.status === "AGUARDANDO_APROVACAO");

  return (
    <div className="grid grid-cols-1 gap-5">
      <PageHeader
        title="Conteúdo"
        subtitle={user.role === "CLIENT" ? "Aprove os vídeos antes de irem ao ar." : "Vídeos verticais, aprovação do cliente e publicação no Instagram, TikTok e YouTube."}
        action={
          writer && (
            <Link href={`/painel/conteudo/novo${clientId ? `?cliente=${clientId}` : ""}`} className={buttonVariants({ className: "h-10 sm:h-9" })}>
              <Plus /> Enviar vídeos
            </Link>
          )
        }
      />

      {user.role === "CLIENT" && waiting.length > 0 && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          Você tem <strong>{waiting.length}</strong> vídeo(s) aguardando sua aprovação.
        </p>
      )}

      {user.role !== "CLIENT" && <ClientFilter selected={clientId} extra={status ? { status } : undefined} />}

      <nav className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
        <Link
          href={`/painel/conteudo${clientId && user.role !== "CLIENT" ? `?cliente=${clientId}` : ""}`}
          className={cn("shrink-0 rounded-full border px-3 py-1 text-xs", !status ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground")}
        >
          Todos
        </Link>
        {(Object.keys(POST_STATUS) as PostStatus[]).map((s) => (
          <Link
            key={s}
            href={`/painel/conteudo?status=${s}${clientId && user.role !== "CLIENT" ? `&cliente=${clientId}` : ""}`}
            className={cn("shrink-0 rounded-full border px-3 py-1 text-xs whitespace-nowrap", status === s ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground")}
          >
            {POST_STATUS[s].label} {status ? "" : counts[s] ? `(${counts[s]})` : ""}
          </Link>
        ))}
      </nav>

      {posts.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">Nenhum post por aqui.</div>
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {posts.map((p) => (
            <li key={p.id}>
              <Link href={`/painel/conteudo/${p.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/60">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Film className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{p.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {p.client.tradeName}
                    {p.channels.length ? ` · ${p.channels.map((c) => CHANNEL_LABEL[c]).join(", ")}` : " · sem canais"}
                    {p.scheduledAt && ["AGENDADO", "AGUARDANDO_APROVACAO"].includes(p.status) ? ` · ${when.format(p.scheduledAt)}` : ""}
                  </span>
                </span>
                <PostStatusBadge status={p.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
