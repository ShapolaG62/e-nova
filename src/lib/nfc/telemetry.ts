import "server-only";
import { createHash } from "node:crypto";
import { UAParser } from "ua-parser-js";
import { db, t } from "@/db";
import { kv } from "@/lib/cache";
import { env } from "@/lib/env";

type Device = "IOS" | "ANDROID" | "DESKTOP" | "OTHER";

export type TapContext = {
  ip: string | null;
  userAgent: string | null;
  referer: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
};

/**
 * Extrai IP e geolocalização aproximada dos cabeçalhos que a CDN/proxy injeta
 * (Cloudflare, Vercel). Sem chamada externa de GeoIP — zero latência extra.
 */
export function tapContextFromHeaders(h: Headers): TapContext {
  const ip =
    h.get("cf-connecting-ip") ??
    h.get("x-real-ip") ??
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    null;
  const dec = (v: string | null) => {
    if (!v) return null;
    try {
      return decodeURIComponent(v).slice(0, 120);
    } catch {
      return v.slice(0, 120);
    }
  };
  const country = (h.get("cf-ipcountry") ?? h.get("x-vercel-ip-country"))?.slice(0, 2).toUpperCase() ?? null;
  return {
    ip,
    userAgent: h.get("user-agent"),
    referer: h.get("referer"),
    country: country && country !== "XX" ? country : null,
    region: dec(h.get("cf-region") ?? h.get("x-vercel-ip-country-region")),
    city: dec(h.get("cf-ipcity") ?? h.get("x-vercel-ip-city")),
  };
}

export function classifyDevice(ua: string | null): { device: Device; os: string | null; browser: string | null } {
  if (!ua) return { device: "OTHER", os: null, browser: null };
  const r = new UAParser(ua).getResult();
  const os = r.os.name ?? null;
  const browser = r.browser.name ?? null;
  let device: Device = "OTHER";
  if (os === "iOS" || os === "iPadOS") device = "IOS";
  else if (os === "Android") device = "ANDROID";
  else if (!r.device.type && os && /windows|mac ?os|linux|chrome ?os/i.test(os)) device = "DESKTOP";
  return { device, os: os?.slice(0, 60) ?? null, browser: browser?.slice(0, 60) ?? null };
}

function hashIp(ip: string) {
  return createHash("sha256").update(`${env.IP_HASH_SALT}:${ip}`).digest("hex");
}

/**
 * Registra um toque. Deduplica o mesmo aparelho na mesma plaquinha por 30s
 * (NFC costuma disparar 2x seguidas), para não inflar as métricas.
 */
export async function recordTap(
  input: { plateId: string; clientId: string; outcome: "REDIRECT_REVIEW" | "SUSPENDED" | "TRIAL_EXPIRED" | "NO_DESTINATION" },
  ctx: TapContext,
) {
  const ipHash = ctx.ip ? hashIp(ctx.ip) : null;
  if (ipHash) {
    const n = await kv.incr(`tapdedup:${input.plateId}:${ipHash}`, 30).catch(() => 1);
    if (n > 1) return;
  }
  const { device, os, browser } = classifyDevice(ctx.userAgent);
  await db.insert(t.plateTaps).values({
    plateId: input.plateId,
    clientId: input.clientId,
    outcome: input.outcome,
    ipHash,
    country: ctx.country,
    region: ctx.region,
    city: ctx.city,
    device,
    os,
    browser,
    referer: ctx.referer?.slice(0, 500) ?? null,
  });
}
