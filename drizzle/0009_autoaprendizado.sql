CREATE TABLE "aprendizado_eventos" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"area" varchar(20) NOT NULL,
	"alvo_id" varchar(64) NOT NULL,
	"sinal" varchar(30) NOT NULL,
	"peso" real NOT NULL,
	"dados" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "aprendizado_eventos" ADD CONSTRAINT "aprendizado_eventos_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "aprendizado_area_idx" ON "aprendizado_eventos" USING btree ("area","created_at");--> statement-breakpoint
CREATE INDEX "aprendizado_alvo_idx" ON "aprendizado_eventos" USING btree ("alvo_id");