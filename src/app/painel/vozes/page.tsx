import { Suspense } from "react";
import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { chavesLista } from "@/lib/ia-hub/config";
import { TEXTO_CONSENTIMENTO, TEXTO_LEITURA, vozLocalInstalada } from "@/lib/voz";
import { PageHeader, PageSkeleton } from "@/components/page";
import { MinhaVoz } from "./minha-voz";

export const metadata: Metadata = { title: "Minha voz" };

export default function Page() {
  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader
        title="Minha voz"
        subtitle="Grave de 30 a 60 segundos lendo o texto (ou envie um áudio) e o E-Nova aprende a sua voz para narrar vídeos e áudios."
      />
      <Suspense fallback={<PageSkeleton />}>
        <Conteudo />
      </Suspense>
    </div>
  );
}

async function Conteudo() {
  const me = await requirePermission("ai:use");
  const [lista, cartesia] = await Promise.all([
    db.select().from(t.vozes).where(can(me.role, "system:view") ? undefined : eq(t.vozes.userId, me.id)).orderBy(desc(t.vozes.createdAt)),
    chavesLista("cartesia"),
  ]);
  return (
    <MinhaVoz
      textoLeitura={TEXTO_LEITURA}
      textoConsentimento={TEXTO_CONSENTIMENTO}
      temCartesia={cartesia.length > 0}
      temLocal={vozLocalInstalada()}
      podeConfigurar={can(me.role, "system:view")}
      vozes={lista.map((v) => ({ id: v.id, nome: v.nome, status: v.status, duracao: v.duracao, cartesia: !!v.cartesiaId, erro: v.cartesiaErro, criadaEm: v.createdAt.toISOString() }))}
    />
  );
}
