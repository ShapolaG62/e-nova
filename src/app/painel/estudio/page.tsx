import { Suspense } from "react";
import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { PageHeader, PageSkeleton } from "@/components/page";
import { candidatos } from "@/lib/ia-hub/roteador";
import { CAPACIDADES, type Capacidade } from "@/lib/ia-hub/tipos";
import { listarTarefasAction } from "@/app/actions/ia-hub";
import { Estudio, type OpcoesCap } from "./estudio";

export const metadata: Metadata = { title: "Estúdio de mídia" };

export default function Page(props: PageProps<"/painel/estudio">) {
  return (
    <div className="grid grid-cols-1 gap-5">
      <PageHeader
        title="Estúdio de mídia"
        subtitle="Imagens, vídeos, vozes, transcrições e mais. Você descreve, a Central de IA escolhe quem faz e troca sozinha se alguma falhar."
      />
      <Suspense fallback={<PageSkeleton />}>
        <Conteudo searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function Conteudo({ searchParams }: { searchParams: PageProps<"/painel/estudio">["searchParams"] }) {
  const me = await requirePermission("ai:use");
  const { aba } = await searchParams;

  const opcoes = {} as Record<Capacidade, OpcoesCap>;
  await Promise.all(
    CAPACIDADES.map(async (c) => {
      const lista = await candidatos(c.id);
      const itens: OpcoesCap["itens"] = [];
      for (const x of lista) {
        const ja = itens.find((i) => i.id === x.item.id);
        if (ja) ja.temChave ||= x.temChave;
        else itens.push({ id: x.item.id, nome: x.item.nome, temChave: x.temChave });
      }
      opcoes[c.id] = { itens, pronta: itens.some((i) => i.temChave) };
    }),
  );

  const tarefas = await listarTarefasAction(80);

  return <Estudio abaInicial={typeof aba === "string" ? aba : undefined} opcoes={opcoes} tarefasIniciais={tarefas} podeConfigurar={can(me.role, "system:view")} />;
}
