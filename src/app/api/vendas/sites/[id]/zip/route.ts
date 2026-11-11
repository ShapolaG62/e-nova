import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { zipSite } from "@/lib/sites/service";

/** GET /api/vendas/sites/:id/zip — baixa o site pronto (index.html + imagens). */
export async function GET(_: Request, ctx: RouteContext<"/api/vendas/sites/[id]/zip">) {
  const u = await getCurrentUser();
  if (!u || !can(u.role, "sites:write")) return new Response(null, { status: 401 });
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response(null, { status: 404 });
  const site = await db.query.generatedSites.findFirst({ where: eq(t.generatedSites.id, id) });
  if (!site) return new Response("Não encontrado", { status: 404 });
  const nome = (site.slug || site.name).normalize("NFD").replace(/[^\w-]+/g, "-").slice(0, 60);
  return new Response(new Uint8Array(await zipSite(site)), {
    headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${nome}.zip"` },
  });
}
