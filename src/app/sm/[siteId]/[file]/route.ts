import { getObjectBuffer } from "@/lib/storage";

/** GET /sm/:siteId/:arquivo — imagens dos sites gerados (públicas: aparecem nos sites publicados). */
export async function GET(_: Request, ctx: RouteContext<"/sm/[siteId]/[file]">) {
  const { siteId, file } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(siteId) || !/^[\w-]{1,40}\.(jpg|png|webp)$/.test(file)) return new Response("Não encontrado", { status: 404 });
  try {
    const buf = await getObjectBuffer(`sites/${siteId}/${file}`);
    const tipo = file.endsWith(".png") ? "image/png" : file.endsWith(".webp") ? "image/webp" : "image/jpeg";
    return new Response(new Uint8Array(buf), { headers: { "Content-Type": tipo, "Cache-Control": "public, max-age=604800, immutable" } });
  } catch {
    return new Response("Não encontrado", { status: 404 });
  }
}
