"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Flame, KanbanSquare } from "lucide-react";
import { toast } from "sonner";
import type { ProspectStage } from "@/db/schema";
import { atualizarProspectAction } from "@/app/actions/vendas";
import { cn } from "@/lib/utils";
import type { DadosHoje, LeadFunil } from "./funil-tipos";
import type { Objecao } from "./roteiros";
import { AbaHoje } from "./funil-hoje";
import { Kanban } from "./funil-kanban";
import { FichaLead, type AbaFicha } from "./funil-ficha";
import { DialogFechou } from "./funil-fechou";

type Aba = "hoje" | "leads";

/** Atualiza ?aba= e ?lead= sem recarregar (para o link continuar válido ao atualizar a página). */
function trocarUrl(aba: Aba, lead: string | null) {
  const u = new URL(window.location.href);
  if (aba === "leads") u.searchParams.set("aba", "leads");
  else u.searchParams.delete("aba");
  if (lead) u.searchParams.set("lead", lead);
  else u.searchParams.delete("lead");
  window.history.replaceState(null, "", u.pathname + u.search);
}

export function FunilApp({
  hoje,
  leads: leadsServidor,
  objecoes,
  abaInicial,
  leadInicial,
  podeEditar,
  podeConverter,
}: {
  hoje: DadosHoje;
  leads: LeadFunil[];
  objecoes: Objecao[];
  abaInicial: Aba;
  leadInicial: string | null;
  podeEditar: boolean;
  podeConverter: boolean;
}) {
  const router = useRouter();
  const [aba, setAba] = useState<Aba>(abaInicial);
  const [ficha, setFicha] = useState<{ id: string; aba: AbaFicha } | null>(leadInicial ? { id: leadInicial, aba: "info" } : null);
  const [fechou, setFechou] = useState<LeadFunil | null>(null);

  // Cópia local para mover cartões na hora (sincroniza quando o servidor manda dados novos)
  const [base, setBase] = useState(leadsServidor);
  const [leads, setLeads] = useState(leadsServidor);
  if (base !== leadsServidor) {
    setBase(leadsServidor);
    setLeads(leadsServidor);
  }

  const atualizar = useCallback(() => router.refresh(), [router]);

  const abrirFicha = useCallback(
    (id: string, abaFicha: AbaFicha = "info") => {
      setFicha({ id, aba: abaFicha });
      trocarUrl(aba, id);
    },
    [aba],
  );

  const mover = async (lead: LeadFunil, etapa: ProspectStage) => {
    if (lead.etapa === etapa) return;
    if (!podeEditar) {
      toast.error("Você não tem permissão para mudar a etapa.");
      return;
    }
    const antes = lead.etapa;
    setLeads((ls) => ls.map((x) => (x.id === lead.id ? { ...x, etapa } : x)));
    const r = await atualizarProspectAction(lead.id, { stage: etapa });
    if (!r.ok) {
      setLeads((ls) => ls.map((x) => (x.id === lead.id ? { ...x, etapa: antes } : x)));
      toast.error(r.message);
      return;
    }
    toast.success(`${lead.nome} → ${etapaNome(etapa)}`);
    if (etapa === "FECHADO" && !lead.clienteId && podeConverter) setFechou(lead);
    atualizar();
  };

  return (
    <div className="grid grid-cols-1 gap-5">
      <div className="flex gap-1 self-start rounded-xl bg-muted p-1 sm:w-fit" role="tablist" aria-label="Visão do funil">
        {([
          ["hoje", Flame, "Hoje", hoje.esperando],
          ["leads", KanbanSquare, "Leads", leads.length],
        ] as const).map(([k, Icone, nome, n]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={aba === k}
            onClick={() => {
              setAba(k);
              trocarUrl(k, ficha?.id ?? null);
            }}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm transition sm:flex-none",
              aba === k ? "bg-card font-semibold shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icone className={cn("size-4", aba === k && "text-primary")} />
            {nome}
            <span className={cn("num rounded-full px-1.5 text-xs", aba === k ? "bg-primary text-primary-foreground" : "bg-background")}>{n}</span>
          </button>
        ))}
      </div>

      {aba === "hoje" ? (
        <AbaHoje hoje={hoje} aoAbrirFicha={abrirFicha} aoAtualizar={atualizar} />
      ) : (
        <Kanban leads={leads} aoAbrirFicha={abrirFicha} aoMover={mover} podeEditar={podeEditar} />
      )}

      <FichaLead
        aberta={ficha}
        resumo={ficha ? (leads.find((l) => l.id === ficha.id) ?? null) : null}
        objecoes={objecoes}
        podeEditar={podeEditar}
        aoFechar={() => {
          setFicha(null);
          trocarUrl(aba, null);
        }}
        aoMudar={atualizar}
        aoFechou={(l) => podeConverter && !l.clienteId && setFechou(l)}
      />

      <DialogFechou
        lead={fechou}
        aoFechar={() => setFechou(null)}
        aoConvertido={() => {
          setFechou(null);
          atualizar();
        }}
      />
    </div>
  );
}

const etapaNome = (e: ProspectStage) => ({ NOVO: "Novos", CONTATADO: "Contatados", NEGOCIANDO: "Negociando", FECHADO: "Fechados", PERDIDO: "Perdidos" })[e];
