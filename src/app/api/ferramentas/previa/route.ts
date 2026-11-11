import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { safeFetch } from "@/lib/net-safety";
import { urlMidiaValida } from "@/lib/ferramentas/pixabay";

const MAX = 40 * 1024 * 1024;

/**
 * GET /api/ferramentas/previa?u=<url> — repassa a prévia curta de um vídeo/GIF da Pixabay ou do GIPHY.
 * A política de segurança do painel só toca vídeo do próprio E-Nova; esta rota serve a prévia daqui.
 * Só aceita os domínios do Banco de mídia e só para quem está logado.
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "ai:use")) return new NextResponse(null, { status: 404 });
  const u = req.nextUrl.searchParams.get("u") ?? "";
  if (!urlMidiaValida(u)) return new NextResponse(null, { status: 400 });
  const r = await safeFetch(u, { signal: AbortSignal.timeout(60_000) });
  if (!r.ok || !r.body) return new NextResponse(null, { status: 502 });
  const tam = Number(r.headers.get("content-length") ?? 0);
  if (tam > MAX) return new NextResponse(null, { status: 413 });
  const tipo = r.headers.get("content-type") ?? "video/mp4";
  if (!/^(video|image)\//.test(tipo)) return new NextResponse(null, { status: 415 });
  return new NextResponse(r.body, {
    headers: { "Content-Type": tipo, ...(tam ? { "Content-Length": String(tam) } : {}), "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff" },
  });
}
