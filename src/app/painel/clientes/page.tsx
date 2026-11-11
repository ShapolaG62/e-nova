import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { Plus, Search } from "lucide-react";
import { and, asc, count, eq, ilike, or } from "drizzle-orm";
import { db, t } from "@/db";
import { requirePermission } from "@/lib/auth/session";
import { PageHeader, PageSkeleton } from "@/components/page";
import { StatusBadge } from "@/components/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDocument } from "@/lib/validation";

export const metadata: Metadata = { title: "Clientes" };

export default function Page(props: PageProps<"/painel/clientes">) {
  return (
    <div className="grid grid-cols-1 gap-5">
      <PageHeader
        title="Clientes"
        subtitle="Estabelecimentos atendidos pela agência."
        action={
          <Link href="/painel/clientes/novo" className={buttonVariants({ className: "h-10 sm:h-9" })}>
            <Plus /> Novo cliente
          </Link>
        }
      />
      <Suspense fallback={<PageSkeleton />}>
        <ClientList searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function ClientList({ searchParams }: { searchParams: PageProps<"/painel/clientes">["searchParams"] }) {
  await requirePermission("clients:read");
  const { q: rawQ, status: rawStatus } = await searchParams;
  const q = typeof rawQ === "string" ? rawQ.trim().slice(0, 80) : "";
  const status = typeof rawStatus === "string" && ["ACTIVE", "TRIAL", "SUSPENDED_PAYMENT"].includes(rawStatus) ? rawStatus : "";

  const like = `%${q.replace(/[%_]/g, "\\$&")}%`;
  const digits = q.replace(/\D/g, "");
  const where = and(
    q ? or(ilike(t.clients.tradeName, like), ilike(t.clients.legalName, like), digits.length >= 3 ? ilike(t.clients.document, `%${digits}%`) : undefined) : undefined,
    status ? eq(t.clients.status, status as "ACTIVE" | "TRIAL" | "SUSPENDED_PAYMENT") : undefined,
  );

  const rows = await db
    .select({
      id: t.clients.id,
      tradeName: t.clients.tradeName,
      document: t.clients.document,
      niche: t.clients.niche,
      status: t.clients.status,
      trialEndsAt: t.clients.trialEndsAt,
      plates: count(t.plates.id),
    })
    .from(t.clients)
    .leftJoin(t.plates, eq(t.plates.clientId, t.clients.id))
    .where(where)
    .groupBy(t.clients.id)
    .orderBy(asc(t.clients.tradeName))
    .limit(200);

  return (
    <>
      <form className="flex flex-col gap-2 sm:flex-row" role="search">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" defaultValue={q} placeholder="Buscar por nome ou CNPJ/CPF" className="h-10 pl-8 sm:h-9" />
        </div>
        <select name="status" defaultValue={status} className="h-10 rounded-lg border border-input bg-transparent px-2.5 text-sm sm:h-9 sm:w-44">
          <option value="">Todos os status</option>
          <option value="ACTIVE">Ativos</option>
          <option value="TRIAL">Trial</option>
          <option value="SUSPENDED_PAYMENT">Suspensos</option>
        </select>
        <button className={buttonVariants({ variant: "outline", className: "h-10 sm:h-9" })}>Filtrar</button>
      </form>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          {q || status ? "Nenhum cliente encontrado com esse filtro." : "Nenhum cliente ainda. Cadastre o primeiro!"}
        </div>
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {rows.map((c) => (
            <li key={c.id}>
              <Link href={`/painel/clientes/${c.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/60">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{c.tradeName}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[c.niche, formatDocument(c.document)].filter((x) => x && x !== "—").join(" · ") || "Sem documento"}
                  </p>
                </div>
                <span className="hidden text-xs text-muted-foreground sm:inline">
                  {Number(c.plates)} {Number(c.plates) === 1 ? "plaquinha" : "plaquinhas"}
                </span>
                <StatusBadge status={c.status} trialEndsAt={c.trialEndsAt} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
