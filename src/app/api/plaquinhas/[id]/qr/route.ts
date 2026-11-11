import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, t } from "@/db";
import { canAccessClient, getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { env } from "@/lib/env";
import { fetchLogo, qrPng, qrSvg } from "@/lib/nfc/qrcode";

const query = z.object({
  format: z.enum(["svg", "png"]).default("svg"),
  size: z.coerce.number().int().min(128).max(4096).default(1024),
  margin: z.coerce.number().int().min(4).max(16).default(4), // ≥4 módulos = zona de silêncio da norma
  logo: z.enum(["0", "1"]).default("0"),
  download: z.enum(["0", "1"]).default("0"),
});

/** GET /api/plaquinhas/:id/qr?format=svg|png&size=1024&logo=1&download=1 */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/plaquinhas/[id]/qr">) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!can(user.role, "plates:read")) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const parsed = query.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "invalid_query", issues: z.flattenError(parsed.error) }, { status: 400 });
  const q = parsed.data;

  const [plate] = await db
    .select({ slug: t.plates.slug, label: t.plates.label, clientId: t.plates.clientId, logoUrl: t.clients.logoUrl, client: t.clients.tradeName })
    .from(t.plates)
    .innerJoin(t.clients, eq(t.clients.id, t.plates.clientId))
    .where(eq(t.plates.id, id))
    .limit(1);
  if (!plate || !canAccessClient(user, plate.clientId)) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const url = `${env.APP_URL}/r/${plate.slug}`;
  const logo = q.logo === "1" && plate.logoUrl ? await fetchLogo(plate.logoUrl) : null;
  const opts = { size: q.size, margin: q.margin, logo };

  const filename = `qr-${plate.slug}.${q.format}`;
  const headers: Record<string, string> = {
    "Cache-Control": "private, max-age=300",
    ...(q.download === "1" ? { "Content-Disposition": `attachment; filename="${filename}"` } : {}),
  };

  if (q.format === "svg") {
    return new NextResponse(await qrSvg(url, opts), { headers: { ...headers, "Content-Type": "image/svg+xml; charset=utf-8" } });
  }
  const png = await qrPng(url, opts);
  return new NextResponse(new Uint8Array(png), { headers: { ...headers, "Content-Type": "image/png" } });
}
