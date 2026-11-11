CREATE TYPE "public"."prospect_stage" AS ENUM('NOVO', 'CONTATADO', 'NEGOCIANDO', 'FECHADO', 'PERDIDO');--> statement-breakpoint
ALTER TYPE "public"."ai_kind" ADD VALUE 'SITE_COPY';--> statement-breakpoint
ALTER TYPE "public"."ai_kind" ADD VALUE 'SALES_SCRIPT';--> statement-breakpoint
CREATE TABLE "generated_sites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prospect_id" uuid,
	"client_id" uuid,
	"name" varchar(200) NOT NULL,
	"sector" varchar(40) DEFAULT 'outro' NOT NULL,
	"slug" varchar(64),
	"published" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone,
	"doc" jsonb NOT NULL,
	"layouts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"layout_index" integer DEFAULT 0 NOT NULL,
	"approach" jsonb,
	"ai_notice" varchar(300),
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prospects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"place_id" varchar(200),
	"name" varchar(200) NOT NULL,
	"sector" varchar(40) DEFAULT 'outro' NOT NULL,
	"city" varchar(120),
	"uf" varchar(40),
	"district" varchar(120),
	"country" varchar(2) DEFAULT 'BR' NOT NULL,
	"address" varchar(300),
	"phone" varchar(40),
	"whatsapp" varchar(20),
	"instagram" varchar(80),
	"website" varchar(300),
	"site_status" varchar(8) DEFAULT 'sem' NOT NULL,
	"rating" real,
	"reviews_count" integer DEFAULT 0 NOT NULL,
	"opportunity" integer DEFAULT 0 NOT NULL,
	"hours" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"photo_refs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"google_reviews" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"maps_url" varchar(400),
	"lat" real,
	"lng" real,
	"stage" "prospect_stage" DEFAULT 'NOVO' NOT NULL,
	"notes" text,
	"next_contact_at" varchar(10),
	"last_contact_at" timestamp with time zone,
	"proposal_cents" integer,
	"history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"origin" varchar(12) DEFAULT 'google' NOT NULL,
	"client_id" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"kind" varchar(20) NOT NULL,
	"prospect_id" uuid,
	"site_id" uuid,
	"user_id" uuid,
	"meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "generated_sites" ADD CONSTRAINT "generated_sites_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_sites" ADD CONSTRAINT "generated_sites_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_sites" ADD CONSTRAINT "generated_sites_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospects" ADD CONSTRAINT "prospects_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospects" ADD CONSTRAINT "prospects_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_events" ADD CONSTRAINT "sales_events_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_events" ADD CONSTRAINT "sales_events_site_id_generated_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."generated_sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_events" ADD CONSTRAINT "sales_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "generated_sites_slug_uq" ON "generated_sites" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "generated_sites_prospect_idx" ON "generated_sites" USING btree ("prospect_id");--> statement-breakpoint
CREATE UNIQUE INDEX "prospects_place_uq" ON "prospects" USING btree ("place_id");--> statement-breakpoint
CREATE INDEX "prospects_stage_idx" ON "prospects" USING btree ("stage");--> statement-breakpoint
CREATE INDEX "sales_events_kind_time_idx" ON "sales_events" USING btree ("kind","created_at");--> statement-breakpoint
CREATE INDEX "sales_events_prospect_idx" ON "sales_events" USING btree ("prospect_id");