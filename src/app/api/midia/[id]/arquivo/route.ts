import { Readable } from "node:stream";
import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import { canAccessClient, getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { verifySignature } from "@/lib/crypto";
import { localReadStream, objectSize, storageMode, temporaryUrl } from "@/lib/storage";

/**
 * GET /api/midia/:id/arquivo
 * - Com ?exp&sig válidos (link temporário): acesso público — é o que Instagram/TikTok baixam.
 * - Sem assinatura: exige sessão com acesso ao cliente (preview no painel).
 * Suporta Range (o player do navegador e as plataformas pedem por partes).
 */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/midia/[id]/arquivo">) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse(null, { status: 404 });
  const asset = await db.query.mediaAssets.findFirst({ where: eq(t.mediaAssets.id, id) });
  if (!asset || asset.status !== "READY") return new NextResponse(null, { status: 404 });

  const exp = req.nextUrl.searchParams.get("exp");
  const sig = req.nextUrl.searchParams.get("sig");
  const signed = !!exp && !!sig && Number(exp) > Date.now() / 1000 && verifySignature(`${id}:${exp}`, sig);
  if (!signed) {
    const user = await getCurrentUser();
    if (!user || !can(user.role, "content:read") || !canAccessClient(user, asset.clientId)) return new NextResponse(null, { status: 404 });
  }

  if (storageMode() === "s3") return NextResponse.redirect(await temporaryUrl(asset.storageKey, asset.id, 3600));

  const size = await objectSize(asset.storageKey);
  if (!size) return new NextResponse(null, { status: 404 });
  const headers: Record<string, string> = {
    "Content-Type": asset.mime,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=3600",
  };

  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") ?? "");
  if (range) {
    let start = range[1] ? Number(range[1]) : size - Number(range[2]);
    let end = range[1] && range[2] ? Number(range[2]) : size - 1;
    start = Math.max(0, start);
    end = Math.min(end, size - 1);
    if (start > end) return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    const stream = Readable.toWeb(localReadStream(asset.storageKey, { start, end })) as ReadableStream;
    return new NextResponse(stream, { status: 206, headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) } });
  }
  const stream = Readable.toWeb(localReadStream(asset.storageKey)) as ReadableStream;
  return new NextResponse(stream, { headers: { ...headers, "Content-Length": String(size) } });
}
