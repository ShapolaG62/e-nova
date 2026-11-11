"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";
import { db, t } from "@/db";
import { hashPassword } from "@/lib/auth/password";
import { requirePermission } from "@/lib/auth/session";
import { userSchema, zodErrors, type ActionState } from "@/lib/validation";
import { audit } from "@/lib/audit";

export async function createUserAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await requirePermission("users:manage");
  const parsed = userSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return zodErrors(parsed.error);
  const { password, clientId, role, ...rest } = parsed.data;
  try {
    await db.insert(t.users).values({
      ...rest,
      role,
      clientId: role === "CLIENT" ? clientId : null,
      passwordHash: await hashPassword(password),
    });
  } catch (e) {
    const err = e as { code?: string; cause?: { code?: string } };
    if (err?.code === "23505" || err?.cause?.code === "23505")
      return { ok: false, errors: { email: ["E-mail já cadastrado"] } };
    throw e;
  }
  await audit(me, "user.create", { entity: "user", meta: { email: rest.email, role } });
  revalidatePath("/painel/usuarios");
  return { ok: true, message: "Usuário criado." };
}

export async function toggleUserAction(form: FormData) {
  const me = await requirePermission("users:manage");
  const id = String(form.get("id"));
  const active = form.get("active") === "true";
  // Ninguém desativa a si mesmo (evita trancar o último sócio fora).
  await db
    .update(t.users)
    .set({ active })
    .where(and(eq(t.users.id, id), ne(t.users.id, me.id)));
  await audit(me, active ? "user.activate" : "user.deactivate", { entity: "user", entityId: id });
  revalidatePath("/painel/usuarios");
}
