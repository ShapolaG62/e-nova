"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requirePermission } from "@/lib/auth/session";
import { invalidateSlugs } from "@/lib/nfc/resolve";
import { plateSchema, slugify, zodErrors, type ActionState } from "@/lib/validation";

const isUnique = (e: unknown) => {
  const err = e as { code?: string; cause?: { code?: string } };
  return err?.code === "23505" || err?.cause?.code === "23505";
};

export async function createPlateAction(clientId: string, _: ActionState, form: FormData): Promise<ActionState> {
  await requirePermission("plates:write");
  const parsed = plateSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return zodErrors(parsed.error);

  const client = await db.query.clients.findFirst({ where: eq(t.clients.id, clientId), columns: { tradeName: true } });
  if (!client) return { ok: false, message: "Cliente não encontrado." };

  const { slug: custom, ...rest } = parsed.data;
  // Slug automático: nome-fantasia + sufixo aleatório (difícil de adivinhar).
  // Até 3 tentativas em caso de colisão.
  for (let attempt = 0; attempt < 3; attempt++) {
    const slug = custom ?? `${slugify(client.tradeName) || "loja"}-${randomBytes(3).toString("hex")}`;
    try {
      await db.insert(t.plates).values({ ...rest, clientId, slug });
      await invalidateSlugs(slug); // limpa um eventual "não existe" cacheado
      revalidatePath(`/painel/clientes/${clientId}`);
      return { ok: true, message: `Plaquinha criada: /r/${slug}` };
    } catch (e) {
      if (!isUnique(e)) throw e;
      if (custom) return { ok: false, errors: { slug: ["Este slug já está em uso"] } };
    }
  }
  return { ok: false, message: "Não foi possível gerar um slug único. Tente de novo." };
}

export async function updatePlateAction(plateId: string, _: ActionState, form: FormData): Promise<ActionState> {
  await requirePermission("plates:write");
  const parsed = plateSchema.omit({ slug: true }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return zodErrors(parsed.error);
  const [row] = await db
    .update(t.plates)
    .set(parsed.data)
    .where(eq(t.plates.id, plateId))
    .returning({ slug: t.plates.slug, clientId: t.plates.clientId });
  if (!row) return { ok: false, message: "Plaquinha não encontrada." };
  await invalidateSlugs(row.slug);
  revalidatePath(`/painel/plaquinhas/${plateId}`);
  revalidatePath(`/painel/clientes/${row.clientId}`);
  return { ok: true, message: "Plaquinha salva." };
}

export async function togglePlateAction(form: FormData) {
  await requirePermission("plates:write");
  const id = String(form.get("id"));
  const active = form.get("active") === "true";
  const [row] = await db
    .update(t.plates)
    .set({ active })
    .where(eq(t.plates.id, id))
    .returning({ slug: t.plates.slug, clientId: t.plates.clientId });
  if (!row) return;
  await invalidateSlugs(row.slug);
  revalidatePath(`/painel/plaquinhas/${id}`);
  revalidatePath(`/painel/clientes/${row.clientId}`);
}
