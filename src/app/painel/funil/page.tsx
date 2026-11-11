import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { Search } from "lucide-react";
import { desc, eq } from "drizzle-orm";
import { db, t } from "@/db";
import type { Prospect } from "@/db/schema";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { dadosHoje } from "@/lib/sites/service";
import { OBJECOES, setor } from "@/lib/sites/engine";
import { PageHeader, PageSkeleton } from "@/components/page";
import { buttonVariants } from "@/components/ui/button";
import { FunilApp } from "@/components/vendas/funil-app";
import type { DadosHoje, LeadFunil } from "@/components/vendas/funil-tipos";

export const metadata: Metadata = { title: "Funil de vendas" };

export default function Page(props: PageProps<"/painel/funil">) {
  return (
    <div className="grid grid-cols-1 gap-5">
      <PageHeader
        title="Funil de vendas"
        subtitle="Quem espera uma mensagem sua, em que etapa está cada negócio e o histórico de tudo."
        action={
          <Link href="/painel/prospeccao" className={buttonVariants({ variant: "outline", className: "h-10 sm:h-9" })}>
            <Search /> Buscar mais negócios
          </Link>
        }
      />
      <Suspense fallback={<PageSkeleton />}>
        <Funil searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

function paraLead(p: Prospect, site: LeadFunil["site"]): LeadFunil {
  const st = setor(p.sector);
  return {
    id: p.id, nome: p.name, setor: p.sector, setorNome: st.nome, setorIcone: st.icone,
    cidade: p.city ?? "", uf: p.uf ?? "", endereco: p.address ?? "", mapa: p.mapsUrl ?? "",
    telefone: p.phone ?? "", whatsapp: p.whatsapp ?? "", instagram: p.instagram ?? "",
    nota: p.rating, avaliacoes: p.reviewsCount, etapa: p.stage, proximoContato: p.nextContactAt ?? "",
    propostaCents: p.proposalCents, notas: p.notes ?? "", clienteId: p.clientId, historico: p.history ?? [], site,
  };
}

async function Funil({ searchParams }: { searchParams: PageProps<"/painel/funil">["searchParams"] }) {
  const user = await requirePermission("prospects:read");
  const { aba, lead } = await searchParams;

  const [hoje, linhas] = await Promise.all([
    dadosHoje(),
    db
      .select({ p: t.prospects, siteId: t.generatedSites.id, publicado: t.generatedSites.published })
      .from(t.prospects)
      .leftJoin(t.generatedSites, eq(t.generatedSites.prospectId, t.prospects.id))
      .orderBy(desc(t.prospects.updatedAt), desc(t.generatedSites.createdAt))
      .limit(800),
  ]);

  const vistos = new Set<string>();
  const leads: LeadFunil[] = [];
  for (const l of linhas) {
    if (vistos.has(l.p.id)) continue;
    vistos.add(l.p.id);
    leads.push(paraLead(l.p, l.siteId ? { id: l.siteId, publicado: !!l.publicado } : null));
  }
  const porId = new Map(leads.map((l) => [l.id, l]));
  const doLead = (p: Prospect) => porId.get(p.id) ?? paraLead(p, null);

  const dados: DadosHoje = {
    meta: hoje.meta,
    feitos: hoje.feitos,
    esperando: hoje.esperando,
    prontos: hoje.prontos.map((x) => ({
      lead: { ...paraLead(x.prospect, null), site: { id: x.site.id, publicado: x.site.published, link: x.site.link, capa: x.site.capa } },
      mensagem: x.mensagem,
    })),
    followups: hoje.followups.map(doLead),
    semSite: hoje.semSite.map(doLead),
    visitas: hoje.visitas,
  };

  return (
    <FunilApp
      hoje={dados}
      leads={leads}
      objecoes={OBJECOES}
      abaInicial={aba === "leads" ? "leads" : "hoje"}
      leadInicial={typeof lead === "string" && /^[0-9a-f-]{36}$/i.test(lead) ? lead : null}
      podeEditar={can(user.role, "prospects:write")}
      podeConverter={can(user.role, "contracts:write")}
    />
  );
}
