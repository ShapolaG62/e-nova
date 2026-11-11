"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, t } from "@/db";
import { verifyPassword } from "@/lib/auth/password";
import { clearMfa, createSession, destroySession, getCurrentUser, readMfa, startMfa } from "@/lib/auth/session";
import { consumeRecoveryCode, verifyTotp } from "@/lib/auth/totp";
import { audit } from "@/lib/audit";
import { decrypt } from "@/lib/crypto";
import { rateLimit } from "@/lib/cache";
import type { ActionState } from "@/lib/validation";

const loginSchema = z.object({
  // E-mail ou nome de usuário (ex.: "admin" no ambiente local)
  email: z.string().trim().toLowerCase().min(1).max(200),
  password: z.string().min(1).max(200),
});

// Hash fixo para gastar o mesmo tempo quando o e-mail não existe (evita descobrir e-mails).
const DUMMY_HASH = "scrypt$00000000000000000000000000000000$" + "0".repeat(128);
const MAX_FAILS = 5;
const LOCK_MINUTES = 15;
// Mesma mensagem para senha errada e conta bloqueada: não revela quais e-mails existem
const GENERIC = "E-mail ou senha inválidos. Depois de 5 erros seguidos, a conta fica bloqueada por 15 minutos.";

async function clientIp() {
  const h = await headers();
  return h.get("cf-connecting-ip") ?? h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
}

export async function loginAction(_: ActionState, form: FormData): Promise<ActionState> {
  // Limite por IP (o cabeçalho pode ser falsificado sem proxy confiável) + bloqueio por conta abaixo
  if (!(await rateLimit(`login:${await clientIp()}`, 10, 60))) return { ok: false, message: "Muitas tentativas. Aguarde 1 minuto." };

  const parsed = loginSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { ok: false, message: GENERIC };

  const user = await db.query.users.findFirst({ where: sql`lower(${t.users.email}) = ${parsed.data.email}` });
  if (user?.lockedUntil && user.lockedUntil > new Date()) {
    await audit(user, "login.locked", { entity: "user", entityId: user.id, label: user.email });
    return { ok: false, message: GENERIC };
  }
  const ok = await verifyPassword(parsed.data.password, user?.passwordHash ?? DUMMY_HASH);

  if (!user || !ok || !user.active) {
    if (user) {
      const fails = user.failedLogins + 1;
      await db
        .update(t.users)
        .set({ failedLogins: fails >= MAX_FAILS ? 0 : fails, lockedUntil: fails >= MAX_FAILS ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null })
        .where(eq(t.users.id, user.id));
    }
    await audit(user ?? null, "login.fail", { entity: "user", entityId: user?.id, label: parsed.data.email });
    return { ok: false, message: GENERIC };
  }

  await db.update(t.users).set({ failedLogins: 0, lockedUntil: null }).where(eq(t.users.id, user.id));
  if (user.totpEnabled) {
    await startMfa(user.id, user.role, user.sessionVersion);
    redirect("/login/verificar");
  }
  await db.update(t.users).set({ lastLoginAt: new Date() }).where(eq(t.users.id, user.id));
  await createSession(user.id, user.role, user.sessionVersion);
  await audit(user, "login.ok", { entity: "user", entityId: user.id });
  redirect("/painel");
}

/** Segunda etapa: código do app autenticador ou código de recuperação. */
export async function verifyMfaAction(_: ActionState, form: FormData): Promise<ActionState> {
  const pending = await readMfa();
  if (!pending) return { ok: false, message: "A verificação expirou. Entre de novo com e-mail e senha." };
  if (!(await rateLimit(`mfa:${pending.userId}`, 5, 300))) return { ok: false, message: "Muitas tentativas. Aguarde 5 minutos." };

  const user = await db.query.users.findFirst({ where: eq(t.users.id, pending.userId) });
  if (!user?.active || !user.totpEnabled || !user.totpSecretEnc || user.sessionVersion !== pending.ver) return { ok: false, message: "Entre de novo com e-mail e senha." };

  const code = String(form.get("code") ?? "").trim();
  let valid = verifyTotp(decrypt(user.totpSecretEnc), code);
  let usedRecovery = false;
  if (!valid && code.length >= 10) {
    const left = consumeRecoveryCode(user.recoveryCodes, code);
    if (left) {
      await db.update(t.users).set({ recoveryCodes: left }).where(eq(t.users.id, user.id));
      valid = true;
      usedRecovery = true;
    }
  }
  if (!valid) {
    await audit(user, "login.mfa_fail", { entity: "user", entityId: user.id });
    return { ok: false, errors: { code: ["Código incorreto ou expirado."] } };
  }

  await clearMfa();
  await db.update(t.users).set({ lastLoginAt: new Date() }).where(eq(t.users.id, user.id));
  await createSession(user.id, user.role, user.sessionVersion);
  await audit(user, usedRecovery ? "login.ok_recovery_code" : "login.ok", { entity: "user", entityId: user.id, meta: { mfa: true } });
  redirect("/painel");
}

export async function logoutAction() {
  const user = await getCurrentUser();
  if (user) await audit(user, "logout", { entity: "user", entityId: user.id });
  await destroySession();
  redirect("/login");
}
