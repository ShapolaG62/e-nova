import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import { decide, getPlateRoute, googleReviewUrl, SLUG_RE } from "@/lib/nfc/resolve";
import { features } from "@/lib/env";
import { ReviewAssistant } from "@/components/review-assistant";

export const metadata: Metadata = { title: "Deixe sua avaliação", robots: { index: false } };

const DEFAULT_TAGS =["Atendimento ágil", "Equipe simpática", "Ambiente aconchegante", "Bom custo-benefício", "Qualidade excelente", "Limpeza impecável", "Voltaria com certeza"];

async function Assistant({ params }: { params: PageProps<"/avaliar/[slug]">["params"] }) {
  await connection(); // status do cliente muda a qualquer momento: sempre por requisição
  const { slug: raw } = await params;
  const slug = raw.toLowerCase();
  if (!SLUG_RE.test(slug)) notFound();
  const route = await getPlateRoute(slug);
  if (!route) notFound();
  const d = decide(route);
  if (d.kind === "blocked") redirect(`/indisponivel/${slug}?motivo=${d.outcome.toLowerCase()}`);

  const client = await db.query.clients.findFirst({
    where: eq(t.clients.id, route.clientId),
    columns: { tradeName: true, logoUrl: true, reviewTags: true, googlePlaceId: true },
  });
  if (!client?.googlePlaceId) notFound();

  return (
    <ReviewAssistant
      slug={slug}
      business={client.tradeName}
      logoUrl={client.logoUrl}
      tags={client.reviewTags.length ? client.reviewTags : DEFAULT_TAGS}
      googleUrl={googleReviewUrl(client.googlePlaceId)}
      aiEnabled={features.ai}
    />
  );
}

export default function Page(props: PageProps<"/avaliar/[slug]">) {
  return (
    <main className="marca-enova min-h-dvh bg-gradient-to-b from-primary/10 to-background px-4 py-8">
      <div className="mx-auto w-full max-w-md">
        <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-muted" />}>
          <Assistant params={props.params} />
        </Suspense>
      </div>
    </main>
  );
}
