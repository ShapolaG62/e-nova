CREATE TYPE "public"."ia_tarefa_status" AS ENUM('NA_FILA', 'RODANDO', 'PRONTA', 'FALHOU');--> statement-breakpoint
CREATE TABLE "ia_execucoes" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"capacidade" varchar(20) NOT NULL,
	"ok" boolean NOT NULL,
	"tentativas" jsonb NOT NULL,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ia_tarefas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"capacidade" varchar(20) NOT NULL,
	"titulo" varchar(200),
	"entrada" jsonb NOT NULL,
	"preferir" varchar(40),
	"status" "ia_tarefa_status" DEFAULT 'NA_FILA' NOT NULL,
	"progresso" integer DEFAULT 0 NOT NULL,
	"etapa" varchar(200),
	"resultado" jsonb,
	"erro" text,
	"client_id" uuid,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ia_execucoes" ADD CONSTRAINT "ia_execucoes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ia_tarefas" ADD CONSTRAINT "ia_tarefas_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ia_tarefas" ADD CONSTRAINT "ia_tarefas_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ia_execucoes_time_idx" ON "ia_execucoes" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "ia_tarefas_time_idx" ON "ia_tarefas" USING btree ("created_at");