import { Readable } from "node:stream";
import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { localReadStream, objectSize, openObjectStream, storageMode } from "@/lib/storage";

const MIME: Record<string, string> = { mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime", png: "image/png", jpg: "image/jpeg", webp: "image/webp", mp3: "audio/mpeg", wav: "audio/wav", m4a: "audio/mp4", ogg: "audio/ogg" };

/**
 * GET /api/gerador/:id/arquivo?k=<chave> — um arquivo de um projeto do Gerador de vídeos.
 * Só chaves do próprio projeto (gerador/<id>/…) e só para quem pode usar a IA. Suporta Range. ?baixar=1 força download.
 */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/gerador/[id]/arquivo">) {
  const { id } = await ctx.params;
  const k = req.nextUrl.searchParams.get("k") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id) || !k.startsWith(`gerador/${id}/`) || k.includes("..") || !/^[\w./-]+$/.test(k)) return new NextResponse(null, { status: 404 });
  const user = await getCurrentUser();
  if (!user || !can(user.role, "ai:use")) return new NextResponse(null, { status: 404 });
  const [p] = await db.select({ userId: t.videoProjetos.userId }).from(t.videoProjetos).where(eq(t.videoProjetos.id, id)).limit(1);
  if (!p || (p.userId !== user.id && !can(user.role, "system:view"))) return new NextResponse(null, { status: 404 });

  const ext = k.split(".").pop()?.toLowerCase() ?? "";
  const headers: Record<string, string> = { "Content-Type": MIME[ext] ?? "application/octet-stream", "Accept-Ranges": "bytes", "Cache-Control": "private, max-age=600", "X-Content-Type-Options": "nosniff" };
  if (req.nextUrl.searchParams.get("baixar") && k.endsWith("/video.mp4")) {
    const { registrar } = await import("@/lib/aprendizado");
    void registrar("videos", id, "baixado", { userId: user.id });
  }
  if (req.nextUrl.searchParams.get("baixar")) headers["Content-Disposition"] = `attachment; filename="${(req.nextUrl.searchParams.get("nome") ?? k.split("/").pop() ?? "arquivo").replace(/[^\w.\- ]/g, "_")}"`;

  if (storageMode() === "s3") {
    const { stream, size } = await openObjectStream(k);
    return new NextResponse(Readable.toWeb(stream) as ReadableStream, { headers: { ...headers, ...(size ? { "Content-Length": String(size) } : {}) } });
  }
  const size = await objectSize(k);
  if (!size) return new NextResponse(null, { status: 404 });
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") ?? "");
  if (range && (range[1] || range[2])) {
    let start = range[1] ? Number(range[1]) : size - Number(range[2]);
    let end = range[1] && range[2] ? Number(range[2]) : size - 1;
    start = Math.max(0, start);
    end = Math.min(end, size - 1);
    if (start > end) return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    return new NextResponse(Readable.toWeb(localReadStream(k, { start, end })) as ReadableStream, { status: 206, headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) } });
  }
  return new NextResponse(Readable.toWeb(localReadStream(k)) as ReadableStream, { headers: { ...headers, "Content-Length": String(size) } });
}
