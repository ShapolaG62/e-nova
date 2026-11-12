import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { ExternalLink, Sparkles } from "lucide-react";
import { requirePermission } from "@/lib/auth/session";
import { listaLayouts, listaPaletas, listaSetores } from "@/lib/sites/engine";
import { PageHeader, PageSkeleton } from "@/components/page";
import { MiniaturaSite } from "@/components/vendas/sites-ui";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = { title: "Visuais de site" };

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Galeria />
    </Suspense>
  );
}

async function Galeria() {
  await requirePermission("sites:write");
  const layouts = listaLayouts();
  const paletas = listaPaletas();
  const setores = new Map(listaSetores().map((s) => [s.id, s]));

  return (
    <div className="grid grid-cols-1 gap-5">
      <PageHeader
        title="Visuais de site"
        subtitle={`${layouts.length} visuais prontos. Todos funcionam com qualquer cor, com ou sem fotos. Passe o mouse para ver a página inteira.`}
        action={
          <Link href="/painel/sites/novo" className={buttonVariants({ className: "h-10 sm:h-9" })}>
            <Sparkles /> Criar site
          </Link>
        }
      />
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {layouts.map((l) => {
          const chips = l.setores.map((id) => setores.get(id)).filter((s): s is NonNullable<typeof s> => !!s);
          return (
            <li key={l.id} className="group flex flex-col overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-md">
              <MiniaturaSite src={`/api/vendas/amostra/${l.id}`} titulo={`Amostra do visual ${l.nome}`} rolarAoPassar className="aspect-[4/5] border-b sm:aspect-[3/4]" />
              <div className="flex flex-1 flex-col gap-2 p-4">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-lg font-semibold">{l.nome}</h2>
                  <span
                    className={
                      "rounded-full px-2 py-0.5 text-xs font-medium " +
                      (l.escuro ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900" : "border bg-background text-foreground")
                    }
                  >
                    {l.escuro ? "Escuro" : "Claro"}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{l.descricao}</p>
                {chips.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {chips.slice(0, 5).map((s) => (
                      <span key={s.id} className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        {s.icone} {s.nome}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-auto flex gap-2 pt-2">
                  <Link href="/painel/sites/novo" className={buttonVariants({ className: "h-10 flex-1 sm:h-9" })}>
                    <Sparkles /> Criar site
                  </Link>
                  <a
                    href={`/api/vendas/amostra/${l.id}`}
                    target="_blank"
                    rel="noopener"
                    aria-label={`Abrir amostra do visual ${l.nome} em nova aba`}
                    className={buttonVariants({ variant: "outline", size: "icon", className: "size-10 sm:size-9" })}
                  >
                    <ExternalLink />
                  </a>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <section aria-labelledby="paletas" className="grid gap-3 pt-2">
        <div className="grid gap-1">
          <h2 id="paletas" className="text-xl font-semibold">Paletas prontas</h2>
          <p className="text-sm text-muted-foreground">Cada paleta troca de uma vez as cores, o fundo e as fontes de qualquer visual. Escolha no editor do site, em “Paletas prontas”.</p>
        </div>
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {paletas.map((p, i) => {
            // cada paleta aparece num visual diferente, para mostrar que combinam com todos
            const visual = layouts[i % layouts.length].id;
            return (
              <li key={p.id} className="flex flex-col overflow-hidden rounded-xl border bg-card">
                <MiniaturaSite src={`/api/vendas/amostra/${visual}?paleta=${p.id}`} titulo={`Amostra da paleta ${p.nome}`} rolarAoPassar className="aspect-[4/5] border-b" />
                <div className="grid gap-1 p-3">
                  <div className="flex items-center gap-1.5">
                    <span className="size-3.5 rounded-full ring-1 ring-black/10" style={{ background: p.cores[0] }} />
                    <span className="size-3.5 rounded-full ring-1 ring-black/10" style={{ background: p.cores[1] }} />
                    <span className="size-3.5 rounded-full ring-1 ring-black/10" style={{ background: p.fundo.bg }} />
                    <h3 className="ml-1 truncate text-sm font-semibold">{p.nome}</h3>
                  </div>
                  <p className="text-xs text-muted-foreground">{p.clima}. Títulos em {p.fonte}.</p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
