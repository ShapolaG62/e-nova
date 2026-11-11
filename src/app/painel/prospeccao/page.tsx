import { Suspense } from "react";
import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { statusGoogle } from "@/lib/sites/config";
import { PageHeader, PageSkeleton } from "@/components/page";
import { listaLayouts, listaSetores, PAISES } from "@/lib/sites/engine";
import { activeAi } from "@/lib/ai/client";
import { Prospeccao } from "./prospeccao";

export const metadata: Metadata = { title: "Prospecção" };

export default function Page() {
  return (
    <div className="grid grid-cols-1 gap-5">
      <PageHeader
        title="Prospecção"
        subtitle="Encontre quem ainda não tem site. Escolha o ramo e a cidade: a lista volta ordenada por oportunidade, quem mais precisa aparece primeiro."
      />
      <Suspense fallback={<PageSkeleton />}>
        <Conteudo />
      </Suspense>
    </div>
  );
}

async function Conteudo() {
  const user = await requirePermission("prospects:read");
  const setores = listaSetores();
  const layouts = listaLayouts();
  const paises = Object.fromEntries(Object.entries(PAISES).map(([k, v]) => [k, { nome: v.nome }]));
  const [ia, google] = await Promise.all([activeAi(), statusGoogle()]);
  return (
    <Prospeccao
      setores={setores}
      layouts={layouts}
      paises={paises}
      iaRapida={ia.rapida}
      google={{ estado: google.estado, erro: google.teste && !google.teste.ok ? (google.teste.titulo ?? null) : null }}
      podeConfigurar={can(user.role, "vendas:config")}
    />
  );
}
