import { Suspense } from "react";
import type { Metadata } from "next";
import { and, eq, gte, sql } from "drizzle-orm";
import { db, t } from "@/db";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { PESOS_PADRAO, perfil, type Area } from "@/lib/aprendizado";
import { PageHeader, PageSkeleton } from "@/components/page";
import { PainelArea } from "./painel-area";

export const metadata: Metadata = { title: "Aprendizado" };

export default function Page() {
  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader
        title="Aprendizado"
        subtitle="A cada corte e a cada vídeo, a ferramenta guarda o que a equipe aprovou, publicou, editou ou descartou e transforma isso em lições. As lições entram no pedido da IA na próxima vez."
      />
      <Suspense fallback={<PageSkeleton />}>
        <Conteudo />
      </Suspense>
    </div>
  );
}

async function Conteudo() {
  const me = await requirePermission("ai:use");
  const areas: Area[] = ["cortes", "videos"];
  const dados = await Promise.all(areas.map(async (area) => {
    const [p, contagem] = await Promise.all([
      perfil(area),
      db.select({ sinal: t.aprendizadoEventos.sinal, n: sql<number>`count(*)::int` }).from(t.aprendizadoEventos)
        .where(and(eq(t.aprendizadoEventos.area, area), gte(t.aprendizadoEventos.createdAt, sql`now() - interval '30 days'`))).groupBy(t.aprendizadoEventos.sinal),
    ]);
    return { area, perfil: p, sinais: Object.fromEntries(contagem.map((c) => [c.sinal, c.n])) as Record<string, number> };
  }));
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      {dados.map((d) => (
        <PainelArea key={d.area} area={d.area} perfil={d.perfil} sinais={d.sinais} padrao={PESOS_PADRAO} podeEditar={can(me.role, "system:view")} />
      ))}
    </div>
  );
}
