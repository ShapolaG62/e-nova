import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { db, t } from "@/db";
import { requirePermission } from "@/lib/auth/session";
import { salvarConfigAction } from "@/app/actions/clipador";
import { ActionForm, FormMessage, SubmitButton } from "@/components/action-form";
import { PageSkeleton } from "@/components/page";
import { MarcaEditor } from "../marca-editor";
import { ExcluirCanal, VerificarAgora } from "../botoes";
import { Opcoes, quando, SeloPlataforma, Video } from "../comum";

export const metadata: Metadata = { title: "Perfil vigiado · Clipador" };

export default function Page({ params }: PageProps<"/painel/clipador/[id]">) {
  return (
    <div className="grid grid-cols-1 gap-5">
      <Link href="/painel/clipador" className="inline-flex h-10 items-center gap-1.5 justify-self-start text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Clientes e perfis
      </Link>
      <Suspense fallback={<PageSkeleton />}>
        <Perfil params={params} />
      </Suspense>
    </div>
  );
}

async function Perfil({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("content:write");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [linha] = await db.select({ c: t.canaisVigiados, cliente: t.clients.tradeName }).from(t.canaisVigiados)
    .innerJoin(t.clients, eq(t.clients.id, t.canaisVigiados.clientId)).where(eq(t.canaisVigiados.id, id)).limit(1);
  if (!linha) notFound();
  const { c, cliente } = linha;
  const videos = await db.select().from(t.videosVigiados).where(eq(t.videosVigiados.canalId, c.id)).orderBy(desc(t.videosVigiados.publicadoEm)).limit(60);
  const yt = c.plataforma === "youtube";
  const ultShort = yt ? videos.find((v) => v.ehShort) : undefined, ultVideo = yt ? videos.find((v) => !v.ehShort) : undefined;
  const conta = (s: readonly string[]) => videos.filter((v) => s.includes(v.status)).length;
  const numeros = [["Postados", ["POSTADO"]], ["Na fila", ["NOVO", "BAIXANDO", "POSTANDO"]], ["Para revisar", ["PRONTO"]], ["Falharam", ["FALHOU"]]] as const;

  return (
    <div className="grid gap-5">
      <header className="grid gap-3 rounded-2xl border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid min-w-0 gap-1">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <SeloPlataforma p={c.plataforma} />
              <h1 className="truncate text-xl font-semibold">{c.nome}</h1>
              <a href={c.url} target="_blank" rel="noreferrer" aria-label="Abrir o perfil original" className="grid size-9 place-items-center rounded-lg hover:bg-muted"><ExternalLink className="size-4" aria-hidden /></a>
            </div>
            <p className="text-sm text-muted-foreground">
              Posta nas redes de <strong className="text-foreground">{cliente}</strong> · {c.ativo ? "vigiando" : "pausado"}
              {c.verificadoEm ? ` · verificado ${quando.format(c.verificadoEm)}` : " · primeira verificação na fila"}
            </p>
            {c.erro && <p className="text-sm text-destructive">{c.erro}</p>}
          </div>
          <div className="flex flex-wrap gap-1.5"><VerificarAgora id={c.id} /><ExcluirCanal id={c.id} nome={c.nome} voltar /></div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
          {numeros.map(([rot, s]) => (
            <div key={rot} className="rounded-xl border p-2"><p className="text-lg font-semibold">{conta(s)}</p><p className="text-xs text-muted-foreground">{rot}</p></div>
          ))}
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <div className="grid min-w-0 content-start gap-5">
          <section aria-labelledby="marca" className="grid gap-3 rounded-2xl border bg-card p-4">
            <h2 id="marca" className="text-base font-semibold">Marca d&apos;água</h2>
            {!c.marca.chave && <p className="text-xs text-signal">Envie a imagem da sua marca: até lá os vídeos saem sem ela.</p>}
            <MarcaEditor canalId={c.id} marca={c.marca}
              fundoShort={ultShort ? `https://i.ytimg.com/vi/${ultShort.videoId}/oar2.jpg` : undefined}
              fundoVideo={ultVideo ? `https://i.ytimg.com/vi/${ultVideo.videoId}/hqdefault.jpg` : undefined} />
          </section>
          <details className="rounded-2xl border bg-card p-4">
            <summary className="cursor-pointer text-base font-semibold">Configurações</summary>
            <ActionForm action={salvarConfigAction.bind(null, c.id)} className="mt-3 grid gap-3">
              <Opcoes c={c} />
              <label className="flex items-center gap-2.5 text-sm"><input type="checkbox" name="ativo" defaultChecked={c.ativo} className="size-4 accent-[var(--primary)]" /> Vigiando (desmarque para pausar)</label>
              <FormMessage />
              <SubmitButton className="h-10 w-full sm:h-9 sm:w-auto sm:justify-self-start">Salvar configurações</SubmitButton>
            </ActionForm>
          </details>
        </div>

        <section aria-labelledby="videos" className="grid min-w-0 content-start gap-3">
          <h2 id="videos" className="text-base font-semibold">Vídeos e repostagens</h2>
          {videos.length === 0
            ? <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">A primeira verificação vai listar os vídeos atuais do perfil em instantes. Toque em “Verificar agora” e atualize a página.</p>
            : <ul className="grid gap-2 xl:grid-cols-2">{videos.map((v) => <Video key={v.id} v={v} plataforma={c.plataforma} />)}</ul>}
        </section>
      </div>
    </div>
  );
}
