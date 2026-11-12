import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import { Clapperboard } from "lucide-react";
import { db, t } from "@/db";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { FORMATOS } from "@/lib/gerador/formatos";
import { quemFaz } from "@/lib/gerador/quem";
import { criarVideoAction } from "@/app/actions/gerador";
import { ActionForm, FieldError, FormMessage, SubmitButton } from "@/components/action-form";
import { ClientSelect } from "@/components/client-filter";
import { Field } from "@/components/field";
import { PageHeader, PageSkeleton } from "@/components/page";
import { Progress } from "@/components/ui/progress";
import { QuemFazLista, StatusVideo } from "./comum";
import { EscolherVoz, EstiloPersonagens, Receitas } from "./opcoes-video";
import { EsteticaEscolha, FotosAnimar, PersonagemCampo } from "./historia-video";
import { PadroesLista, type PadraoCartao } from "./padroes-lista";
import { listarPadroes } from "@/lib/gerador/padroes";
import { estetica } from "@/lib/gerador/estetica";
import { formato } from "@/lib/gerador/formatos";

export const metadata: Metadata = { title: "Gerador de vídeos" };
const quando = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
const sel = "h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:h-9 dark:bg-input/30";

export default function Page() {
  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader
        title="Gerador de vídeos"
        subtitle="Conte a história, mostre o personagem e escolha a estética. As melhores IAs grátis passam o trabalho de uma para outra até o vídeo ficar pronto, e ele vira um padrão para repetir com 1 botão."
      />
      <Suspense fallback={<PageSkeleton />}>
        <Conteudo />
      </Suspense>
    </div>
  );
}

async function Conteudo() {
  const me = await requirePermission("ai:use");
  const [projetos, quem, minhas, padroes] = await Promise.all([
    db.select({ id: t.videoProjetos.id, titulo: t.videoProjetos.titulo, status: t.videoProjetos.status, progresso: t.videoProjetos.progresso, etapa: t.videoProjetos.etapa, criado: t.videoProjetos.createdAt, resultado: t.videoProjetos.resultado, brief: t.videoProjetos.brief })
      .from(t.videoProjetos).where(can(me.role, "system:view") ? undefined : eq(t.videoProjetos.userId, me.id)).orderBy(desc(t.videoProjetos.createdAt)).limit(40),
    quemFaz(),
    db.select({ id: t.vozes.id, nome: t.vozes.nome }).from(t.vozes).where(eq(t.vozes.status, "PRONTA")).orderBy(desc(t.vozes.createdAt)).limit(30),
    listarPadroes(),
  ]);
  const cartoes: PadraoCartao[] = padroes.filter((p) => can(me.role, "system:view") || p.userId === me.id).map((p) => ({
    id: p.id, nome: p.nome, usos: p.usos,
    capa: p.capaChave ? `/api/gerador/${p.projetoId}/arquivo?k=${encodeURIComponent(p.capaChave)}` : null,
    detalhes: [p.brief.estilo === "animacao" ? "Animação desenhada" : estetica(p.brief.estetica)?.nome ?? "Imagens por IA", formato(p.brief.formato).nome, `${p.brief.duracaoAlvo} s`, p.brief.proporcao].join(" · "),
    personagem: p.brief.personagem?.slice(0, 70) ?? p.personagens?.map((x) => x.nome).join(", ") ?? p.anim?.elenco?.map((x) => x.nome).join(", ") ?? null,
  }));

  return (
    <div className="grid grid-cols-1 gap-6">
    <PadroesLista padroes={cartoes} />
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
      <section aria-labelledby="novo" className="grid min-w-0 content-start gap-4">
        <Receitas />
        <ActionForm action={criarVideoAction} id="form-novo-video" className="grid gap-4 rounded-2xl border bg-card p-4">
          <h2 id="novo" className="text-lg font-semibold">Novo vídeo</h2>
          <div className="grid gap-1.5">
            <label htmlFor="tema" className="text-sm font-medium">Conte a história</label>
            <textarea id="tema" name="tema" rows={4} required placeholder="Ex.: Dona Rita abre a padaria às 5h, o forno falha no dia da encomenda grande e ela salva tudo com a ajuda dos vizinhos. Ou: 3 erros que fazem a pizzaria perder clientes no delivery." className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:text-sm dark:bg-input/30" />
            <FieldError name="tema" />
          </div>
          <PersonagemCampo />
          <fieldset className="grid gap-2">
            <legend className="mb-1.5 text-sm font-medium">Estilo</legend>
            <label className="flex items-start gap-2.5 rounded-xl border p-3 text-sm has-[:checked]:border-signal has-[:checked]:bg-signal/5">
              <input type="radio" name="estilo" value="animacao" className="mt-0.5 size-4 accent-[var(--primary)]" />
              <span><strong>Animação desenhada</strong> — bonecos e cenários feitos por código, com efeitos sonoros. Grátis, sem IA de imagem, sempre vertical.</span>
            </label>
            <label className="flex items-start gap-2.5 rounded-xl border p-3 text-sm has-[:checked]:border-signal has-[:checked]:bg-signal/5">
              <input type="radio" name="estilo" value="fotos" defaultChecked className="mt-0.5 size-4 accent-[var(--primary)]" />
              <span><strong>Imagens por IA</strong> — o personagem, a estética e as suas fotos ganham vida em cenas com movimento de câmera (ou clipes, se houver IA de vídeo).</span>
            </label>
          </fieldset>
          <div className="so-ia grid gap-4"><EsteticaEscolha /><FotosAnimar /></div>
          <div className="so-animacao"><EstiloPersonagens /></div>
          <div className="grid gap-1.5">
            <label htmlFor="formato" className="text-sm font-medium">Formato</label>
            <select id="formato" name="formato" defaultValue="historia" className={sel}>
              {FORMATOS.map((f) => <option key={f.id} value={f.id}>{f.nome} — {f.descricao}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field name="duracaoAlvo" label="Duração (segundos)" type="number" min={10} max={180} defaultValue={60} inputMode="numeric" />
            <div className="grid gap-1.5">
              <label htmlFor="proporcao" className="text-sm font-medium">Formato da tela</label>
              <select id="proporcao" name="proporcao" defaultValue="9:16" className={sel}>
                <option value="9:16">Vertical 9:16 (Reels, TikTok)</option>
                <option value="1:1">Quadrado 1:1</option>
                <option value="16:9">Horizontal 16:9 (YouTube)</option>
              </select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="fonteVisual" className="text-sm font-medium">De onde vêm as imagens? <span className="font-normal text-muted-foreground">(só no estilo com IA)</span></label>
            <select id="fonteVisual" name="fonteVisual" defaultValue="ia" className={sel}>
              <option value="ia">IA desenha todas as cenas (o personagem aparece em todas)</option>
              <option value="referencia">IA criando imagens novas seguindo um exemplo do banco</option>
              <option value="banco">Banco de mídia: fotos e vídeos prontos (sem personagem fixo)</option>
            </select>
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="visual" className="text-sm font-medium">Imagens ou clipes? <span className="font-normal text-muted-foreground">(só no estilo com IA)</span></label>
            <select id="visual" name="visual" defaultValue="imagem" className={sel}>
              <option value="imagem">Imagens com movimento de câmera (mais barato e rápido)</option>
              <option value="misto">Misturar: clipes onde há ação, imagens no resto</option>
              <option value="video">Clipes de vídeo em todas as cenas (mais caro)</option>
            </select>
          </div>
          <EscolherVoz minhas={minhas} />
          <details className="group rounded-xl border p-3">
            <summary className="cursor-pointer text-sm font-medium">Mais opções</summary>
            <div className="mt-3 grid gap-3">
              <Field name="publico" label="Para quem é? (opcional)" placeholder="Ex.: donos de restaurante da cidade" />
              <Field name="tom" label="Tom (opcional)" placeholder="Ex.: bem-humorado e direto" />
              <Field name="estiloVisual" label="Estilo visual (opcional)" placeholder="Ex.: fotos realistas, luz quente, cores da marca vermelho e creme" />
              <Field name="cta" label="Chamada no final (opcional)" placeholder="Ex.: Peça pelo link da bio" />
              <Field name="clientId" label="Cliente (opcional)" hint="Com cliente, o vídeo pronto entra na biblioteca dele para publicar.">
                <ClientSelect emptyLabel="Nenhum (vídeo da agência)" />
              </Field>
            </div>
          </details>
          <div className="grid gap-2 text-sm">
            <label className="flex items-center gap-2.5"><input type="checkbox" name="legendas" defaultChecked className="size-4 accent-[var(--primary)]" /> Legendas na tela</label>
            <label className="flex items-center gap-2.5"><input type="checkbox" name="musica" className="size-4 accent-[var(--primary)]" /> Trilha sonora (precisa de IA de música, paga)</label>
            <input type="hidden" name="semRevisao" value="on" />
            <label className="flex items-start gap-2.5"><input type="checkbox" name="semRevisao" value="off" defaultChecked className="mt-0.5 size-4 accent-[var(--primary)]" /> <span>Corrente de IAs: uma segunda IA revisa o roteiro e uma IA que enxerga confere se o personagem saiu igual (mais lento, melhor resultado)</span></label>
          </div>
          <FormMessage />
          <SubmitButton className="h-11 w-full sm:h-10">Escrever o roteiro</SubmitButton>
          <p className="text-xs text-muted-foreground">Primeiro sai só o roteiro (barato). Você revisa e só então manda produzir as imagens e a voz.</p>
        </ActionForm>
        <QuemFazLista quem={quem} podeConfigurar={can(me.role, "system:view")} />
      </section>

      <section aria-labelledby="lista" className="grid content-start gap-3">
        <h2 id="lista" className="text-lg font-semibold">Seus vídeos</h2>
        {projetos.length === 0 && (
          <div className="grid place-items-center gap-2 rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            <Clapperboard className="size-8" aria-hidden />
            Nenhum vídeo ainda. Descreva a ideia ao lado.
          </div>
        )}
        <ul className="grid gap-3 sm:grid-cols-2">
          {projetos.map((p) => (
            <li key={p.id}>
              <Link href={`/painel/gerador/${p.id}`} className="flex gap-3 rounded-2xl border bg-card p-3 hover:bg-muted/50">
                <div className="grid aspect-[9/16] w-16 shrink-0 place-items-center overflow-hidden rounded-lg bg-muted">
                  {p.resultado?.capaChave
                    ? <img src={`/api/gerador/${p.id}/arquivo?k=${encodeURIComponent(p.resultado.capaChave)}`} alt="" className="size-full object-cover" loading="lazy" />
                    : <Clapperboard className="size-5 text-muted-foreground" aria-hidden />}
                </div>
                <div className="grid min-w-0 content-start gap-1.5">
                  <p className="line-clamp-2 text-sm font-medium">{p.titulo}</p>
                  <StatusVideo status={p.status} />
                  {(p.status === "ROTEIRIZANDO" || p.status === "PRODUZINDO") && <Progress value={p.progresso} aria-label="Progresso" />}
                  <p className="text-xs text-muted-foreground">{quando.format(p.criado)} · {p.brief.proporcao} · {p.resultado ? `${Math.round(p.resultado.duracao)} s` : `${p.brief.duracaoAlvo} s pedidos`}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
    </div>
  );
}
