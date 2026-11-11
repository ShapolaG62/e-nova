"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, t } from "@/db";
import { requirePermission, type SessionUser } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { invalidateSlugs } from "@/lib/nfc/resolve";
import { slugify, zodErrors, type ActionState } from "@/lib/validation";

const money = z.preprocess(
  (v) => (typeof v === "string" ? (v.trim() === "" ? 0 : Number(v.replace(/\./g, "").replace(",", "."))) : v),
  z.number({ error: "Valor inválido" }).nonnegative().max(1_000_000),
);
const cents = (n: number) => Math.round(n * 100);

async function logEvent(unitId: string, kind: string, description: string, user: SessionUser) {
  await db.insert(t.plateUnitEvents).values({ unitId, kind, description, userId: user.id });
}

// ─── Modelos (catálogo) ──────────────────────────────────────────────────
const modelSchema = z.object({
  name: z.string().trim().min(2, "Dê um nome ao modelo").max(120),
  cost: money,
  salePrice: money,
  rentMonthly: money,
});

export async function createModelAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requirePermission("inventory:manage");
  const p = modelSchema.safeParse(Object.fromEntries(form));
  if (!p.success) return zodErrors(p.error);
  await db.insert(t.plateModels).values({ name: p.data.name, costCents: cents(p.data.cost), salePriceCents: cents(p.data.salePrice), rentMonthlyCents: cents(p.data.rentMonthly) });
  await audit(user, "inventory.model.create", { entity: "plate_model", meta: { name: p.data.name } });
  revalidatePath("/painel/estoque");
  return { ok: true, message: "Modelo cadastrado." };
}

// ─── Entrada de lote no estoque ──────────────────────────────────────────
const batchSchema = z.object({
  modelId: z.uuid("Escolha o modelo"),
  quantity: z.coerce.number().int().min(1, "Mínimo 1").max(500, "Máximo 500 por lote"),
  notes: z.string().trim().max(500).optional(),
});

export async function createUnitsAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requirePermission("inventory:manage");
  const p = batchSchema.safeParse(Object.fromEntries(form));
  if (!p.success) return zodErrors(p.error);

  const created = await db.transaction(async (tx) => {
    // Numeração sequencial da etiqueta física: EN-0001, EN-0002…
    const [{ last }] = await tx.select({ last: sql<number>`coalesce(max(substring(${t.plateUnits.code} from 4)::int), 0)::int` }).from(t.plateUnits);
    const rows = Array.from({ length: p.data.quantity }, (_, i) => ({
      code: `EN-${String(last + i + 1).padStart(4, "0")}`,
      modelId: p.data.modelId,
      notes: p.data.notes || null,
    }));
    const units = await tx.insert(t.plateUnits).values(rows).returning({ id: t.plateUnits.id, code: t.plateUnits.code });
    await tx.insert(t.plateUnitEvents).values(units.map((u) => ({ unitId: u.id, kind: "entrada", description: "Entrada no estoque", userId: user.id })));
    return units;
  });
  await audit(user, "inventory.units.create", { entity: "plate_unit", meta: { quantity: created.length, from: created[0]?.code, to: created.at(-1)?.code } });
  revalidatePath("/painel/estoque");
  return { ok: true, message: `${created.length} plaquinha(s) no estoque: ${created[0].code}${created.length > 1 ? ` a ${created.at(-1)!.code}` : ""}.` };
}

// ─── Venda / aluguel / cortesia ──────────────────────────────────────────
const assignSchema = z.object({
  clientId: z.uuid("Escolha o cliente"),
  deal: z.enum(["VENDA", "ALUGUEL", "CORTESIA"]),
  price: money,
  months: z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().int().min(1).max(60).nullable()),
  plateId: z.preprocess((v) => (v ? v : null), z.uuid().nullable()),
  label: z.string().trim().max(120).optional(),
});

export async function assignUnitAction(unitId: string, _: ActionState, form: FormData): Promise<ActionState> {
  const user = await requirePermission("inventory:manage");
  const p = assignSchema.safeParse(Object.fromEntries(form));
  if (!p.success) return zodErrors(p.error);
  const d = p.data;

  const unit = await db.query.plateUnits.findFirst({ where: eq(t.plateUnits.id, unitId), with: { model: true } });
  if (!unit || unit.status !== "ESTOQUE") return { ok: false, message: "Esta plaquinha não está disponível no estoque." };
  const client = await db.query.clients.findFirst({ where: eq(t.clients.id, d.clientId), columns: { tradeName: true } });
  if (!client) return { ok: false, message: "Cliente não encontrado." };

  const slugToInvalidate: string[] = [];
  await db.transaction(async (tx) => {
    // Link /r/slug: usa um existente do cliente ou cria um novo para esta unidade
    let plateId = d.plateId;
    if (plateId) {
      const plate = await tx.query.plates.findFirst({ where: and(eq(t.plates.id, plateId), eq(t.plates.clientId, d.clientId)) });
      if (!plate) throw new Error("Link escolhido não pertence a este cliente");
      await tx.update(t.plates).set({ active: true }).where(eq(t.plates.id, plateId));
      slugToInvalidate.push(plate.slug);
    } else {
      const slug = `${slugify(client.tradeName) || "loja"}-${randomBytes(3).toString("hex")}`;
      const [plate] = await tx
        .insert(t.plates)
        .values({ clientId: d.clientId, slug, label: d.label || `Plaquinha ${unit.code}` })
        .returning({ id: t.plates.id });
      plateId = plate.id;
      slugToInvalidate.push(slug);
    }

    // Contrato: venda → avulso; aluguel → recorrente (entra no MRR)
    let contractId: string | null = null;
    if (d.deal !== "CORTESIA" && d.price > 0) {
      const [c] = await tx
        .insert(t.contracts)
        .values({
          clientId: d.clientId,
          type: d.deal === "ALUGUEL" ? "RECURRING" : "ONE_OFF",
          service: `${d.deal === "ALUGUEL" ? "Aluguel" : "Venda"} de plaquinha ${unit.code}${unit.model ? ` (${unit.model.name})` : ""}`,
          amountCents: cents(d.price),
        })
        .returning({ id: t.contracts.id });
      contractId = c.id;
    }

    const now = new Date();
    await tx
      .update(t.plateUnits)
      .set({
        status: "INSTALADA",
        clientId: d.clientId,
        plateId,
        deal: d.deal,
        priceCents: cents(d.price),
        contractId,
        startedAt: now,
        endsAt: d.deal === "ALUGUEL" && d.months ? new Date(now.getTime() + d.months * 30 * 86_400_000) : null,
      })
      .where(eq(t.plateUnits.id, unitId));
    const verb = d.deal === "VENDA" ? "Vendida" : d.deal === "ALUGUEL" ? "Alugada" : "Cedida (cortesia)";
    await tx.insert(t.plateUnitEvents).values({
      unitId,
      kind: d.deal.toLowerCase(),
      description: `${verb} para ${client.tradeName}${d.price ? ` por R$ ${d.price.toFixed(2).replace(".", ",")}${d.deal === "ALUGUEL" ? "/mês" : ""}` : ""}`,
      userId: user.id,
    });
  });
  await invalidateSlugs(...slugToInvalidate);
  await audit(user, `inventory.unit.${d.deal.toLowerCase()}`, { entity: "plate_unit", entityId: unitId, meta: { code: unit.code, client: client.tradeName, price: d.price } });
  revalidatePath(`/painel/estoque/${unitId}`);
  revalidatePath("/painel/estoque");
  return { ok: true, message: "Plaquinha atribuída. O link já está ativo." };
}

/** Devolução (fim de aluguel ou troca): volta ao estoque, encerra contrato e desliga o link. */
export async function returnUnitAction(form: FormData) {
  const user = await requirePermission("inventory:manage");
  const unitId = String(form.get("id"));
  const unit = await db.query.plateUnits.findFirst({ where: eq(t.plateUnits.id, unitId), with: { plate: true, client: { columns: { tradeName: true } } } });
  if (!unit || unit.status !== "INSTALADA") return;
  await db.transaction(async (tx) => {
    if (unit.contractId && unit.deal === "ALUGUEL") {
      await tx.update(t.contracts).set({ status: "CANCELED", endedAt: new Date() }).where(eq(t.contracts.id, unit.contractId));
    }
    if (unit.plateId) await tx.update(t.plates).set({ active: false }).where(eq(t.plates.id, unit.plateId));
    await tx
      .update(t.plateUnits)
      .set({ status: "ESTOQUE", clientId: null, plateId: null, deal: null, priceCents: null, contractId: null, startedAt: null, endsAt: null })
      .where(eq(t.plateUnits.id, unitId));
  });
  if (unit.plate) await invalidateSlugs(unit.plate.slug);
  await logEvent(unitId, "devolvida", `Devolvida por ${unit.client?.tradeName ?? "cliente"}; voltou ao estoque${unit.deal === "ALUGUEL" ? " e o aluguel foi encerrado" : ""}`, user);
  await audit(user, "inventory.unit.return", { entity: "plate_unit", entityId: unitId, meta: { code: unit.code } });
  revalidatePath(`/painel/estoque/${unitId}`);
  revalidatePath("/painel/estoque");
}

const statusSchema = z.enum(["ESTOQUE", "DEFEITO", "BAIXADA"]);

export async function setUnitStatusAction(form: FormData) {
  const user = await requirePermission("inventory:manage");
  const unitId = String(form.get("id"));
  const status = statusSchema.safeParse(form.get("status"));
  if (!status.success) return;
  const unit = await db.query.plateUnits.findFirst({ where: eq(t.plateUnits.id, unitId) });
  if (!unit || unit.status === "INSTALADA") return; // instalada: primeiro devolver
  await db.update(t.plateUnits).set({ status: status.data }).where(eq(t.plateUnits.id, unitId));
  const label = { ESTOQUE: "Voltou ao estoque", DEFEITO: "Marcada com defeito", BAIXADA: "Baixada (descartada)" }[status.data];
  await logEvent(unitId, status.data.toLowerCase(), label, user);
  revalidatePath(`/painel/estoque/${unitId}`);
  revalidatePath("/painel/estoque");
}

/** Guarda o número de série (UID) do chip lido pelo celular. */
export async function saveNfcUidAction(unitId: string, uid: string) {
  const user = await requirePermission("inventory:manage");
  const clean = uid.trim().toUpperCase();
  if (!/^[0-9A-F:]{8,40}$/.test(clean)) return { ok: false, message: "UID inválido" };
  await db.update(t.plateUnits).set({ nfcUid: clean }).where(eq(t.plateUnits.id, unitId));
  await logEvent(unitId, "nfc", `Chip NFC registrado (${clean})`, user);
  revalidatePath(`/painel/estoque/${unitId}`);
  return { ok: true, message: "Chip registrado." };
}

export async function deleteModelAction(form: FormData) {
  await requirePermission("inventory:manage");
  await db.update(t.plateModels).set({ active: false }).where(eq(t.plateModels.id, String(form.get("id"))));
  revalidatePath("/painel/estoque");
  redirect("/painel/estoque?aba=modelos");
}
