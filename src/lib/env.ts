import "server-only";
import { z } from "zod";

const opt = z.string().trim().min(1).optional().or(z.literal("").transform(() => undefined));

const schema = z.object({
  DATABASE_URL: z.string().optional().default(""),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET precisa de pelo menos 32 caracteres"),
  APP_URL: z.url().default("http://localhost:3000"),
  IP_HASH_SALT: z.string().min(16).default("troque-este-sal-em-producao"),
  // 32 bytes em base64/base64url — criptografa tokens OAuth e configs de alerta
  ENCRYPTION_KEY: opt,

  UPSTASH_REDIS_REST_URL: z.url().optional().or(z.literal("").transform(() => undefined)),
  UPSTASH_REDIS_REST_TOKEN: opt,
  REDIRECT_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(300),

  // ── IA. Padrão: local via Ollama (sem custo por uso, dados não saem do servidor).
  AI_PROVIDER: z.enum(["ollama", "anthropic"]).default("ollama"),
  OLLAMA_URL: z.url().default("http://127.0.0.1:11434"),
  OLLAMA_MODEL: z.string().default("qwen2.5:7b"),
  // Opcional: Claude API (pago por token) — só usado se AI_PROVIDER=anthropic
  ANTHROPIC_API_KEY: opt,
  AI_MODEL: z.string().default("claude-opus-5-5"),

  // ── Storage S3-compatível (Cloudflare R2 / AWS S3). Sem isso: disco em .data/uploads
  S3_ENDPOINT: opt, // R2: https://<account>.r2.cloudflarestorage.com
  S3_REGION: z.string().default("auto"),
  S3_BUCKET: opt,
  S3_ACCESS_KEY_ID: opt,
  S3_SECRET_ACCESS_KEY: opt,
  MAX_UPLOAD_MB: z.coerce.number().int().positive().default(1024),

  // ── OAuth das plataformas (apps criados por vocês nos portais de desenvolvedor)
  GOOGLE_CLIENT_ID: opt,
  GOOGLE_CLIENT_SECRET: opt,
  META_APP_ID: opt,
  META_APP_SECRET: opt,
  TIKTOK_CLIENT_KEY: opt,
  TIKTOK_CLIENT_SECRET: opt,

  // Segredo compartilhado do webhook de avaliações (Pub/Sub push → ?token=…)
  WEBHOOK_SECRET: opt,
});

export const env = schema.parse(process.env);

export const features = {
  // Local: sempre "ligada"; se o Ollama estiver fechado, a chamada avisa na hora.
  ai: env.AI_PROVIDER === "ollama" || !!env.ANTHROPIC_API_KEY,
  s3: !!(env.S3_BUCKET && env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY),
  encryption: !!env.ENCRYPTION_KEY,
  google: !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
  meta: !!(env.META_APP_ID && env.META_APP_SECRET),
  tiktok: !!(env.TIKTOK_CLIENT_KEY && env.TIKTOK_CLIENT_SECRET),
};
