import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { db, t } from "@/db";
import { env } from "@/lib/env";

/**
 * Trilha de auditoria: quem fez o quê e quando. IP guardado só como hash (LGPD).
 * Nunca lança erro — auditoria não pode derrubar a ação principal.
 */
export async function audit(
  user: { id: string; email?: string } | null,
  action: string,
  opts: { entity?: string; entityId?: string; meta?: Record<string, unknown>; label?: string } = {},
) {
  try {
    let ipHash: string | null = null;
    try {
      const h = await headers();
      const ip = h.get("cf-connecting-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip");
      if (ip) ipHash = createHash("sha256").update(`${env.IP_HASH_SALT}:${ip}`).digest("hex");
    } catch {
      /* fora de requisição (worker) */
    }
    await db.insert(t.auditLogs).values({
      userId: user?.id ?? null,
      userLabel: opts.label ?? user?.email ?? null,
      action,
      entity: opts.entity,
      entityId: opts.entityId,
      ipHash,
      meta: opts.meta ?? {},
    });
  } catch (e) {
    console.error("[audit] falhou", action, e);
  }
}
