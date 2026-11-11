import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { Package } from "lucide-react";
import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db, t } from "@/db";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { createModelAction, createUnitsAction, deleteModelAction } from "@/app/actions/inventory";
import { ActionForm, FormMessage, SubmitButton } from "@/components/action-form";
import { Field, selectClass } from "@/components/field";
import { Kpi, Panel } from "@/components/charts";
import { PageHeader, PageSkeleton } from "@/components/page";
import { UnitStatusBadge, DEAL_LABEL, UNIT_STATUS } from "@/components/unit-status";
import { Input } from "@/components/ui/input";
import { buttonVariants } from "@/components/ui/button";
import { Term } from "@/components/term";
import { brl } from "@/lib/validation";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Plaquinhas — estoque e vendas" };

export default function Page(props: PageProps<"/painel/estoque">) {
  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader title="Plaquinhas" subtitle="Estoque físico, vendas, aluguéis e devoluções. Cada venda ou aluguel já gera o contrato do cliente." />
      <Suspense fallback={<PageSkeleton />}>
        <Inventory searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function Inventory({ searchParams }: { searchParams: PageProps<"/painel/estoque">["searchParams"] }) {
  const user = await requirePermission("inventory:manage");
  const sp = await searchParams;
  const tab = sp.aba === "modelos" ? "modelos" : "unidades";
  const status = typeof sp.status === "string" && sp.status in UNIT_STATUS ? (sp.status as keyof typeof UNIT_STATUS) : null;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 40) : "";

  const [[k], models, units] = await Promise.all([
    db
      .select({
        estoque: sql<number>`count(*) filter (where ${t.plateUnits.status} = 'ESTOQUE')::int`,
        instaladas: sql<number>`count(*) filter (where ${t.plateUnits.status} = 'INSTALADA')::int`,
        alugadas: sql<number>`count(*) filter (where ${t.plateUnits.status} = 'INSTALADA' and ${t.plateUnits.deal} = 'ALUGUEL')::int`,
        vendidas: sql<number>`count(*) filter (where ${t.plateUnits.deal} = 'VENDA')::int`,
        defeito: sql<number>`count(*) filter (where ${t.plateUnits.status} = 'DEFEITO')::int`,
        aluguelMes: sql<number>`coalesce(sum(${t.plateUnits.priceCents}) filter (where ${t.plateUnits.status} = 'INSTALADA' and ${t.plateUnits.deal} = 'ALUGUEL'), 0)::int`,
        custoEstoque: sql<number>`coalesce(sum(${t.plateModels.costCents}) filter (where ${t.plateUnits.status} = 'ESTOQUE'), 0)::int`,
      })
      .from(t.plateUnits)
      .leftJoin(t.plateModels, eq(t.plateModels.id, t.plateUnits.modelId)),
    db
      .select({
        id: t.plateModels.id,
        name: t.plateModels.name,
        cost: t.plateModels.costCents,
        sale: t.plateModels.salePriceCents,
        rent: t.plateModels.rentMonthlyCents,
        stock: sql<number>`(select count(*) from plate_units u where u.model_id = ${t.plateModels.id} and u.status = 'ESTOQUE')::int`,
      })
      .from(t.plateModels)
      .where(eq(t.plateModels.active, true))
      .orderBy(asc(t.plateModels.name)),
    db
      .select({
        id: t.plateUnits.id,
        code: t.plateUnits.code,
        status: t.plateUnits.status,
        deal: t.plateUnits.deal,
        price: t.plateUnits.priceCents,
        model: t.plateModels.name,
        client: t.clients.tradeName,
        endsAt: t.plateUnits.endsAt,
      })
      .from(t.plateUnits)
      .leftJoin(t.plateModels, eq(t.plateModels.id, t.plateUnits.modelId))
      .leftJoin(t.clients, eq(t.clients.id, t.plateUnits.clientId))
      .where(and(status ? eq(t.plateUnits.status, status) : undefined, q ? or(ilike(t.plateUnits.code, `%${q}%`), ilike(t.clients.tradeName, `%${q}%`)) : undefined))
      .orderBy(desc(t.plateUnits.updatedAt))
      .limit(300),
  ]);
  const finance = can(user.role, "finance:view");

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi featured className="col-span-2" label="Plaquinhas instaladas em clientes" value={k.instaladas} hint={`${k.alugadas} alugadas · ${k.vendidas} vendidas no total`} />
        <Kpi label="Em estoque" value={k.estoque} hint={finance ? `custo parado: ${brl(k.custoEstoque)}` : undefined} />
        {finance ? (
          <Kpi label={<>Aluguel no <Term k="MRR" /></>} value={brl(k.aluguelMes)} hint="por mês" />
        ) : (
          <Kpi label="Com defeito" value={k.defeito} />
        )}
      </div>

      <div className="flex gap-1 rounded-xl bg-muted p-1 sm:w-fit">
        {[
          ["unidades", "Unidades"],
          ["modelos", `Modelos e preços`],
        ].map(([key, label]) => (
          <Link
            key={key}
            href={`/painel/estoque?aba=${key}`}
            className={cn("flex-1 rounded-lg px-4 py-2 text-center text-sm sm:flex-none", tab === key ? "bg-card font-medium shadow-sm" : "text-muted-foreground")}
          >
            {label}
          </Link>
        ))}
      </div>

      {tab === "unidades" ? (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
          <div className="grid content-start gap-3">
            <form className="flex flex-col gap-2 sm:flex-row" role="search">
              <input type="hidden" name="aba" value="unidades" />
              <Input name="q" defaultValue={q} placeholder="Etiqueta (EN-0001) ou cliente" className="h-10 sm:h-9" />
              <select name="status" defaultValue={status ?? ""} className="h-10 rounded-lg border border-input bg-card px-2.5 text-sm sm:h-9 sm:w-44" aria-label="Situação">
                <option value="">Todas as situações</option>
                {Object.entries(UNIT_STATUS).map(([key, v]) => (
                  <option key={key} value={key}>
                    {v.label}
                  </option>
                ))}
              </select>
              <button className={buttonVariants({ variant: "outline", className: "h-10 sm:h-9" })}>Filtrar</button>
            </form>
            {units.length === 0 ? (
              <div className="grid place-items-center gap-2 rounded-2xl border border-dashed p-10 text-center">
                <Package className="size-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">{models.length ? "Nenhuma plaquinha aqui. Dê entrada em um lote ao lado." : "Comece cadastrando um modelo em “Modelos e preços”."}</p>
              </div>
            ) : (
              <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
                {units.map((u) => (
                  <li key={u.id}>
                    <Link href={`/painel/estoque/${u.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/60">
                      <span className="num w-16 shrink-0 text-sm font-semibold">{u.code}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">{u.client ?? <span className="text-muted-foreground">Sem cliente</span>}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {u.model ?? "Modelo removido"}
                          {u.deal && ` · ${DEAL_LABEL[u.deal]}${u.price ? ` ${brl(u.price)}${u.deal === "ALUGUEL" ? "/mês" : ""}` : ""}`}
                        </span>
                      </span>
                      <UnitStatusBadge status={u.status} deal={u.deal} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Panel title="Entrada de lote" className="self-start">
            {models.length === 0 ? (
              <p className="text-sm text-muted-foreground">Cadastre um modelo primeiro.</p>
            ) : (
              <ActionForm action={createUnitsAction} resetOnSuccess className="grid gap-3">
                <Field name="modelId" label="Modelo">
                  <select id="modelId" name="modelId" className={selectClass} defaultValue={models[0].id}>
                    {models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field name="quantity" label="Quantidade" type="number" min={1} max={500} defaultValue={10} />
                <Field name="notes" label="Observação (fornecedor, nota fiscal…)" />
                <FormMessage />
                <SubmitButton className="h-10 sm:h-9">Dar entrada</SubmitButton>
                <p className="text-xs text-muted-foreground">As etiquetas são numeradas na sequência (EN-0001, EN-0002…).</p>
              </ActionForm>
            )}
          </Panel>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
          <div className="overflow-hidden rounded-2xl border bg-card">
            {models.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">Nenhum modelo ainda.</p>
            ) : (
              <ul className="divide-y">
                {models.map((m) => (
                  <li key={m.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{m.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {m.stock} em estoque{finance && ` · custo ${brl(m.cost)}`}
                      </p>
                    </div>
                    <div className="text-right text-sm">
                      <p>
                        Venda <span className="num font-semibold">{brl(m.sale)}</span>
                      </p>
                      <p className="text-muted-foreground">
                        Aluguel <span className="num font-semibold text-foreground">{brl(m.rent)}</span>/mês
                      </p>
                    </div>
                    <form action={deleteModelAction}>
                      <input type="hidden" name="id" value={m.id} />
                      <button className="text-xs text-muted-foreground hover:text-destructive hover:underline">Arquivar</button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Panel title="Novo modelo" className="self-start">
            <ActionForm action={createModelAction} resetOnSuccess className="grid gap-3">
              <Field name="name" label="Nome" placeholder="Acrílico 10×10 com NFC" />
              <div className="grid grid-cols-3 gap-2">
                <Field name="cost" label="Custo" inputMode="decimal" placeholder="18,00" />
                <Field name="salePrice" label="Venda" inputMode="decimal" placeholder="149,00" />
                <Field name="rentMonthly" label="Aluguel/mês" inputMode="decimal" placeholder="39,90" />
              </div>
              <FormMessage />
              <SubmitButton className="h-10 sm:h-9">Cadastrar modelo</SubmitButton>
            </ActionForm>
          </Panel>
        </div>
      )}
    </>
  );
}
