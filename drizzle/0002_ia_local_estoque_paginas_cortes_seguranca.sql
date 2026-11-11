CREATE TYPE "public"."clip_project_status" AS ENUM('ENVIADO', 'TRANSCREVENDO', 'ANALISANDO', 'PRONTO', 'FALHOU');--> statement-breakpoint
CREATE TYPE "public"."clip_status" AS ENUM('SUGERIDO', 'RENDERIZANDO', 'PRONTO', 'FALHOU');--> statement-breakpoint
CREATE TYPE "public"."deal" AS ENUM('VENDA', 'ALUGUEL', 'CORTESIA');--> statement-breakpoint
CREATE TYPE "public"."page_status" AS ENUM('RASCUNHO', 'PUBLICADA');--> statement-breakpoint
CREATE TYPE "public"."unit_status" AS ENUM('ESTOQUE', 'RESERVADA', 'INSTALADA', 'DEFEITO', 'BAIXADA');--> statement-breakpoint
CREATE TABLE "app_settings" (
	"key" varchar(80) PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"user_label" varchar(200),
	"action" varchar(80) NOT NULL,
	"entity" varchar(40),
	"entity_id" varchar(80),
	"ip_hash" varchar(64),
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clip_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid,
	"title" varchar(200) NOT NULL,
	"source_asset_id" uuid NOT NULL,
	"status" "clip_project_status" DEFAULT 'ENVIADO' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"stage" varchar(120),
	"duration_sec" real,
	"width" integer,
	"height" integer,
	"transcript" jsonb,
	"energy" jsonb,
	"error" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"start" real NOT NULL,
	"end" real NOT NULL,
	"title" varchar(200) NOT NULL,
	"hook" text,
	"reason" text,
	"viral_score" integer NOT NULL,
	"scores" jsonb NOT NULL,
	"hashtags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"captions" boolean DEFAULT true NOT NULL,
	"status" "clip_status" DEFAULT 'SUGERIDO' NOT NULL,
	"output_asset_id" uuid,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "page_views" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"page_id" uuid NOT NULL,
	"kind" varchar(10) DEFAULT 'view' NOT NULL,
	"block_id" varchar(40),
	"visitor_hash" varchar(64),
	"referrer_host" varchar(120),
	"utm_source" varchar(80),
	"device" "device" DEFAULT 'OTHER' NOT NULL,
	"country" varchar(2),
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plate_models" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"cost_cents" integer DEFAULT 0 NOT NULL,
	"sale_price_cents" integer DEFAULT 0 NOT NULL,
	"rent_monthly_cents" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plate_unit_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"unit_id" uuid NOT NULL,
	"kind" varchar(40) NOT NULL,
	"description" text NOT NULL,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plate_units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(20) NOT NULL,
	"model_id" uuid,
	"nfc_uid" varchar(40),
	"status" "unit_status" DEFAULT 'ESTOQUE' NOT NULL,
	"client_id" uuid,
	"plate_id" uuid,
	"deal" "deal",
	"price_cents" integer,
	"contract_id" uuid,
	"started_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "security_scans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"monitor_id" uuid NOT NULL,
	"grade" varchar(2) NOT NULL,
	"score" integer NOT NULL,
	"findings" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid,
	"slug" varchar(64) NOT NULL,
	"title" varchar(120) NOT NULL,
	"description" varchar(300),
	"theme" jsonb NOT NULL,
	"blocks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "page_status" DEFAULT 'RASCUNHO' NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "session_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "totp_secret_enc" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "totp_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "recovery_codes" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "failed_logins" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "locked_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_login_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clip_projects" ADD CONSTRAINT "clip_projects_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clip_projects" ADD CONSTRAINT "clip_projects_source_asset_id_media_assets_id_fk" FOREIGN KEY ("source_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clip_projects" ADD CONSTRAINT "clip_projects_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clips" ADD CONSTRAINT "clips_project_id_clip_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."clip_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clips" ADD CONSTRAINT "clips_output_asset_id_media_assets_id_fk" FOREIGN KEY ("output_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_views" ADD CONSTRAINT "page_views_page_id_site_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."site_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plate_unit_events" ADD CONSTRAINT "plate_unit_events_unit_id_plate_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."plate_units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plate_unit_events" ADD CONSTRAINT "plate_unit_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plate_units" ADD CONSTRAINT "plate_units_model_id_plate_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."plate_models"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plate_units" ADD CONSTRAINT "plate_units_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plate_units" ADD CONSTRAINT "plate_units_plate_id_plates_id_fk" FOREIGN KEY ("plate_id") REFERENCES "public"."plates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plate_units" ADD CONSTRAINT "plate_units_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_scans" ADD CONSTRAINT "security_scans_monitor_id_monitors_id_fk" FOREIGN KEY ("monitor_id") REFERENCES "public"."monitors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_pages" ADD CONSTRAINT "site_pages_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_time_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_user_idx" ON "audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "clip_projects_time_idx" ON "clip_projects" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "clips_project_idx" ON "clips" USING btree ("project_id","viral_score");--> statement-breakpoint
CREATE INDEX "page_views_page_time_idx" ON "page_views" USING btree ("page_id","occurred_at");--> statement-breakpoint
CREATE INDEX "unit_events_unit_idx" ON "plate_unit_events" USING btree ("unit_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "plate_units_code_uq" ON "plate_units" USING btree ("code");--> statement-breakpoint
CREATE INDEX "plate_units_status_idx" ON "plate_units" USING btree ("status");--> statement-breakpoint
CREATE INDEX "plate_units_client_idx" ON "plate_units" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "security_scans_monitor_idx" ON "security_scans" USING btree ("monitor_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "site_pages_slug_uq" ON "site_pages" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "site_pages_client_idx" ON "site_pages" USING btree ("client_id");