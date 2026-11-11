"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AtSign, Copy, ExternalLink, Globe, History, Info, Loader2, MapPin, MessageCircle, MessagesSquare, Pencil, Phone, Plus,
  ShieldQuestion, Sparkles, Star, Trash2, UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import type { Prospect, ProspectStage } from "@/db/schema";
import { apagarProspectAction, atualizarProspectAction, fichaProspectAction } from "@/app/actions/vendas";
import { ETAPAS, abrirWhats, copiar } from "@/lib/sites/client-utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { selectClass } from "@/components/field";
import { cn } from "@/lib/utils";
import { ETAPA_ESTILO, ETAPA_SINGULAR, paraCents, reais, type LeadFunil } from "./funil-tipos";
import { ListaObjecoes, RoteirosDoContato, type Objecao } from "./roteiros";

export type AbaFicha = "info" | "roteiros" | "objecoes" | "site" | "hist";
type Ficha = NonNullable<Awaited<ReturnType<typeof fichaProspectAction>>>;

const ABAS: [AbaFicha, string, React.ComponentType<{ className?: string }>][] = [
  ["info", "Informações", Info],
  ["roteiros", "Roteiros", MessagesSquare],
  ["objecoes", "Objeções", ShieldQuestion],
  ["site", "Site", Globe],
  ["hist", "Histórico", History],
];

export function FichaLead({
  aberta,
  resumo,
  objecoes,
  podeEditar,
  aoFechar,
  aoMudar,
  aoFechou,
}: {
  aberta: { id: string; aba: AbaFicha } | null;
  resumo: LeadFunil | null;
  objecoes: Objecao[];
  podeEditar: boolean;
  aoFechar: () => void;
  aoMudar: () => void;
  aoFechou: (l: LeadFunil) => void;
}) {
  const [ficha, setFicha] = useState<Ficha | null | undefined>(undefined);
  const [aba, setAba] = useState<AbaFicha>("info");
  const id = aberta?.id ?? null;

  const carregar = useCallback(async (pid: string) => {
    const f = await fichaProspectAction(pid).catch(() => null);
    setFicha(f);
  }, []);

  // Abre (ou troca) de contato: busca a ficha atualizada
  const [ultimo, setUltimo] = useState<{ id: string; aba: AbaFicha } | null>(null);
  if (aberta !== ultimo) {
    setUltimo(aberta);
    if (aberta) {
      setAba(aberta.aba);
      if (aberta.id !== ultimo?.id) setFicha(undefined);
    }
  }
  useEffect(() => {
    if (!id) return;
    let vivo = true;
    fichaProspectAction(id)
      .catch(() => null)
      .then((f) => vivo && setFicha(f));
    return () => {
      vivo = false;
    };
  }, [id]);

  const p = ficha?.prospect;
  const nome = p?.name ?? resumo?.nome ?? "Contato";
  const sub = resumo ? `${resumo.setorIcone} ${resumo.setorNome}${resumo.cidade ? ` · ${resumo.cidade}` : ""}` : (p?.city ?? "");

  const recarregar = async () => {
    if (id) await carregar(id);
    aoMudar();
  };

  return (
    <Sheet open={!!aberta} onOpenChange={(o) => !o && aoFechar()}>
      <SheetContent side="right" className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-xl">
        <SheetHeader className="border-b pr-12">
          <SheetTitle className="text-lg font-bold">{nome}</SheetTitle>
          <SheetDescription>{sub}</SheetDescription>
          <div className="-mx-1 mt-2 flex gap-1 overflow-x-auto pb-0.5" role="tablist" aria-label="Seções da ficha">
            {ABAS.map(([k, n, Icone]) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={aba === k}
                onClick={() => setAba(k)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm transition",
                  aba === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icone className="size-3.5" /> {n}
              </button>
            ))}
          </div>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {ficha === undefined ? (
            <div className="grid gap-3" aria-busy="true">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
              ))}
            </div>
          ) : ficha === null || !p ? (
            <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Contato não encontrado (pode ter sido apagado).</p>
          ) : aba === "info" ? (
            <AbaInfo key={p.id + String(p.updatedAt)} p={p} site={ficha.site} podeEditar={podeEditar} resumo={resumo} aoSalvo={recarregar} aoApagado={() => { aoFechar(); aoMudar(); }} aoFechou={aoFechou} />
          ) : aba === "roteiros" ? (
            <RoteirosDoContato prospectId={p.id} whatsapp={p.whatsapp} aoRegistrar={recarregar} />
          ) : aba === "objecoes" ? (
            <div className="grid gap-3">
              <p className="text-sm text-muted-foreground">Respostas prontas para as objeções mais comuns.</p>
              <ListaObjecoes objecoes={objecoes} />
            </div>
          ) : aba === "site" ? (
            <AbaSite prospectId={p.id} site={ficha.site} aoNavegar={aoFechar} />
          ) : (
            <AbaHistorico p={p} podeEditar={podeEditar} aoNota={recarregar} />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ───────────────────────── Informações ─────────────────────────

function AbaInfo({
  p,
  site,
  podeEditar,
  resumo,
  aoSalvo,
  aoApagado,
  aoFechou,
}: {
  p: Prospect;
  site: Ficha["site"];
  podeEditar: boolean;
  resumo: LeadFunil | null;
  aoSalvo: () => Promise<void>;
  aoApagado: () => void;
  aoFechou: (l: LeadFunil) => void;
}) {
  const [f, setF] = useState({
    stage: p.stage,
    nextContactAt: p.nextContactAt ?? "",
    phone: p.phone ?? "",
    whatsapp: p.whatsapp ?? "",
    proposta: reais(p.proposalCents),
    instagram: p.instagram ?? "",
    notes: p.notes ?? "",
  });
  const [salvando, setSalvando] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [apagando, setApagando] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF((x) => ({ ...x, [k]: e.target.value }));
  const est = ETAPA_ESTILO[p.stage];

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    const r = await atualizarProspectAction(p.id, {
      stage: f.stage,
      nextContactAt: f.nextContactAt,
      phone: f.phone,
      whatsapp: f.whatsapp.replace(/\D/g, ""),
      proposalCents: paraCents(f.proposta),
      instagram: f.instagram,
      notes: f.notes,
    });
    setSalvando(false);
    if (!r.ok) {
      toast.error(r.message);
      return;
    }
    toast.success("Salvo");
    const virouFechado = f.stage === "FECHADO" && p.stage !== "FECHADO";
    await aoSalvo();
    if (virouFechado && !p.clientId && resumo) aoFechou({ ...resumo, etapa: "FECHADO", propostaCents: paraCents(f.proposta) });
  };

  const insta = (p.instagram ?? "").replace(/^@/, "");

  return (
    <form onSubmit={salvar} className="grid gap-4">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", est.cls)}>{ETAPA_SINGULAR[p.stage]}</span>
        {site ? (
          <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", site.published ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-primary/10 text-primary")}>
            <Globe className="size-3" /> {site.published ? "Site no ar" : "Site pronto (não publicado)"}
          </span>
        ) : (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">Sem site</span>
        )}
        {p.rating != null && (
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
            <Star className="size-3 fill-star text-star" /> {p.rating.toLocaleString("pt-BR")} ({p.reviewsCount})
          </span>
        )}
      </div>

      {p.clientId && (
        <Link href={`/painel/clientes/${p.clientId}`} className="flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm font-medium text-emerald-900 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
          <UserCheck className="size-4" /> Já é cliente. <span className="underline">Ver cliente</span>
        </Link>
      )}

      <div className="flex flex-wrap gap-1.5">
        {p.phone && (
          <a href={`tel:${p.phone.replace(/[^\d+]/g, "")}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            <Phone /> {p.phone}
          </a>
        )}
        {insta && (
          <a href={`https://instagram.com/${encodeURIComponent(insta)}`} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "outline", size: "sm" })}>
            <AtSign /> {insta}
          </a>
        )}
        {p.mapsUrl && (
          <a href={p.mapsUrl} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "outline", size: "sm" })}>
            <MapPin /> Ver no Maps
          </a>
        )}
      </div>

      <fieldset disabled={!podeEditar || salvando} className="grid gap-3 sm:grid-cols-2">
        <Campo id="f-etapa" rotulo="Etapa">
          <select id="f-etapa" value={f.stage} onChange={(e) => setF((x) => ({ ...x, stage: e.target.value as ProspectStage }))} className={selectClass}>
            {ETAPAS.map((x) => (
              <option key={x.id} value={x.id}>
                {ETAPA_SINGULAR[x.id]}
              </option>
            ))}
          </select>
        </Campo>
        <Campo id="f-prox" rotulo="Próximo contato">
          <Input id="f-prox" type="date" value={f.nextContactAt} onChange={set("nextContactAt")} className="h-10 sm:h-9" />
        </Campo>
        <Campo id="f-tel" rotulo="Telefone">
          <Input id="f-tel" type="tel" value={f.phone} onChange={set("phone")} className="h-10 sm:h-9" maxLength={40} />
        </Campo>
        <Campo id="f-wa" rotulo="WhatsApp (com 55)">
          <Input id="f-wa" inputMode="numeric" value={f.whatsapp} onChange={(e) => setF((x) => ({ ...x, whatsapp: e.target.value.replace(/\D/g, "") }))} className="h-10 sm:h-9" maxLength={20} placeholder="5511999999999" />
        </Campo>
        <Campo id="f-valor" rotulo="Valor da proposta (R$)">
          <Input id="f-valor" inputMode="decimal" value={f.proposta} onChange={set("proposta")} className="h-10 sm:h-9" placeholder="750,00" />
        </Campo>
        <Campo id="f-insta" rotulo="Instagram">
          <Input id="f-insta" value={f.instagram} onChange={set("instagram")} className="h-10 sm:h-9" maxLength={80} placeholder="@perfil" />
        </Campo>
        <Campo id="f-notas" rotulo="Anotações" className="sm:col-span-2">
          <Textarea id="f-notas" rows={4} value={f.notes} onChange={set("notes")} maxLength={4000} placeholder="Ex.: falei com o João, pediu para retornar sexta" />
        </Campo>
      </fieldset>

      {p.address && (
        <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
          <MapPin className="mt-0.5 size-4 shrink-0" /> {p.address}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {podeEditar && (
          <Button type="submit" className="h-10" disabled={salvando}>
            {salvando && <Loader2 className="animate-spin" />} Salvar
          </Button>
        )}
        {p.whatsapp && (
          <Button type="button" className="h-10 bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => abrirWhats(p.whatsapp)}>
            <MessageCircle /> Abrir conversa
          </Button>
        )}
        <span className="flex-1" />
        {podeEditar && (
          <Button type="button" variant="destructive" className="h-10" onClick={() => setConfirmar(true)}>
            <Trash2 /> Apagar
          </Button>
        )}
      </div>

      <Dialog open={confirmar} onOpenChange={setConfirmar}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apagar contato?</DialogTitle>
            <DialogDescription>
              {p.name} sai do funil, com o histórico. O site (se houver) continua em Criador de sites. Não dá para desfazer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" className="h-10" onClick={() => setConfirmar(false)} disabled={apagando}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              className="h-10"
              disabled={apagando}
              onClick={async () => {
                setApagando(true);
                const r = await apagarProspectAction(p.id);
                setApagando(false);
                if (!r.ok) {
                  toast.error(r.message);
                  return;
                }
                setConfirmar(false);
                toast.success("Contato apagado");
                aoApagado();
              }}
            >
              {apagando && <Loader2 className="animate-spin" />} Apagar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  );
}

function Campo({ id, rotulo, className, children }: { id: string; rotulo: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={id}>{rotulo}</Label>
      {children}
    </div>
  );
}

// ───────────────────────── Site ─────────────────────────

function AbaSite({ prospectId, site, aoNavegar }: { prospectId: string; site: Ficha["site"]; aoNavegar: () => void }) {
  const caixa = useRef<HTMLDivElement>(null);
  const [escala, setEscala] = useState(0.3);
  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setEscala(e.contentRect.width / 1280));
    ro.observe(el);
    return () => ro.disconnect();
  }, [site]);

  if (!site)
    return (
      <div className="grid justify-items-center gap-3 rounded-2xl border border-dashed p-8 text-center">
        <Globe className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Esse contato ainda não tem site.</p>
        <Link href={`/painel/sites/novo?prospect=${prospectId}`} onClick={aoNavegar} className={buttonVariants({ className: "h-10" })}>
          <Sparkles /> Criar site
        </Link>
      </div>
    );

  return (
    <div className="grid gap-3">
      <div ref={caixa} className="relative aspect-[16/10] overflow-hidden rounded-xl bg-muted ring-1 ring-border">
        <iframe
          src={`/api/vendas/sites/${site.id}/previa`}
          title="Miniatura do site"
          loading="lazy"
          tabIndex={-1}
          className="pointer-events-none absolute top-0 left-0 origin-top-left border-0 bg-white"
          style={{ width: 1280, height: 800, transform: `scale(${escala})` }}
        />
      </div>
      <p className="text-sm text-muted-foreground">{site.published ? "Publicado na internet." : "Ainda não publicado."}</p>
      <div className="flex flex-wrap gap-2">
        <Link href={`/painel/sites/${site.id}`} onClick={aoNavegar} className={buttonVariants({ className: "h-10" })}>
          <ExternalLink /> Abrir projeto
        </Link>
        <Link href={`/painel/sites/${site.id}/editor`} onClick={aoNavegar} className={buttonVariants({ variant: "outline", className: "h-10" })}>
          <Pencil /> Editar
        </Link>
        {site.link && (
          <Button variant="outline" className="h-10" onClick={() => copiar(site.link)}>
            <Copy /> Copiar link
          </Button>
        )}
      </div>
    </div>
  );
}

// ───────────────────────── Histórico ─────────────────────────

function AbaHistorico({ p, podeEditar, aoNota }: { p: Prospect; podeEditar: boolean; aoNota: () => Promise<void> }) {
  const [nota, setNota] = useState("");
  const [salvando, setSalvando] = useState(false);
  const hist = p.history ?? [];
  return (
    <div className="grid gap-4">
      {podeEditar && (
        <form
          className="flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const t = nota.trim();
            if (!t) return;
            setSalvando(true);
            const r = await atualizarProspectAction(p.id, {}, t);
            if (r.ok) {
              setNota("");
              await aoNota();
            } else toast.error(r.message);
            setSalvando(false);
          }}
        >
          <Input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Adicionar anotação ao histórico" className="h-10 flex-1" maxLength={500} aria-label="Nova anotação" />
          <Button type="submit" variant="outline" className="h-10" disabled={salvando || !nota.trim()}>
            {salvando ? <Loader2 className="animate-spin" /> : <Plus />} Adicionar
          </Button>
        </form>
      )}
      {hist.length ? (
        <ol className="relative grid gap-3 border-l pl-4">
          {hist.map((h, i) => (
            <li key={i} className="relative">
              <span className="absolute top-1.5 -left-[1.3rem] size-2 rounded-full bg-primary ring-4 ring-popover" />
              <time className="text-xs text-muted-foreground">{new Date(h.data).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</time>
              <p className="text-sm">{h.texto.replace(/(NOVO|CONTATADO|NEGOCIANDO|FECHADO|PERDIDO)/g, (m) => ETAPA_SINGULAR[m as ProspectStage])}</p>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-muted-foreground">Nada ainda.</p>
      )}
    </div>
  );
}
