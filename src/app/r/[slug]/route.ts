import { after, NextResponse, type NextRequest } from "next/server";
import { decide, getPlateRoute, SLUG_RE } from "@/lib/nfc/resolve";
import { recordTap, tapContextFromHeaders } from "@/lib/nfc/telemetry";

/**
 * GET /r/[slug] — rota pública das plaquinhas NFC/QR.
 * Caminho quente: 1 leitura de cache → 302. A telemetria roda em `after()`,
 * depois que a resposta já saiu, então não soma latência ao redirect.
 */
export async function GET(req: NextRequest, ctx: RouteContext<"/r/[slug]">) {
  const { slug: raw } = await ctx.params;
  const slug = raw.toLowerCase();
  const origin = req.nextUrl.origin;

  if (!SLUG_RE.test(slug)) return notFound(origin);

  let route;
  try {
    route = await getPlateRoute(slug);
  } catch (err) {
    console.error("[r/slug] falha ao resolver", slug, err);
    return NextResponse.redirect(new URL(`/indisponivel/${slug}?motivo=erro`, origin), 302);
  }
  if (!route) return notFound(origin);

  const decision = decide(route, new Date(), slug);
  const tapCtx = tapContextFromHeaders(req.headers);

  after(() =>
    recordTap({ plateId: route.plateId, clientId: route.clientId, outcome: decision.outcome }, tapCtx).catch((e) =>
      console.error("[r/slug] falha na telemetria", slug, e),
    ),
  );

  const location =
    decision.kind === "redirect"
      ? new URL(decision.url, origin).toString()
      : new URL(`/indisponivel/${slug}?motivo=${decision.outcome.toLowerCase()}`, origin).toString();

  const res = NextResponse.redirect(location, 302);
  // Nunca cachear o 302 no navegador/CDN: o status do cliente pode mudar a qualquer momento.
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}

function notFound(origin: string) {
  const res = NextResponse.redirect(new URL("/indisponivel/nao-encontrada?motivo=nao_encontrada", origin), 302);
  res.headers.set("Cache-Control", "no-store");
  return res;
}
