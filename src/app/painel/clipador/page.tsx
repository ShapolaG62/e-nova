import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { asc, desc, eq, sql } from "drizzle-orm";
import { ChevronRight, Plus, Repeat2 } from "lucide-react";
import { db, t } from "@/db";
import { requirePermission } from "@/lib/auth/session";
import { PageHeader, PageSkeleton } from "@/components/page";
import { quando, SeloPlataforma } from "./comum";

export const metadata: Metadata = { title: "Clipador" };

export default function Page() {
  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader title="Clipador" subtitle="Seus clientes e os perfis do YouTube, TikTok e Instagram que você vigia para repostar com a sua marca d'água." />
      <Suspense fallback={<PageSkeleton />}>
        <Lista />
      </Suspense>
    </div>
  );
}

async function Lista() {
  await requirePermission("content:write");
  const perfis = await db
    .select({
      id: t.canaisVigiados.id, nome: t.canaisVigiados.nome, plataforma: t.canaisVigiados.plataforma, ativo: t.canaisVigiados.ativo, erro: t.canaisVigiados.erro,
      verificadoEm: t.canaisVigiados.verificadoEm, temMarca: sql<boolean>`(${t.canaisVigiados.marca} ->> 'chave') is not null`,
      clienteId: t.clients.id, cliente: t.clients.tradeName,
      postados: sql<number>`count(*) filter (where ${t.videosVigiados.status} = 'POSTADO')::int`,
      fila: sql<number>`count(*) filter (where ${t.videosVigiados.status} in ('NOVO','BAIXANDO','POSTANDO'))::int`,
      revisar: sql<number>`count(*) filter (where ${t.videosVigiados.status} = 'PRONTO')::int`,
      falhas: sql<number>`count(*) filter (where ${t.videosVigiados.status} = 'FALHOU')::int`,
    })
    .from(t.canaisVigiados)
    .innerJoin(t.clients, eq(t.clients.id, t.canaisVigiados.clientId))
    .leftJoin(t.videosVigiados, eq(t.videosVigiados.canalId, t.canaisVigiados.id))
    .groupBy(t.canaisVigiados.id, t.clients.id)
    .orderBy(asc(t.clients.tradeName), desc(t.canaisVigiados.createdAt));

  const clientes = [...new Map(perfis.map((p) => [p.clienteId, p.cliente])).entries()];

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{perfis.length} {perfis.length === 1 ? "perfil vigiado" : "perfis vigiados"} · verificados a cada 10 minutos</p>
        <Link href="/painel/clipador/novo" className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 sm:h-10 sm:w-auto">
          <Plus className="size-4" aria-hidden /> Vigiar novo perfil
        </Link>
      </div>

      {perfis.length === 0 && (
        <div className="grid place-items-center gap-2 rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          <Repeat2 className="size-8" aria-hidden /> Nenhum perfil ainda. Toque em “Vigiar novo perfil”.
        </div>
      )}

      {clientes.map(([id, nome]) => (
        <section key={id} aria-labelledby={`cli-${id}`} className="grid gap-2">
          <h2 id={`cli-${id}`} className="text-base font-semibold">{nome}</h2>
          <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {perfis.filter((p) => p.clienteId === id).map((p) => (
              <li key={p.id}>
                <Link href={`/painel/clipador/${p.id}`} className="flex items-center gap-3 rounded-2xl border bg-card p-3 hover:bg-muted/50">
                  <div className="grid min-w-0 flex-1 gap-1.5">
                    <div className="flex min-w-0 items-center gap-2">
                      <SeloPlataforma p={p.plataforma} />
                      <span className="truncate text-sm font-semibold">{p.nome}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 text-xs">
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-emerald-600 dark:text-emerald-400">{p.postados} postados</span>
                      {p.fila > 0 && <span className="rounded-full bg-signal/15 px-2 py-0.5">{p.fila} na fila</span>}
                      {p.revisar > 0 && <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-sky-700 dark:text-sky-300">{p.revisar} para revisar</span>}
                      {p.falhas > 0 && <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-destructive">{p.falhas} falharam</span>}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {p.ativo ? "Vigiando" : "Pausado"}{p.verificadoEm ? ` · verificado ${quando.format(p.verificadoEm)}` : " · primeira verificação na fila"}
                      {!p.temMarca && " · sem marca d'água"}
                    </p>
                    {p.erro && <p className="line-clamp-2 text-xs text-destructive">{p.erro}</p>}
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
