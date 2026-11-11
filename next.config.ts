import type { NextConfig } from "next";

const dev = process.env.NODE_ENV !== "production";
// Uploads diretos e vídeos vêm do R2/S3 quando configurado
const storage = process.env.S3_BUCKET ? "https://*.r2.cloudflarestorage.com https://*.amazonaws.com" : "";

/**
 * Cabeçalhos de segurança (OWASP A05). O 'unsafe-inline' em scripts é exigido
 * pelos scripts de inicialização do Next sem nonce; o resto fica restrito.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com", // fontes dos sites gerados
  "img-src 'self' data: blob: https:",
  `media-src 'self' blob: ${storage}`,
  "font-src 'self' data: https://fonts.gstatic.com",
  `connect-src 'self' ${storage}${dev ? " ws: wss:" : ""}`,
  "frame-src 'self' https://www.youtube-nocookie.com https://player.vimeo.com https://www.google.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(dev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // NFC liberado só para este site (gravar tags pelo Chrome do Android)
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), nfc=(self)" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ...(dev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]),
];

const nextConfig: NextConfig = {
  poweredByHeader: false, // não anuncia "X-Powered-By: Next.js"
  async headers() {
    // Sites gerados (públicos e prévias): podem ser exibidos em iframe pelo próprio painel
    const sitesHeaders = [
      { key: "Content-Security-Policy", value: csp.replace("frame-ancestors 'none'", "frame-ancestors 'self'") },
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
    ];
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/s/:path*", headers: sitesHeaders },
      { source: "/api/vendas/:path*", headers: sitesHeaders },
    ];
  },
  cacheComponents: true,
  partialPrefetching: true,
  // sharp (composição do logo no QR PNG) roda como módulo Node nativo.
  serverExternalPackages: ["sharp", "ffmpeg-static", "@huggingface/transformers", "onnxruntime-node"],
  experimental: {
    authInterrupts: true, // habilita forbidden() / unauthorized()
    // fotos enviadas no editor de sites (já reduzidas no navegador) passam de 1 MB às vezes
    serverActions: { bodySizeLimit: "8mb" },
  },
  async redirects() {
    return [{ source: "/", destination: "/painel", permanent: false }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
