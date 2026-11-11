import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requirePermission } from "@/lib/auth/session";
import { listaLayouts, setor as pegarSetor, slugSite, type SiteDoc } from "@/lib/sites/engine";
import { baseSites } from "@/lib/sites/config";
import { PageSkeleton } from "@/components/page";
import { ProjetoView } from "./projeto-view";

export const metadata: Metadata = { title: "Site" };

export default function Page(props: PageProps<"/painel/sites/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Projeto params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function contar(doc: SiteDoc) {
  const blocos = (doc.blocos ?? []).filter((b) => b.visivel !== false);
  const txt = JSON.stringify(blocos.map((b) => b.dados));
  const palavras = txt.replace(/"[a-zA-Z]+":/g, " ").replace(/[^\p{L}\s]/gu, " ").split(/\s+/).filter((w) => w.length > 1).length;
  const imagens = doc.fotos?.lista?.length ?? 0;
  const itens = (blocos.find((b) => b.tipo === "servicos")?.dados?.itens as unknown[] | undefined)?.length ?? 0;
  return { palavras, imagens, itens };
}

async function Projeto({ params, searchParams }: { params: PageProps<"/painel/sites/[id]">["params"]; searchParams: PageProps<"/painel/sites/[id]">["searchParams"] }) {
  await requirePermission("sites:write");
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const site = await db.query.generatedSites.findFirst({ where: eq(t.generatedSites.id, id) });
  if (!site) notFound();

  const doc = site.doc as unknown as SiteDoc;
  const layoutsInfo = listaLayouts();
  const visuais = site.layouts.length ? site.layouts : [doc.layout];
  const atual = Math.min(site.layoutIndex, visuais.length - 1);
  const nomeVisual = layoutsInfo.find((l) => l.id === (doc.layout ?? visuais[atual]))?.nome ?? doc.layout;
  const temExemplos = (doc.blocos ?? []).some((b) => b.visivel !== false && ((b.dados?.itens as any[]) ?? []).some((i) => i?.exemplo));
  const base = `${await baseSites()}/s/`;
  const local = /\/\/(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)(:|\/)/i.test(base);
  const st = pegarSetor(site.sector);

  return (
    <ProjetoView
      site={{
        id: site.id,
        nome: site.name,
        published: site.published,
        slug: site.slug,
        prospectId: site.prospectId,
        aiNotice: site.aiNotice,
        setor: `${st.icone} ${st.nome}`,
      }}
      stats={contar(doc)}
      temExemplos={temExemplos}
      visual={{ atual, total: visuais.length, nome: nomeVisual }}
      base={base}
      local={local}
      sugestaoSlug={site.slug || slugSite(site.name).slice(0, 50)}
      abrirPublicar={sp.publicar !== undefined}
    />
  );
}
