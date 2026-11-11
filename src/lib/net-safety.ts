import "server-only";
import { lookup } from "node:dns/promises";
import net from "node:net";

/**
 * Proteção contra SSRF (OWASP A10): antes de o servidor buscar uma URL informada
 * por usuário (monitor, logo, webhook, varredura), resolve o DNS e recusa endereços
 * internos — inclusive domínios que apontam para 127.0.0.1 e redirecionamentos.
 */
const BLOCKED_V4: [string, number][] = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10], // CGNAT
  ["127.0.0.0", 8],
  ["169.254.0.0", 16], // link-local / metadados de nuvem
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
];

function v4ToInt(ip: string) {
  return ip.split(".").reduce((n, o) => (n << 8) + Number(o), 0) >>> 0;
}

export function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const n = v4ToInt(ip);
    return BLOCKED_V4.some(([base, bits]) => (n >>> (32 - bits)) === (v4ToInt(base) >>> (32 - bits)));
  }
  const v6 = ip.toLowerCase();
  if (v6.startsWith("::ffff:")) return isPrivateIp(v6.slice(7)); // IPv4 mapeado
  return v6 === "::" || v6 === "::1" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe80") || v6.startsWith("ff");
}

export class UnsafeUrlError extends Error {}

export async function assertPublicUrl(raw: string | URL): Promise<URL> {
  const u = new URL(raw);
  if (!/^https?:$/.test(u.protocol)) throw new UnsafeUrlError("Só http(s) é permitido");
  if (u.username || u.password) throw new UnsafeUrlError("URL com usuário/senha não é permitida");
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (/^localhost$|\.local$|\.internal$/i.test(host)) throw new UnsafeUrlError("Endereço interno não é permitido");
  const addrs = net.isIP(host) ? [{ address: host }] : await lookup(host, { all: true, verbatim: true }).catch(() => {
    throw new UnsafeUrlError(`Domínio não encontrado (${host})`);
  });
  if (addrs.some((a) => isPrivateIp(a.address))) throw new UnsafeUrlError("Endereço interno não é permitido");
  return u;
}

/** fetch que segue até 5 redirecionamentos validando cada destino. */
export async function safeFetch(url: string, init: RequestInit = {}, maxRedirects = 5): Promise<Response> {
  let current = await assertPublicUrl(url);
  for (let i = 0; i <= maxRedirects; i++) {
    const res = await fetch(current, { ...init, redirect: "manual" });
    if (res.status < 300 || res.status >= 400 || !res.headers.get("location")) return res;
    await res.body?.cancel();
    current = await assertPublicUrl(new URL(res.headers.get("location")!, current));
  }
  throw new UnsafeUrlError("Redirecionamentos demais");
}
