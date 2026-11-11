import { getCurrentUser } from "@/lib/auth/session";
import { renderSite, montarDocumento } from "@/lib/sites/engine";
import { NEGOCIO_AMOSTRA, FOTOS_AMOSTRA, SETOR_POR_LAYOUT } from "@/lib/sites/amostra";

/** GET /api/vendas/amostra/:layout — prévia de um visual com um negócio de exemplo. */
export async function GET(_: Request, ctx: RouteContext<"/api/vendas/amostra/[layout]">) {
  if (!(await getCurrentUser())) return new Response(null, { status: 401 });
  const { layout } = await ctx.params;
  const doc = montarDocumento(NEGOCIO_AMOSTRA, { setor: SETOR_POR_LAYOUT[layout] ?? "outro", layout, fotos: FOTOS_AMOSTRA });
  return new Response(renderSite(doc), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, max-age=600" } });
}
