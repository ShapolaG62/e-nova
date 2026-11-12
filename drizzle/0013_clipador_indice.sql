DROP INDEX "canais_vigiados_yt_cliente";--> statement-breakpoint
CREATE UNIQUE INDEX "canais_vigiados_origem_cliente" ON "canais_vigiados" USING btree ("plataforma","youtube_id","client_id");