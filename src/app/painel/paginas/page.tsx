import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { LayoutTemplate } from "lucide-react";
import { desc, eq, sql } from "drizzle-orm";
import { db, t } from "@/db";
import { requirePermission, scopeClientId } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { createPageAction } from "@/app/actions/pages";
import { ActionForm, FormMessage, SubmitButton } from "@/components/action-form";
import { ClientSelect } from "@/components/client-filter";
import { Field } from "@/components/field";
import { Panel } from "@/components/charts";
import { PageHeader, PageSkeleton } from "@/components/page";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Páginas" };

export default function Page() {
  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader title="Páginas" subtitle="Páginas de link na bio, cardápio e campanhas para os clientes, com visitas e cliques contados." />
      <Suspense fallback={<PageSkeleton />}>
        <Pages />
      </Suspense>
    </div>
  );
}

async function Pages() {
  const user = await requirePermission("pages:read");
  const clientId = scopeClientId(user, null);
  const rows = await db
    .select({
      id: t.sitePages.id,
      title: t.sitePages.title,
      slug: t.sitePages.slug,
      status: t.sitePages.status,
      client: t.clients.tradeName,
      views: sql<number>`(select count(*) from page_views v where v.page_id = ${t.sitePages.id} and v.kind = 'view' and v.occurred_at > now() - interval '30 days')::int`,
      clicks: sql<number>`(select count(*) from page_views v where v.page_id = ${t.sitePages.id} and v.kind = 'click' and v.occurred_at > now() - interval '30 days')::int`,
    })
    .from(t.sitePages)
    .leftJoin(t.clients, eq(t.clients.id, t.sitePages.clientId))
    .where(clientId ? eq(t.sitePages.clientId, clientId) : undefined)
    .orderBy(desc(t.sitePages.updatedAt));

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
      {rows.length === 0 ? (
        <div className="grid place-items-center gap-3 rounded-2xl border border-dashed p-12 text-center">
          <LayoutTemplate className="size-8 text-muted-foreground" />
          <p className="max-w-xs text-sm text-muted-foreground">Nenhuma página ainda. Crie a primeira ao lado: ela já começa com título, WhatsApp e links.</p>
        </div>
      ) : (
        <ul className="grid content-start gap-3">
          {rows.map((p) => (
            <li key={p.id}>
              <Link href={`/painel/paginas/${p.id}`} className="flex items-center gap-4 rounded-2xl border bg-card p-4 hover:border-primary/40">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{p.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {p.client ?? "Agência"} · /p/{p.slug}
                  </span>
                </span>
                <span className="text-right">
                  <span className="num block text-lg font-semibold">{p.views}</span>
                  <span className="block text-[0.7rem] text-muted-foreground">visitas · {p.clicks} cliques</span>
                </span>
                <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", p.status === "PUBLICADA" ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground")}>
                  {p.status === "PUBLICADA" ? "No ar" : "Rascunho"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {can(user.role, "pages:write") && (
        <Panel title="Nova página" className="self-start">
          <ActionForm action={createPageAction} className="grid gap-3">
            <Field name="title" label="Título" placeholder="Cantina da Nona" />
            <Field name="slug" label="Endereço (opcional)" placeholder="cantina-da-nona" hint="Fica em /p/endereço. Vazio = gerado pelo título." />
            <Field name="clientId" label="Cliente">
              <ClientSelect emptyLabel="— Agência —" />
            </Field>
            <FormMessage />
            <SubmitButton className="h-10">Criar e editar</SubmitButton>
          </ActionForm>
        </Panel>
      )}
    </div>
  );
}
