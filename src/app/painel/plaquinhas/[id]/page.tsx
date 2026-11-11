import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, Download, ExternalLink } from "lucide-react";
import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import { canAccessClient, requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { togglePlateAction, updatePlateAction } from "@/app/actions/plates";
import { ActionForm, FormMessage, SubmitButton } from "@/components/action-form";
import { Field, selectClass } from "@/components/field";
import { DailyBars, DeviceSplit, Kpi, OUTCOME_LABEL, Panel } from "@/components/charts";
import { RecentTapsList } from "@/components/recent-taps";
import { PageHeader, PageSkeleton } from "@/components/page";
import { ActiveDot, StatusBadge } from "@/components/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { CopyButton } from "@/components/copy-button";
import { NfcWriter } from "@/components/nfc-writer";
import { recentTaps, tapsByDevice, tapsByOutcome, tapsPerDay } from "@/lib/nfc/stats";
import { env } from "@/lib/env";

export const metadata: Metadata = { title: "Plaquinha" };

export default function Page(props: PageProps<"/painel/plaquinhas/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <PlatePage params={props.params} />
    </Suspense>
  );
}

async function PlatePage({ params }: { params: PageProps<"/painel/plaquinhas/[id]">["params"] }) {
  const user = await requirePermission("plates:read");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const plate = await db.query.plates.findFirst({ where: eq(t.plates.id, id), with: { client: true } });
  // 404 (e não 403) para não revelar que a plaquinha existe para outro cliente
  if (!plate || !canAccessClient(user, plate.clientId)) notFound();

  const scope = { plateId: id };
  const [daily, devices, outcomes, recent] = await Promise.all([
    tapsPerDay(scope, 30),
    tapsByDevice(scope, 30),
    tapsByOutcome(scope, 30),
    recentTaps(scope, 10),
  ]);
  const total = daily.reduce((s, d) => s + d.total, 0);
  const blocked = total - (outcomes.REDIRECT_REVIEW ?? 0);
  const publicUrl = `${env.APP_URL}/r/${plate.slug}`;
  const qr = `/api/plaquinhas/${id}/qr`;
  const hasLogo = !!plate.client.logoUrl;
  const writable = can(user.role, "plates:write");

  return (
    <div className="grid grid-cols-1 gap-5">
      <Link href={`/painel/clientes/${plate.clientId}`} className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> {plate.client.tradeName}
      </Link>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {plate.label} <ActiveDot active={plate.active} />
          </span>
        }
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            Cliente <StatusBadge status={plate.client.status} trialEndsAt={plate.client.trialEndsAt} />
          </span>
        }
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,320px)_1fr]">
        <Panel title="QR Code">
          {/* eslint-disable-next-line @next/next/no-img-element -- SVG dinâmico autenticado */}
          <img src={`${qr}?format=svg&logo=${hasLogo ? 1 : 0}`} alt={`QR Code da plaquinha ${plate.label}`} className="mx-auto aspect-square w-full max-w-64 rounded-lg border bg-white p-2" />
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-muted px-2.5 py-2">
            <code className="min-w-0 flex-1 truncate text-xs">{publicUrl}</code>
            <CopyButton value={publicUrl} />
            <a href={`/r/${plate.slug}`} target="_blank" rel="noopener" className="text-muted-foreground hover:text-foreground" aria-label="Testar link">
              <ExternalLink className="size-4" />
            </a>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Grave este link na tag NFC. O QR aponta para o mesmo endereço.</p>
          {writable && (
            <div className="mt-3">
              <NfcWriter url={publicUrl} />
            </div>
          )}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <a href={`${qr}?format=svg&logo=${hasLogo ? 1 : 0}&download=1`} className={buttonVariants({ variant: "outline", className: "h-10 sm:h-9" })}>
              <Download /> SVG
            </a>
            <a href={`${qr}?format=png&size=2048&logo=${hasLogo ? 1 : 0}&download=1`} className={buttonVariants({ variant: "outline", className: "h-10 sm:h-9" })}>
              <Download /> PNG 2048
            </a>
          </div>
          {hasLogo ? (
            <p className="mt-2 text-xs text-muted-foreground">Com logo no centro (correção de erro alta).</p>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">Cadastre o link do logo no cliente para incluí-lo no centro.</p>
          )}
        </Panel>

        <div className="grid grid-cols-1 content-start gap-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Kpi label="Toques (30d)" value={total} />
            <Kpi label="Foram ao Google" value={outcomes.REDIRECT_REVIEW ?? 0} />
            <Kpi
              label="Bloqueados"
              value={blocked}
              hint={
                blocked
                  ? Object.entries(outcomes)
                      .filter(([k]) => k !== "REDIRECT_REVIEW")
                      .map(([k, v]) => `${OUTCOME_LABEL[k]}: ${v}`)
                      .join(" · ")
                  : undefined
              }
            />
          </div>
          <Panel title="Toques por dia">
            <DailyBars data={daily} />
          </Panel>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Panel title="Dispositivos (30d)">
          <DeviceSplit data={devices} />
        </Panel>
        <Panel title="Últimos toques">
          <RecentTapsList taps={recent} />
        </Panel>
      </div>

      {writable && (
        <Panel
          title="Configurações"
          action={
            <form action={togglePlateAction}>
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="active" value={String(!plate.active)} />
              <button className={buttonVariants({ variant: plate.active ? "destructive" : "outline", size: "sm" })}>
                {plate.active ? "Desativar" : "Reativar"}
              </button>
            </form>
          }
        >
          <ActionForm action={updatePlateAction.bind(null, id)} className="grid gap-3 sm:grid-cols-2">
            <Field name="label" label="Nome / local" defaultValue={plate.label} required />
            <Field name="kind" label="Tipo">
              <select id="kind" name="kind" defaultValue={plate.kind} className={selectClass}>
                <option value="NFC_QR">NFC + QR</option>
                <option value="NFC">Só NFC</option>
                <option value="QR">Só QR Code</option>
              </select>
            </Field>
            <Field
              name="destinationOverride"
              label="Destino alternativo (opcional)"
              className="sm:col-span-2"
              placeholder="vazio = avaliação do Google"
              defaultValue={plate.destinationOverride ?? ""}
              hint="O slug não muda: a tag NFC já gravada continua funcionando."
            />
            <FormMessage className="sm:col-span-2" />
            <div>
              <SubmitButton className="h-10 w-full sm:h-9 sm:w-auto">Salvar</SubmitButton>
            </div>
          </ActionForm>
        </Panel>
      )}
    </div>
  );
}
