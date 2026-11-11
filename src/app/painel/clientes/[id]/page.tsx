import { Suspense } from "react";
import Link from "next/link";
import { notFound, forbidden } from "next/navigation";
import type { Metadata } from "next";
import { ChevronRight, Nfc, QrCode } from "lucide-react";
import { and, count, desc, eq, gte } from "drizzle-orm";
import { db, t } from "@/db";
import { canAccessClient, requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { addContractAction, setClientStatusAction, setContractStatusAction, updateClientAction } from "@/app/actions/clients";
import { createPlateAction } from "@/app/actions/plates";
import { ActionForm, FormMessage, SubmitButton } from "@/components/action-form";
import { ClientFields } from "@/components/client-fields";
import { Field, selectClass } from "@/components/field";
import { DailyBars, Panel } from "@/components/charts";
import { PageHeader, PageSkeleton } from "@/components/page";
import { ActiveDot, StatusBadge } from "@/components/status-badge";
import { tapsPerDay, windowStart } from "@/lib/nfc/stats";
import { brl, SLUG_HINT } from "@/lib/validation";
import { env } from "@/lib/env";
import { ClientAutomation } from "@/components/client-automation";

export const metadata: Metadata = { title: "Cliente" };

const UUID = /^[0-9a-f-]{36}$/i;
const dateFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" });

export default function Page(props: PageProps<"/painel/clientes/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ClientPage params={props.params} />
    </Suspense>
  );
}

async function ClientPage({ params }: { params: PageProps<"/painel/clientes/[id]">["params"] }) {
  const user = await requirePermission("plates:read");
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  if (!canAccessClient(user, id)) forbidden();

  const client = await db.query.clients.findFirst({ where: eq(t.clients.id, id) });
  if (!client) notFound();

  const staff = can(user.role, "clients:write");
  const finance = can(user.role, "finance:view");

  const [plates, daily, contracts] = await Promise.all([
    db
      .select({
        id: t.plates.id,
        slug: t.plates.slug,
        label: t.plates.label,
        kind: t.plates.kind,
        active: t.plates.active,
        taps: count(t.plateTaps.id),
      })
      .from(t.plates)
      .leftJoin(t.plateTaps, and(eq(t.plateTaps.plateId, t.plates.id), gte(t.plateTaps.occurredAt, windowStart(30))))
      .where(eq(t.plates.clientId, id))
      .groupBy(t.plates.id)
      .orderBy(t.plates.createdAt),
    tapsPerDay({ clientId: id }, 30),
    finance ? db.select().from(t.contracts).where(eq(t.contracts.clientId, id)).orderBy(desc(t.contracts.createdAt)) : Promise.resolve([]),
  ]);

  const mrr = contracts.filter((c) => c.type === "RECURRING" && c.status === "ACTIVE").reduce((s, c) => s + c.amountCents, 0);

  return (
    <div className="grid grid-cols-1 gap-5">
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {client.tradeName} <StatusBadge status={client.status} trialEndsAt={client.trialEndsAt} />
          </span>
        }
        subtitle={[client.niche, client.status === "TRIAL" && client.trialEndsAt ? `trial até ${dateFmt.format(client.trialEndsAt)}` : null].filter(Boolean).join(" · ") || undefined}
      />

      {!client.googlePlaceId && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          Falta o <strong>Google Place ID</strong>: as plaquinhas deste cliente ainda não levam para a avaliação.
        </p>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Panel title={`Plaquinhas (${plates.length})`} className="lg:col-span-2">
          {plates.length ? (
            <ul className="divide-y">
              {plates.map((p) => (
                <li key={p.id}>
                  <Link href={`/painel/plaquinhas/${p.id}`} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-muted/60">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      {p.kind === "QR" ? <QrCode className="size-4" /> : <Nfc className="size-4" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{p.label}</span>
                      <span className="block truncate font-mono text-xs text-muted-foreground">/r/{p.slug}</span>
                    </span>
                    <span className="hidden text-right sm:block">
                      <span className="block text-sm tabular-nums">{Number(p.taps)}</span>
                      <span className="block text-[11px] text-muted-foreground">toques/30d</span>
                    </span>
                    <ActiveDot active={p.active} />
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhuma plaquinha ainda.</p>
          )}

          {can(user.role, "plates:write") && (
            <details className="mt-4 rounded-lg border bg-muted/30 p-3 open:bg-transparent">
              <summary className="cursor-pointer text-sm font-medium text-primary">+ Nova plaquinha</summary>
              <ActionForm action={createPlateAction.bind(null, id)} resetOnSuccess className="mt-3 grid gap-3 sm:grid-cols-2">
                <Field name="label" label="Nome / local" placeholder="Balcão, Mesa 4, Caixa…" required />
                <Field name="kind" label="Tipo">
                  <select id="kind" name="kind" defaultValue="NFC_QR" className={selectClass}>
                    <option value="NFC_QR">NFC + QR</option>
                    <option value="NFC">Só NFC</option>
                    <option value="QR">Só QR Code</option>
                  </select>
                </Field>
                <Field name="slug" label="Slug (opcional)" placeholder="gerado automaticamente" hint={SLUG_HINT} />
                <Field name="destinationOverride" label="Destino alternativo (opcional)" placeholder="https://…" hint="Substitui o Google, ex.: campanha." />
                <FormMessage className="sm:col-span-2" />
                <div className="sm:col-span-2">
                  <SubmitButton className="h-10 w-full sm:h-9 sm:w-auto">Criar plaquinha</SubmitButton>
                </div>
              </ActionForm>
            </details>
          )}
        </Panel>

        <Panel title="Toques por dia (30d)">
          <DailyBars data={daily} />
        </Panel>
      </div>

      {(can(user.role, "clients:status") || finance) && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {can(user.role, "clients:status") && (
            <Panel title="Status do cliente">
              <p className="mb-3 text-sm text-muted-foreground">
                Suspender redireciona todas as plaquinhas para a página de manutenção <strong>na hora</strong>.
              </p>
              <ActionForm action={setClientStatusAction.bind(null, id)} className="grid gap-3 sm:grid-cols-[1fr_120px_auto] sm:items-end">
                <Field name="status" label="Status">
                  <select id="status" name="status" defaultValue={client.status} className={selectClass}>
                    <option value="ACTIVE">Ativo</option>
                    <option value="TRIAL">Trial</option>
                    <option value="SUSPENDED_PAYMENT">Suspenso (pagamento)</option>
                  </select>
                </Field>
                <Field name="trialDays" label="Dias de trial" type="number" min={1} max={90} defaultValue={14} />
                <SubmitButton className="h-10 sm:h-9">Aplicar</SubmitButton>
                <FormMessage className="sm:col-span-3" />
              </ActionForm>
            </Panel>
          )}

          {finance && (
            <Panel title="Contratos" action={<span className="text-sm font-medium tabular-nums">MRR {brl(mrr)}</span>}>
              {contracts.length > 0 && (
                <ul className="mb-4 divide-y">
                  {contracts.map((c) => (
                    <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
                      <span className="min-w-0 flex-1 truncate">
                        {c.service}
                        <span className="text-muted-foreground"> · {c.type === "RECURRING" ? "mensal" : "avulso"}</span>
                      </span>
                      <span className="tabular-nums">{brl(c.amountCents)}</span>
                      <form action={setContractStatusAction} className="flex items-center gap-1">
                        <input type="hidden" name="id" value={c.id} />
                        <input type="hidden" name="clientId" value={id} />
                        <select name="status" defaultValue={c.status} className="h-8 rounded-md border bg-transparent px-1.5 text-xs" aria-label="Status do contrato">
                          <option value="ACTIVE">Ativo</option>
                          <option value="PAUSED">Pausado</option>
                          <option value="CANCELED">Cancelado</option>
                        </select>
                        <button className="h-8 rounded-md border px-2 text-xs hover:bg-muted">OK</button>
                      </form>
                    </li>
                  ))}
                </ul>
              )}
              <ActionForm action={addContractAction.bind(null, id)} resetOnSuccess className="grid gap-3 sm:grid-cols-2">
                <Field name="service" label="Serviço" placeholder="Aluguel de Plaquinhas" required />
                <Field name="type" label="Tipo">
                  <select id="type" name="type" defaultValue="RECURRING" className={selectClass}>
                    <option value="RECURRING">Mensal (recorrente)</option>
                    <option value="ONE_OFF">Avulso</option>
                  </select>
                </Field>
                <Field name="amount" label="Valor (R$)" inputMode="decimal" placeholder="149,90" required />
                <div className="flex items-end">
                  <SubmitButton variant="outline" className="h-10 w-full sm:h-9">
                    Adicionar contrato
                  </SubmitButton>
                </div>
                <FormMessage className="sm:col-span-2" />
              </ActionForm>
            </Panel>
          )}
        </div>
      )}

      {staff && <ClientAutomation client={client} />}

      {staff && (
        <Panel title="Dados cadastrais">
          <ActionForm action={updateClientAction.bind(null, id)} className="grid gap-4">
            <ClientFields c={client} />
            <FormMessage />
            <div>
              <SubmitButton className="h-10 w-full sm:h-9 sm:w-auto">Salvar alterações</SubmitButton>
            </div>
          </ActionForm>
        </Panel>
      )}

      <p className="text-xs text-muted-foreground">Link público das plaquinhas: {env.APP_URL}/r/&lt;slug&gt;</p>
    </div>
  );
}
