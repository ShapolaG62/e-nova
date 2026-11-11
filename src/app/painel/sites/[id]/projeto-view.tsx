"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle, ArrowLeft, ChevronLeft, ChevronRight, Copy, Download, ExternalLink, Globe, Info, Link2, Loader2, MessageCircle, Monitor,
  Pencil, Phone, Search, Send, Shuffle, Smartphone, Tablet, Trash2,
} from "lucide-react";
import {
  despublicarSiteAction, excluirSiteAction, outroVisualAction, publicarSiteAction, registrarContatoAction,
} from "@/app/actions/vendas";
import { abrirWhats, copiar } from "@/lib/sites/client-utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Props = {
  site: { id: string; nome: string; published: boolean; slug: string | null; prospectId: string | null; aiNotice: string | null; setor: string };
  stats: { palavras: number; imagens: number; itens: number };
  temExemplos: boolean;
  visual: { atual: number; total: number; nome: string };
  base: string;
  local: boolean;
  sugestaoSlug: string;
  abrirPublicar: boolean;
};

const DISPOSITIVOS = [
  { id: "desktop", rotulo: "Computador", Icone: Monitor, largura: "100%" },
  { id: "tablet", rotulo: "Tablet", Icone: Tablet, largura: "820px" },
  { id: "celular", rotulo: "Celular", Icone: Smartphone, largura: "390px" },
] as const;

const n = (x: number) => x.toLocaleString("pt-BR");

export function ProjetoView({ site, stats, temExemplos, visual, base, local, sugestaoSlug, abrirPublicar }: Props) {
  const router = useRouter();
  const [ts, setTs] = useState(0);
  const [disp, setDisp] = useState<(typeof DISPOSITIVOS)[number]["id"]>("desktop");
  const [ocupado, setOcupado] = useState<"" | "ant" | "prox" | "novo">("");
  const [pubAberto, setPubAberto] = useState(abrirPublicar);
  const [excluirAberto, setExcluirAberto] = useState(false);
  const [pend, start] = useTransition();
  const link = site.published && site.slug ? `${base}${site.slug}` : "";
  const largura = DISPOSITIVOS.find((d) => d.id === disp)!.largura;

  const recarregar = () => {
    setTs(Date.now());
    router.refresh();
  };

  const trocarVisual = async (tipo: "ant" | "prox" | "novo") => {
    setOcupado(tipo);
    try {
      let r = await outroVisualAction(site.id, tipo === "ant" ? -1 : 1);
      // "Gerar outro visual": vai até o último já gerado e cria um novo
      if (tipo === "novo") {
        while (r.ok && r.data.layoutIndex < r.data.layouts.length - 1) r = await outroVisualAction(site.id, 1);
        if (r.ok && visual.atual < visual.total - 1) r = await outroVisualAction(site.id, 1);
      }
      if (!r.ok) toast.error(r.message);
      recarregar();
    } catch {
      toast.error("Não foi possível trocar o visual.");
    } finally {
      setOcupado("");
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4">
      {/* Barra superior */}
      <div className="grid gap-3">
        <div className="flex min-w-0 items-center gap-3">
        <Link href="/painel/sites" className={buttonVariants({ variant: "outline", size: "icon", className: "size-10 sm:size-9" })} aria-label="Voltar para Meus sites">
          <ArrowLeft />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl leading-tight font-bold sm:text-2xl">{site.nome}</h1>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span>{site.setor}</span>
            <span aria-hidden>·</span>
            <span>
              {n(stats.palavras)} palavras · {n(stats.imagens)} imagens · {n(stats.itens)} itens
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium",
                site.published ? "bg-emerald-600/10 text-emerald-700 dark:text-emerald-400" : "bg-muted text-muted-foreground",
              )}
            >
              {site.published ? "● Publicado" : "Não publicado"}
            </span>
          </p>
        </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="mr-auto hidden rounded-lg bg-muted p-0.5 sm:flex" role="group" aria-label="Tamanho da prévia">
            {DISPOSITIVOS.map(({ id, rotulo, Icone }) => (
              <button
                key={id}
                type="button"
                title={rotulo}
                aria-label={rotulo}
                aria-pressed={disp === id}
                onClick={() => setDisp(id)}
                className={cn("grid size-8 place-items-center rounded-md", disp === id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
              >
                <Icone className="size-4" />
              </button>
            ))}
          </div>
          <a href={`/api/vendas/sites/${site.id}/previa`} target="_blank" rel="noopener" className={buttonVariants({ variant: "outline", className: "h-10 sm:h-9" })}>
            <ExternalLink /> Abrir
          </a>
          <Link href={`/painel/sites/${site.id}/editor`} className={buttonVariants({ variant: "outline", className: "h-10 sm:h-9" })}>
            <Pencil /> Editar
          </Link>
          <a href={`/api/vendas/sites/${site.id}/zip`} download className={buttonVariants({ variant: "outline", className: "h-10 sm:h-9" })}>
            <Download /> Baixar
          </a>
          <Button variant="destructive" size="icon" className="size-10 sm:size-9" aria-label="Excluir site" title="Excluir site" onClick={() => setExcluirAberto(true)}>
            <Trash2 />
          </Button>
          <Button className="h-10 flex-1 sm:h-9 sm:flex-none" onClick={() => setPubAberto(true)}>
            <Send /> {site.published ? "Enviar oferta" : "Publicar e enviar oferta"}
          </Button>
        </div>
      </div>

      {site.aiNotice && (
        <p className="flex items-start gap-2 rounded-lg border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0" /> {site.aiNotice}
        </p>
      )}

      {temExemplos && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>
            Alguns depoimentos ou números são <b>exemplos</b> (o negócio não tinha avaliações suficientes no Google). Troque em{" "}
            <Link href={`/painel/sites/${site.id}/editor`} className="font-medium underline">
              Editar
            </Link>{" "}
            antes de mandar para o cliente, ou oculte o bloco.
          </span>
        </div>
      )}

      {/* Visual + link publicado */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-xl border bg-card p-1">
          <Button variant="ghost" size="icon" aria-label="Visual anterior" disabled={!!ocupado || visual.atual === 0} onClick={() => trocarVisual("ant")}>
            {ocupado === "ant" ? <Loader2 className="animate-spin" /> : <ChevronLeft />}
          </Button>
          <span className="px-1 text-xs font-semibold whitespace-nowrap">
            Visual {visual.atual + 1}/{visual.total} · {visual.nome}
          </span>
          <Button variant="ghost" size="icon" aria-label="Próximo visual" disabled={!!ocupado || visual.atual >= visual.total - 1} onClick={() => trocarVisual("prox")}>
            {ocupado === "prox" ? <Loader2 className="animate-spin" /> : <ChevronRight />}
          </Button>
        </div>
        <Button variant="secondary" className="h-10 sm:h-9" disabled={!!ocupado} onClick={() => trocarVisual("novo")}>
          {ocupado === "novo" ? <Loader2 className="animate-spin" /> : <Shuffle />} Gerar outro visual
        </Button>
        {link && (
          <div className="flex w-full min-w-0 items-center gap-1 rounded-xl border bg-card py-1 pr-1 pl-3 text-sm sm:ml-auto sm:w-auto">
            <Globe className="size-4 shrink-0 text-emerald-600" />
            <a href={link} target="_blank" rel="noopener" className="min-w-0 flex-1 truncate text-primary hover:underline">
              {link}
            </a>
            <Button variant="ghost" size="icon-sm" aria-label="Copiar link" onClick={() => copiar(link)}>
              <Copy />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={pend}
              onClick={() =>
                start(async () => {
                  const r = await despublicarSiteAction(site.id);
                  if (r.ok) toast.success("Site tirado do ar");
                  else toast.error(r.message);
                  router.refresh();
                })
              }
            >
              Tirar do ar
            </Button>
          </div>
        )}
      </div>

      {/* Palco da prévia */}
      <div className="overflow-x-auto rounded-2xl border bg-[repeating-linear-gradient(45deg,var(--muted),var(--muted)_10px,transparent_10px,transparent_20px)] p-2 sm:p-4">
        <div
          className={cn("mx-auto overflow-hidden bg-white shadow-lg transition-[width] duration-300", disp === "desktop" ? "rounded-lg" : "rounded-[1.6rem] border-[6px] border-neutral-800")}
          style={{ width: largura, maxWidth: disp === "desktop" ? "100%" : undefined }}
        >
          <iframe
            key={ts}
            src={`/api/vendas/sites/${site.id}/previa?t=${ts}`}
            title={`Prévia do site ${site.nome}`}
            className="block h-[72dvh] min-h-[460px] w-full border-0"
          />
        </div>
      </div>

      <PublicarDialog
        aberto={pubAberto}
        onAberto={setPubAberto}
        site={site}
        base={base}
        local={local}
        sugestaoSlug={sugestaoSlug}
        onPublicado={() => recarregar()}
      />

      <Dialog open={excluirAberto} onOpenChange={setExcluirAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir site?</DialogTitle>
            <DialogDescription>
              O site de <b>{site.nome}</b> será apagado{site.published ? " e sairá do ar" : ""}. O negócio continua no funil.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExcluirAberto(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={pend}
              onClick={() =>
                start(async () => {
                  const r = await excluirSiteAction(site.id);
                  if (!r.ok) return void toast.error(r.message);
                  toast.success("Site excluído");
                  router.push("/painel/sites");
                })
              }
            >
              {pend ? <Loader2 className="animate-spin" /> : <Trash2 />} Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PublicarDialog({
  aberto, onAberto, site, base, local, sugestaoSlug, onPublicado,
}: {
  aberto: boolean;
  onAberto: (v: boolean) => void;
  site: Props["site"];
  base: string;
  local: boolean;
  sugestaoSlug: string;
  onPublicado: () => void;
}) {
  const [slug, setSlug] = useState(sugestaoSlug);
  const [res, setRes] = useState<{ link: string; mensagem: string; whatsapp: string } | null>(null);
  const [msg, setMsg] = useState("");
  const [pend, start] = useTransition();

  const [abertoAntes, setAbertoAntes] = useState(aberto);
  if (aberto !== abertoAntes) {
    setAbertoAntes(aberto);
    if (aberto) setSlug(sugestaoSlug);
  }

  const publicar = () =>
    start(async () => {
      try {
        const r = await publicarSiteAction(site.id, slug);
        if (!r.ok) return void toast.error(r.message);
        setRes(r.data);
        setMsg(r.data.mensagem);
        setSlug(r.data.slug);
        toast.success("Site publicado!");
        onPublicado();
      } catch {
        toast.error("Não foi possível publicar. Tente de novo.");
      }
    });

  const enviar = async () => {
    if (!res) return;
    abrirWhats(res.whatsapp, msg);
    if (site.prospectId) {
      const r = await registrarContatoAction(site.prospectId, msg).catch(() => null);
      if (r?.ok) toast.success("Marcado como contatado");
    }
  };

  return (
    <Dialog
      open={aberto}
      onOpenChange={(v) => {
        onAberto(v);
        if (!v) setRes(null);
      }}
    >
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{site.nome}</DialogTitle>
          <DialogDescription>Publique e mande o link no WhatsApp do dono do negócio.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 rounded-xl border p-3.5">
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            <Link2 className="size-3.5" /> Endereço do site
          </p>
          <div className="flex min-w-0 items-stretch overflow-hidden rounded-lg border focus-within:ring-3 focus-within:ring-ring/50">
            <span className="flex max-w-[55%] items-center truncate border-r bg-muted px-2.5 text-xs text-muted-foreground" title={base}>
              {base.replace(/^https?:\/\//, "")}
            </span>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 56))}
              className="h-10 min-w-0 flex-1 bg-transparent px-2.5 text-sm outline-none"
              aria-label="Endereço (slug)"
            />
          </div>
          {local && (
            <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              <span>
                O sistema ainda roda só no seu computador (localhost), então o cliente <b>não consegue abrir</b> esse link. Ele funciona para você conferir; quando o E-Nova estiver
                online, os links passam a abrir para qualquer pessoa.
              </span>
            </p>
          )}
          <Button className="h-10" disabled={pend || !slug.replace(/-/g, "")} onClick={publicar}>
            {pend ? <Loader2 className="animate-spin" /> : <Globe />} {site.published || res ? "Atualizar e gerar mensagem" : "Publicar site"}
          </Button>
        </div>

        {res && (
          <div className="grid gap-3 rounded-xl border border-emerald-500/50 bg-emerald-500/5 p-3.5">
            <p className="text-xs font-semibold tracking-wider text-emerald-700 uppercase dark:text-emerald-400">● Site no ar</p>
            <a href={res.link} target="_blank" rel="noopener" className="truncate text-sm font-medium text-primary hover:underline">
              {res.link}
            </a>
            <Textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={6} aria-label="Mensagem para o cliente" />
            {res.whatsapp ? (
              <>
                <Button className="h-10 bg-[#1f9d55] text-white hover:bg-[#1a8a4a]" onClick={enviar}>
                  <MessageCircle /> Enviar no WhatsApp
                </Button>
                <p className="text-xs text-muted-foreground">Abre a conversa com a mensagem pronta. Você revisa e envia.</p>
              </>
            ) : (
              <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
                <Phone className="mt-0.5 size-3.5 shrink-0" />
                Esse número parece fixo (ou não temos o WhatsApp). Ligue e peça o WhatsApp, ou copie a mensagem.
              </p>
            )}
            <Button variant="outline" onClick={() => copiar(msg)}>
              <Copy /> Copiar mensagem
            </Button>
          </div>
        )}

        <div className="grid gap-2 sm:grid-cols-2">
          <Link href={`/painel/sites/${site.id}/editor`} className={buttonVariants({ variant: "outline", className: "h-10" })}>
            <Pencil /> Editar
          </Link>
          <Link href="/painel/prospeccao" className={buttonVariants({ variant: "outline", className: "h-10" })}>
            <Search /> Achar mais negócios sem site
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}
