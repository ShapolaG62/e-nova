"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, t } from "@/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession, requireUser } from "@/lib/auth/session";
import QRCode from "qrcode";
import { newRecoveryCodes, newTotpSecret, totpUri, verifyTotp } from "@/lib/auth/totp";
import { audit } from "@/lib/audit";
import { decrypt, encrypt } from "@/lib/crypto";
import { features } from "@/lib/env";
import { zodErrors, type ActionState } from "@/lib/validation";

const pwSchema = z
  .object({
    current: z.string().min(1, "Informe a senha atual"),
    next: z
      .string()
      .min(12, "Use pelo menos 12 caracteres")
      .max(200)
      .refine((v) => /[a-z]/i.test(v) && /\d/.test(v), "Misture letras e números"),
    confirm: z.string(),
  })
  .refine((v) => v.next === v.confirm, { message: "As senhas não conferem", path: ["confirm"] });

/** Troca a senha e derruba as sessões em outros aparelhos. */
export async function changePasswordAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await requireUser();
  const p = pwSchema.safeParse(Object.fromEntries(form));
  if (!p.success) return zodErrors(p.error);
  const user = await db.query.users.findFirst({ where: eq(t.users.id, me.id) });
  if (!user || !(await verifyPassword(p.data.current, user.passwordHash))) return { ok: false, errors: { current: ["Senha atual incorreta"] } };
  const [u] = await db
    .update(t.users)
    .set({ passwordHash: await hashPassword(p.data.next), sessionVersion: sql`${t.users.sessionVersion} + 1` })
    .where(eq(t.users.id, me.id))
    .returning({ ver: t.users.sessionVersion });
  await createSession(me.id, me.role, u.ver); // continua logado aqui
  await audit(me, "account.password_change", { entity: "user", entityId: me.id });
  return { ok: true, message: "Senha trocada. Os outros aparelhos foram desconectados." };
}

export async function signOutEverywhereAction() {
  const me = await requireUser();
  await db.update(t.users).set({ sessionVersion: sql`${t.users.sessionVersion} + 1` }).where(eq(t.users.id, me.id));
  await audit(me, "account.signout_all", { entity: "user", entityId: me.id });
  await destroySession();
  redirect("/login");
}

// ─── 2FA ─────────────────────────────────────────────────────────────────
export type TotpSetup = ActionState & { secret?: string; qr?: string; recovery?: string[] };

/** Passo 1: gera o segredo (ainda não ativa) e devolve para mostrar o QR. */
export async function beginTotpAction(): Promise<TotpSetup> {
  const me = await requireUser();
  if (!features.encryption) return { ok: false, message: "Defina ENCRYPTION_KEY no servidor antes de ativar o 2FA." };
  const secret = newTotpSecret();
  await db.update(t.users).set({ totpSecretEnc: encrypt(secret), totpEnabled: false }).where(eq(t.users.id, me.id));
  const qr = await QRCode.toDataURL(totpUri(secret, me.email), { margin: 2, width: 240 });
  return { ok: true, secret, qr };
}

/** Passo 2: confirma com um código do app, ativa e mostra os códigos de recuperação uma única vez. */
export async function confirmTotpAction(_: TotpSetup, form: FormData): Promise<TotpSetup> {
  const me = await requireUser();
  const user = await db.query.users.findFirst({ where: eq(t.users.id, me.id) });
  if (!user?.totpSecretEnc) return { ok: false, message: "Comece a configuração de novo." };
  if (!verifyTotp(decrypt(user.totpSecretEnc), String(form.get("code") ?? ""))) return { ok: false, errors: { code: ["Código incorreto. Confira o relógio do celular."] } };
  const codes = newRecoveryCodes();
  // Não mexe em cookie aqui: o Next atualizaria a página e esconderia os códigos de recuperação
  await db.update(t.users).set({ totpEnabled: true, recoveryCodes: codes.hashed }).where(eq(t.users.id, me.id));
  await audit(me, "account.2fa_enable", { entity: "user", entityId: me.id });
  // Sem revalidar aqui: a tela precisa continuar mostrando os códigos até a pessoa confirmar que guardou
  return { ok: true, message: "Verificação em duas etapas ativada.", recovery: codes.plain };
}

export async function disableTotpAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await requireUser();
  const user = await db.query.users.findFirst({ where: eq(t.users.id, me.id) });
  if (!user?.totpEnabled || !user.totpSecretEnc) return { ok: false, message: "O 2FA já está desligado." };
  if (!verifyTotp(decrypt(user.totpSecretEnc), String(form.get("code") ?? ""))) return { ok: false, errors: { code: ["Código incorreto."] } };
  await db.update(t.users).set({ totpEnabled: false, totpSecretEnc: null, recoveryCodes: [] }).where(eq(t.users.id, me.id));
  await audit(me, "account.2fa_disable", { entity: "user", entityId: me.id });
  revalidatePath("/painel/conta");
  return { ok: true, message: "2FA desativado." };
}
