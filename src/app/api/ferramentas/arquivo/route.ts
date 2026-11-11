import { Readable } from "node:stream";
import { NextResponse, type NextRequest } from "next/server";
import { conferirLink, mimeDe } from "@/lib/ferramentas/arquivos";
import { localReadStream, objectSize, storageMode, temporaryUrl } from "@/lib/storage";

/**
 * GET /api/ferramentas/arquivo?k&n&exp&sig[&dl=1] — resultado das Ferramentas por link assinado.
 * A assinatura (HMAC + validade) é a autorização: quem tem o link vê o arquivo até ele vencer.
 * Suporta Range (prévia de vídeo/áudio no navegador).
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const link = conferirLink(sp.get("k") ?? "", sp.get("n") ?? "", sp.get("exp") ?? "", sp.get("sig") ?? "");
  if (!link) return new NextResponse("Link inválido ou vencido.", { status: 404 });

  if (storageMode() === "s3") return NextResponse.redirect(await temporaryUrl(link.key, "", 3600));

  const size = await objectSize(link.key);
  if (!size) return new NextResponse("Arquivo não encontrado.", { status: 404 });
  const headers: Record<string, string> = {
    "Content-Type": mimeDe(link.nome),
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=3600",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'; sandbox",
  };
  const ascii = link.nome.replace(/[^\w.\- ()]/g, "_");
  headers["Content-Disposition"] = `${sp.get("dl") ? "attachment" : "inline"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(link.nome)}`;

  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") ?? "");
  if (range && (range[1] || range[2])) {
    let start = range[1] ? Number(range[1]) : size - Number(range[2]);
    let end = range[1] && range[2] ? Number(range[2]) : size - 1;
    start = Math.max(0, start);
    end = Math.min(end, size - 1);
    if (start > end) return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    const stream = Readable.toWeb(localReadStream(link.key, { start, end })) as ReadableStream;
    return new NextResponse(stream, { status: 206, headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) } });
  }
  const stream = Readable.toWeb(localReadStream(link.key)) as ReadableStream;
  return new NextResponse(stream, { headers: { ...headers, "Content-Length": String(size) } });
}
