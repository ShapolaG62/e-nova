CREATE TABLE "video_projetos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"titulo" varchar(200) NOT NULL,
	"status" varchar(20) DEFAULT 'ROTEIRIZANDO' NOT NULL,
	"brief" jsonb NOT NULL,
	"roteiro" jsonb,
	"cenas" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"resultado" jsonb,
	"progresso" integer DEFAULT 0 NOT NULL,
	"etapa" varchar(200),
	"erro" text,
	"output_asset_id" uuid,
	"client_id" uuid,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "video_projetos" ADD CONSTRAINT "video_projetos_output_asset_id_media_assets_id_fk" FOREIGN KEY ("output_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_projetos" ADD CONSTRAINT "video_projetos_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_projetos" ADD CONSTRAINT "video_projetos_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "video_projetos_time_idx" ON "video_projetos" USING btree ("created_at");