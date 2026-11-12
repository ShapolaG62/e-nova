CREATE TABLE "canais_vigiados" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" varchar(200) NOT NULL,
	"youtube_id" varchar(40) NOT NULL,
	"url" text NOT NULL,
	"client_id" uuid NOT NULL,
	"destinos" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tipos" varchar(10) DEFAULT 'shorts' NOT NULL,
	"legenda" varchar(10) DEFAULT 'ia' NOT NULL,
	"creditar" boolean DEFAULT true NOT NULL,
	"aprovacao" varchar(12) DEFAULT 'automatico' NOT NULL,
	"marca" jsonb NOT NULL,
	"autorizacao" jsonb NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"verificado_em" timestamp with time zone,
	"erro" text,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "videos_vigiados" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"canal_id" uuid NOT NULL,
	"video_id" varchar(20) NOT NULL,
	"titulo" text NOT NULL,
	"descricao" text DEFAULT '' NOT NULL,
	"eh_short" boolean DEFAULT false NOT NULL,
	"publicado_em" timestamp with time zone,
	"status" varchar(12) DEFAULT 'NOVO' NOT NULL,
	"etapa" text,
	"erro" text,
	"post_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "canais_vigiados" ADD CONSTRAINT "canais_vigiados_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canais_vigiados" ADD CONSTRAINT "canais_vigiados_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "videos_vigiados" ADD CONSTRAINT "videos_vigiados_canal_id_canais_vigiados_id_fk" FOREIGN KEY ("canal_id") REFERENCES "public"."canais_vigiados"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "videos_vigiados" ADD CONSTRAINT "videos_vigiados_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "canais_vigiados_yt_cliente" ON "canais_vigiados" USING btree ("youtube_id","client_id");--> statement-breakpoint
CREATE UNIQUE INDEX "videos_vigiados_canal_video" ON "videos_vigiados" USING btree ("canal_id","video_id");--> statement-breakpoint
CREATE INDEX "videos_vigiados_status" ON "videos_vigiados" USING btree ("status","created_at");