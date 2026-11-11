import { Suspense } from "react";
import type { Metadata } from "next";
import { desc } from "drizzle-orm";
import { db, t } from "@/db";
import { requirePermission } from "@/lib/auth/session";
import { activeAi } from "@/lib/ai/client";
import { listaSetores, OBJECOES } from "@/lib/sites/engine";
import { PageHeader, PageSkeleton } from "@/components/page";
import { GeradorAbordagem } from "./gerador";

export const metadata: Metadata = { title: "Abordagem" };

export default function Page(props: PageProps<"/painel/abordagem">) {
  return (
    <div className="grid grid-cols-1 gap-5">
      <PageHeader
        title="Roteiro sem gerar site"
        subtitle="Mande a primeira mensagem antes de criar o site: assim você não gasta tempo com quem nunca responde."
      />
      <Suspense fallback={<PageSkeleton />}>
        <Conteudo searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function Conteudo({ searchParams }: { searchParams: PageProps<"/painel/abordagem">["searchParams"] }) {
  await requirePermission("prospects:read");
  const { lead } = await searchParams;
  const [linhas, ia] = await Promise.all([
    db
      .select({ id: t.prospects.id, nome: t.prospects.name, setor: t.prospects.sector, cidade: t.prospects.city, whatsapp: t.prospects.whatsapp })
      .from(t.prospects)
      .orderBy(desc(t.prospects.updatedAt))
      .limit(500),
    activeAi(),
  ]);
  const setores = listaSetores().map((s) => ({ id: s.id, nome: s.nome, icone: s.icone }));
  return (
    <GeradorAbordagem
      leads={linhas.map((l) => ({ ...l, cidade: l.cidade ?? "", whatsapp: l.whatsapp ?? "" }))}
      setores={setores}
      objecoes={OBJECOES}
      provedorIA={ia.nome}
      leadInicial={typeof lead === "string" ? lead : ""}
    />
  );
}
