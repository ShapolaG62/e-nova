import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { getObjectBuffer } from "@/lib/storage";

/** Baixa uma cópia (backup) da página. Sempre como anexo — nunca renderiza o HTML aqui (evita XSS). */
export async function GET(_: NextRequest, ctx: RouteContext<"/api/snapshots/[id]">) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "monitors:read")) return new NextResponse(null, { status: 401 });
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse(null, { status: 404 });

  const [snap] = await db
    .select({ key: t.siteSnapshots.storageKey, createdAt: t.siteSnapshots.createdAt, clientId: t.monitors.clientId, name: t.monitors.name })
    .from(t.siteSnapshots)
    .innerJoin(t.monitors, eq(t.monitors.id, t.siteSnapshots.monitorId))
    .where(eq(t.siteSnapshots.id, id));
  if (!snap || (user.role === "CLIENT" && snap.clientId !== user.clientId)) return new NextResponse(null, { status: 404 });

  const buf = await getObjectBuffer(snap.key);
  const name = `${snap.name.replace(/[^\w-]+/g, "-")}-${snap.createdAt.toISOString().slice(0, 10)}.html`;
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${name}"`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
