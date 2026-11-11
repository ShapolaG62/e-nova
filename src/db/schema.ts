import { relations, sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  index,
  integer,
  jsonb,
  real,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

// ─── Enums ────────────────────────────────────────────────────────────────
export const roleEnum = pgEnum("role", ["SUPER_ADMIN", "MEMBER", "CLIENT"]);

export const clientStatusEnum = pgEnum("client_status", [
  "ACTIVE",
  "SUSPENDED_PAYMENT",
  "TRIAL",
]);

export const contractTypeEnum = pgEnum("contract_type", ["RECURRING", "ONE_OFF"]);
export const contractStatusEnum = pgEnum("contract_status", ["ACTIVE", "PAUSED", "CANCELED"]);

export const plateKindEnum = pgEnum("plate_kind", ["NFC", "QR", "NFC_QR"]);

export const deviceEnum = pgEnum("device", ["IOS", "ANDROID", "DESKTOP", "OTHER"]);

export const tapOutcomeEnum = pgEnum("tap_outcome", [
  "REDIRECT_REVIEW", // foi para o Google (ou destino customizado)
  "SUSPENDED", // cliente com pagamento suspenso
  "TRIAL_EXPIRED", // trial vencido
  "NO_DESTINATION", // cliente sem Place ID configurado
]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

// ─── CRM: clientes ────────────────────────────────────────────────────────
export const clients = pgTable(
  "clients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    legalName: varchar("legal_name", { length: 200 }).notNull(), // razão social
    tradeName: varchar("trade_name", { length: 200 }).notNull(), // nome fantasia
    document: varchar("document", { length: 14 }), // CNPJ/CPF só dígitos
    niche: varchar("niche", { length: 80 }),
    contactName: varchar("contact_name", { length: 120 }),
    contactEmail: varchar("contact_email", { length: 200 }),
    contactPhone: varchar("contact_phone", { length: 20 }),
    status: clientStatusEnum("status").notNull().default("TRIAL"),
    trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
    googlePlaceId: varchar("google_place_id", { length: 200 }),
    // "accounts/123/locations/456" do Google Business Profile (para sincronizar avaliações)
    googleLocationName: varchar("google_location_name", { length: 200 }),
    logoUrl: text("logo_url"),
    // Módulo 2: assistente de avaliação para o consumidor antes do Google
    reviewAssistant: boolean("review_assistant").notNull().default(false),
    reviewTags: jsonb("review_tags").$type<string[]>().notNull().default([]),
    brandVoice: text("brand_voice"), // tom de voz para respostas e conteúdos
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [uniqueIndex("clients_document_uq").on(t.document), index("clients_status_idx").on(t.status)],
);

// ─── Contratos (MRR + avulsos) ────────────────────────────────────────────
export const contracts = pgTable(
  "contracts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    type: contractTypeEnum("type").notNull(),
    service: varchar("service", { length: 120 }).notNull(),
    amountCents: integer("amount_cents").notNull(), // mensal se RECURRING, total se ONE_OFF
    status: contractStatusEnum("status").notNull().default("ACTIVE"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }), // preenchido ao cancelar (histórico de MRR)
    ...timestamps,
  },
  (t) => [index("contracts_client_idx").on(t.clientId)],
);

// ─── Usuários + RBAC ──────────────────────────────────────────────────────
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 120 }).notNull(),
    email: varchar("email", { length: 200 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    role: roleEnum("role").notNull().default("MEMBER"),
    // Só para role CLIENT: o estabelecimento que ele enxerga
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "cascade" }),
    active: boolean("active").notNull().default(true),
    // Segurança
    sessionVersion: integer("session_version").notNull().default(1), // +1 derruba todas as sessões
    totpSecretEnc: text("totp_secret_enc"), // 2FA (criptografado)
    totpEnabled: boolean("totp_enabled").notNull().default(false),
    recoveryCodes: jsonb("recovery_codes").$type<string[]>().notNull().default([]), // hashes
    failedLogins: integer("failed_logins").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [uniqueIndex("users_email_uq").on(sql`lower(${t.email})`)],
);

// ─── Plaquinhas NFC / QR ──────────────────────────────────────────────────
export const plates = pgTable(
  "plates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    slug: varchar("slug", { length: 64 }).notNull(),
    label: varchar("label", { length: 120 }).notNull(), // ex.: "Balcão", "Mesa 4"
    kind: plateKindEnum("kind").notNull().default("NFC_QR"),
    // Se preenchido, substitui o link do Google (ex.: campanha temporária)
    destinationOverride: text("destination_override"),
    active: boolean("active").notNull().default(true),
    ...timestamps,
  },
  (t) => [uniqueIndex("plates_slug_uq").on(t.slug), index("plates_client_idx").on(t.clientId)],
);

// ─── Telemetria de toques/leituras ────────────────────────────────────────
export const plateTaps = pgTable(
  "plate_taps",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    plateId: uuid("plate_id")
      .notNull()
      .references(() => plates.id, { onDelete: "cascade" }),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    outcome: tapOutcomeEnum("outcome").notNull(),
    // LGPD: guardamos só o hash do IP (com sal), nunca o IP puro
    ipHash: varchar("ip_hash", { length: 64 }),
    country: varchar("country", { length: 2 }),
    region: varchar("region", { length: 80 }),
    city: varchar("city", { length: 120 }),
    device: deviceEnum("device").notNull().default("OTHER"),
    os: varchar("os", { length: 60 }),
    browser: varchar("browser", { length: 60 }),
    referer: text("referer"),
  },
  (t) => [
    index("plate_taps_plate_time_idx").on(t.plateId, t.occurredAt),
    index("plate_taps_client_time_idx").on(t.clientId, t.occurredAt),
  ],
);

// ═══ Módulo 2: IA + avaliações ═══════════════════════════════════════════
export const sentimentEnum = pgEnum("sentiment", ["POSITIVE", "NEUTRAL", "NEGATIVE"]);
export const replyStatusEnum = pgEnum("reply_status", ["PENDING", "DRAFTED", "PUBLISHED", "IGNORED"]);
export const reviewSourceEnum = pgEnum("review_source", ["GOOGLE", "MANUAL"]);

export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    source: reviewSourceEnum("source").notNull().default("MANUAL"),
    externalId: varchar("external_id", { length: 300 }), // reviews/{id} do Google
    authorName: varchar("author_name", { length: 200 }),
    rating: integer("rating").notNull(), // 1..5
    text: text("text"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }).notNull().defaultNow(),
    sentiment: sentimentEnum("sentiment"),
    replyDrafts: jsonb("reply_drafts").$type<string[]>().notNull().default([]),
    replyStatus: replyStatusEnum("reply_status").notNull().default("PENDING"),
    replyText: text("reply_text"),
    repliedAt: timestamp("replied_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("reviews_external_uq").on(t.clientId, t.externalId),
    index("reviews_client_time_idx").on(t.clientId, t.reviewedAt),
    index("reviews_status_idx").on(t.replyStatus),
  ],
);

export const aiKindEnum = pgEnum("ai_kind", ["REVIEW_SUGGESTION", "REVIEW_REPLY", "VIDEO_SCRIPT", "EMAIL", "REPORT_SUMMARY", "CLIP_ANALYSIS", "SITE_COPY", "SALES_SCRIPT"]);

/** Histórico e custo de cada chamada de IA. */
export const aiGenerations = pgTable(
  "ai_generations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: aiKindEnum("kind").notNull(),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    title: varchar("title", { length: 200 }),
    input: jsonb("input").$type<Record<string, unknown>>().notNull(),
    output: jsonb("output").$type<unknown>(),
    model: varchar("model", { length: 60 }),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    ok: boolean("ok").notNull().default(true),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("ai_gen_kind_time_idx").on(t.kind, t.createdAt), index("ai_gen_client_idx").on(t.clientId)],
);

// ═══ Integrações OAuth (Google Business, Meta, TikTok, YouTube) ═══════════
export const providerEnum = pgEnum("provider", ["GOOGLE_BUSINESS", "META", "TIKTOK", "YOUTUBE"]);

export const integrations = pgTable(
  "integrations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    provider: providerEnum("provider").notNull(),
    // Tokens criptografados com AES-256-GCM (ENCRYPTION_KEY) — nunca em texto puro
    accessTokenEnc: text("access_token_enc").notNull(),
    refreshTokenEnc: text("refresh_token_enc"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    externalAccountId: varchar("external_account_id", { length: 200 }), // IG user id, canal YT…
    accountLabel: varchar("account_label", { length: 200 }),
    scopes: text("scopes"),
    lastError: text("last_error"),
    ...timestamps,
  },
  (t) => [uniqueIndex("integrations_client_provider_uq").on(t.clientId, t.provider)],
);

// ═══ Módulo 3: mídia e publicação ════════════════════════════════════════
export const assetStatusEnum = pgEnum("asset_status", ["UPLOADING", "READY", "FAILED"]);

export const mediaAssets = pgTable(
  "media_assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    storageKey: text("storage_key").notNull(),
    filename: varchar("filename", { length: 255 }).notNull(),
    mime: varchar("mime", { length: 80 }).notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull().default(0),
    status: assetStatusEnum("status").notNull().default("UPLOADING"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("media_client_idx").on(t.clientId, t.createdAt)],
);

export const postStatusEnum = pgEnum("post_status", [
  "RASCUNHO",
  "AGUARDANDO_APROVACAO",
  "AGENDADO",
  "PUBLICANDO",
  "PUBLICADO",
  "FALHOU",
]);
export const channelEnum = pgEnum("channel", ["INSTAGRAM", "TIKTOK", "YOUTUBE"]);
export const targetStatusEnum = pgEnum("target_status", ["PENDING", "PUBLISHED", "FAILED"]);

export const posts = pgTable(
  "posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    mediaAssetId: uuid("media_asset_id").references(() => mediaAssets.id, { onDelete: "set null" }),
    title: varchar("title", { length: 150 }).notNull(),
    caption: text("caption").notNull().default(""),
    channels: jsonb("channels").$type<("INSTAGRAM" | "TIKTOK" | "YOUTUBE")[]>().notNull().default([]),
    status: postStatusEnum("status").notNull().default("RASCUNHO"),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    reviewNote: text("review_note"), // pedido de ajuste do cliente
    approvedBy: uuid("approved_by").references(() => users.id, { onDelete: "set null" }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [index("posts_client_idx").on(t.clientId, t.createdAt), index("posts_due_idx").on(t.status, t.scheduledAt)],
);

export const postTargets = pgTable(
  "post_targets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    channel: channelEnum("channel").notNull(),
    status: targetStatusEnum("status").notNull().default("PENDING"),
    externalId: varchar("external_id", { length: 200 }),
    externalUrl: text("external_url"),
    error: text("error"),
    attempts: integer("attempts").notNull().default(0),
    publishedAt: timestamp("published_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("post_targets_uq").on(t.postId, t.channel)],
);

// ═══ Módulo 4: uptime, SSL e integridade ═════════════════════════════════
export const monitorStateEnum = pgEnum("monitor_state", ["UP", "DOWN", "UNKNOWN"]);

export const monitors = pgTable(
  "monitors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    url: text("url").notNull(),
    intervalMinutes: integer("interval_minutes").notNull().default(5),
    active: boolean("active").notNull().default(true),
    state: monitorStateEnum("state").notNull().default("UNKNOWN"),
    consecutiveFailures: integer("consecutive_failures").notNull().default(0),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
    lastStatusCode: integer("last_status_code"),
    lastLatencyMs: integer("last_latency_ms"),
    lastError: text("last_error"),
    sslExpiresAt: timestamp("ssl_expires_at", { withTimezone: true }),
    sslIssuer: varchar("ssl_issuer", { length: 200 }),
    sslAlertedDays: jsonb("ssl_alerted_days").$type<number[]>().notNull().default([]),
    contentHash: varchar("content_hash", { length: 64 }),
    contentChangedAt: timestamp("content_changed_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("monitors_client_idx").on(t.clientId)],
);

export const monitorChecks = pgTable(
  "monitor_checks",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    monitorId: uuid("monitor_id")
      .notNull()
      .references(() => monitors.id, { onDelete: "cascade" }),
    checkedAt: timestamp("checked_at", { withTimezone: true }).notNull().defaultNow(),
    ok: boolean("ok").notNull(),
    statusCode: integer("status_code"),
    latencyMs: integer("latency_ms"),
    error: text("error"),
  },
  (t) => [index("monitor_checks_monitor_time_idx").on(t.monitorId, t.checkedAt)],
);

/** Cópia da página (HTML) guardada no storage — backup e detecção de alteração. */
export const siteSnapshots = pgTable(
  "site_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    monitorId: uuid("monitor_id")
      .notNull()
      .references(() => monitors.id, { onDelete: "cascade" }),
    storageKey: text("storage_key").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    sha256: varchar("sha256", { length: 64 }).notNull(),
    changed: boolean("changed").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("snapshots_monitor_time_idx").on(t.monitorId, t.createdAt)],
);

export const alertKindEnum = pgEnum("alert_kind", ["DISCORD", "TELEGRAM", "WHATSAPP", "WEBHOOK"]);

export const alertChannels = pgTable("alert_channels", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id").references(() => clients.id, { onDelete: "cascade" }), // null = agência
  kind: alertKindEnum("kind").notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  // DISCORD/WEBHOOK: { url } · TELEGRAM: { botToken, chatId } · WHATSAPP: { url, token?, to }
  configEnc: text("config_enc").notNull(),
  active: boolean("active").notNull().default(true),
  ...timestamps,
});

export const alertEventKindEnum = pgEnum("alert_event_kind", ["DOWN", "RECOVERED", "SSL_EXPIRING", "CONTENT_CHANGED", "TEST", "SECURITY"]);

export const alertEvents = pgTable(
  "alert_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    monitorId: uuid("monitor_id").references(() => monitors.id, { onDelete: "cascade" }),
    kind: alertEventKindEnum("kind").notNull(),
    message: text("message").notNull(),
    deliveries: jsonb("deliveries").$type<{ channel: string; ok: boolean; error?: string }[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("alert_events_time_idx").on(t.createdAt)],
);

// ═══ Fila de jobs (Postgres, FOR UPDATE SKIP LOCKED) ═════════════════════
export const jobStatusEnum = pgEnum("job_status", ["QUEUED", "RUNNING", "DONE", "FAILED"]);

export const jobs = pgTable(
  "jobs",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    type: varchar("type", { length: 60 }).notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    // Evita duplicar o mesmo trabalho na fila (ex.: "monitor:<id>")
    dedupeKey: varchar("dedupe_key", { length: 200 }),
    status: jobStatusEnum("status").notNull().default("QUEUED"),
    runAt: timestamp("run_at", { withTimezone: true }).notNull().defaultNow(),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(5),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    lastError: text("last_error"),
    durationMs: real("duration_ms"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [
    index("jobs_ready_idx").on(t.status, t.runAt),
    uniqueIndex("jobs_dedupe_active_uq").on(t.dedupeKey).where(sql`status in ('QUEUED','RUNNING')`),
  ],
);

// ═══ Configurações do sistema (chave → valor) ════════════════════════════
export const appSettings = pgTable("app_settings", {
  key: varchar("key", { length: 80 }).primaryKey(),
  value: jsonb("value").$type<unknown>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ═══ Auditoria ═══════════════════════════════════════════════════════════
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    userLabel: varchar("user_label", { length: 200 }), // e-mail no momento do evento
    action: varchar("action", { length: 80 }).notNull(), // ex.: login.ok, client.status, user.create
    entity: varchar("entity", { length: 40 }),
    entityId: varchar("entity_id", { length: 80 }),
    ipHash: varchar("ip_hash", { length: 64 }),
    meta: jsonb("meta").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_time_idx").on(t.createdAt), index("audit_user_idx").on(t.userId)],
);

// ═══ Estoque e comercial das plaquinhas físicas ══════════════════════════
export const plateModels = pgTable("plate_models", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 120 }).notNull(), // "Acrílico 10×10 com NFC"
  costCents: integer("cost_cents").notNull().default(0),
  salePriceCents: integer("sale_price_cents").notNull().default(0),
  rentMonthlyCents: integer("rent_monthly_cents").notNull().default(0),
  active: boolean("active").notNull().default(true),
  ...timestamps,
});

export const unitStatusEnum = pgEnum("unit_status", ["ESTOQUE", "RESERVADA", "INSTALADA", "DEFEITO", "BAIXADA"]);
export const dealEnum = pgEnum("deal", ["VENDA", "ALUGUEL", "CORTESIA"]);

export const plateUnits = pgTable(
  "plate_units",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 20 }).notNull(), // etiqueta física: EN-0001
    modelId: uuid("model_id").references(() => plateModels.id, { onDelete: "set null" }),
    nfcUid: varchar("nfc_uid", { length: 40 }),
    status: unitStatusEnum("status").notNull().default("ESTOQUE"),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
    plateId: uuid("plate_id").references(() => plates.id, { onDelete: "set null" }), // o link /r/slug gravado
    deal: dealEnum("deal"),
    priceCents: integer("price_cents"), // venda: total · aluguel: mensal
    contractId: uuid("contract_id").references(() => contracts.id, { onDelete: "set null" }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [uniqueIndex("plate_units_code_uq").on(t.code), index("plate_units_status_idx").on(t.status), index("plate_units_client_idx").on(t.clientId)],
);

export const plateUnitEvents = pgTable(
  "plate_unit_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    unitId: uuid("unit_id")
      .notNull()
      .references(() => plateUnits.id, { onDelete: "cascade" }),
    kind: varchar("kind", { length: 40 }).notNull(), // criada, vendida, alugada, devolvida, defeito…
    description: text("description").notNull(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("unit_events_unit_idx").on(t.unitId, t.createdAt)],
);

// ═══ Páginas (criador de páginas) + visualizações ════════════════════════
export type PageBlock =
  | { id: string; type: "hero"; title: string; subtitle?: string; imageUrl?: string }
  | { id: string; type: "text"; body: string }
  | { id: string; type: "button"; label: string; url: string; style?: "solid" | "outline" }
  | { id: string; type: "links"; items: { id: string; label: string; url: string }[] }
  | { id: string; type: "image"; url: string; alt: string }
  | { id: string; type: "video"; url: string }
  | { id: string; type: "whatsapp"; phone: string; message?: string; label?: string }
  | { id: string; type: "review"; plateSlug: string; label?: string }
  | { id: string; type: "map"; query: string };

export const pageStatusEnum = pgEnum("page_status", ["RASCUNHO", "PUBLICADA"]);

export const sitePages = pgTable(
  "site_pages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "cascade" }),
    slug: varchar("slug", { length: 64 }).notNull(),
    title: varchar("title", { length: 120 }).notNull(),
    description: varchar("description", { length: 300 }),
    theme: jsonb("theme").$type<{ accent: string; background: string; font: "moderna" | "classica" | "arredondada" }>().notNull(),
    blocks: jsonb("blocks").$type<PageBlock[]>().notNull().default([]),
    status: pageStatusEnum("status").notNull().default("RASCUNHO"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [uniqueIndex("site_pages_slug_uq").on(t.slug), index("site_pages_client_idx").on(t.clientId)],
);

export const pageViews = pgTable(
  "page_views",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    pageId: uuid("page_id")
      .notNull()
      .references(() => sitePages.id, { onDelete: "cascade" }),
    kind: varchar("kind", { length: 10 }).notNull().default("view"), // view | click
    blockId: varchar("block_id", { length: 40 }), // em cliques: qual botão
    visitorHash: varchar("visitor_hash", { length: 64 }), // hash diário (sem cookie)
    referrerHost: varchar("referrer_host", { length: 120 }),
    utmSource: varchar("utm_source", { length: 80 }),
    device: deviceEnum("device").notNull().default("OTHER"),
    country: varchar("country", { length: 2 }),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("page_views_page_time_idx").on(t.pageId, t.occurredAt)],
);

// ═══ Cortes virais ═══════════════════════════════════════════════════════
export const clipProjectStatusEnum = pgEnum("clip_project_status", ["ENVIADO", "BAIXANDO", "TRANSCREVENDO", "ANALISANDO", "PRONTO", "FALHOU"]);
export const clipStatusEnum = pgEnum("clip_status", ["SUGERIDO", "RENDERIZANDO", "PRONTO", "FALHOU"]);

export type TranscriptSegment = { start: number; end: number; text: string };

export const clipProjects = pgTable(
  "clip_projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
    title: varchar("title", { length: 200 }).notNull(),
    // Vazio enquanto o vídeo do YouTube ainda está sendo baixado
    sourceAssetId: uuid("source_asset_id").references(() => mediaAssets.id, { onDelete: "cascade" }),
    sourceUrl: text("source_url"), // link do YouTube, quando veio por link
    sourceChannel: varchar("source_channel", { length: 200 }), // canal de origem (registro)
    status: clipProjectStatusEnum("status").notNull().default("ENVIADO"),
    progress: integer("progress").notNull().default(0), // 0..100
    stage: varchar("stage", { length: 120 }),
    durationSec: real("duration_sec"),
    width: integer("width"),
    height: integer("height"),
    transcript: jsonb("transcript").$type<TranscriptSegment[]>(),
    energy: jsonb("energy").$type<number[]>(), // volume por segundo (0..1)
    error: text("error"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [index("clip_projects_time_idx").on(t.createdAt)],
);

export const clips = pgTable(
  "clips",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => clipProjects.id, { onDelete: "cascade" }),
    start: real("start").notNull(),
    end: real("end").notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    hook: text("hook"),
    reason: text("reason"),
    viralScore: integer("viral_score").notNull(), // 0..100
    scores: jsonb("scores").$type<{ gancho: number; emocao: number; valor: number; ritmo: number; energia: number }>().notNull(),
    hashtags: jsonb("hashtags").$type<string[]>().notNull().default([]),
    captions: boolean("captions").notNull().default(true),
    status: clipStatusEnum("status").notNull().default("SUGERIDO"),
    outputAssetId: uuid("output_asset_id").references(() => mediaAssets.id, { onDelete: "set null" }),
    error: text("error"),
    ...timestamps,
  },
  (t) => [index("clips_project_idx").on(t.projectId, t.viralScore)],
);

// ═══ Varredura de segurança dos sites ════════════════════════════════════
export type SecurityFinding = { id: string; severity: "critica" | "alta" | "media" | "baixa" | "ok"; title: string; detail: string; fix?: string };

export const securityScans = pgTable(
  "security_scans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    monitorId: uuid("monitor_id")
      .notNull()
      .references(() => monitors.id, { onDelete: "cascade" }),
    grade: varchar("grade", { length: 2 }).notNull(), // A+..F
    score: integer("score").notNull(),
    findings: jsonb("findings").$type<SecurityFinding[]>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("security_scans_monitor_idx").on(t.monitorId, t.createdAt)],
);

// ─── Relações ─────────────────────────────────────────────────────────────
export const clientsRelations = relations(clients, ({ many }) => ({
  plates: many(plates),
  contracts: many(contracts),
  users: many(users),
}));

export const platesRelations = relations(plates, ({ one, many }) => ({
  client: one(clients, { fields: [plates.clientId], references: [clients.id] }),
  taps: many(plateTaps),
}));

export const contractsRelations = relations(contracts, ({ one }) => ({
  client: one(clients, { fields: [contracts.clientId], references: [clients.id] }),
}));

export const usersRelations = relations(users, ({ one }) => ({
  client: one(clients, { fields: [users.clientId], references: [clients.id] }),
}));

export const plateTapsRelations = relations(plateTaps, ({ one }) => ({
  plate: one(plates, { fields: [plateTaps.plateId], references: [plates.id] }),
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
  client: one(clients, { fields: [reviews.clientId], references: [clients.id] }),
}));

export const postsRelations = relations(posts, ({ one, many }) => ({
  client: one(clients, { fields: [posts.clientId], references: [clients.id] }),
  media: one(mediaAssets, { fields: [posts.mediaAssetId], references: [mediaAssets.id] }),
  targets: many(postTargets),
}));

export const postTargetsRelations = relations(postTargets, ({ one }) => ({
  post: one(posts, { fields: [postTargets.postId], references: [posts.id] }),
}));

export const mediaAssetsRelations = relations(mediaAssets, ({ one }) => ({
  client: one(clients, { fields: [mediaAssets.clientId], references: [clients.id] }),
}));

export const monitorsRelations = relations(monitors, ({ one, many }) => ({
  client: one(clients, { fields: [monitors.clientId], references: [clients.id] }),
  checks: many(monitorChecks),
  snapshots: many(siteSnapshots),
}));

export const monitorChecksRelations = relations(monitorChecks, ({ one }) => ({
  monitor: one(monitors, { fields: [monitorChecks.monitorId], references: [monitors.id] }),
}));

export const siteSnapshotsRelations = relations(siteSnapshots, ({ one }) => ({
  monitor: one(monitors, { fields: [siteSnapshots.monitorId], references: [monitors.id] }),
}));

export const integrationsRelations = relations(integrations, ({ one }) => ({
  client: one(clients, { fields: [integrations.clientId], references: [clients.id] }),
}));

export const plateUnitsRelations = relations(plateUnits, ({ one, many }) => ({
  model: one(plateModels, { fields: [plateUnits.modelId], references: [plateModels.id] }),
  client: one(clients, { fields: [plateUnits.clientId], references: [clients.id] }),
  plate: one(plates, { fields: [plateUnits.plateId], references: [plates.id] }),
  events: many(plateUnitEvents),
}));

export const plateUnitEventsRelations = relations(plateUnitEvents, ({ one }) => ({
  unit: one(plateUnits, { fields: [plateUnitEvents.unitId], references: [plateUnits.id] }),
}));

export const sitePagesRelations = relations(sitePages, ({ one }) => ({
  client: one(clients, { fields: [sitePages.clientId], references: [clients.id] }),
}));

export const clipProjectsRelations = relations(clipProjects, ({ one, many }) => ({
  client: one(clients, { fields: [clipProjects.clientId], references: [clients.id] }),
  source: one(mediaAssets, { fields: [clipProjects.sourceAssetId], references: [mediaAssets.id] }),
  clips: many(clips),
}));

export const clipsRelations = relations(clips, ({ one }) => ({
  project: one(clipProjects, { fields: [clips.projectId], references: [clipProjects.id] }),
  output: one(mediaAssets, { fields: [clips.outputAssetId], references: [mediaAssets.id] }),
}));

export type Client = typeof clients.$inferSelect;
export type SitePage = typeof sitePages.$inferSelect;
export type PlateUnit = typeof plateUnits.$inferSelect;
export type ClipProject = typeof clipProjects.$inferSelect;
export type Clip = typeof clips.$inferSelect;
export type Post = typeof posts.$inferSelect;
export type Monitor = typeof monitors.$inferSelect;
export type Review = typeof reviews.$inferSelect;
export type Channel = (typeof channelEnum.enumValues)[number];
export type PostStatus = (typeof postStatusEnum.enumValues)[number];
export type Plate = typeof plates.$inferSelect;
export type User = typeof users.$inferSelect;
export type Role = (typeof roleEnum.enumValues)[number];
export type ClientStatus = (typeof clientStatusEnum.enumValues)[number];

// ═══ Vendas: prospecção, sites gerados e funil ═══════════════════════════════
// Negócios encontrados no Google Maps (ou cadastrados à mão) que podem virar cliente.

export const prospectStageEnum = pgEnum("prospect_stage", ["NOVO", "CONTATADO", "NEGOCIANDO", "FECHADO", "PERDIDO"]);

export type ProspectReview = { nome: string; nota: number; texto: string };
export type ProspectHistory = { data: string; tipo: string; texto: string };

export const prospects = pgTable(
  "prospects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    placeId: varchar("place_id", { length: 200 }),
    name: varchar("name", { length: 200 }).notNull(),
    sector: varchar("sector", { length: 40 }).notNull().default("outro"),
    city: varchar("city", { length: 120 }),
    uf: varchar("uf", { length: 40 }),
    district: varchar("district", { length: 120 }),
    country: varchar("country", { length: 2 }).notNull().default("BR"),
    address: varchar("address", { length: 300 }),
    phone: varchar("phone", { length: 40 }),
    whatsapp: varchar("whatsapp", { length: 20 }), // só dígitos, com DDI
    instagram: varchar("instagram", { length: 80 }),
    website: varchar("website", { length: 300 }),
    siteStatus: varchar("site_status", { length: 8 }).notNull().default("sem"), // sem | rede | tem
    rating: real("rating"),
    reviewsCount: integer("reviews_count").notNull().default(0),
    opportunity: integer("opportunity").notNull().default(0), // 0..100
    hours: jsonb("hours").$type<string[]>().notNull().default([]),
    photoRefs: jsonb("photo_refs").$type<string[]>().notNull().default([]), // nomes de fotos da Places API
    googleReviews: jsonb("google_reviews").$type<ProspectReview[]>().notNull().default([]),
    mapsUrl: varchar("maps_url", { length: 400 }),
    lat: real("lat"),
    lng: real("lng"),
    stage: prospectStageEnum("stage").notNull().default("NOVO"),
    notes: text("notes"),
    nextContactAt: varchar("next_contact_at", { length: 10 }), // AAAA-MM-DD
    lastContactAt: timestamp("last_contact_at", { withTimezone: true }),
    proposalCents: integer("proposal_cents"),
    history: jsonb("history").$type<ProspectHistory[]>().notNull().default([]),
    origin: varchar("origin", { length: 12 }).notNull().default("google"), // google | manual | demo
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }), // virou cliente
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [uniqueIndex("prospects_place_uq").on(t.placeId), index("prospects_stage_idx").on(t.stage)],
);

export const generatedSites = pgTable(
  "generated_sites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    prospectId: uuid("prospect_id").references(() => prospects.id, { onDelete: "set null" }),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
    name: varchar("name", { length: 200 }).notNull(),
    sector: varchar("sector", { length: 40 }).notNull().default("outro"),
    slug: varchar("slug", { length: 64 }),
    published: boolean("published").notNull().default(false),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    doc: jsonb("doc").$type<Record<string, unknown>>().notNull(), // documento do site (blocos, cores, visual)
    layouts: jsonb("layouts").$type<string[]>().notNull().default([]), // visuais já gerados (voltar/avançar)
    layoutIndex: integer("layout_index").notNull().default(0),
    approach: jsonb("approach").$type<Record<string, unknown>>(), // roteiro de abordagem gerado
    aiNotice: varchar("ai_notice", { length: 300 }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [uniqueIndex("generated_sites_slug_uq").on(t.slug), index("generated_sites_prospect_idx").on(t.prospectId)],
);

// Visitas aos sites publicados, contatos enviados e outros eventos do funil
export const salesEvents = pgTable(
  "sales_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    kind: varchar("kind", { length: 20 }).notNull(), // visita | contato | site_gerado | publicado
    prospectId: uuid("prospect_id").references(() => prospects.id, { onDelete: "cascade" }),
    siteId: uuid("site_id").references(() => generatedSites.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    meta: jsonb("meta").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sales_events_kind_time_idx").on(t.kind, t.createdAt), index("sales_events_prospect_idx").on(t.prospectId)],
);

export type Prospect = typeof prospects.$inferSelect;
export type GeneratedSite = typeof generatedSites.$inferSelect;
export type ProspectStage = (typeof prospectStageEnum.enumValues)[number];

// ═══ Central de IA ═══════════════════════════════════════════════════════════
// Cada execução registra a sequência de tentativas (quem falhou e quem assumiu).
export const iaExecucoes = pgTable(
  "ia_execucoes",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    capacidade: varchar("capacidade", { length: 20 }).notNull(),
    ok: boolean("ok").notNull(),
    tentativas: jsonb("tentativas").$type<{ item: string; via: string; provedor: string; modelo?: string; chave?: number; ok: boolean; ms: number; erro?: string }[]>().notNull(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("ia_execucoes_time_idx").on(t.createdAt)],
);

export const iaTarefaStatusEnum = pgEnum("ia_tarefa_status", ["NA_FILA", "RODANDO", "PRONTA", "FALHOU"]);

// Gerações demoradas (vídeo, avatar, imagem, voz…) rodam no worker; a tela acompanha pelo status.
export const iaTarefas = pgTable(
  "ia_tarefas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    capacidade: varchar("capacidade", { length: 20 }).notNull(),
    titulo: varchar("titulo", { length: 200 }),
    entrada: jsonb("entrada").$type<Record<string, unknown>>().notNull(),
    preferir: varchar("preferir", { length: 40 }),
    status: iaTarefaStatusEnum("status").notNull().default("NA_FILA"),
    progresso: integer("progresso").notNull().default(0),
    etapa: varchar("etapa", { length: 200 }),
    resultado: jsonb("resultado").$type<{ texto?: string; arquivos?: { chave: string; mime: string; nome?: string }[]; usado?: Record<string, unknown>; tentativas?: unknown[] }>(),
    erro: text("erro"),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [index("ia_tarefas_time_idx").on(t.createdAt)],
);
export type IaTarefa = typeof iaTarefas.$inferSelect;

// ═══ Gerador de vídeos ═══════════════════════════════════════════════════════
// Brief → roteiro (diretor de IA) → cenas geradas pela Central (imagem/vídeo + voz) → montagem no FFmpeg.
// Tudo que muda de forma (brief, roteiro, cenas) fica em JSON para o roteiro poder ser editado na tela.
export type VideoBrief = {
  tema: string;
  estilo?: "fotos" | "animacao"; // animacao = desenhado por código, sem IA de imagem/vídeo
  formato: string;              // id do formato (explicativo, ranking, historia, produto, dicas…)
  duracaoAlvo: number;          // segundos
  proporcao: "9:16" | "16:9" | "1:1";
  publico?: string;
  tom?: string;
  visual: "imagem" | "video" | "misto";
  estiloVisual?: string;
  voz?: string;                 // id da voz (Microsoft/ElevenLabs…)
  legendas: boolean;
  musica: boolean;
  cta?: string;
};
export type VideoCenaRoteiro = {
  id: string;
  narracao: string;
  textoNaTela?: string;
  visual: { tipo: "imagem" | "video"; prompt: string; camera?: string };
  duracaoAlvo: number;
  anim?: import("@/lib/gerador/animacao/tipos").AnimCena;
};
export type VideoRoteiro = {
  titulo: string;
  gancho: string;
  tratamento: string;
  estiloVisual: string;
  personagens?: { nome: string; descricao: string }[];
  musica?: string;
  cenas: VideoCenaRoteiro[];
  usado?: string;
  anim?: import("@/lib/gerador/animacao/tipos").AnimVideo;
};
export type VideoCenaProducao = {
  id: string;
  status: "PENDENTE" | "GERANDO" | "PRONTA" | "FALHOU";
  visualChave?: string;
  visualMime?: string;
  audioChave?: string;
  duracao?: number;
  usadoVisual?: string;
  usadoVoz?: string;
  erro?: string;
};
export type VideoResultado = {
  videoChave: string;
  capaChave?: string;
  folhaChave?: string;          // folha de contato (quadros do vídeo) para a revisão
  duracao: number;
  musicaChave?: string;
  revisao?: { item: string; ok: boolean; detalhe?: string }[];
};

export const videoProjetos = pgTable(
  "video_projetos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    titulo: varchar("titulo", { length: 200 }).notNull(),
    status: varchar("status", { length: 20 }).notNull().default("ROTEIRIZANDO"),
    brief: jsonb("brief").$type<VideoBrief>().notNull(),
    roteiro: jsonb("roteiro").$type<VideoRoteiro>(),
    cenas: jsonb("cenas").$type<VideoCenaProducao[]>().notNull().default([]),
    resultado: jsonb("resultado").$type<VideoResultado>(),
    progresso: integer("progresso").notNull().default(0),
    etapa: varchar("etapa", { length: 200 }),
    erro: text("erro"),
    outputAssetId: uuid("output_asset_id").references(() => mediaAssets.id, { onDelete: "set null" }),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [index("video_projetos_time_idx").on(t.createdAt)],
);
export type VideoProjeto = typeof videoProjetos.$inferSelect;

// ═══ Autoaprendizado ═════════════════════════════════════════════════════════
// Cada sinal da equipe ou do resultado (👍/👎, aprovado, publicado, editado, excluído…) vira um evento.
// O resumo periódico transforma os eventos em "lições" (texto) e em ajustes numéricos usados pelos motores.
export const aprendizadoEventos = pgTable(
  "aprendizado_eventos",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    area: varchar("area", { length: 20 }).notNull(),      // "cortes" | "videos"
    alvoId: varchar("alvo_id", { length: 64 }).notNull(), // id do corte ou do projeto de vídeo
    sinal: varchar("sinal", { length: 30 }).notNull(),    // curtiu, nao-curtiu, publicado, baixado, renderizado, excluido, refeito, editado, visualizacoes
    peso: real("peso").notNull(),                         // + aprova, − reprova
    dados: jsonb("dados").$type<Record<string, unknown>>().notNull().default({}),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("aprendizado_area_idx").on(t.area, t.createdAt), index("aprendizado_alvo_idx").on(t.alvoId)],
);
export type AprendizadoEvento = typeof aprendizadoEventos.$inferSelect;
