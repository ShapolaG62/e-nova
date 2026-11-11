import { Suspense } from "react";
import { avaliacoes } from "@/lib/aprendizado";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { desc, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { clipToPostAction, deleteClipProjectAction, reanalyzeAction, renderClipAction, retryProjectAction } from "@/app/actions/clips";
import { AutoRefresh } from "@/components/auto-refresh";
import { ClipWorkbench } from "@/components/clip-workbench";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { PageHeader, PageSkeleton } from "@/components/page";
import { Progress } from "@/components/ui/progress";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = { title: "Projeto de cortes" };

export default function Page(props: PageProps<"/painel/cortes/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Project params={props.params} />
    </Suspense>
  );
}

async function Project({ params }: { params: PageProps<"/painel/cortes/[id]">["params"] }) {
  const user = await requirePermission("clips:use");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const p = await db.query.clipProjects.findFirst({
    where: eq(t.clipProjects.id, id),
    with: { client: { columns: { tradeName: true } }, clips: { orderBy: desc(t.clips.viralScore) } },
  });
  if (!p) notFound();
  const notas = await avaliacoes("cortes", p.clips.map((c) => c.id));

  const working = p.status === "ENVIADO" || p.status === "BAIXANDO" || p.status === "TRANSCREVENDO" || p.status === "ANALISANDO";
  const rendering = p.clips.some((c) => c.status === "RENDERIZANDO");
  const minutes = p.durationSec ? `${Math.floor(p.durationSec / 60)}:${String(Math.round(p.durationSec % 60)).padStart(2, "0")}` : null;

  return (
    <div className="grid grid-cols-1 gap-6">
      {(working || rendering) && <AutoRefresh every={4} />}
      <Link href="/painel/cortes" className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Cortes virais
      </Link>
      <PageHeader
        title={p.title}
        subtitle={
          <>
            {[p.client?.tradeName, minutes && `${minutes} de vídeo`, p.clips.length ? `${p.clips.length} cortes sugeridos` : null].filter(Boolean).join(" · ")}
            {p.sourceUrl && (
              <a href={p.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-1 flex items-center gap-1 text-sm text-primary hover:underline">
                <ExternalLink className="size-3.5" /> Original no YouTube{p.sourceChannel ? ` · ${p.sourceChannel}` : ""}
              </a>
            )}
          </>
        }
        action={
          p.status === "PRONTO" && p.sourceAssetId && (
            <form action={reanalyzeAction}>
              <input type="hidden" name="id" value={p.id} />
              <button className={buttonVariants({ variant: "outline", size: "sm" })}>Reavaliar com a IA</button>
            </form>
          )
        }
      />

      {working && (
        <div className="grid gap-3 rounded-2xl border bg-card p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="font-display font-semibold">{p.stage ?? "Na fila"}</p>
            <span className="num text-sm text-muted-foreground">{p.progress}%</span>
          </div>
          <Progress value={p.progress} className="h-2" />
          <p className="text-xs text-muted-foreground">Pode sair desta tela: o processamento continua no servidor.</p>
        </div>
      )}

      {p.status === "FALHOU" && (
        <div className="grid gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
          <p className="text-sm">
            <strong>Não deu para processar.</strong> {p.error}
          </p>
          <form action={retryProjectAction}>
            <input type="hidden" name="id" value={p.id} />
            <button className={buttonVariants({ size: "sm" })}>Tentar de novo</button>
          </form>
        </div>
      )}

      {p.status === "PRONTO" && (
        <ClipWorkbench
          sourceUrl={`/api/midia/${p.sourceAssetId}/arquivo`}
          transcript={p.transcript ?? []}
          clips={p.clips.map((c) => ({
            id: c.id,
            start: c.start,
            end: c.end,
            title: c.title,
            hook: c.hook,
            reason: c.reason,
            viralScore: c.viralScore,
            scores: c.scores,
            hashtags: c.hashtags,
            captions: c.captions,
            status: c.status,
            outputUrl: c.outputAssetId ? `/api/midia/${c.outputAssetId}/arquivo` : null,
            error: c.error,
            nota: notas[c.id],
          }))}
          renderAction={renderClipAction}
          toPostAction={clipToPostAction}
          canPost={can(user.role, "content:write") && !!p.clientId}
        />
      )}

      <form action={deleteClipProjectAction} className="text-right">
        <input type="hidden" name="id" value={p.id} />
        <ConfirmSubmit message="Excluir o projeto, o vídeo original e os cortes que não viraram publicação?" className="text-xs text-destructive hover:underline">
          Excluir projeto
        </ConfirmSubmit>
      </form>
    </div>
  );
}
