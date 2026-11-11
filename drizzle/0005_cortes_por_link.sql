ALTER TYPE "public"."clip_project_status" ADD VALUE 'BAIXANDO' BEFORE 'TRANSCREVENDO';--> statement-breakpoint
ALTER TABLE "clip_projects" ALTER COLUMN "source_asset_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "clip_projects" ADD COLUMN "source_url" text;--> statement-breakpoint
ALTER TABLE "clip_projects" ADD COLUMN "source_channel" varchar(200);