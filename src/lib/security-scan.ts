import "server-only";
import tls from "node:tls";
import { and, desc, eq } from "drizzle-orm";
import { db, t } from "@/db";
import type { SecurityFinding } from "@/db/schema";
import { sendAlert } from "@/lib/alerts";
import { assertPublicUrl, safeFetch } from "@/lib/net-safety";

/**
 * Varredura passiva e leve de segurança do site de um cliente (ele nos contratou
 * para cuidar do site). Não explora nada: só lê respostas públicas, como um navegador.
 */
const UA = "E-Nova-SecurityCheck/1.0 (+monitoramento contratado)";
const T = (ms = 8000) => AbortSignal.timeout(ms);
const sev = { critica: 40, alta: 20, media: 8, baixa: 3, ok: 0 } as const;

function tlsInfo(host: string): Promise<{ protocol: string | null; validTo: Date | null; authorized: boolean } | null> {
  return new Promise((resolve) => {
    const s = tls.connect({ host, port: 443, servername: host, rejectUnauthorized: false, timeout: 8000 }, () => {
      const cert = s.getPeerCertificate();
      resolve({ protocol: s.getProtocol(), validTo: cert?.valid_to ? new Date(cert.valid_to) : null, authorized: s.authorized });
      s.end();
    });
    s.on("error", () => resolve(null));
    s.on("timeout", () => {
      s.destroy();
      resolve(null);
    });
  });
}

/** Arquivos que NUNCA deveriam estar públicos. Confere a assinatura do conteúdo para evitar falso positivo. */
const EXPOSED: { path: string; title: string; match: (body: string) => boolean }[] = [
  { path: "/.env", title: "Arquivo .env público (senhas e chaves)", match: (b) => /^[A-Z_][A-Z0-9_]*=.+/m.test(b) && !/<html/i.test(b) },
  { path: "/.git/HEAD", title: "Repositório .git público (código-fonte)", match: (b) => /^ref: refs\//.test(b.trim()) },
  { path: "/wp-config.php.bak", title: "Backup do wp-config público (senha do banco)", match: (b) => /DB_PASSWORD/.test(b) },
  { path: "/phpinfo.php", title: "phpinfo() público (detalhes do servidor)", match: (b) => /PHP Version/.test(b) && /phpinfo/i.test(b) },
  { path: "/server-status", title: "Página server-status do Apache pública", match: (b) => /Apache Server Status/i.test(b) },
];

async function probeText(url: string, max = 4096) {
  try {
    const r = await safeFetch(url, { signal: T(6000), headers: { "User-Agent": UA } });
    if (!r.ok) {
      await r.body?.cancel();
      return null;
    }
    const text = (await r.text()).slice(0, max);
    return text;
  } catch {
    return null;
  }
}

export async function scanSite(rawUrl: string): Promise<{ grade: string; score: number; findings: SecurityFinding[] }> {
  const f: SecurityFinding[] = [];
  const add = (x: SecurityFinding) => f.push(x);
  const url = await assertPublicUrl(rawUrl);
  const host = url.hostname;
  const origin = `https://${host}`;

  // 1. HTTPS e redirecionamento de http → https
  try {
    const r = await fetch(`http://${host}/`, { redirect: "manual", signal: T(), headers: { "User-Agent": UA } });
    await r.body?.cancel();
    const loc = r.headers.get("location") ?? "";
    if (r.status >= 300 && r.status < 400 && loc.startsWith("https://")) add({ id: "https-redirect", severity: "ok", title: "HTTP redireciona para HTTPS", detail: "Visitantes que digitam sem https são levados para a versão segura." });
    else add({ id: "https-redirect", severity: "media", title: "HTTP não redireciona para HTTPS", detail: `http://${host} responde ${r.status} sem mandar para https.`, fix: "Configure redirecionamento 301 de todo http:// para https:// no servidor/CDN." });
  } catch {
    /* porta 80 fechada: ok */
  }

  // 2. TLS e certificado
  const tlsi = await tlsInfo(host);
  if (!tlsi) add({ id: "tls", severity: "critica", title: "Site sem HTTPS", detail: "Não foi possível abrir conexão segura na porta 443.", fix: "Instale um certificado (Let's Encrypt é gratuito) e ative HTTPS." });
  else {
    if (tlsi.protocol && /TLSv1(\.1)?$/.test(tlsi.protocol)) add({ id: "tls-version", severity: "alta", title: `Criptografia antiga (${tlsi.protocol})`, detail: "TLS 1.0/1.1 tem falhas conhecidas.", fix: "Desative TLS 1.0 e 1.1; deixe só 1.2 e 1.3." });
    else add({ id: "tls-version", severity: "ok", title: `Criptografia moderna (${tlsi.protocol})`, detail: "Conexão com TLS atual." });
    if (!tlsi.authorized) add({ id: "cert-trust", severity: "alta", title: "Certificado não confiável", detail: "O navegador vai mostrar alerta (autoassinado, vencido ou cadeia incompleta).", fix: "Reemita o certificado e inclua a cadeia intermediária." });
    const days = tlsi.validTo ? Math.floor((tlsi.validTo.getTime() - Date.now()) / 86_400_000) : null;
    if (days !== null && days < 0) add({ id: "cert-expiry", severity: "critica", title: "Certificado vencido", detail: `Venceu há ${-days} dias.`, fix: "Renove o certificado agora e ative a renovação automática." });
    else if (days !== null && days < 15) add({ id: "cert-expiry", severity: "media", title: `Certificado vence em ${days} dias`, detail: "Renovação próxima.", fix: "Confirme que a renovação automática está funcionando." });
  }

  // 3. Cabeçalhos de segurança na página principal
  let html = "";
  try {
    const r = await safeFetch(tlsi ? `${origin}/` : url.toString(), { signal: T(10_000), headers: { "User-Agent": UA } });
    const h = r.headers;
    html = (await r.text()).slice(0, 400_000);
    const header = (name: string, severity: SecurityFinding["severity"], title: string, fix: string) =>
      h.get(name) ? add({ id: name, severity: "ok", title: `${title} presente`, detail: h.get(name)!.slice(0, 120) }) : add({ id: name, severity, title: `Falta ${title}`, detail: `Cabeçalho ${name} ausente.`, fix });
    if (tlsi) header("strict-transport-security", "media", "HSTS", "Envie Strict-Transport-Security: max-age=31536000; includeSubDomains.");
    header("content-security-policy", "media", "Política de conteúdo (CSP)", "Defina uma Content-Security-Policy restringindo origens de scripts.");
    if (!h.get("x-frame-options") && !/frame-ancestors/i.test(h.get("content-security-policy") ?? ""))
      add({ id: "x-frame-options", severity: "media", title: "Site pode ser embutido por terceiros (clickjacking)", detail: "Sem X-Frame-Options nem frame-ancestors.", fix: "Envie X-Frame-Options: SAMEORIGIN." });
    header("x-content-type-options", "baixa", "X-Content-Type-Options", "Envie X-Content-Type-Options: nosniff.");
    header("referrer-policy", "baixa", "Referrer-Policy", "Envie Referrer-Policy: strict-origin-when-cross-origin.");

    // 4. Exposição de versão do servidor
    const leak = [h.get("server"), h.get("x-powered-by")].filter((v): v is string => !!v && /\d/.test(v));
    if (leak.length) add({ id: "version-leak", severity: "baixa", title: "Servidor mostra a versão do software", detail: leak.join(" · "), fix: "Esconda versões (server_tokens off / expose_php Off)." });

    // 5. Cookies sem proteção
    const cookies = h.getSetCookie?.() ?? [];
    const weak = cookies.filter((c) => !/;\s*secure/i.test(c) || !/;\s*httponly/i.test(c)).map((c) => c.split("=")[0]);
    if (weak.length) add({ id: "cookies", severity: "media", title: "Cookies sem Secure/HttpOnly", detail: weak.slice(0, 5).join(", "), fix: "Marque cookies de sessão com Secure, HttpOnly e SameSite." });
  } catch (e) {
    add({ id: "fetch", severity: "alta", title: "Página principal não respondeu", detail: e instanceof Error ? e.message : "erro" });
  }

  // 6. Conteúdo misto (http dentro de página https)
  const mixed = html.match(/<(?:script|link|img|iframe)[^>]+(?:src|href)=["']http:\/\/[^"']+/gi) ?? [];
  if (mixed.length) add({ id: "mixed", severity: "media", title: `${mixed.length} recurso(s) carregados por http`, detail: "Conteúdo misto: o navegador bloqueia ou marca como inseguro.", fix: "Troque os links http:// por https://." });

  // 7. WordPress: versão exposta e XML-RPC aberto
  const wp = /<meta name=["']generator["'] content=["']WordPress ([\d.]+)/i.exec(html);
  if (wp) add({ id: "wp-version", severity: "baixa", title: `WordPress ${wp[1]} visível no código`, detail: "Facilita achar falhas daquela versão.", fix: "Remova a meta generator e mantenha o WordPress atualizado." });
  if (wp || /wp-content\//i.test(html)) {
    const xml = await probeText(`${origin}/xmlrpc.php`, 300);
    if (xml && /XML-RPC server accepts POST requests only/i.test(xml)) add({ id: "wp-xmlrpc", severity: "media", title: "XML-RPC do WordPress aberto", detail: "Usado em ataques de força bruta de senha.", fix: "Bloqueie /xmlrpc.php (plugin de segurança ou regra no servidor)." });
    const listing = await probeText(`${origin}/wp-content/uploads/`, 2000);
    if (listing && /<title>Index of/i.test(listing)) add({ id: "dir-listing", severity: "media", title: "Listagem de pastas aberta", detail: "/wp-content/uploads/ mostra todos os arquivos.", fix: "Desative a listagem (Options -Indexes)." });
  }

  // 8. Arquivos sensíveis expostos
  for (const e of EXPOSED) {
    const body = await probeText(`${origin}${e.path}`);
    if (body && e.match(body)) add({ id: `exposed:${e.path}`, severity: "critica", title: e.title, detail: `${origin}${e.path} está acessível para qualquer pessoa.`, fix: "Bloqueie o acesso imediatamente e troque as senhas/chaves que estavam no arquivo." });
  }

  const score = Math.max(0, 100 - f.reduce((s, x) => s + sev[x.severity], 0));
  const worst = f.some((x) => x.severity === "critica") ? "critica" : f.some((x) => x.severity === "alta") ? "alta" : null;
  const grade = worst === "critica" ? "F" : score >= 97 && !f.some((x) => x.severity === "media") ? "A+" : score >= 90 ? "A" : score >= 80 ? "B" : score >= 65 ? "C" : score >= 50 ? "D" : "F";
  return { grade: worst === "alta" && grade.startsWith("A") ? "B" : grade, score, findings: f.sort((a, b) => sev[b.severity] - sev[a.severity]) };
}

export async function runSecurityScan(monitorId: string) {
  const m = await db.query.monitors.findFirst({ where: eq(t.monitors.id, monitorId) });
  if (!m) return;
  const prev = await db.query.securityScans.findFirst({ where: eq(t.securityScans.monitorId, monitorId), orderBy: desc(t.securityScans.createdAt) });
  const r = await scanSite(m.url);
  await db.insert(t.securityScans).values({ monitorId, ...r });

  // Alerta quando aparece achado crítico novo
  const newCritical = r.findings.filter((x) => x.severity === "critica" && !prev?.findings.some((p) => p.id === x.id));
  if (newCritical.length) {
    await sendAlert({ kind: "SECURITY", monitorId, clientId: m.clientId, message: `Segurança de ${m.name}: ${newCritical.map((x) => x.title).join("; ")}` });
  }
}

export async function latestScan(monitorId: string) {
  return db.query.securityScans.findFirst({ where: and(eq(t.securityScans.monitorId, monitorId)), orderBy: desc(t.securityScans.createdAt) });
}
