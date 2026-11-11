import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { asc, desc, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requirePermission } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { assignUnitAction, returnUnitAction, saveNfcUidAction, setUnitStatusAction } from "@/app/actions/inventory";
import { AssignUnitForm } from "@/components/assign-unit-form";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { NfcWriter } from "@/components/nfc-writer";
import { Panel } from "@/components/charts";
import { PageHeader, PageSkeleton } from "@/components/page";
import { DEAL_LABEL, UnitStatusBadge } from "@/components/unit-status";
import { buttonVariants } from "@/components/ui/button";
import { brl } from "@/lib/validation";

export const metadata: Metadata = { title: "Plaquinha" };
const dt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
const d = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "medium" });

export default function Page(props: PageProps<"/painel/estoque/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Unit params={props.params} />
    </Suspense>
  );
}

async function Unit({ params }: { params: PageProps<"/painel/estoque/[id]">["params"] }) {
  await requirePermission("inventory:manage");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const unit = await db.query.plateUnits.findFirst({
    where: eq(t.plateUnits.id, id),
    with: { model: true, client: { columns: { id: true, tradeName: true } }, plate: true, events: { orderBy: desc(t.plateUnitEvents.createdAt), limit: 30 } },
  });
  if (!unit) notFound();

  const needForm = unit.status === "ESTOQUE";
  const [clients, plates] = needForm
    ? await Promise.all([
        db.select({ id: t.clients.id, name: t.clients.tradeName }).from(t.clients).orderBy(asc(t.clients.tradeName)),
        db.select({ id: t.plates.id, clientId: t.plates.clientId, label: t.plates.label, slug: t.plates.slug }).from(t.plates).orderBy(asc(t.plates.label)),
      ])
    : [[], []];
  const publicUrl = unit.plate ? `${env.APP_URL}/r/${unit.plate.slug}` : null;

  return (
    <div className="grid grid-cols-1 gap-6">
      <Link href="/painel/estoque" className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Plaquinhas
      </Link>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span className="num">{unit.code}</span> <UnitStatusBadge status={unit.status} deal={unit.deal} />
          </span>
        }
        subtitle={[unit.model?.name, unit.nfcUid ? `chip ${unit.nfcUid}` : null].filter(Boolean).join(" · ") || undefined}
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_360px]">
        <div className="grid content-start grid-cols-1 gap-5">
          {unit.status === "INSTALADA" && unit.client && (
            <Panel title="Onde está">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div>
                  <dt className="text-muted-foreground">Cliente</dt>
                  <dd>
                    <Link href={`/painel/clientes/${unit.client.id}`} className="font-medium hover:underline">
                      {unit.client.tradeName}
                    </Link>
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Negócio</dt>
                  <dd className="font-medium">
                    {unit.deal ? DEAL_LABEL[unit.deal] : "—"}
                    {unit.priceCents ? ` · ${brl(unit.priceCents)}${unit.deal === "ALUGUEL" ? "/mês" : ""}` : ""}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Desde</dt>
                  <dd>{unit.startedAt ? d.format(unit.startedAt) : "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Fim do aluguel</dt>
                  <dd>{unit.endsAt ? d.format(unit.endsAt) : unit.deal === "ALUGUEL" ? "Sem prazo" : "—"}</dd>
                </div>
              </dl>
              {unit.plate && (
                <div className="mt-4 grid gap-3 border-t pt-4">
                  <p className="text-sm">
                    Link gravado:{" "}
                    <Link href={`/painel/plaquinhas/${unit.plate.id}`} className="font-medium text-primary hover:underline">
                      /r/{unit.plate.slug}
                    </Link>{" "}
                    <span className="text-muted-foreground">({unit.plate.label})</span>
                  </p>
                  {publicUrl && <NfcWriter url={publicUrl} onUid={saveNfcUidAction.bind(null, unit.id)} />}
                </div>
              )}
              <form action={returnUnitAction} className="mt-4 border-t pt-4">
                <input type="hidden" name="id" value={unit.id} />
                <ConfirmSubmit
                  message={unit.deal === "ALUGUEL" ? "Registrar devolução? O aluguel será encerrado e o link desligado." : "Registrar devolução e voltar ao estoque? O link será desligado."}
                  className={buttonVariants({ variant: "outline", className: "h-10" })}
                >
                  Registrar devolução
                </ConfirmSubmit>
              </form>
            </Panel>
          )}

          <Panel title="Histórico">
            <ol className="relative grid gap-4 border-l-2 border-border pl-5">
              {unit.events.map((e) => (
                <li key={e.id} className="relative">
                  <span className="absolute top-1.5 -left-[1.6rem] size-2.5 rounded-full border-2 border-card bg-primary" aria-hidden />
                  <p className="text-sm">{e.description}</p>
                  <p className="text-xs text-muted-foreground">{dt.format(e.createdAt)}</p>
                </li>
              ))}
            </ol>
          </Panel>
        </div>

        <div className="grid content-start gap-5">
          {needForm && (
            <Panel title="Vender ou alugar">
              <AssignUnitForm
                action={assignUnitAction.bind(null, unit.id)}
                clients={clients}
                plates={plates}
                prices={{ sale: unit.model?.salePriceCents ?? 0, rent: unit.model?.rentMonthlyCents ?? 0 }}
              />
            </Panel>
          )}
          {unit.status !== "INSTALADA" && (
            <Panel title="Situação">
              <div className="flex flex-wrap gap-2">
                {unit.status !== "DEFEITO" && unit.status !== "BAIXADA" && (
                  <form action={setUnitStatusAction}>
                    <input type="hidden" name="id" value={unit.id} />
                    <input type="hidden" name="status" value="DEFEITO" />
                    <button className={buttonVariants({ variant: "outline", size: "sm" })}>Marcar com defeito</button>
                  </form>
                )}
                {unit.status === "DEFEITO" && (
                  <form action={setUnitStatusAction}>
                    <input type="hidden" name="id" value={unit.id} />
                    <input type="hidden" name="status" value="ESTOQUE" />
                    <button className={buttonVariants({ variant: "outline", size: "sm" })}>Consertada, voltar ao estoque</button>
                  </form>
                )}
                {unit.status !== "BAIXADA" && (
                  <form action={setUnitStatusAction}>
                    <input type="hidden" name="id" value={unit.id} />
                    <input type="hidden" name="status" value="BAIXADA" />
                    <ConfirmSubmit message="Dar baixa (descartar) esta plaquinha?" className={buttonVariants({ variant: "ghost", size: "sm", className: "text-destructive" })}>
                      Dar baixa
                    </ConfirmSubmit>
                  </form>
                )}
              </div>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
