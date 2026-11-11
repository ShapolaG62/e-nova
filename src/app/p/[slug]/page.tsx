import { Suspense } from "react";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { after, connection } from "next/server";
import type { Metadata } from "next";
import { and, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { PageRenderer } from "@/components/page-renderer";
import { recordPageEvent } from "@/lib/page-analytics";

const SLUG = /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/;

async function load(slug: string) {
  if (!SLUG.test(slug)) return null;
  return db.query.sitePages.findFirst({ where: and(eq(t.sitePages.slug, slug), eq(t.sitePages.status, "PUBLICADA")) });
}

export async function generateMetadata(props: PageProps<"/p/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const page = await load(slug);
  if (!page) return { title: "Página não encontrada" };
  return { title: { absolute: page.title }, description: page.description ?? undefined, openGraph: { title: page.title, description: page.description ?? undefined } };
}

async function PublicPage({ params, searchParams }: PageProps<"/p/[slug]">) {
  await connection();
  const { slug } = await params;
  const sp = await searchParams;
  const page = await load(slug);
  if (!page) notFound();

  // Conta a visita depois de responder (não atrasa a página)
  const h = new Headers(await headers());
  const utm = typeof sp.utm_source === "string" ? sp.utm_source : null;
  after(() => recordPageEvent(page.id, h, "view", { utm }).catch((e) => console.error("[p] visita", e)));

  return (
    <PageRenderer
      title={page.title}
      theme={page.theme}
      blocks={page.blocks}
      linkFor={(blockId, _url, itemId) => `/p/${slug}/ir/${blockId}${itemId ? `?item=${itemId}` : ""}`}
    />
  );
}

export default function Page(props: PageProps<"/p/[slug]">) {
  return (
    <main className="marca-enova min-h-dvh">
      <Suspense fallback={<div className="min-h-dvh" />}>
        <PublicPage {...props} />
      </Suspense>
    </main>
  );
}
