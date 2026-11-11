import "server-only";
import { eq } from "drizzle-orm";
import { db, t } from "@/db";

/** Configurações editáveis pelo painel (guardadas no banco, com cache curto). */
const cache = new Map<string, { v: unknown; at: number }>();

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 30_000) return hit.v as T;
  const row = await db.query.appSettings.findFirst({ where: eq(t.appSettings.key, key) });
  const v = (row?.value as T) ?? fallback;
  cache.set(key, { v, at: Date.now() });
  return v;
}

export async function setSetting(key: string, value: unknown) {
  // A coluna é jsonb NOT NULL: "null" significa apagar (getSetting volta ao padrão)
  if (value === null || value === undefined) {
    await db.delete(t.appSettings).where(eq(t.appSettings.key, key));
    cache.delete(key);
    return;
  }
  await db
    .insert(t.appSettings)
    .values({ key, value })
    .onConflictDoUpdate({ target: t.appSettings.key, set: { value, updatedAt: new Date() } });
  cache.delete(key);
}
