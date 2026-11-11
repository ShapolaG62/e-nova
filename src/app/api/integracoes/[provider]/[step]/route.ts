import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import { canAccessClient, getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { buildAuthorizeUrl, exchangeCode, fetchAccount, newNonce, parseState, PROVIDERS, saveIntegration, type Provider } from "@/lib/social/oauth";
import { features } from "@/lib/env";

const COOKIE = "enova_oauth_nonce";

/**
 * GET /api/integracoes/:provider/conectar?cliente=… → redireciona ao login oficial
 * GET /api/integracoes/:provider/callback?code&state → troca o código por tokens
 */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/integracoes/[provider]/[step]">) {
  const { provider: raw, step } = await ctx.params;
  const provider = raw.toUpperCase() as Provider;
  if (!(provider in PROVIDERS)) return NextResponse.json({ error: "Plataforma desconhecida" }, { status: 404 });

  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));
  if (!can(user.role, "integrations:manage")) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  if (!PROVIDERS[provider].enabled() || !features.encryption) return NextResponse.json({ error: "Integração não configurada no servidor" }, { status: 503 });

  const jar = await cookies();

  if (step === "conectar") {
    const clientId = req.nextUrl.searchParams.get("cliente") ?? "";
    if (!/^[0-9a-f-]{36}$/i.test(clientId) || !canAccessClient(user, clientId)) return NextResponse.json({ error: "Cliente inválido" }, { status: 400 });
    const nonce = newNonce();
    jar.set(COOKIE, nonce, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/api/integracoes", maxAge: 600 });
    return NextResponse.redirect(buildAuthorizeUrl(provider, clientId, nonce));
  }

  if (step === "callback") {
    const state = parseState(req.nextUrl.searchParams.get("state") ?? "", provider, jar.get(COOKIE)?.value);
    jar.delete(COOKIE);
    if (!state) return NextResponse.json({ error: "Retorno inválido ou expirado. Tente conectar de novo." }, { status: 400 });
    const back = new URL(`/painel/clientes/${state.clientId}`, req.url);

    const err = req.nextUrl.searchParams.get("error");
    const code = req.nextUrl.searchParams.get("code");
    if (err || !code) return NextResponse.redirect(back);

    try {
      const tokens = await exchangeCode(provider, code);
      const account = await fetchAccount(provider, tokens.accessToken);
      await saveIntegration(state.clientId, provider, tokens, account);
      const { audit } = await import("@/lib/audit");
      await audit(user, "integration.connect", { entity: "client", entityId: state.clientId, meta: { provider, account: account.label } });
    } catch (e) {
      console.error(`[oauth] ${provider} falhou`, e);
      await db
        .update(t.integrations)
        .set({ lastError: (e instanceof Error ? e.message : String(e)).slice(0, 500) })
        .where(eq(t.integrations.clientId, state.clientId));
    }
    return NextResponse.redirect(back);
  }

  return NextResponse.json({ error: "Rota inválida" }, { status: 404 });
}
