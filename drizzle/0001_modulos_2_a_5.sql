CREATE TYPE "public"."ai_kind" AS ENUM('REVIEW_SUGGESTION', 'REVIEW_REPLY', 'VIDEO_SCRIPT', 'EMAIL', 'REPORT_SUMMARY');--> statement-breakpoint
CREATE TYPE "public"."alert_event_kind" AS ENUM('DOWN', 'RECOVERED', 'SSL_EXPIRING', 'CONTENT_CHANGED', 'TEST');--> statement-breakpoint
CREATE TYPE "public"."alert_kind" AS ENUM('DISCORD', 'TELEGRAM', 'WHATSAPP', 'WEBHOOK');--> statement-breakpoint
CREATE TYPE "public"."asset_status" AS ENUM('UPLOADING', 'READY', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."channel" AS ENUM('INSTAGRAM', 'TIKTOK', 'YOUTUBE');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('QUEUED', 'RUNNING', 'DONE', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."monitor_state" AS ENUM('UP', 'DOWN', 'UNKNOWN');--> statement-breakpoint
CREATE TYPE "public"."post_status" AS ENUM('RASCUNHO', 'AGUARDANDO_APROVACAO', 'AGENDADO', 'PUBLICANDO', 'PUBLICADO', 'FALHOU');--> statement-breakpoint
CREATE TYPE "public"."provider" AS ENUM('GOOGLE_BUSINESS', 'META', 'TIKTOK', 'YOUTUBE');--> statement-breakpoint
CREATE TYPE "public"."reply_status" AS ENUM('PENDING', 'DRAFTED', 'PUBLISHED', 'IGNORED');--> statement-breakpoint
CREATE TYPE "public"."review_source" AS ENUM('GOOGLE', 'MANUAL');--> statement-breakpoint
CREATE TYPE "public"."sentiment" AS ENUM('POSITIVE', 'NEUTRAL', 'NEGATIVE');--> statement-breakpoint
CREATE TYPE "public"."target_status" AS ENUM('PENDING', 'PUBLISHED', 'FAILED');--> statement-breakpoint
CREATE TABLE "ai_generations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "ai_kind" NOT NULL,
	"client_id" uuid,
	"user_id" uuid,
	"title" varchar(200),
	"input" jsonb NOT NULL,
	"output" jsonb,
	"model" varchar(60),
	"input_tokens" integer,
	"output_tokens" integer,
	"ok" boolean DEFAULT true NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alert_channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid,
	"kind" "alert_kind" NOT NULL,
	"name" varchar(120) NOT NULL,
	"config_enc" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alert_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"monitor_id" uuid,
	"kind" "alert_event_kind" NOT NULL,
	"message" text NOT NULL,
	"deliveries" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"provider" "provider" NOT NULL,
	"access_token_enc" text NOT NULL,
	"refresh_token_enc" text,
	"expires_at" timestamp with time zone,
	"external_account_id" varchar(200),
	"account_label" varchar(200),
	"scopes" text,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"type" varchar(60) NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"dedupe_key" varchar(200),
	"status" "job_status" DEFAULT 'QUEUED' NOT NULL,
	"run_at" timestamp with time zone DEFAULT now() NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 5 NOT NULL,
	"locked_at" timestamp with time zone,
	"last_error" text,
	"duration_ms" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "media_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"filename" varchar(255) NOT NULL,
	"mime" varchar(80) NOT NULL,
	"size_bytes" bigint DEFAULT 0 NOT NULL,
	"status" "asset_status" DEFAULT 'UPLOADING' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "monitor_checks" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"monitor_id" uuid NOT NULL,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ok" boolean NOT NULL,
	"status_code" integer,
	"latency_ms" integer,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "monitors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid,
	"name" varchar(120) NOT NULL,
	"url" text NOT NULL,
	"interval_minutes" integer DEFAULT 5 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"state" "monitor_state" DEFAULT 'UNKNOWN' NOT NULL,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"last_checked_at" timestamp with time zone,
	"last_status_code" integer,
	"last_latency_ms" integer,
	"last_error" text,
	"ssl_expires_at" timestamp with time zone,
	"ssl_issuer" varchar(200),
	"ssl_alerted_days" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"content_hash" varchar(64),
	"content_changed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "post_targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"channel" "channel" NOT NULL,
	"status" "target_status" DEFAULT 'PENDING' NOT NULL,
	"external_id" varchar(200),
	"external_url" text,
	"error" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"published_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"media_asset_id" uuid,
	"title" varchar(150) NOT NULL,
	"caption" text DEFAULT '' NOT NULL,
	"channels" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "post_status" DEFAULT 'RASCUNHO' NOT NULL,
	"scheduled_at" timestamp with time zone,
	"review_note" text,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"source" "review_source" DEFAULT 'MANUAL' NOT NULL,
	"external_id" varchar(300),
	"author_name" varchar(200),
	"rating" integer NOT NULL,
	"text" text,
	"reviewed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sentiment" "sentiment",
	"reply_drafts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"reply_status" "reply_status" DEFAULT 'PENDING' NOT NULL,
	"reply_text" text,
	"replied_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"monitor_id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"sha256" varchar(64) NOT NULL,
	"changed" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "google_location_name" varchar(200);--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "review_assistant" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "review_tags" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "brand_voice" text;--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "ended_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ai_generations" ADD CONSTRAINT "ai_generations_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_generations" ADD CONSTRAINT "ai_generations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_channels" ADD CONSTRAINT "alert_channels_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_events" ADD CONSTRAINT "alert_events_monitor_id_monitors_id_fk" FOREIGN KEY ("monitor_id") REFERENCES "public"."monitors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monitor_checks" ADD CONSTRAINT "monitor_checks_monitor_id_monitors_id_fk" FOREIGN KEY ("monitor_id") REFERENCES "public"."monitors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monitors" ADD CONSTRAINT "monitors_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_targets" ADD CONSTRAINT "post_targets_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_media_asset_id_media_assets_id_fk" FOREIGN KEY ("media_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_snapshots" ADD CONSTRAINT "site_snapshots_monitor_id_monitors_id_fk" FOREIGN KEY ("monitor_id") REFERENCES "public"."monitors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_gen_kind_time_idx" ON "ai_generations" USING btree ("kind","created_at");--> statement-breakpoint
CREATE INDEX "ai_gen_client_idx" ON "ai_generations" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "alert_events_time_idx" ON "alert_events" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "integrations_client_provider_uq" ON "integrations" USING btree ("client_id","provider");--> statement-breakpoint
CREATE INDEX "jobs_ready_idx" ON "jobs" USING btree ("status","run_at");--> statement-breakpoint
CREATE UNIQUE INDEX "jobs_dedupe_active_uq" ON "jobs" USING btree ("dedupe_key") WHERE status in ('QUEUED','RUNNING');--> statement-breakpoint
CREATE INDEX "media_client_idx" ON "media_assets" USING btree ("client_id","created_at");--> statement-breakpoint
CREATE INDEX "monitor_checks_monitor_time_idx" ON "monitor_checks" USING btree ("monitor_id","checked_at");--> statement-breakpoint
CREATE INDEX "monitors_client_idx" ON "monitors" USING btree ("client_id");--> statement-breakpoint
CREATE UNIQUE INDEX "post_targets_uq" ON "post_targets" USING btree ("post_id","channel");--> statement-breakpoint
CREATE INDEX "posts_client_idx" ON "posts" USING btree ("client_id","created_at");--> statement-breakpoint
CREATE INDEX "posts_due_idx" ON "posts" USING btree ("status","scheduled_at");--> statement-breakpoint
CREATE UNIQUE INDEX "reviews_external_uq" ON "reviews" USING btree ("client_id","external_id");--> statement-breakpoint
CREATE INDEX "reviews_client_time_idx" ON "reviews" USING btree ("client_id","reviewed_at");--> statement-breakpoint
CREATE INDEX "reviews_status_idx" ON "reviews" USING btree ("reply_status");--> statement-breakpoint
CREATE INDEX "snapshots_monitor_time_idx" ON "site_snapshots" USING btree ("monitor_id","created_at");