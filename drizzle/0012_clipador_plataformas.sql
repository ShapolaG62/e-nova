ALTER TABLE "canais_vigiados" ALTER COLUMN "youtube_id" SET DATA TYPE varchar(80);--> statement-breakpoint
ALTER TABLE "canais_vigiados" ALTER COLUMN "tipos" SET DEFAULT 'vertical';--> statement-breakpoint
ALTER TABLE "videos_vigiados" ALTER COLUMN "video_id" SET DATA TYPE varchar(40);--> statement-breakpoint
ALTER TABLE "canais_vigiados" ADD COLUMN "plataforma" varchar(12) DEFAULT 'youtube' NOT NULL;--> statement-breakpoint
ALTER TABLE "videos_vigiados" ADD COLUMN "link" text;--> statement-breakpoint
ALTER TABLE "videos_vigiados" ADD COLUMN "midia_url" text;--> statement-breakpoint
UPDATE "canais_vigiados" SET "tipos" = CASE "tipos" WHEN 'shorts' THEN 'vertical' WHEN 'videos' THEN 'horizontal' ELSE "tipos" END;
