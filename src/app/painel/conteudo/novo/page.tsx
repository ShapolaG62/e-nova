import { Suspense } from "react";
import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { db, t } from "@/db";
import { requirePermission } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { storageMode } from "@/lib/storage";
import { createUploadAction, finalizeUploadAction } from "@/app/actions/content";
import { BatchUploader } from "@/components/batch-uploader";
import { PageHeader, PageSkeleton } from "@/components/page";

export const metadata: Metadata = { title: "Enviar vídeos" };

export default function Page(props: PageProps<"/painel/conteudo/novo">) {
  return (
    <div className="grid max-w-3xl grid-cols-1 gap-5">
      <PageHeader title="Enviar vídeos" subtitle="Cada vídeo vira um rascunho de post para você completar legenda, canais e data." />
      <Suspense fallback={<PageSkeleton />}>
        <Uploader searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function Uploader({ searchParams }: { searchParams: PageProps<"/painel/conteudo/novo">["searchParams"] }) {
  await requirePermission("content:write");
  const { cliente } = await searchParams;
  const clients = await db.select({ id: t.clients.id, name: t.clients.tradeName }).from(t.clients).orderBy(asc(t.clients.tradeName));
  return (
    <div className="rounded-xl border bg-card p-4 sm:p-6">
      <BatchUploader
        clients={clients}
        defaultClientId={typeof cliente === "string" ? cliente : null}
        createUpload={createUploadAction}
        finalizeUpload={finalizeUploadAction}
        maxMb={env.MAX_UPLOAD_MB}
      />
      <p className="mt-4 text-xs text-muted-foreground">
        Armazenamento: {storageMode() === "s3" ? "Cloudflare R2 / S3 (envio direto do navegador)" : "disco do servidor (.data/uploads) — configure R2/S3 em produção"}.
      </p>
    </div>
  );
}
