import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect, forbidden } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import { env } from "@/lib/env";
import type { Role } from "@/db/schema";
import { can, type Permission } from "./rbac";

export const SESSION_COOKIE = "enova_session";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 dias
const key = new TextEncoder().encode(env.AUTH_SECRET);

// ver = users.session_version: subir o número invalida todas as sessões abertas
type Payload = { sub: string; role: Role; ver: number; purpose?: "mfa" };

export async function createSession(userId: string, role: Role, ver: number) {
  const token = await new SignJWT({ role, ver } satisfies Omit<Payload, "sub">)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(key);

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession() {
  (await cookies()).delete(SESSION_COOKIE);
}

// ─── Etapa do 2FA: senha certa, falta o código ───────────────────────────
export const MFA_COOKIE = "enova_mfa";

export async function startMfa(userId: string, role: Role, ver: number) {
  const token = await new SignJWT({ role, ver, purpose: "mfa" } satisfies Omit<Payload, "sub">)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(key);
  (await cookies()).set(MFA_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/login", maxAge: 300 });
}

export async function readMfa(): Promise<{ userId: string; ver: number } | null> {
  const token = (await cookies()).get(MFA_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify<Payload>(token, key, { algorithms: ["HS256"] });
    if (payload.purpose !== "mfa" || !payload.sub) return null;
    return { userId: payload.sub, ver: payload.ver };
  } catch {
    return null;
  }
}

export async function clearMfa() {
  (await cookies()).delete({ name: MFA_COOKIE, path: "/login" });
}

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  clientId: string | null;
};

/**
 * Valida o JWT e confirma no banco que o usuário ainda existe e está ativo
 * (desativar um usuário derruba a sessão na próxima requisição).
 * `cache` deduplica a consulta dentro do mesmo render.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify<Payload>(token, key, { algorithms: ["HS256"] });
    if (!payload.sub || payload.purpose === "mfa") return null; // token de 2FA não vale como sessão
    const user = await db.query.users.findFirst({
      where: eq(t.users.id, payload.sub),
      columns: { id: true, name: true, email: true, role: true, clientId: true, active: true, sessionVersion: true },
    });
    if (!user?.active) return null;
    if (payload.ver !== user.sessionVersion) return null; // senha trocada / "sair de todos"
    return { id: user.id, name: user.name, email: user.email, role: user.role, clientId: user.clientId };
  } catch {
    return null;
  }
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requirePermission(permission: Permission): Promise<SessionUser> {
  const user = await requireUser();
  if (!can(user.role, permission)) forbidden();
  return user;
}

/** CLIENT só acessa o próprio estabelecimento; equipe acessa todos. */
export function canAccessClient(user: SessionUser, clientId: string) {
  return user.role !== "CLIENT" || user.clientId === clientId;
}

/**
 * Filtro de cliente para listagens: CLIENT só enxerga o próprio estabelecimento
 * (ou nada, se não estiver ligado a um); equipe vê o filtro escolhido ou todos.
 */
export function scopeClientId(user: SessionUser, requested?: string | null): string | null {
  if (user.role === "CLIENT") return user.clientId ?? "00000000-0000-0000-0000-000000000000";
  return requested && /^[0-9a-f-]{36}$/i.test(requested) ? requested : null;
}
