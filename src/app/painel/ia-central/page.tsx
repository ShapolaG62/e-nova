import { Suspense } from "react";
import type { Metadata } from "next";
import { desc } from "drizzle-orm";
import { db, t } from "@/db";
import { requirePermission } from "@/lib/auth/session";
import { PageHeader, PageSkeleton } from "@/components/page";
import { CREDENCIAIS } from "@/lib/ia-hub/catalogo";
import { chavesLista, chavesMascaradas, credenciaisConfiguradas, preferencias } from "@/lib/ia-hub/config";
import { estadoSaude } from "@/lib/ia-hub/roteador";
import { CentralIA, type ExecucaoView } from "./central-ia";

export const metadata: Metadata = { title: "Central de IA" };

export default function Page() {
  return (
    <div className="grid grid-cols-1 gap-5">
      <PageHeader
        title="Central de IA"
        subtitle="Cada função tem uma fila de IAs: a melhor com chave trabalha primeiro; se falhar, ficar sem crédito ou cair, a próxima assume sozinha. A IA local fica por último como reserva grátis."
      />
      <Suspense fallback={<PageSkeleton />}>
        <Central />
      </Suspense>
    </div>
  );
}

const mascarar = (v: string) => (v ? "••••" + v.slice(-4) : "");

async function Central() {
  await requirePermission("system:view");
  const [prefs, configuradas, execs, listas] = await Promise.all([
    preferencias(),
    credenciaisConfiguradas(),
    db.select().from(t.iaExecucoes).orderBy(desc(t.iaExecucoes.createdAt)).limit(50),
    chavesMascaradas(),
  ]);

  // valores dos campos já salvos: segredos só com os 4 últimos caracteres
  const campos: Record<string, Record<string, string>> = {};
  await Promise.all(
    CREDENCIAIS.filter((c) => configuradas[c.id] && c.campos.length).map(async (c) => {
      const v = (await chavesLista(c.id))[0] ?? {};
      campos[c.id] = Object.fromEntries(c.campos.map((f) => [f.id, f.segredo ? mascarar(v[f.id] ?? "") : (v[f.id] ?? "")]));
    }),
  );

  const execucoes: ExecucaoView[] = execs.map((e) => ({ id: e.id, capacidade: e.capacidade, ok: e.ok, tentativas: e.tentativas, criadoEm: e.createdAt.toISOString() }));

  return <CentralIA prefs={prefs} configuradas={configuradas} campos={campos} listas={listas} saude={estadoSaude()} execucoes={execucoes} />;
}
