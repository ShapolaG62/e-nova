import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { renderSite, type SiteDoc } from "@/lib/sites/engine";

/** POST /api/vendas/render — prévia ao vivo do editor (renderiza o documento sem salvar). */
export async function POST(req: Request) {
  const u = await getCurrentUser();
  if (!u || !can(u.role, "sites:write")) return new Response(null, { status: 401 });
  const body = (await req.json().catch(() => null)) as { site?: SiteDoc; editor?: boolean } | null;
  if (!body?.site?.blocos) return new Response("Documento inválido", { status: 400 });
  return new Response(renderSite(body.site, { editor: !!body.editor }), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}
