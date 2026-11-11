import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requirePermission } from "@/lib/auth/session";
import { listaLayouts, setor, TEMAS, type SiteDoc } from "@/lib/sites/engine";
import { EditorSite } from "@/components/vendas/editor-site";

export const metadata: Metadata = { title: "Editar site" };

export default function Page(props: PageProps<"/painel/sites/[id]/editor">) {
  return (
    <Suspense
      fallback={
        <div className="grid animate-pulse gap-3" aria-busy="true">
          <div className="h-10 w-64 rounded-lg bg-muted" />
          <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
            <div className="h-[70dvh] rounded-2xl bg-muted" />
            <div className="hidden h-[70dvh] rounded-2xl bg-muted lg:block" />
          </div>
        </div>
      }
    >
      <Editor params={props.params} />
    </Suspense>
  );
}

async function Editor({ params }: { params: PageProps<"/painel/sites/[id]/editor">["params"] }) {
  await requirePermission("sites:write");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const site = await db.query.generatedSites.findFirst({ where: eq(t.generatedSites.id, id) });
  if (!site || !Array.isArray((site.doc as { blocos?: unknown }).blocos)) notFound();
  const doc = site.doc as unknown as SiteDoc;

  return (
    <EditorSite
      siteId={site.id}
      nome={site.name}
      inicial={doc}
      layouts={listaLayouts()}
      coresSetor={setor(doc.setor || site.sector).cores}
      temas={TEMAS}
    />
  );
}
