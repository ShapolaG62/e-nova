import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { asc, desc, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requirePermission } from "@/lib/auth/session";
import { createAlertChannelAction, deleteAlertChannelAction, testAlertChannelAction, toggleAlertChannelAction } from "@/app/actions/monitors";
import { AlertChannelForm } from "@/components/alert-channel-form";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { Panel } from "@/components/charts";
import { PageHeader, PageSkeleton } from "@/components/page";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Canais de alerta" };
const KIND = { DISCORD: "Discord", TELEGRAM: "Telegram", WHATSAPP: "WhatsApp", WEBHOOK: "Webhook" } as const;
const dt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

export default function Page() {
  return (
    <div className="grid grid-cols-1 gap-5">
      <Link href="/painel/monitoramento" className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Sites
      </Link>
      <PageHeader title="Canais de alerta" subtitle="Para onde vão os avisos de site fora do ar, volta ao ar e SSL vencendo." />
      <Suspense fallback={<PageSkeleton />}>
        <Channels />
      </Suspense>
    </div>
  );
}

async function Channels() {
  await requirePermission("alerts:manage");
  const [channels, clients, events] = await Promise.all([
    db
      .select({ id: t.alertChannels.id, kind: t.alertChannels.kind, name: t.alertChannels.name, active: t.alertChannels.active, client: t.clients.tradeName })
      .from(t.alertChannels)
      .leftJoin(t.clients, eq(t.clients.id, t.alertChannels.clientId))
      .orderBy(asc(t.alertChannels.name)),
    db.select({ id: t.clients.id, name: t.clients.tradeName }).from(t.clients).orderBy(asc(t.clients.tradeName)),
    db.select().from(t.alertEvents).orderBy(desc(t.alertEvents.createdAt)).limit(15),
  ]);

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_360px]">
      <div className="grid content-start grid-cols-1 gap-5">
        <Panel title="Canais">
          {channels.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum canal ainda — sem canal, os alertas ficam só registrados aqui.</p>
          ) : (
            <ul className="divide-y">
              {channels.map((c) => (
                <li key={c.id} className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5", !c.active && "opacity-60")}>
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[11px]">{KIND[c.kind]}</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{c.name}</span>
                  <span className="text-xs text-muted-foreground">{c.client ? `só ${c.client}` : "agência"}</span>
                  <form action={testAlertChannelAction}>
                    <input type="hidden" name="id" value={c.id} />
                    <button className="text-xs text-primary hover:underline">Testar</button>
                  </form>
                  <form action={toggleAlertChannelAction}>
                    <input type="hidden" name="id" value={c.id} />
                    <input type="hidden" name="active" value={String(!c.active)} />
                    <button className="text-xs text-muted-foreground hover:underline">{c.active ? "Pausar" : "Ativar"}</button>
                  </form>
                  <form action={deleteAlertChannelAction}>
                    <input type="hidden" name="id" value={c.id} />
                    <ConfirmSubmit message={`Remover o canal "${c.name}"?`} className="text-xs text-destructive hover:underline">
                      Remover
                    </ConfirmSubmit>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Últimos alertas">
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum alerta enviado.</p>
          ) : (
            <ul className="divide-y text-sm">
              {events.map((e) => (
                <li key={e.id} className="py-2">
                  <p className="break-words">{e.message}</p>
                  <p className="text-xs text-muted-foreground">
                    {dt.format(e.createdAt)} ·{" "}
                    {e.deliveries.length
                      ? e.deliveries.map((d) => (
                          <span key={d.channel} className={d.ok ? "" : "text-destructive"} title={d.error}>
                            {d.channel} {d.ok ? "✓" : "✗"}{" "}
                          </span>
                        ))
                      : "sem canais"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
      <Panel title="Novo canal" className="self-start">
        <AlertChannelForm action={createAlertChannelAction} clients={clients} />
      </Panel>
    </div>
  );
}
