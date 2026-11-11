import { Suspense } from "react";
import type { Metadata } from "next";
import { desc, eq, isNull } from "drizzle-orm";
import { db, t } from "@/db";
import { requirePermission } from "@/lib/auth/session";
import { listaLayouts, listaSetores, TONS } from "@/lib/sites/engine";
import { prospectParaLead } from "@/lib/sites/service";
import { activeAi } from "@/lib/ai/client";
import { PageSkeleton } from "@/components/page";
import { NovoSiteWizard } from "./wizard";

export const metadata: Metadata = { title: "Novo site" };

export default function Page(props: PageProps<"/painel/sites/novo">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Carregar searchParams={props.searchParams} />
    </Suspense>
  );
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function Carregar({ searchParams }: { searchParams: PageProps<"/painel/sites/novo">["searchParams"] }) {
  await requirePermission("sites:write");
  const sp = await searchParams;
  const setores = listaSetores();
  const setorParam = typeof sp.setor === "string" && setores.some((s) => s.id === sp.setor) ? sp.setor : "";

  let leadInicial: ReturnType<typeof prospectParaLead> | null = null;
  if (typeof sp.prospect === "string" && UUID.test(sp.prospect)) {
    const p = await db.query.prospects.findFirst({ where: eq(t.prospects.id, sp.prospect) });
    if (p) leadInicial = prospectParaLead(p);
  }

  // Negócios do funil que ainda não têm site
  const semSite = await db
    .select({ p: t.prospects })
    .from(t.prospects)
    .leftJoin(t.generatedSites, eq(t.generatedSites.prospectId, t.prospects.id))
    .where(isNull(t.generatedSites.id))
    .orderBy(desc(t.prospects.opportunity), desc(t.prospects.createdAt))
    .limit(60);

  const ai = await activeAi();

  return (
    <NovoSiteWizard
      setores={setores}
      layouts={listaLayouts()}
      tons={TONS}
      funil={semSite.map((r) => prospectParaLead(r.p))}
      leadInicial={leadInicial}
      setorInicial={setorParam}
      iaRapida={ai.provider !== "ollama"}
    />
  );
}
