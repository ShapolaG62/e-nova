"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requirePermission } from "@/lib/auth/session";
import { invalidateClient } from "@/lib/nfc/resolve";
import { audit } from "@/lib/audit";
import {
  clientSchema,
  clientStatusSchema,
  contractSchema,
  zodErrors,
  type ActionState,
} from "@/lib/validation";

function isUniqueViolation(e: unknown) {
  const err = e as { code?: string; cause?: { code?: string } };
  return err?.code === "23505" || err?.cause?.code === "23505";
}

export async function createClientAction(_: ActionState, form: FormData): Promise<ActionState> {
  await requirePermission("clients:write");
  const parsed = clientSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return zodErrors(parsed.error);

  let id: string;
  try {
    const trialEndsAt = new Date(Date.now() + 14 * 86_400_000); // trial padrão de 14 dias
    [{ id }] = await db
      .insert(t.clients)
      .values({ ...parsed.data, status: "TRIAL", trialEndsAt })
      .returning({ id: t.clients.id });
  } catch (e) {
    if (isUniqueViolation(e)) return { ok: false, errors: { document: ["Já existe cliente com este CPF/CNPJ"] } };
    throw e;
  }
  revalidatePath("/painel/clientes");
  redirect(`/painel/clientes/${id}`);
}

export async function updateClientAction(clientId: string, _: ActionState, form: FormData): Promise<ActionState> {
  await requirePermission("clients:write");
  const parsed = clientSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return zodErrors(parsed.error);
  try {
    await db.update(t.clients).set(parsed.data).where(eq(t.clients.id, clientId));
  } catch (e) {
    if (isUniqueViolation(e)) return { ok: false, errors: { document: ["Já existe cliente com este CPF/CNPJ"] } };
    throw e;
  }
  await invalidateClient(clientId); // Place ID pode ter mudado
  revalidatePath(`/painel/clientes/${clientId}`);
  return { ok: true, message: "Dados salvos." };
}

export async function setClientStatusAction(clientId: string, _: ActionState, form: FormData): Promise<ActionState> {
  const me = await requirePermission("clients:status");
  const parsed = clientStatusSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return zodErrors(parsed.error);
  const { status, trialDays } = parsed.data;
  await db
    .update(t.clients)
    .set({
      status,
      ...(status === "TRIAL" ? { trialEndsAt: new Date(Date.now() + (trialDays ?? 14) * 86_400_000) } : {}),
    })
    .where(eq(t.clients.id, clientId));
  // Efeito imediato nas plaquinhas: derruba o cache de todos os slugs do cliente.
  await invalidateClient(clientId);
  await audit(me, "client.status", { entity: "client", entityId: clientId, meta: { status } });
  revalidatePath(`/painel/clientes/${clientId}`);
  revalidatePath("/painel");
  return { ok: true, message: "Status atualizado — já vale para as plaquinhas." };
}

export async function addContractAction(clientId: string, _: ActionState, form: FormData): Promise<ActionState> {
  await requirePermission("contracts:write");
  const parsed = contractSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return zodErrors(parsed.error);
  await db.insert(t.contracts).values({
    clientId,
    type: parsed.data.type,
    service: parsed.data.service,
    amountCents: Math.round(parsed.data.amount * 100),
  });
  revalidatePath(`/painel/clientes/${clientId}`);
  revalidatePath("/painel");
  return { ok: true, message: "Contrato adicionado." };
}

export async function setContractStatusAction(form: FormData) {
  await requirePermission("contracts:write");
  const id = String(form.get("id"));
  const clientId = String(form.get("clientId"));
  const status = String(form.get("status"));
  if (!["ACTIVE", "PAUSED", "CANCELED"].includes(status)) return;
  await db
    .update(t.contracts)
    .set({ status: status as "ACTIVE" | "PAUSED" | "CANCELED", endedAt: status === "CANCELED" ? new Date() : null })
    .where(and(eq(t.contracts.id, id), eq(t.contracts.clientId, clientId)));
  revalidatePath(`/painel/clientes/${clientId}`);
  revalidatePath("/painel");
}
