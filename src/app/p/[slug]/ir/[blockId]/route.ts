import { after, NextResponse, type NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { recordPageEvent } from "@/lib/page-analytics";
import { embedUrl } from "@/lib/pages";

/**
 * GET /p/:slug/ir/:blockId[?item=…] — conta o clique e redireciona.
 * O destino vem SEMPRE do bloco salvo no banco (nunca da URL), então não vira
 * um "redirecionador aberto" usado em golpes.
 */
export async function GET(req: NextRequest, ctx: RouteContext<"/p/[slug]/ir/[blockId]">) {
  const { slug, blockId } = await ctx.params;
  const page = await db.query.sitePages.findFirst({ where: and(eq(t.sitePages.slug, slug), eq(t.sitePages.status, "PUBLICADA")) });
  if (!page) return NextResponse.redirect(new URL("/", req.url));

  const block = page.blocks.find((b) => b.id === blockId);
  const item = req.nextUrl.searchParams.get("item");
  let target: string | null = null;
  if (block?.type === "button") target = block.url;
  else if (block?.type === "links") target = block.items.find((i) => i.id === item)?.url ?? null;
  else if (block?.type === "whatsapp") target = `https://wa.me/${block.phone}${block.message ? `?text=${encodeURIComponent(block.message)}` : ""}`;
  else if (block?.type === "review") target = `/r/${block.plateSlug}`;
  else if (block?.type === "video") target = embedUrl(block.url) ? block.url : null;
  if (!target) return NextResponse.redirect(new URL(`/p/${slug}`, req.url));

  const h = new Headers(req.headers);
  after(() => recordPageEvent(page.id, h, "click", { blockId: item ? `${blockId}:${item}` : blockId }).catch(() => {}));
  const res = NextResponse.redirect(target.startsWith("/") ? new URL(target, req.url) : target, 302);
  res.headers.set("Cache-Control", "no-store");
  return res;
}
