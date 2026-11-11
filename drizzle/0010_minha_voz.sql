CREATE TABLE "vozes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" varchar(80) NOT NULL,
	"status" varchar(20) DEFAULT 'PROCESSANDO' NOT NULL,
	"amostra_chave" text NOT NULL,
	"duracao" real DEFAULT 0 NOT NULL,
	"cartesia_id" varchar(80),
	"cartesia_erro" text,
	"consentimento" jsonb NOT NULL,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vozes" ADD CONSTRAINT "vozes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "vozes_user_idx" ON "vozes" USING btree ("user_id","created_at");