"use client";

import { useMemo, useState } from "react";
import { CalendarClock, Globe, MessageCircle, Search, Star, UserCheck } from "lucide-react";
import type { ProspectStage } from "@/db/schema";
import { ETAPAS } from "@/lib/sites/client-utils";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ETAPA_ESTILO, ETAPA_SINGULAR, dataCurta, type LeadFunil } from "./funil-tipos";

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function Kanban({
  leads,
  aoAbrirFicha,
  aoMover,
  podeEditar,
}: {
  leads: LeadFunil[];
  aoAbrirFicha: (id: string) => void;
  aoMover: (lead: LeadFunil, etapa: ProspectStage) => void;
  podeEditar: boolean;
}) {
  const [busca, setBusca] = useState("");
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [alvo, setAlvo] = useState<ProspectStage | null>(null);
  const hoje = new Date().toISOString().slice(0, 10);

  const filtrados = useMemo(() => {
    const q = semAcento(busca.trim());
    return q ? leads.filter((l) => semAcento(`${l.nome} ${l.cidade} ${l.setorNome}`).includes(q)) : leads;
  }, [leads, busca]);

  return (
    <div className="grid grid-cols-1 gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar contato…" className="h-10 pl-8 sm:h-9" aria-label="Buscar contato" />
        </div>
        <p className="text-xs text-muted-foreground">
          <span className="pointer-coarse:hidden">Arraste os cartões entre as colunas.</span>
          <span className="hidden pointer-coarse:inline">Use o seletor do cartão para mudar a etapa.</span>
        </p>
      </div>

      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pt-1 pb-3 [contain:paint] md:mx-0 md:px-1 xl:grid xl:grid-cols-5 xl:overflow-visible xl:[contain:none]">
        {ETAPAS.map(({ id: etapa }) => {
          const col = filtrados.filter((l) => l.etapa === etapa);
          const est = ETAPA_ESTILO[etapa];
          return (
            <section
              key={etapa}
              aria-label={est.nome}
              onDragOver={(e) => {
                if (!arrastando) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (alvo !== etapa) setAlvo(etapa);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setAlvo((a) => (a === etapa ? null : a));
              }}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/plain") || arrastando;
                setAlvo(null);
                setArrastando(null);
                const lead = leads.find((l) => l.id === id);
                if (lead) aoMover(lead, etapa);
              }}
              className={cn(
                "flex w-[80vw] max-w-[300px] shrink-0 snap-start flex-col gap-2 rounded-2xl border bg-muted/50 p-2 transition sm:w-72 xl:w-auto xl:max-w-none",
                alvo === etapa && "border-primary bg-accent/60 ring-2 ring-primary/30",
              )}
            >
              <header className="flex items-center gap-2 px-1.5 pt-1">
                <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", est.cls)}>{est.nome}</span>
                <span className="num ml-auto text-xs text-muted-foreground">{col.length}</span>
              </header>
              <div className="grid min-h-24 content-start gap-2">
                {col.map((l) => (
                  <article
                    key={l.id}
                    draggable={podeEditar}
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", l.id);
                      e.dataTransfer.effectAllowed = "move";
                      setArrastando(l.id);
                    }}
                    onDragEnd={() => {
                      setArrastando(null);
                      setAlvo(null);
                    }}
                    onClick={() => aoAbrirFicha(l.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        aoAbrirFicha(l.id);
                      }
                    }}
                    tabIndex={0}
                    aria-label={`${l.nome}, ${ETAPA_SINGULAR[l.etapa]}. Abrir ficha`}
                    className={cn(
                      "grid cursor-pointer gap-1.5 rounded-xl border bg-card p-3 shadow-xs transition hover:border-primary/40 hover:shadow-sm",
                      podeEditar && "active:cursor-grabbing",
                      arrastando === l.id && "opacity-40",
                    )}
                  >
                    <b className="text-sm leading-snug">{l.nome}</b>
                    <small className="flex flex-wrap items-center gap-x-1 text-xs text-muted-foreground">
                      <span>{l.setorIcone}</span>
                      {l.cidade && <span className="truncate">{l.cidade}</span>}
                      {l.nota != null && (
                        <span className="inline-flex items-center gap-0.5">
                          · <Star className="size-3 fill-star text-star" /> {l.nota.toLocaleString("pt-BR")}
                        </span>
                      )}
                    </small>
                    <div className="flex flex-wrap gap-1">
                      {l.site ? (
                        l.site.publicado ? (
                          <Etiqueta cls="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                            <Globe /> site no ar
                          </Etiqueta>
                        ) : (
                          <Etiqueta cls="bg-primary/10 text-primary">
                            <Globe /> site pronto
                          </Etiqueta>
                        )
                      ) : (
                        <Etiqueta cls="bg-muted text-muted-foreground">sem site</Etiqueta>
                      )}
                      {l.whatsapp && (
                        <Etiqueta cls="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          <MessageCircle /> <span className="sr-only">tem WhatsApp</span>
                        </Etiqueta>
                      )}
                      {l.proximoContato && (
                        <Etiqueta cls={l.proximoContato <= hoje ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" : "bg-muted text-muted-foreground"}>
                          <CalendarClock /> {dataCurta(l.proximoContato)}
                        </Etiqueta>
                      )}
                      {l.clienteId && (
                        <Etiqueta cls="bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300">
                          <UserCheck /> cliente
                        </Etiqueta>
                      )}
                    </div>
                    {podeEditar && (
                      <select
                        aria-label={`Etapa de ${l.nome}`}
                        value={l.etapa}
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                        onChange={(e) => aoMover(l, e.target.value as ProspectStage)}
                        className="mt-1 hidden h-9 w-full rounded-lg border border-input bg-background px-2 text-xs pointer-coarse:block"
                      >
                        {ETAPAS.map((x) => (
                          <option key={x.id} value={x.id}>
                            {x.id === l.etapa ? `Etapa: ${ETAPA_SINGULAR[x.id]}` : `Mover para: ${ETAPA_SINGULAR[x.id]}`}
                          </option>
                        ))}
                      </select>
                    )}
                  </article>
                ))}
                {!col.length && <p className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground">{busca ? "Nada aqui com essa busca" : "Vazio"}</p>}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function Etiqueta({ cls, children }: { cls: string; children: React.ReactNode }) {
  return <span className={cn("inline-flex h-5 items-center gap-1 rounded-full px-1.5 text-[0.7rem] font-medium [&_svg]:size-3", cls)}>{children}</span>;
}
