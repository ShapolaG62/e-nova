"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarClock, CheckCircle2, Copy, Eye, Loader2, MessageCircle, MessagesSquare, Phone, Search, Send, Sparkles, Upload } from "lucide-react";
import { toast } from "sonner";
import { registrarContatoAction } from "@/app/actions/vendas";
import { abrirWhats, copiar, tempoAtras } from "@/lib/sites/client-utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DadosHoje, LeadFunil } from "./funil-tipos";
import type { AbaFicha } from "./funil-ficha";

type Tipo = "prontos" | "follow" | "semsite";

export function AbaHoje({ hoje, aoAbrirFicha, aoAtualizar }: { hoje: DadosHoje; aoAbrirFicha: (id: string, aba?: AbaFicha) => void; aoAtualizar: () => void }) {
  const pct = Math.min(100, Math.round((hoje.feitos / Math.max(1, hoje.meta)) * 100));
  const nada = !hoje.prontos.length && !hoje.followups.length && !hoje.semSite.length;
  const s = hoje.esperando !== 1;

  return (
    <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      <div className="grid gap-4">
        <section className="grid gap-3 rounded-2xl border bg-card p-5">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Meta de hoje</p>
          <p className="flex items-baseline gap-2">
            <span className="num text-4xl font-bold">{hoje.feitos}</span>
            <span className="text-sm text-muted-foreground">de {hoje.meta} contatos</span>
          </p>
          <div className="h-2.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Progresso da meta do dia">
            <div className={cn("h-full rounded-full transition-all", pct >= 100 ? "bg-emerald-500" : "bg-primary")} style={{ width: `${pct}%` }} />
          </div>
          <p className="text-sm text-muted-foreground">
            {pct >= 100 ? "Meta batida! 🎉 " : ""}
            <b className="text-foreground">{hoje.esperando}</b> negócio{s ? "s" : ""} espera{s ? "m" : ""} uma mensagem sua. Quem manda {hoje.meta} por dia vende; quem manda 2, não.
          </p>
        </section>

        <section className="grid gap-3 rounded-2xl border bg-card p-5">
          <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            <Eye className="size-3.5" /> Abriram seu site
          </p>
          {hoje.visitas.length ? (
            <ul className="grid gap-1">
              {hoje.visitas.map((v, i) => (
                <li key={i}>
                  <button
                    type="button"
                    disabled={!v.prospectId}
                    onClick={() => v.prospectId && aoAbrirFicha(v.prospectId)}
                    className="flex w-full items-start gap-2.5 rounded-lg p-2 text-left hover:bg-muted disabled:hover:bg-transparent"
                  >
                    <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                      <Eye className="size-3.5" />
                    </span>
                    <span className="text-sm">
                      <b>{v.nome}</b> abriu o site
                      <br />
                      <small className="text-xs text-muted-foreground" suppressHydrationWarning>há {tempoAtras(v.em)} · hora boa para chamar</small>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Quando um dono abrir o link que você mandou, aparece aqui (com o site publicado na internet).</p>
          )}
        </section>
      </div>

      <div className="grid gap-6">
        <Secao titulo="Sites prontos para mandar" sub="O site existe e o dono ainda não sabe.">
          {hoje.prontos.map((c) => (
            <Cartao key={c.lead.id} lead={c.lead} mensagem={c.mensagem} tipo="prontos" aoAbrirFicha={aoAbrirFicha} aoAtualizar={aoAtualizar} />
          ))}
        </Secao>
        <Secao titulo="Retomar contato" sub="Mandou mensagem e não andou? Hora do follow-up.">
          {hoje.followups.map((l) => (
            <Cartao key={l.id} lead={l} tipo="follow" aoAbrirFicha={aoAbrirFicha} aoAtualizar={aoAtualizar} />
          ))}
        </Secao>
        <Secao titulo="No funil, ainda sem site" sub="Crie o site ou mande só a primeira mensagem.">
          {hoje.semSite.map((l) => (
            <Cartao key={l.id} lead={l} tipo="semsite" aoAbrirFicha={aoAbrirFicha} aoAtualizar={aoAtualizar} />
          ))}
        </Secao>
        {nada && (
          <div className="grid justify-items-center gap-3 rounded-2xl border border-dashed p-10 text-center">
            <CheckCircle2 className="size-8 text-primary" />
            <p className="text-sm text-muted-foreground">Ninguém esperando. Bora prospectar!</p>
            <Link href="/painel/prospeccao" className={buttonVariants({ className: "h-10" })}>
              <Search /> Encontrar negócios sem site
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function Secao({ titulo, sub, children }: { titulo: string; sub: string; children: React.ReactNode[] }) {
  if (!children.length) return null;
  return (
    <section className="grid gap-3">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <h2 className="text-lg font-bold">{titulo}</h2>
        <span className="num rounded-full bg-muted px-2 text-xs font-semibold">{children.length}</span>
        <span className="w-full text-sm text-muted-foreground sm:w-auto">{sub}</span>
      </div>
      <div className="grid gap-3 md:grid-cols-2">{children}</div>
    </section>
  );
}

function Selo({ cls, children }: { cls: string; children: React.ReactNode }) {
  return <span className={cn("inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium [&_svg]:size-3", cls)}>{children}</span>;
}

function Cartao({
  lead: l,
  mensagem,
  tipo,
  aoAbrirFicha,
  aoAtualizar,
}: {
  lead: LeadFunil;
  mensagem?: string;
  tipo: Tipo;
  aoAbrirFicha: (id: string, aba?: AbaFicha) => void;
  aoAtualizar: () => void;
}) {
  const [aberta, setAberta] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const publicado = !!l.site?.publicado;

  const status =
    tipo === "follow" ? (
      <Selo cls="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
        <CalendarClock /> Retomar contato hoje
      </Selo>
    ) : tipo === "semsite" ? (
      <Selo cls="bg-muted text-muted-foreground">Sem site ainda</Selo>
    ) : publicado ? (
      <Selo cls="bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300">
        <Send /> Site pronto, ainda não enviado
      </Selo>
    ) : (
      <Selo cls="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
        <Upload /> Site gerado, falta publicar
      </Selo>
    );

  let acao: React.ReactNode;
  if (tipo === "prontos" && !publicado)
    acao = (
      <Link href={`/painel/sites/${l.site!.id}?publicar=1`} className={buttonVariants({ className: "h-10 w-full" })}>
        <Upload /> Publicar o site
      </Link>
    );
  else if (tipo === "prontos")
    acao = l.whatsapp ? (
      <Button
        className="h-10 w-full bg-emerald-600 text-white hover:bg-emerald-700"
        disabled={enviando}
        onClick={async () => {
          abrirWhats(l.whatsapp, mensagem ?? "");
          setEnviando(true);
          const r = await registrarContatoAction(l.id, mensagem);
          setEnviando(false);
          if (r.ok) {
            toast.success("Marcado como contatado ✓");
            aoAtualizar();
          } else toast.error(r.message);
        }}
      >
        {enviando ? <Loader2 className="animate-spin" /> : <MessageCircle />} Mandar no WhatsApp
      </Button>
    ) : (
      <Button variant="outline" className="h-10 w-full" onClick={() => aoAbrirFicha(l.id, "roteiros")}>
        <Phone /> Telefone fixo: ver roteiro de ligação
      </Button>
    );
  else if (tipo === "semsite")
    acao = (
      <div className="grid grid-cols-2 gap-2">
        <Link href={`/painel/sites/novo?prospect=${l.id}`} className={buttonVariants({ className: "h-10" })}>
          <Sparkles /> Criar site
        </Link>
        <Button variant="outline" className="h-10" onClick={() => aoAbrirFicha(l.id, "roteiros")}>
          <MessagesSquare /> Só o 1º contato
        </Button>
      </div>
    );
  else
    acao = (
      <Button variant="outline" className="h-10 w-full" onClick={() => aoAbrirFicha(l.id, "roteiros")}>
        <MessagesSquare /> Abrir ficha e roteiros
      </Button>
    );

  return (
    <article className="grid content-start gap-3 rounded-2xl border bg-card p-4">
      <div className="flex items-start gap-3">
        <button type="button" onClick={() => aoAbrirFicha(l.id)} className="min-w-0 flex-1 text-left">
          <b className="block truncate hover:underline">{l.nome}</b>
          <small className="block truncate text-xs text-muted-foreground">
            {l.setorIcone} {l.setorNome}
            {l.cidade ? ` · ${l.cidade}` : ""}
          </small>
        </button>
        {l.site?.capa && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={l.site.capa} alt="" className="size-11 shrink-0 rounded-lg object-cover ring-1 ring-border" />
        )}
      </div>
      {status}
      {mensagem && (
        <div className="grid gap-1.5">
          <p className={cn("rounded-lg bg-muted/60 p-2.5 text-sm whitespace-pre-line", !aberta && "line-clamp-3")}>{mensagem}</p>
          <div className="flex items-center justify-between gap-2">
            <button type="button" onClick={() => setAberta((a) => !a)} className="text-xs font-medium text-primary hover:underline">
              {aberta ? "Ver menos" : "Ver mensagem inteira"}
            </button>
            <Button variant="outline" size="sm" onClick={() => copiar(mensagem)}>
              <Copy /> Copiar
            </Button>
          </div>
        </div>
      )}
      {acao}
    </article>
  );
}
