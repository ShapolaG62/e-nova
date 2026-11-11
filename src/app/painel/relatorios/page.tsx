import { Suspense } from "react";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { db, t } from "@/db";
import { requirePermission } from "@/lib/auth/session";
import { currentMonth, monthLabel } from "@/lib/reports";
import { PageHeader, PageSkeleton } from "@/components/page";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = { title: "Relatórios" };

export default function Page() {
  return (
    <div className="grid max-w-2xl grid-cols-1 gap-5">
      <PageHeader title="Relatórios de impacto" subtitle="Relatório mensal por cliente: plaquinhas, avaliações, conteúdo publicado e saúde do site." />
      <Suspense fallback={<PageSkeleton />}>
        <Picker />
      </Suspense>
    </div>
  );
}

async function Picker() {
  const user = await requirePermission("reports:read");
  // Cliente vai direto para o próprio relatório
  if (user.role === "CLIENT") redirect(user.clientId ? `/painel/relatorios/${user.clientId}` : "/painel");

  const clients = await db.select({ id: t.clients.id, name: t.clients.tradeName }).from(t.clients).orderBy(asc(t.clients.tradeName));
  const months = Array.from({ length: 12 }, (_, i) => {
    const [y, m] = currentMonth().split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 1 - i, 15));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
  const sel = "h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm sm:h-9";

  return (
    <form action="/painel/relatorios/abrir" className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-[1fr_200px_auto] sm:items-end sm:p-6">
      <label className="grid gap-1.5 text-sm font-medium">
        Cliente
        <select name="cliente" required className={sel}>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1.5 text-sm font-medium">
        Mês
        <select name="mes" defaultValue={months[1]} className={sel}>
          {months.map((m) => (
            <option key={m} value={m}>
              {monthLabel(m)}
            </option>
          ))}
        </select>
      </label>
      <button className={buttonVariants({ className: "h-10 sm:h-9" })}>Abrir relatório</button>
    </form>
  );
}
