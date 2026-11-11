import { NextResponse, type NextRequest } from "next/server";

/**
 * Checagem otimista: sem cookie de sessão → manda para /login.
 * A validação real (assinatura do JWT, usuário ativo, papel) acontece no
 * servidor em requireUser()/requirePermission() — o proxy é só um atalho.
 */
export function proxy(req: NextRequest) {
  if (!req.cookies.has("enova_session")) {
    const url = new URL("/login", req.url);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/painel/:path*", "/api/plaquinhas/:path*"],
};
