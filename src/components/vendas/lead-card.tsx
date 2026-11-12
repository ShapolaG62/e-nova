"use client";

import { useState } from "react";
import { AlertTriangle, ExternalLink, Globe, MapPin, MessageCircle, Phone, AtSign } from "lucide-react";
import { cn } from "@/lib/utils";
import { fotoGoogleUrl, iniciais } from "@/lib/sites/client-utils";
import type { LeadBusca } from "@/lib/sites/engine";

const chip = "inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors";

function Foto({ lead }: { lead: LeadBusca }) {
  const [falhou, setFalhou] = useState(false);
  const ref = lead.fotos?.[0];
  if (ref && !falhou) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={fotoGoogleUrl(ref, 200)}
        alt=""
        loading="lazy"
        onError={() => setFalhou(true)}
        className="size-14 shrink-0 rounded-xl bg-muted object-cover"
      />
    );
  }
  return (
    <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-accent font-display text-lg font-semibold text-primary" aria-hidden>
      {iniciais(lead.nome)}
    </div>
  );
}

export function SituacaoBadge({ situacao }: { situacao: LeadBusca["situacaoSite"] }) {
  if (situacao === "tem")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[0.7rem] font-semibold tracking-wide text-muted-foreground">
        <Globe className="size-3" /> TEM SITE
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[0.7rem] font-semibold tracking-wide text-amber-900 dark:bg-amber-950 dark:text-amber-300">
      <AlertTriangle className="size-3" /> {situacao === "rede" ? "SÓ REDE SOCIAL" : "SEM SITE"}
    </span>
  );
}

export function NotaOportunidade({ nota }: { nota: number }) {
  const alta = nota >= 75;
  return (
    <span
      title="Nota de oportunidade: quanto mais alta, mais esse negócio precisa de um site"
      className={cn(
        "num ml-auto inline-flex items-baseline rounded-full px-2 py-0.5 text-sm font-bold",
        alta ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-secondary text-secondary-foreground",
      )}
    >
      {nota}
      <small className="text-[0.65rem] font-medium opacity-70">/100</small>
    </span>
  );
}

/** Chips de contato: WhatsApp (celular), fixo (ligar), Instagram e site atual. */
export function ContatosLead({ lead }: { lead: LeadBusca }) {
  const tel = String(lead.telefone ?? "");
  const insta = String(lead.instagram ?? "").replace(/^@/, "");
  return (
    <div className="flex flex-wrap gap-1.5">
      {lead.whatsapp ? (
        <a
          href={`https://wa.me/${String(lead.whatsapp).replace(/\D/g, "")}`}
          target="_blank"
          rel="noopener noreferrer"
          title="Celular com WhatsApp"
          className={cn(chip, "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300")}
        >
          <MessageCircle className="size-3.5 shrink-0" />
          <span className="truncate">{tel || lead.whatsapp}</span>
        </a>
      ) : tel ? (
        <a
          href={`tel:${tel.replace(/\D/g, "")}`}
          title="Telefone fixo: o melhor é ligar"
          className={cn(chip, "border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300")}
        >
          <Phone className="size-3.5 shrink-0" />
          <span className="truncate">{tel} · FIXO · LIGUE</span>
        </a>
      ) : null}
      {insta && (
        <a href={`https://instagram.com/${insta}`} target="_blank" rel="noopener noreferrer" className={cn(chip, "bg-card hover:bg-muted")}>
          <AtSign className="size-3.5 shrink-0" />
          <span className="truncate">{insta}</span>
        </a>
      )}
      {lead.site && (
        <a href={String(lead.site)} target="_blank" rel="noopener noreferrer" className={cn(chip, "bg-card hover:bg-muted")}>
          <ExternalLink className="size-3.5 shrink-0" /> site atual
        </a>
      )}
    </div>
  );
}

/** Cartão de um negócio encontrado na prospecção. */
export function LeadCard({
  lead,
  selecionado = false,
  onToggle,
  acoes,
}: {
  lead: LeadBusca;
  selecionado?: boolean;
  onToggle?: (selecionado: boolean) => void;
  acoes?: React.ReactNode;
}) {
  const nota = Number(lead.oportunidade) || 0;
  return (
    <article
      className={cn(
        "flex flex-col gap-3 rounded-2xl border bg-card p-4 transition-shadow",
        selecionado ? "border-primary ring-2 ring-primary/25" : "hover:shadow-sm",
        lead.situacaoSite === "tem" && !selecionado && "opacity-85",
      )}
    >
      <div className="flex items-center gap-2">
        {onToggle && (
          <input
            type="checkbox"
            checked={selecionado}
            onChange={(e) => onToggle(e.target.checked)}
            aria-label={`Selecionar ${lead.nome}`}
            className="size-[1.1rem] shrink-0 cursor-pointer accent-primary"
          />
        )}
        <SituacaoBadge situacao={lead.situacaoSite} />
        {lead.demo && <span className="rounded-full border px-1.5 py-0.5 text-[0.65rem] font-medium text-muted-foreground">demo</span>}
        <NotaOportunidade nota={nota} />
      </div>

      <div className="flex min-w-0 gap-3">
        <Foto lead={lead} />
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-[1.02rem] leading-snug font-semibold">{lead.nome}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            {lead.cidade && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3" />
                {lead.cidade}
                {lead.uf ? ` · ${lead.uf}` : ""}
              </span>
            )}
            {lead.nota ? (
              <span>
                <b className="text-star">★</b> <span className="font-medium text-foreground">{String(lead.nota).replace(".", ",")}</span> ({lead.avaliacoes ?? 0})
              </span>
            ) : (
              <span>sem avaliações</span>
            )}
          </div>
          {lead.endereco && (
            <p className="mt-1 truncate text-xs text-muted-foreground" title={String(lead.endereco)}>
              {lead.endereco}
            </p>
          )}
        </div>
      </div>

      <ContatosLead lead={lead} />

      {acoes && <div className="mt-auto grid grid-cols-2 gap-2 pt-1">{acoes}</div>}
    </article>
  );
}
