import { Suspense } from "react";
import { avaliacoes } from "@/lib/aprendizado";
import { Avaliar } from "@/components/avaliar";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { ArrowLeft, CheckCircle2, CircleAlert, Download } from "lucide-react";
import { db, t } from "@/db";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { formato } from "@/lib/gerador/formatos";
import { quemFaz } from "@/lib/gerador/quem";
import { itemCatalogo } from "@/lib/ia-hub/catalogo";
import { AutoRefresh } from "@/components/auto-refresh";
import { PageSkeleton } from "@/components/page";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { QuemFazLista, StatusVideo } from "../comum";
import { Acoes, EditorRoteiro } from "./editor";

export const metadata: Metadata = { title: "Vídeo — Gerador" };

export default function Page(props: PageProps<"/painel/gerador/[id]">) {
  return (
    <div className="grid grid-cols-1 gap-5">
      <Link href="/painel/gerador" className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Todos os vídeos
      </Link>
      <Suspense fallback={<PageSkeleton />}>
        <Conteudo params={props.params} />
      </Suspense>
    </div>
  );
}

async function Conteudo({ params }: { params: PageProps<"/painel/gerador/[id]">["params"] }) {
  const me = await requirePermission("ai:use");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const p = await db.query.videoProjetos.findFirst({ where: eq(t.videoProjetos.id, id) });
  if (!p || (p.userId !== me.id && !can(me.role, "system:view"))) notFound();
  const rodando = p.status === "ROTEIRIZANDO" || p.status === "PRODUZINDO";
  const arq = (k: string) => `/api/gerador/${p.id}/arquivo?k=${encodeURIComponent(k)}`;
  const r = p.resultado;
  const quem = p.status === "ROTEIRO_PRONTO" ? await quemFaz(p.brief.estilo === "animacao" ? ["voz"] : ["imagem", "video", "voz", "musica"]) : null;
  const vertical = p.brief.proporcao === "9:16";
  const nota = (await avaliacoes("videos", [p.id]))[p.id];

  return (
    <>
      {rodando && <AutoRefresh every={3} />}
      <header className="grid gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <StatusVideo status={p.status} />
          <span className="text-xs text-muted-foreground">{p.brief.estilo === "animacao" ? "Animação desenhada" : "Imagens por IA"} · {formato(p.brief.formato).nome} · {p.brief.proporcao} · {p.brief.duracaoAlvo} s pedidos</span>
        </div>
        <h1 className="text-[1.6rem] leading-tight font-bold sm:text-[2rem]">{p.titulo}</h1>
      </header>

      {rodando && (
        <div role="status" aria-live="polite" className="grid gap-2 rounded-2xl border bg-card p-4">
          <p className="text-sm font-medium">{p.etapa ?? "Trabalhando…"}</p>
          <Progress value={p.progresso} aria-label="Progresso" />
          <p className="text-xs text-muted-foreground">Pode sair desta tela: o trabalho continua no servidor.</p>
        </div>
      )}

      {p.status === "FALHOU" && p.erro && (
        <div role="alert" className="grid gap-1.5 rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
          <p className="flex items-center gap-2 font-medium text-destructive"><CircleAlert className="size-4" aria-hidden /> {p.etapa ?? "Algo deu errado"}</p>
          <p className="whitespace-pre-line break-words text-muted-foreground">{p.erro}</p>
        </div>
      )}

      {r && (
        <section aria-labelledby="resultado" className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
          <h2 id="resultado" className="sr-only">Vídeo pronto</h2>
          <div className="grid content-start gap-2">
            <video src={arq(r.videoChave)} poster={r.capaChave ? arq(r.capaChave) : undefined} controls playsInline preload="metadata" className={cn("w-full rounded-2xl bg-black", vertical ? "mx-auto max-h-[75dvh] max-w-[24rem]" : "")} />
            <a href={`${arq(r.videoChave)}&baixar=1&nome=${encodeURIComponent((p.titulo || "video").slice(0, 60))}.mp4`} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/85 sm:h-10">
              <Download className="size-4" aria-hidden /> Baixar MP4 ({Math.round(r.duracao)} s)
            </a>
            <div className="flex justify-center"><Avaliar area="videos" alvoId={p.id} inicial={nota} /></div>
            {p.outputAssetId && <p className="text-xs text-muted-foreground">Também está na biblioteca do cliente: crie a publicação em <Link href="/painel/conteudo" className="font-medium text-signal underline">Publicações</Link>.</p>}
          </div>
          <div className="grid content-start gap-4">
            {r.revisao && (
              <div className="grid gap-2 rounded-2xl border bg-card p-4">
                <h3 className="font-semibold">Revisão automática</h3>
                <ul className="grid gap-1.5 text-sm">
                  {r.revisao.map((x) => (
                    <li key={x.item} className="flex items-start gap-2">
                      {x.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-label="ok" /> : <CircleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" aria-label="atenção" />}
                      <span>{x.item}{x.detalhe && <span className="text-muted-foreground"> — {x.detalhe}</span>}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground">Assista com som antes de publicar: confira se o gancho prende, se cada imagem combina com a fala e se nomes e números soam certos. Para corrigir, edite a cena abaixo e use “Refazer cena” ou “Montar de novo”.</p>
              </div>
            )}
            {r.folhaChave && (
              <figure className="grid gap-1.5">
                <img src={arq(r.folhaChave)} alt="Quadros do vídeo, em ordem" className="w-full rounded-xl border" loading="lazy" />
                <figcaption className="text-xs text-muted-foreground">Quadros do vídeo, em ordem — para ver o ritmo das cenas de uma vez.</figcaption>
              </figure>
            )}
          </div>
        </section>
      )}

      {p.roteiro && (
        <section aria-labelledby="tratamento" className="grid gap-2 rounded-2xl border bg-card p-4">
          <h2 id="tratamento" className="font-semibold">A ideia do diretor</h2>
          <p className="text-sm"><span className="font-medium">Gancho:</span> {p.roteiro.gancho}</p>
          <p className="text-sm text-muted-foreground">{p.roteiro.tratamento}</p>
          {p.roteiro.usado && <p className="text-xs text-muted-foreground">Roteiro escrito por {itemCatalogo(p.roteiro.usado)?.nome ?? p.roteiro.usado}.</p>}
        </section>
      )}

      {quem && <QuemFazLista quem={quem} podeConfigurar={can(me.role, "system:view")} />}

      <Acoes id={p.id} status={p.status} temRoteiro={!!p.roteiro} todasProntas={p.cenas.length > 0 && p.cenas.every((c) => c.status === "PRONTA")} temResultado={!!r} />

      {p.roteiro && (
        <EditorRoteiro
          id={p.id}
          bloqueado={rodando}
          vertical={vertical}
          animado={p.brief.estilo === "animacao"}
          cenas={p.roteiro.cenas.map((c) => {
            const prod = p.cenas.find((x) => x.id === c.id);
            return {
              id: c.id, narracao: c.narracao, textoNaTela: c.textoNaTela ?? "", tipo: c.visual.tipo, prompt: c.visual.prompt, camera: c.visual.camera ?? "",
              status: prod?.status ?? "PENDENTE", erro: prod?.erro,
              visual: p.brief.estilo === "animacao"
                ? { url: `/api/gerador/${p.id}/previa?c=${c.id}&v=${encodeURIComponent(JSON.stringify(c.anim ?? {}).length + c.narracao.slice(0, 12))}`, video: false }
                : prod?.visualChave ? { url: arq(prod.visualChave), video: !!prod.visualMime?.startsWith("video/") } : null,
              resumo: c.anim ? [c.anim.cenario, c.anim.acao, c.anim.efeito && c.anim.efeito !== "nenhum" ? c.anim.efeito : null, c.anim.som && c.anim.som !== "nenhum" ? `som: ${c.anim.som}` : null, c.anim.cartao ? `cartão: ${c.anim.cartao.tipo}` : null].filter(Boolean).join(" · ") : "",
              audio: prod?.audioChave ? arq(prod.audioChave) : null,
              usado: [prod?.usadoVisual, prod?.usadoVoz].filter((x): x is string => !!x).map((x) => itemCatalogo(x)?.nome.replace(/\s*\(.*\)$/, "") ?? x).join(" + "),
            };
          })}
        />
      )}
    </>
  );
}
