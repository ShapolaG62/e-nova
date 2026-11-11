import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { ExternalLink, Sparkles } from "lucide-react";
import { requirePermission } from "@/lib/auth/session";
import { listaLayouts, listaSetores } from "@/lib/sites/engine";
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
    </div>
  );
}
