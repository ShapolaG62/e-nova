import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { Globe, MapPin, Plus, Search, Sparkles } from "lucide-react";
import { desc, eq, ilike, or } from "drizzle-orm";
import { db, t } from "@/db";
import { requirePermission } from "@/lib/auth/session";
import { setor as pegarSetor } from "@/lib/sites/engine";
import { PageHeader, PageSkeleton } from "@/components/page";
import { MiniaturaSite } from "@/components/vendas/sites-ui";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const metadata: Metadata = { title: "Criador de sites" };

export default function Page(props: PageProps<"/painel/sites">) {
  return (
    <div className="grid grid-cols-1 gap-5">
      <PageHeader
        title="Meus sites"
        subtitle="Sites criados para os negócios que você está prospectando."
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/painel/visuais" className={buttonVariants({ variant: "outline", className: "h-10 sm:h-9" })}>
              Ver visuais
            </Link>
            <Link href="/painel/sites/novo" className={buttonVariants({ className: "h-10 sm:h-9" })}>
              <Plus /> Novo site
            </Link>
          </div>
        }
      />
      <Suspense fallback={<PageSkeleton />}>
        <Lista searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

const dataBR = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "America/Sao_Paulo" });

async function Lista({ searchParams }: { searchParams: PageProps<"/painel/sites">["searchParams"] }) {
  await requirePermission("sites:write");
  const { q: rawQ } = await searchParams;
  const q = typeof rawQ === "string" ? rawQ.trim().slice(0, 80) : "";
  const like = `%${q.replace(/[%_]/g, "\\$&")}%`;

  const rows = await db
    .select({
      id: t.generatedSites.id,
      name: t.generatedSites.name,
      sector: t.generatedSites.sector,
      published: t.generatedSites.published,
      slug: t.generatedSites.slug,
      createdAt: t.generatedSites.createdAt,
      city: t.prospects.city,
    })
    .from(t.generatedSites)
    .leftJoin(t.prospects, eq(t.prospects.id, t.generatedSites.prospectId))
    .where(q ? or(ilike(t.generatedSites.name, like), ilike(t.prospects.city, like), ilike(t.generatedSites.sector, like)) : undefined)
    .orderBy(desc(t.generatedSites.createdAt))
    .limit(120);

  return (
    <>
      <form className="flex flex-col gap-2 sm:flex-row" role="search">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" defaultValue={q} placeholder="Buscar por nome, cidade ou setor" className="h-10 pl-8 sm:h-9" />
        </div>
        <button className={buttonVariants({ variant: "outline", className: "h-10 sm:h-9" })}>Buscar</button>
      </form>

      {rows.length === 0 ? (
        q ? (
          <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">Nenhum site encontrado com essa busca.</div>
        ) : (
          <div className="grid justify-items-center gap-3 rounded-xl border border-dashed bg-card p-10 text-center">
            <span className="grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
              <Sparkles className="size-6" />
            </span>
            <p className="text-lg font-semibold">Nenhum site ainda</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Ache negócios sem site no Google e monte uma prévia em segundos para oferecer ao dono.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <Link href="/painel/prospeccao" className={buttonVariants({ className: "h-10" })}>
                <Search /> Buscar negócios sem site
              </Link>
              <Link href="/painel/sites/novo" className={buttonVariants({ variant: "outline", className: "h-10" })}>
                <Plus /> Criar à mão
              </Link>
            </div>
          </div>
        )
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((s) => {
            const st = pegarSetor(s.sector);
            return (
              <li key={s.id}>
                <Link
                  href={`/painel/sites/${s.id}`}
                  className="group block overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <div className="relative">
                    <MiniaturaSite src={`/api/vendas/sites/${s.id}/previa`} titulo={`Prévia de ${s.name}`} className="aspect-[16/10] border-b" />
                    <span
                      className={
                        "absolute top-2.5 left-2.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold shadow-sm " +
                        (s.published ? "bg-emerald-600 text-white" : "bg-card/95 text-foreground")
                      }
                    >
                      {s.published ? <Globe className="size-3" /> : null}
                      {s.published ? "No ar" : "Pronto"}
                    </span>
                  </div>
                  <div className="grid gap-1 p-3.5">
                    <p className="truncate font-semibold group-hover:text-primary">{s.name}</p>
                    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span>
                        {st.icone} {st.nome}
                      </span>
                      {s.city && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="size-3" /> {s.city}
                        </span>
                      )}
                      <span className="ml-auto">{dataBR.format(s.createdAt)}</span>
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

