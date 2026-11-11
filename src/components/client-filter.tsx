import { asc } from "drizzle-orm";
import { db, t } from "@/db";
import { buttonVariants } from "@/components/ui/button";

/** Filtro GET por cliente (+ campos extras). Só aparece para a equipe. */
export async function ClientFilter({
  selected,
  extra,
  children,
}: {
  selected: string | null;
  extra?: Record<string, string>;
  children?: React.ReactNode;
}) {
  const clients = await db.select({ id: t.clients.id, name: t.clients.tradeName }).from(t.clients).orderBy(asc(t.clients.tradeName));
  return (
    <form className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <select name="cliente" defaultValue={selected ?? ""} className="h-10 rounded-lg border border-input bg-transparent px-2.5 text-sm sm:h-9 sm:w-56" aria-label="Cliente">
        <option value="">Todos os clientes</option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      {children}
      {Object.entries(extra ?? {}).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <button className={buttonVariants({ variant: "outline", className: "h-10 sm:h-9" })}>Filtrar</button>
    </form>
  );
}

export async function ClientSelect({ name = "clientId", defaultValue, required, allowEmpty = true, emptyLabel = "—" }: { name?: string; defaultValue?: string | null; required?: boolean; allowEmpty?: boolean; emptyLabel?: string }) {
  const clients = await db.select({ id: t.clients.id, name: t.clients.tradeName }).from(t.clients).orderBy(asc(t.clients.tradeName));
  return (
    <select
      id={name}
      name={name}
      defaultValue={defaultValue ?? ""}
      required={required}
      className="h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:h-9 dark:bg-input/30"
    >
      {allowEmpty && <option value="">{emptyLabel}</option>}
      {clients.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );
}
