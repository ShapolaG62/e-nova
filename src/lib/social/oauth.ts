import "server-only";
import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { decrypt, encrypt, sign, verifySignature } from "@/lib/crypto";
import { env, features } from "@/lib/env";

/**
 * OAuth 2.0 oficial de cada plataforma. Os tokens ficam criptografados no banco
 * (AES-GCM) e são renovados automaticamente antes de expirar.
 * Nunca pedimos senha da conta do cliente — só autorização pelo próprio site da plataforma.
 */
export type Provider = "GOOGLE_BUSINESS" | "META" | "TIKTOK" | "YOUTUBE";

const GRAPH = "https://graph.facebook.com/v21.0";

export const PROVIDERS: Record<
  Provider,
  { label: string; enabled: () => boolean; authorizeUrl: string; scopes: string[]; extra?: Record<string, string> }
> = {
  GOOGLE_BUSINESS: {
    label: "Google Meu Negócio",
    enabled: () => features.google,
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    scopes: ["https://www.googleapis.com/auth/business.manage"],
    extra: { access_type: "offline", prompt: "consent", include_granted_scopes: "true" },
  },
  YOUTUBE: {
    label: "YouTube",
    enabled: () => features.google,
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    scopes: ["https://www.googleapis.com/auth/youtube.upload", "https://www.googleapis.com/auth/youtube.readonly"],
    extra: { access_type: "offline", prompt: "consent" },
  },
  META: {
    label: "Instagram (Meta)",
    enabled: () => features.meta,
    authorizeUrl: "https://www.facebook.com/v21.0/dialog/oauth",
    scopes: ["instagram_basic", "instagram_content_publish", "pages_show_list", "pages_read_engagement", "business_management"],
  },
  TIKTOK: {
    label: "TikTok",
    enabled: () => features.tiktok,
    authorizeUrl: "https://www.tiktok.com/v2/auth/authorize/",
    scopes: ["user.info.basic", "video.publish"],
  },
};

export const redirectUri = (p: Provider) => `${env.APP_URL}/api/integracoes/${p.toLowerCase()}/callback`;

/** state = clientId.provider.exp.nonce.assinatura — amarra o retorno ao cliente certo e expira em 10 min. */
export function buildAuthorizeUrl(provider: Provider, clientId: string, nonce: string) {
  const cfg = PROVIDERS[provider];
  const exp = Math.floor(Date.now() / 1000) + 600;
  const payload = `${clientId}.${provider}.${exp}.${nonce}`;
  const state = `${payload}.${sign(payload)}`;
  const u = new URL(cfg.authorizeUrl);
  const idParam = provider === "TIKTOK" ? "client_key" : "client_id";
  const id = provider === "META" ? env.META_APP_ID : provider === "TIKTOK" ? env.TIKTOK_CLIENT_KEY : env.GOOGLE_CLIENT_ID;
  u.searchParams.set(idParam, id!);
  u.searchParams.set("redirect_uri", redirectUri(provider));
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", cfg.scopes.join(provider === "TIKTOK" ? "," : provider === "META" ? "," : " "));
  u.searchParams.set("state", state);
  for (const [k, v] of Object.entries(cfg.extra ?? {})) u.searchParams.set(k, v);
  return u.toString();
}

export const newNonce = () => randomBytes(16).toString("base64url");

export function parseState(state: string, expectedProvider: Provider, cookieNonce: string | undefined) {
  const parts = state.split(".");
  if (parts.length !== 5) return null;
  const [clientId, provider, exp, nonce, sig] = parts;
  const payload = `${clientId}.${provider}.${exp}.${nonce}`;
  if (!verifySignature(payload, sig)) return null;
  if (provider !== expectedProvider || Number(exp) < Date.now() / 1000) return null;
  if (!cookieNonce || cookieNonce !== nonce) return null; // CSRF: o retorno precisa vir do mesmo navegador
  return { clientId };
}

type TokenSet = { accessToken: string; refreshToken?: string | null; expiresIn?: number | null };

async function postForm(url: string, body: Record<string, string>) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
    signal: AbortSignal.timeout(20_000),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || json.error) throw new Error(`OAuth: ${JSON.stringify(json.error_description ?? json.error ?? json).slice(0, 300)}`);
  return json;
}

export async function exchangeCode(provider: Provider, code: string): Promise<TokenSet> {
  if (provider === "GOOGLE_BUSINESS" || provider === "YOUTUBE") {
    const j = await postForm("https://oauth2.googleapis.com/token", {
      code,
      client_id: env.GOOGLE_CLIENT_ID!,
      client_secret: env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri(provider),
      grant_type: "authorization_code",
    });
    return { accessToken: String(j.access_token), refreshToken: (j.refresh_token as string) ?? null, expiresIn: Number(j.expires_in) };
  }
  if (provider === "TIKTOK") {
    const j = await postForm("https://open.tiktokapis.com/v2/oauth/token/", {
      client_key: env.TIKTOK_CLIENT_KEY!,
      client_secret: env.TIKTOK_CLIENT_SECRET!,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri(provider),
    });
    return { accessToken: String(j.access_token), refreshToken: String(j.refresh_token), expiresIn: Number(j.expires_in) };
  }
  // META: código → token curto → token de longa duração (~60 dias)
  const short = await fetch(
    `${GRAPH}/oauth/access_token?${new URLSearchParams({ client_id: env.META_APP_ID!, client_secret: env.META_APP_SECRET!, redirect_uri: redirectUri(provider), code })}`,
  ).then((r) => r.json());
  if (!short.access_token) throw new Error(`Meta: ${JSON.stringify(short.error ?? short).slice(0, 300)}`);
  const long = await fetch(
    `${GRAPH}/oauth/access_token?${new URLSearchParams({ grant_type: "fb_exchange_token", client_id: env.META_APP_ID!, client_secret: env.META_APP_SECRET!, fb_exchange_token: short.access_token })}`,
  ).then((r) => r.json());
  return { accessToken: long.access_token ?? short.access_token, refreshToken: null, expiresIn: long.expires_in ?? null };
}

/** Busca o identificador da conta (perfil IG business, canal YT, usuário TikTok). */
export async function fetchAccount(provider: Provider, accessToken: string): Promise<{ id: string | null; label: string | null }> {
  if (provider === "META") {
    const r = await fetch(`${GRAPH}/me/accounts?fields=name,instagram_business_account{id,username}&access_token=${encodeURIComponent(accessToken)}`).then((x) => x.json());
    const page = (r.data ?? []).find((p: { instagram_business_account?: unknown }) => p.instagram_business_account);
    if (!page) throw new Error("Nenhuma conta profissional do Instagram ligada a uma Página do Facebook foi encontrada.");
    return { id: page.instagram_business_account.id, label: `@${page.instagram_business_account.username}` };
  }
  if (provider === "YOUTUBE") {
    const r = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", { headers: { Authorization: `Bearer ${accessToken}` } }).then((x) => x.json());
    const ch = r.items?.[0];
    return { id: ch?.id ?? null, label: ch?.snippet?.title ?? null };
  }
  if (provider === "TIKTOK") {
    const r = await fetch("https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name", { headers: { Authorization: `Bearer ${accessToken}` } }).then((x) => x.json());
    return { id: r.data?.user?.open_id ?? null, label: r.data?.user?.display_name ?? null };
  }
  // GOOGLE_BUSINESS: a localização é escolhida depois, no cadastro do cliente
  const r = await fetch("https://mybusinessaccountmanagement.googleapis.com/v1/accounts", { headers: { Authorization: `Bearer ${accessToken}` } }).then((x) => x.json());
  const acc = r.accounts?.[0];
  return { id: acc?.name ?? null, label: acc?.accountName ?? null };
}

export async function saveIntegration(clientId: string, provider: Provider, tokens: TokenSet, account: { id: string | null; label: string | null }) {
  const values = {
    clientId,
    provider,
    accessTokenEnc: encrypt(tokens.accessToken),
    refreshTokenEnc: tokens.refreshToken ? encrypt(tokens.refreshToken) : null,
    expiresAt: tokens.expiresIn ? new Date(Date.now() + tokens.expiresIn * 1000) : null,
    externalAccountId: account.id,
    accountLabel: account.label,
    scopes: PROVIDERS[provider].scopes.join(" "),
    lastError: null,
  };
  await db
    .insert(t.integrations)
    .values(values)
    .onConflictDoUpdate({
      target: [t.integrations.clientId, t.integrations.provider],
      // Google só devolve refresh_token no primeiro consentimento: não apagar o antigo
      set: { ...values, refreshTokenEnc: values.refreshTokenEnc ?? undefined },
    });
}

/** Token válido para uso, renovando se faltar menos de 5 min para expirar. */
export async function getAccessToken(clientId: string, provider: Provider) {
  const integ = await db.query.integrations.findFirst({ where: and(eq(t.integrations.clientId, clientId), eq(t.integrations.provider, provider)) });
  if (!integ) throw new Error(`${PROVIDERS[provider].label} não está conectado para este cliente.`);
  const fresh = !integ.expiresAt || integ.expiresAt.getTime() - Date.now() > 5 * 60_000;
  if (fresh) return { token: decrypt(integ.accessTokenEnc), integration: integ };
  if (!integ.refreshTokenEnc) throw new Error(`Autorização do ${PROVIDERS[provider].label} expirou. Reconecte a conta.`);

  const refresh = decrypt(integ.refreshTokenEnc);
  const j =
    provider === "TIKTOK"
      ? await postForm("https://open.tiktokapis.com/v2/oauth/token/", { client_key: env.TIKTOK_CLIENT_KEY!, client_secret: env.TIKTOK_CLIENT_SECRET!, grant_type: "refresh_token", refresh_token: refresh })
      : await postForm("https://oauth2.googleapis.com/token", { client_id: env.GOOGLE_CLIENT_ID!, client_secret: env.GOOGLE_CLIENT_SECRET!, grant_type: "refresh_token", refresh_token: refresh });
  const accessToken = String(j.access_token);
  await db
    .update(t.integrations)
    .set({
      accessTokenEnc: encrypt(accessToken),
      expiresAt: new Date(Date.now() + Number(j.expires_in ?? 3600) * 1000),
      ...(j.refresh_token ? { refreshTokenEnc: encrypt(String(j.refresh_token)) } : {}),
    })
    .where(eq(t.integrations.id, integ.id));
  return { token: accessToken, integration: integ };
}
