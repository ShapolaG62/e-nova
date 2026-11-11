import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { asc, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { canAccessClient, requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { env } from "@/lib/env";
import { pageStats } from "@/lib/page-analytics";
import { deletePageAction, savePageAction, setPageStatusAction } from "@/app/actions/pages";
import { PageEditor } from "@/components/page-editor";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { CopyButton } from "@/components/copy-button";
import { DailyBars, DeviceSplit, Kpi, Panel } from "@/components/charts";
import { PageHeader, PageSkeleton } from "@/components/page";
import { Term } from "@/components/term";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Editar página" };

export default function Page(props: PageProps<"/painel/paginas/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Editor params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Editor({ params, searchParams }: { params: PageProps<"/painel/paginas/[id]">["params"]; searchParams: PageProps<"/painel/paginas/[id]">["searchParams"] }) {
  const user = await requirePermission("pages:read");
  const { id } = await params;
  const { aba } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const page = await db.query.sitePages.findFirst({ where: eq(t.sitePages.id, id) });
  if (!page || (page.clientId && !canAccessClient(user, page.clientId)) || (!page.clientId && user.role === "CLIENT")) notFound();

  const writer = can(user.role, "pages:write");
  const tab = !writer || aba === "dados" ? "dados" : "editar";
  const url = `${env.APP_URL}/p/${page.slug}`;

  return (
    <div className="grid grid-cols-1 gap-6">
      <Link href="/painel/paginas" className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Páginas
      </Link>
      <PageHeader
        title={page.title}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-2">
            {page.status === "PUBLICADA" ? (
              <a href={`/p/${page.slug}`} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-primary hover:underline">
                /p/{page.slug} <ExternalLink className="size-3.5" />
              </a>
            ) : (
              <span>/p/{page.slug} · rascunho, ainda fora do ar</span>
            )}
            {page.status === "PUBLICADA" && <CopyButton value={url} />}
          </span>
        }
        action={
          writer && (
            <form action={setPageStatusAction}>
              <input type="hidden" name="id" value={page.id} />
              <input type="hidden" name="publish" value={String(page.status !== "PUBLICADA")} />
              <button className={buttonVariants({ variant: page.status === "PUBLICADA" ? "outline" : "default", className: "h-10" })}>
                {page.status === "PUBLICADA" ? "Tirar do ar" : "Publicar"}
              </button>
            </form>
          )
        }
      />

      {writer && (
        <div className="flex gap-1 rounded-xl bg-muted p-1 sm:w-fit">
          {[
            ["editar", "Editar"],
            ["dados", "Visitas e cliques"],
          ].map(([k, label]) => (
            <Link key={k} href={`/painel/paginas/${id}?aba=${k}`} className={cn("flex-1 rounded-lg px-4 py-2 text-center text-sm sm:flex-none", tab === k ? "bg-card font-medium shadow-sm" : "text-muted-foreground")}>
              {label}
            </Link>
          ))}
        </div>
      )}

      {tab === "editar" ? <EditorTab page={page} /> : <StatsTab page={page} />}

      {writer && (
        <form action={deletePageAction} className="mb-16 text-right">
          <input type="hidden" name="id" value={page.id} />
          <ConfirmSubmit message="Excluir esta página e as estatísticas dela?" className="text-xs text-destructive hover:underline">
            Excluir página
          </ConfirmSubmit>
        </form>
      )}
    </div>
  );
}

async function EditorTab({ page }: { page: typeof t.sitePages.$inferSelect }) {
  const plates = page.clientId
    ? await db.select({ slug: t.plates.slug, label: t.plates.label }).from(t.plates).where(eq(t.plates.clientId, page.clientId)).orderBy(asc(t.plates.label))
    : [];
  return (
    <PageEditor
      initial={{ title: page.title, description: page.description ?? undefined, theme: page.theme, blocks: page.blocks }}
      save={savePageAction.bind(null, page.id)}
      plates={plates}
    />
  );
}

function blockLabel(page: typeof t.sitePages.$inferSelect, key: string | null) {
  if (!key) return "—";
  const [bid, item] = key.split(":");
  const b = page.blocks.find((x) => x.id === bid);
  if (!b) return "Bloco removido";
  if (b.type === "links") return b.items.find((i) => i.id === item)?.label ?? "Link removido";
  if (b.type === "button") return b.label;
  if (b.type === "whatsapp") return b.label || "WhatsApp";
  if (b.type === "review") return b.label || "Avaliação";
  return b.type;
}

async function StatsTab({ page }: { page: typeof t.sitePages.$inferSelect }) {
  const s = await pageStats(page.id, 30);
  const ctr = s.views ? Math.round((s.clicks / s.views) * 1000) / 10 : 0;
  const clicks = [...s.clickList].sort((a, b) => b.total - a.total);
  return (
    <div className="grid grid-cols-1 gap-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi featured className="col-span-2" label="Visitas nos últimos 30 dias" value={s.views.toLocaleString("pt-BR")} hint={`${s.visitors} visitantes únicos por dia somados`} />
        <Kpi label="Cliques" value={s.clicks} />
        <Kpi label={<Term k="CTR" />} value={`${ctr.toString().replace(".", ",")}%`} hint="cliques ÷ visitas" />
      </div>
      <Panel title="Visitas por dia">
        <DailyBars data={s.series} />
      </Panel>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Panel title="Botões mais clicados">
          {clicks.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum clique ainda.</p>
          ) : (
            <ul className="grid gap-2">
              {clicks.map((c) => (
                <li key={c.blockId} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate">{blockLabel(page, c.blockId)}</span>
                  <span className="num font-semibold">{c.total}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="De onde vieram">
          {s.sources.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem visitas ainda.</p>
          ) : (
            <ul className="grid gap-2">
              {s.sources.map((r) => (
                <li key={r.source} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate">{r.source}</span>
                  <span className="num font-semibold">{r.total}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-muted-foreground">Dica: use ?utm_source=instagram no link da bio para separar a origem.</p>
        </Panel>
        <Panel title="Aparelhos">
          <DeviceSplit data={s.devices} />
        </Panel>
      </div>
    </div>
  );
}
