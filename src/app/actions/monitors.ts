"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, t } from "@/db";
import { requirePermission } from "@/lib/auth/session";
import { alertConfigSchemas, type AlertKind } from "@/lib/alerts";
import { encryptJson } from "@/lib/crypto";
import { features } from "@/lib/env";
import { enqueue } from "@/lib/jobs";
import { validateMonitorUrl } from "@/lib/monitor";
import { zodErrors, type ActionState } from "@/lib/validation";

const monitorSchema = z.object({
  name: z.string().trim().min(2, "Dê um nome").max(120),
  url: z
    .string()
    .trim()
    .transform((v) => (/^https?:\/\//i.test(v) ? v : `https://${v}`))
    .pipe(z.url("URL inválida"))
    .refine(
      (v) => {
        try {
          validateMonitorUrl(v);
          return true;
        } catch {
          return false;
        }
      },
      { message: "Use um endereço público http(s)" },
    ),
  intervalMinutes: z.coerce.number().refine((n) => n === 5 || n === 15, "Intervalo de 5 ou 15 minutos"),
  clientId: z.preprocess((v) => (v ? v : null), z.uuid().nullable()),
});

export async function createMonitorAction(_: ActionState, form: FormData): Promise<ActionState> {
  await requirePermission("monitors:write");
  const parsed = monitorSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return zodErrors(parsed.error);
  const [m] = await db.insert(t.monitors).values(parsed.data).returning({ id: t.monitors.id });
  // Primeira verificação e cópia já, sem esperar o próximo ciclo
  await enqueue("monitor.check", { id: m.id }, { dedupeKey: `monitor:${m.id}`, maxAttempts: 1 });
  await enqueue("monitor.snapshot", { id: m.id }, { dedupeKey: `snapshot:${m.id}`, maxAttempts: 3 });
  revalidatePath("/painel/monitoramento");
  return { ok: true, message: "Monitor criado — a primeira verificação sai em segundos." };
}

export async function toggleMonitorAction(form: FormData) {
  await requirePermission("monitors:write");
  await db
    .update(t.monitors)
    .set({ active: form.get("active") === "true" })
    .where(eq(t.monitors.id, String(form.get("id"))));
  revalidatePath("/painel/monitoramento");
  revalidatePath(`/painel/monitoramento/${form.get("id")}`);
}

export async function checkNowAction(form: FormData) {
  await requirePermission("monitors:write");
  const id = String(form.get("id"));
  await enqueue("monitor.check", { id }, { dedupeKey: `monitor:${id}`, maxAttempts: 1 });
  revalidatePath(`/painel/monitoramento/${id}`);
}

export async function snapshotNowAction(form: FormData) {
  await requirePermission("monitors:write");
  const id = String(form.get("id"));
  await enqueue("monitor.snapshot", { id }, { dedupeKey: `snapshot:${id}`, maxAttempts: 2 });
  revalidatePath(`/painel/monitoramento/${id}`);
}

export async function deleteMonitorAction(form: FormData) {
  await requirePermission("monitors:write");
  await db.delete(t.monitors).where(eq(t.monitors.id, String(form.get("id"))));
  revalidatePath("/painel/monitoramento");
  redirect("/painel/monitoramento");
}

// ─── Canais de alerta ────────────────────────────────────────────────────
const channelBase = z.object({
  kind: z.enum(["DISCORD", "TELEGRAM", "WHATSAPP", "WEBHOOK"]),
  name: z.string().trim().min(2, "Dê um nome").max(120),
  clientId: z.preprocess((v) => (v ? v : null), z.uuid().nullable()),
});

export async function createAlertChannelAction(_: ActionState, form: FormData): Promise<ActionState> {
  await requirePermission("alerts:manage");
  if (!features.encryption) return { ok: false, message: "Defina ENCRYPTION_KEY no servidor antes (as credenciais ficam criptografadas)." };
  const raw = Object.fromEntries(form);
  const base = channelBase.safeParse(raw);
  if (!base.success) return zodErrors(base.error);
  const kind = base.data.kind as AlertKind;
  const cfg = alertConfigSchemas[kind].safeParse(raw);
  if (!cfg.success) return zodErrors(cfg.error);
  const [ch] = await db.insert(t.alertChannels).values({ ...base.data, configEnc: encryptJson(cfg.data) }).returning({ id: t.alertChannels.id });
  await enqueue("alert.test", { id: ch.id }, { maxAttempts: 1 });
  revalidatePath("/painel/monitoramento/alertas");
  return { ok: true, message: "Canal criado. Enviamos uma mensagem de teste." };
}

export async function testAlertChannelAction(form: FormData) {
  await requirePermission("alerts:manage");
  await enqueue("alert.test", { id: String(form.get("id")) }, { maxAttempts: 1 });
  revalidatePath("/painel/monitoramento/alertas");
}

export async function toggleAlertChannelAction(form: FormData) {
  await requirePermission("alerts:manage");
  await db
    .update(t.alertChannels)
    .set({ active: form.get("active") === "true" })
    .where(eq(t.alertChannels.id, String(form.get("id"))));
  revalidatePath("/painel/monitoramento/alertas");
}

export async function deleteAlertChannelAction(form: FormData) {
  await requirePermission("alerts:manage");
  await db.delete(t.alertChannels).where(eq(t.alertChannels.id, String(form.get("id"))));
  revalidatePath("/painel/monitoramento/alertas");
}

export async function scanNowAction(form: FormData) {
  await requirePermission("monitors:write");
  const id = String(form.get("id"));
  await enqueue("security.scan", { id }, { dedupeKey: `scan:${id}`, maxAttempts: 1 });
  revalidatePath(`/painel/monitoramento/${id}`);
  revalidatePath("/painel/seguranca");
}
