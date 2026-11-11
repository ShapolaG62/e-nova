import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { renderSite, type SiteDoc } from "@/lib/sites/engine";

/** GET /api/vendas/sites/:id/previa[?editor=1] — prévia (mesmo não publicado), só para a equipe. */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/vendas/sites/[id]/previa">) {
  const u = await getCurrentUser();
  if (!u || !can(u.role, "prospects:read")) return new Response(null, { status: 401 });
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response(null, { status: 404 });
  const site = await db.query.generatedSites.findFirst({ where: eq(t.generatedSites.id, id) });
  if (!site) return new Response("Não encontrado", { status: 404 });
  return new Response(renderSite(site.doc as unknown as SiteDoc, { editor: req.nextUrl.searchParams.has("editor") }), {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}
