CREATE TYPE "public"."client_status" AS ENUM('ACTIVE', 'SUSPENDED_PAYMENT', 'TRIAL');--> statement-breakpoint
CREATE TYPE "public"."contract_status" AS ENUM('ACTIVE', 'PAUSED', 'CANCELED');--> statement-breakpoint
CREATE TYPE "public"."contract_type" AS ENUM('RECURRING', 'ONE_OFF');--> statement-breakpoint
CREATE TYPE "public"."device" AS ENUM('IOS', 'ANDROID', 'DESKTOP', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."plate_kind" AS ENUM('NFC', 'QR', 'NFC_QR');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('SUPER_ADMIN', 'MEMBER', 'CLIENT');--> statement-breakpoint
CREATE TYPE "public"."tap_outcome" AS ENUM('REDIRECT_REVIEW', 'SUSPENDED', 'TRIAL_EXPIRED', 'NO_DESTINATION');--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legal_name" varchar(200) NOT NULL,
	"trade_name" varchar(200) NOT NULL,
	"document" varchar(14),
	"niche" varchar(80),
	"contact_name" varchar(120),
	"contact_email" varchar(200),
	"contact_phone" varchar(20),
	"status" "client_status" DEFAULT 'TRIAL' NOT NULL,
	"trial_ends_at" timestamp with time zone,
	"google_place_id" varchar(200),
	"logo_url" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"type" "contract_type" NOT NULL,
	"service" varchar(120) NOT NULL,
	"amount_cents" integer NOT NULL,
	"status" "contract_status" DEFAULT 'ACTIVE' NOT NULL,
	"starts_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plate_taps" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"plate_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"outcome" "tap_outcome" NOT NULL,
	"ip_hash" varchar(64),
	"country" varchar(2),
	"region" varchar(80),
	"city" varchar(120),
	"device" "device" DEFAULT 'OTHER' NOT NULL,
	"os" varchar(60),
	"browser" varchar(60),
	"referer" text
);
--> statement-breakpoint
CREATE TABLE "plates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"slug" varchar(64) NOT NULL,
	"label" varchar(120) NOT NULL,
	"kind" "plate_kind" DEFAULT 'NFC_QR' NOT NULL,
	"destination_override" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"email" varchar(200) NOT NULL,
	"password_hash" text NOT NULL,
	"role" "role" DEFAULT 'MEMBER' NOT NULL,
	"client_id" uuid,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plate_taps" ADD CONSTRAINT "plate_taps_plate_id_plates_id_fk" FOREIGN KEY ("plate_id") REFERENCES "public"."plates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plate_taps" ADD CONSTRAINT "plate_taps_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plates" ADD CONSTRAINT "plates_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "clients_document_uq" ON "clients" USING btree ("document");--> statement-breakpoint
CREATE INDEX "clients_status_idx" ON "clients" USING btree ("status");--> statement-breakpoint
CREATE INDEX "contracts_client_idx" ON "contracts" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "plate_taps_plate_time_idx" ON "plate_taps" USING btree ("plate_id","occurred_at");--> statement-breakpoint
CREATE INDEX "plate_taps_client_time_idx" ON "plate_taps" USING btree ("client_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "plates_slug_uq" ON "plates" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "plates_client_idx" ON "plates" USING btree ("client_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_uq" ON "users" USING btree (lower("email"));