import { Readable } from "node:stream";
import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { localReadStream, objectSize, openObjectStream, storageMode } from "@/lib/storage";

const EXT: Record<string, string> = { "video/mp4": "mp4", "video/webm": "webm", "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "audio/mpeg": "mp3", "audio/wav": "wav", "audio/mp4": "m4a", "audio/ogg": "ogg" };

/**
 * GET /api/ia/tarefas/:id/arquivo/:n — arquivo n (começa em 0) do resultado de uma tarefa da Central de IA.
 * Exige sessão com "ai:use". Suporta Range (players de vídeo/áudio). ?baixar=1 força download.
 */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/ia/tarefas/[id]/arquivo/[n]">) {
  const { id, n } = await ctx.params;
  const idx = Number(n);
  if (!/^[0-9a-f-]{36}$/i.test(id) || !Number.isInteger(idx) || idx < 0) return new NextResponse(null, { status: 404 });
  const user = await getCurrentUser();
  if (!user || !can(user.role, "ai:use")) return new NextResponse(null, { status: 404 });

  const [tarefa] = await db.select({ resultado: t.iaTarefas.resultado }).from(t.iaTarefas).where(eq(t.iaTarefas.id, id)).limit(1);
  const arq = tarefa?.resultado?.arquivos?.[idx];
  if (!arq) return new NextResponse(null, { status: 404 });

  const headers: Record<string, string> = {
    "Content-Type": arq.mime,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=3600",
    "X-Content-Type-Options": "nosniff",
  };
  if (req.nextUrl.searchParams.get("baixar")) {
    const nome = (arq.nome || `resultado-${idx + 1}.${EXT[arq.mime] ?? "bin"}`).replace(/[^\w.\- ]/g, "_");
    headers["Content-Disposition"] = `attachment; filename="${nome}"`;
  }

  if (storageMode() === "s3") {
    const { stream, size } = await openObjectStream(arq.chave);
    return new NextResponse(Readable.toWeb(stream) as ReadableStream, { headers: { ...headers, ...(size ? { "Content-Length": String(size) } : {}) } });
  }

  const size = await objectSize(arq.chave);
  if (!size) return new NextResponse(null, { status: 404 });
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") ?? "");
  if (range && (range[1] || range[2])) {
    let start = range[1] ? Number(range[1]) : size - Number(range[2]);
    let end = range[1] && range[2] ? Number(range[2]) : size - 1;
    start = Math.max(0, start);
    end = Math.min(end, size - 1);
    if (start > end) return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    const stream = Readable.toWeb(localReadStream(arq.chave, { start, end })) as ReadableStream;
    return new NextResponse(stream, { status: 206, headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) } });
  }
  const stream = Readable.toWeb(localReadStream(arq.chave)) as ReadableStream;
  return new NextResponse(stream, { headers: { ...headers, "Content-Length": String(size) } });
}
