import "server-only";
import QRCode from "qrcode";
import { safeFetch } from "@/lib/net-safety";

export type QrOptions = {
  size: number; // px do lado (PNG) / viewBox lógico (SVG)
  margin: number; // zona de silêncio em módulos (mín. 4 pela norma)
  logo?: { bytes: Buffer; mime: string } | null;
};

/**
 * Com logo usamos correção de erro "H" (30%) e o logo cobre no máx. ~20% da
 * largura, abaixo do que a correção recupera — o código continua legível.
 */
const LOGO_RATIO = 0.2;

export async function qrSvg(text: string, opts: QrOptions): Promise<string> {
  const svg = await QRCode.toString(text, {
    type: "svg",
    margin: opts.margin,
    width: opts.size,
    errorCorrectionLevel: opts.logo ? "H" : "M",
    color: { dark: "#000000", light: "#ffffff" },
  });
  if (!opts.logo) return svg;

  // O SVG do qrcode usa viewBox="0 0 N N" (N = módulos + 2×margem).
  const n = Number(/viewBox="0 0 (\d+) \d+"/.exec(svg)?.[1] ?? 0);
  if (!n) return svg;
  const box = n * LOGO_RATIO;
  const pad = box * 0.12;
  const x = (n - box) / 2;
  const href = `data:${opts.logo.mime};base64,${opts.logo.bytes.toString("base64")}`;
  const overlay =
    `<rect x="${x - pad}" y="${x - pad}" width="${box + pad * 2}" height="${box + pad * 2}" rx="${pad}" fill="#ffffff"/>` +
    `<image href="${href}" x="${x}" y="${x}" width="${box}" height="${box}" preserveAspectRatio="xMidYMid meet"/>`;
  return svg.replace("</svg>", `${overlay}</svg>`);
}

export async function qrPng(text: string, opts: QrOptions): Promise<Buffer> {
  const base = await QRCode.toBuffer(text, {
    type: "png",
    margin: opts.margin,
    width: opts.size,
    errorCorrectionLevel: opts.logo ? "H" : "M",
  });
  if (!opts.logo) return base;

  const sharp = (await import("sharp")).default;
  const box = Math.round(opts.size * LOGO_RATIO);
  const pad = Math.round(box * 0.12);
  const logo = await sharp(opts.logo.bytes)
    .resize(box, box, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .extend({ top: pad, bottom: pad, left: pad, right: pad, background: "#ffffff" })
    .png()
    .toBuffer();
  const pos = Math.round((opts.size - box - pad * 2) / 2);
  return sharp(base).composite([{ input: logo, left: pos, top: pos }]).png().toBuffer();
}

const ALLOWED_LOGO = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
const MAX_LOGO_BYTES = 512 * 1024;

/** Baixa o logo do cliente com limites de tempo, tamanho e tipo. */
export async function fetchLogo(url: string): Promise<{ bytes: Buffer; mime: string } | null> {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return null;
    const res = await safeFetch(u.toString(), { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const mime = (res.headers.get("content-type") ?? "").split(";")[0].trim();
    if (!ALLOWED_LOGO.includes(mime)) return null;
    const len = Number(res.headers.get("content-length") ?? 0);
    if (len > MAX_LOGO_BYTES) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length > MAX_LOGO_BYTES) return null;
    return { bytes, mime };
  } catch {
    return null;
  }
}
