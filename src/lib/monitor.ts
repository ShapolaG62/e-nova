import "server-only";
import { createHash } from "node:crypto";
import tls from "node:tls";
import { and, eq, gte, sql } from "drizzle-orm";
import { db, t } from "@/db";
import { sendAlert } from "@/lib/alerts";
import { putObject } from "@/lib/storage";
import { safeFetch } from "@/lib/net-safety";

const TIMEOUT_MS = 15_000;
const SSL_THRESHOLDS = [15, 7, 2]; // dias de antecedência dos alertas
const DOWN_AFTER = 2; // falhas seguidas antes de declarar fora do ar (evita alarme falso)
const UA = "E-Nova-Monitor/1.0 (+uptime)";

export function validateMonitorUrl(raw: string): URL {
  const u = new URL(raw);
  if (!/^https?:$/.test(u.protocol)) throw new Error("Use http ou https");
  // Bloqueia alvos internos (SSRF): o worker não deve sondar a rede da própria VPS
  if (/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.|\[?::1\]?$)/i.test(u.hostname))
    throw new Error("Endereço interno não é permitido");
  return u;
}

/** Lê o certificado TLS do host (validade e emissor). */
export function readCertificate(host: string, port = 443): Promise<{ validTo: Date; issuer: string } | null> {
  return new Promise((resolve) => {
    const socket = tls.connect({ host, port, servername: host, rejectUnauthorized: false, timeout: TIMEOUT_MS }, () => {
      const cert = socket.getPeerCertificate();
      socket.end();
      if (!cert?.valid_to) return resolve(null);
      const issuer = [cert.issuer?.O, cert.issuer?.CN].filter(Boolean).join(" · ");
      resolve({ validTo: new Date(cert.valid_to), issuer: String(issuer).slice(0, 200) });
    });
    socket.on("error", () => resolve(null));
    socket.on("timeout", () => {
      socket.destroy();
      resolve(null);
    });
  });
}

export async function probe(url: string) {
  const start = performance.now();
  try {
    const res = await safeFetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), headers: { "User-Agent": UA }, cache: "no-store" });
    await res.body?.cancel();
    const latencyMs = Math.round(performance.now() - start);
    return { ok: res.status < 400, statusCode: res.status, latencyMs, error: res.status >= 400 ? `HTTP ${res.status}` : null };
  } catch (e) {
    const err = e as Error & { cause?: { code?: string } };
    const msg = err.name === "TimeoutError" ? `Sem resposta em ${TIMEOUT_MS / 1000}s` : (err.cause?.code ?? err.message);
    return { ok: false, statusCode: null, latencyMs: Math.round(performance.now() - start), error: String(msg).slice(0, 300) };
  }
}

/** Uma verificação completa: HTTP + SSL + transição de estado + alertas. */
export async function runMonitorCheck(monitorId: string) {
  const m = await db.query.monitors.findFirst({ where: eq(t.monitors.id, monitorId) });
  if (!m || !m.active) return;
  const url = validateMonitorUrl(m.url);

  const [result, cert] = await Promise.all([probe(m.url), url.protocol === "https:" ? readCertificate(url.hostname, Number(url.port) || 443) : null]);

  await db.insert(t.monitorChecks).values({ monitorId, ok: result.ok, statusCode: result.statusCode, latencyMs: result.latencyMs, error: result.error });

  const failures = result.ok ? 0 : m.consecutiveFailures + 1;
  const nextState = result.ok ? "UP" : failures >= DOWN_AFTER ? "DOWN" : m.state;

  // SSL: alerta uma vez por limiar; zera quando o certificado é renovado
  let sslAlerted = m.sslAlertedDays;
  if (cert) {
    const daysLeft = Math.floor((cert.validTo.getTime() - Date.now()) / 86_400_000);
    if (daysLeft > SSL_THRESHOLDS[0]) sslAlerted = [];
    const hit = SSL_THRESHOLDS.find((d) => daysLeft <= d && !sslAlerted.includes(d));
    if (hit !== undefined) {
      sslAlerted = SSL_THRESHOLDS.filter((d) => daysLeft <= d);
      await sendAlert({
        kind: "SSL_EXPIRING",
        monitorId,
        clientId: m.clientId,
        message: daysLeft < 0 ? `SSL de ${m.name} EXPIROU (${url.hostname}).` : `SSL de ${m.name} vence em ${daysLeft} dia(s) (${url.hostname}).`,
      });
    }
  }

  await db
    .update(t.monitors)
    .set({
      state: nextState,
      consecutiveFailures: failures,
      lastCheckedAt: new Date(),
      lastStatusCode: result.statusCode,
      lastLatencyMs: result.latencyMs,
      lastError: result.error,
      ...(cert ? { sslExpiresAt: cert.validTo, sslIssuer: cert.issuer, sslAlertedDays: sslAlerted } : {}),
    })
    .where(eq(t.monitors.id, monitorId));

  if (nextState === "DOWN" && m.state !== "DOWN") {
    await sendAlert({ kind: "DOWN", monitorId, clientId: m.clientId, message: `${m.name} está FORA DO AR — ${result.error} (${m.url})` });
  } else if (nextState === "UP" && m.state === "DOWN") {
    await sendAlert({ kind: "RECOVERED", monitorId, clientId: m.clientId, message: `${m.name} voltou ao ar (${result.latencyMs} ms).` });
  }
}

const MAX_SNAPSHOT_BYTES = 5 * 1024 * 1024;

/** Backup diário do HTML da página + detecção de alteração de conteúdo. */
export async function runSnapshot(monitorId: string) {
  const m = await db.query.monitors.findFirst({ where: eq(t.monitors.id, monitorId) });
  if (!m || !m.active) return;
  validateMonitorUrl(m.url);
  const res = await safeFetch(m.url, { signal: AbortSignal.timeout(30_000), headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_SNAPSHOT_BYTES) throw new Error("Página maior que 5 MB");
  const sha = createHash("sha256").update(buf).digest("hex");
  const changed = !!m.contentHash && m.contentHash !== sha;
  const key = `snapshots/${monitorId}/${new Date().toISOString().replace(/[:.]/g, "-")}.html`;
  await putObject(key, buf, "text/html; charset=utf-8");
  await db.insert(t.siteSnapshots).values({ monitorId, storageKey: key, sizeBytes: buf.length, sha256: sha, changed });
  await db
    .update(t.monitors)
    .set({ contentHash: sha, ...(changed ? { contentChangedAt: new Date() } : {}) })
    .where(eq(t.monitors.id, monitorId));
}

/** % de uptime no período (verificações ok / total). null se não houve verificação. */
export async function uptimePercent(monitorId: string, since: Date, until = new Date()) {
  const [r] = await db
    .select({
      total: sql<number>`count(*)::int`,
      ok: sql<number>`count(*) filter (where ${t.monitorChecks.ok})::int`,
    })
    .from(t.monitorChecks)
    .where(and(eq(t.monitorChecks.monitorId, monitorId), gte(t.monitorChecks.checkedAt, since), sql`${t.monitorChecks.checkedAt} < ${until}`));
  return r.total ? (r.ok / r.total) * 100 : null;
}
