import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { Link2, Scissors, Upload } from "lucide-react";
import { asc, desc, sql } from "drizzle-orm";
import { db, t } from "@/db";
import { requirePermission } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { createUploadAction } from "@/app/actions/content";
import { startClipFromUrlAction, startClipProjectAction } from "@/app/actions/clips";
import { ActionForm, FieldError, FormMessage, SubmitButton } from "@/components/action-form";
import { ClientSelect } from "@/components/client-filter";
import { Field } from "@/components/field";
import { cn } from "@/lib/utils";
import { ClipUploader } from "@/components/clip-uploader";
import { AutoRefresh } from "@/components/auto-refresh";
import { ScoreRing } from "@/components/score-ring";
import { PageHeader, PageSkeleton } from "@/components/page";
import { Progress } from "@/components/ui/progress";
import { Term } from "@/components/term";

export const metadata: Metadata = { title: "Cortes virais" };
const when = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "short" });
const mmss = (s: number | null) => (s ? `${Math.floor(s / 60)} min` : "—");

export default function Page(props: PageProps<"/painel/cortes">) {
  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader
        title="Cortes virais"
        subtitle={
          <>
            Envie um vídeo longo: a fala é transcrita aqui mesmo, os melhores trechos ganham <Term k="Nota viral">nota de viralidade</Term> e viram verticais com legenda.
          </>
        }
      />
      <Suspense fallback={<PageSkeleton />}>
        <Projects searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function Projects({ searchParams }: { searchParams: PageProps<"/painel/cortes">["searchParams"] }) {
  await requirePermission("clips:use");
  const { origem } = await searchParams;
  const fromLink = origem === "link";
  const [clients, projects] = await Promise.all([
    db.select({ id: t.clients.id, name: t.clients.tradeName }).from(t.clients).orderBy(asc(t.clients.tradeName)),
    db
      .select({
        id: t.clipProjects.id,
        title: t.clipProjects.title,
        status: t.clipProjects.status,
        stage: t.clipProjects.stage,
        progress: t.clipProjects.progress,
        duration: t.clipProjects.durationSec,
        createdAt: t.clipProjects.createdAt,
        client: t.clients.tradeName,
        clips: sql<number>`(select count(*) from clips c where c.project_id = ${t.clipProjects.id})::int`,
        best: sql<number | null>`(select max(viral_score) from clips c where c.project_id = ${t.clipProjects.id})`,
      })
      .from(t.clipProjects)
      .leftJoin(t.clients, sql`${t.clients.id} = ${t.clipProjects.clientId}`)
      .orderBy(desc(t.clipProjects.createdAt))
      .limit(60),
  ]);
  const processing = projects.some((p) => p.status === "BAIXANDO" || p.status === "TRANSCREVENDO" || p.status === "ANALISANDO" || p.status === "ENVIADO");

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[380px_1fr]">
      {processing && <AutoRefresh every={5} />}
      <div className="lg:sticky lg:top-6 lg:self-start">
        <div className="mb-3 flex gap-1 rounded-xl bg-muted p-1">
          {[
            ["arquivo", "Enviar arquivo", Upload],
            ["link", "Link do YouTube", Link2],
          ].map(([k, label, Icon]) => {
            const on = (k === "link") === fromLink;
            const I = Icon as typeof Upload;
            return (
              <Link key={k as string} href={`/painel/cortes?origem=${k}`} className={cn("flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm", on ? "bg-card font-medium shadow-sm" : "text-muted-foreground")}>
                <I className="size-4" /> {label as string}
              </Link>
            );
          })}
        </div>
        {fromLink ? (
          <ActionForm action={startClipFromUrlAction} className="grid gap-3 rounded-2xl border bg-card p-4">
            <Field name="url" label="Link do vídeo" placeholder="https://youtube.com/watch?v=…" inputMode="url" autoComplete="off" />
            <Field name="clientId" label="Para qual cliente?">
              <ClientSelect required emptyLabel="Escolha…" />
            </Field>
            <Field name="title" label="Nome do projeto (opcional)" placeholder="usa o título do YouTube" />
            <label className="flex items-start gap-2.5 rounded-xl bg-muted/70 p-3 text-sm">
              <input type="checkbox" name="authorized" className="mt-0.5 size-4 shrink-0 accent-[var(--primary)]" />
              <span>
                O vídeo é <strong>do cliente</strong> ou temos <strong>autorização por escrito</strong> do dono para cortar e republicar.
              </span>
            </label>
            <FieldError name="authorized" />
            <FormMessage />
            <SubmitButton className="h-11">Importar e encontrar os cortes</SubmitButton>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Cortar vídeo de terceiros sem autorização gera strike de direitos autorais no canal do cliente. Cada importação fica registrada na auditoria. Vídeos privados, ao vivo ou com restrição de idade não podem ser importados.
            </p>
          </ActionForm>
        ) : (
          <ClipUploader clients={clients} createUpload={createUploadAction} startProject={startClipProjectAction} maxMb={env.MAX_UPLOAD_MB} />
        )}
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          Tudo roda no servidor da empresa: transcrição com Whisper e avaliação com a <Term k="IA local" />. Um vídeo de 10 minutos leva alguns minutos para transcrever nesta máquina.
        </p>
      </div>

      {projects.length === 0 ? (
        <div className="grid place-items-center gap-3 rounded-2xl border border-dashed p-12 text-center">
          <Scissors className="size-8 text-muted-foreground" />
          <p className="max-w-xs text-sm text-muted-foreground">Nenhum projeto ainda. Envie um podcast, live ou depoimento e os cortes aparecem aqui.</p>
        </div>
      ) : (
        <ul className="grid content-start gap-3">
          {projects.map((p) => (
            <li key={p.id}>
              <Link href={`/painel/cortes/${p.id}`} className="flex items-center gap-4 rounded-2xl border bg-card p-4 hover:border-primary/40">
                {p.status === "PRONTO" && p.best !== null ? (
                  <ScoreRing score={Number(p.best)} size={52} />
                ) : (
                  <span className="grid size-[52px] shrink-0 place-items-center rounded-full bg-muted">
                    <Scissors className="size-5 text-muted-foreground" />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{p.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {p.client ?? "Agência"} · {mmss(p.duration)} · {when.format(p.createdAt)}
                  </span>
                  {p.status === "PRONTO" ? (
                    <span className="mt-1 block text-xs font-medium text-primary">{p.clips} cortes sugeridos</span>
                  ) : p.status === "FALHOU" ? (
                    <span className="mt-1 block text-xs text-destructive">Falhou — abra para ver o motivo</span>
                  ) : (
                    <span className="mt-1.5 grid gap-1">
                      <Progress value={p.progress} className="h-1.5" />
                      <span className="text-xs text-muted-foreground">{p.stage ?? "Na fila"}</span>
                    </span>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
