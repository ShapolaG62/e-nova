import { after, type NextRequest } from "next/server";
import { and, desc, eq, gte } from "drizzle-orm";
import { db, t } from "@/db";
import { renderSite, type SiteDoc } from "@/lib/sites/engine";
import { addHistorico, registrarEvento } from "@/lib/sites/service";

const BOT = /bot|crawler|spider|preview|facebookexternalhit|whatsapp|telegram|slack|discord|curl|wget/i;

/** GET /s/:slug — site gerado e publicado. Conta a visita (sem cookie) para o funil. */
export async function GET(req: NextRequest, ctx: RouteContext<"/s/[slug]">) {
  const { slug } = await ctx.params;
  if (!/^[a-z0-9-]{2,64}$/.test(slug)) return naoEncontrado();
  const site = await db.query.generatedSites.findFirst({ where: and(eq(t.generatedSites.slug, slug), eq(t.generatedSites.published, true)) });
  if (!site) return naoEncontrado();
  const ua = req.headers.get("user-agent") ?? "";
  if (!BOT.test(ua)) {
    after(async () => {
      // uma visita a cada 30 min por site, para não poluir o funil
      const recente = await db.query.salesEvents.findFirst({
        where: and(eq(t.salesEvents.kind, "visita"), eq(t.salesEvents.siteId, site.id), gte(t.salesEvents.createdAt, new Date(Date.now() - 30 * 60e3))),
        orderBy: desc(t.salesEvents.createdAt),
      });
      if (recente) return;
      await registrarEvento("visita", { prospectId: site.prospectId, siteId: site.id, meta: { slug } });
      if (site.prospectId) await addHistorico(site.prospectId, "visita", "Abriu o site");
    });
  }
  return new Response(renderSite(site.doc as unknown as SiteDoc), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

function naoEncontrado() {
  return new Response(
    "<!doctype html><meta charset=\"utf-8\"><title>Site não encontrado</title><body style=\"font-family:sans-serif;display:grid;place-items:center;height:90vh\"><p>Este site não está publicado.</p>",
    { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}
