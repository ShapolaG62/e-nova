import type { ProspectHistory, ProspectStage } from "@/db/schema";

/** Contato do funil já no formato que as telas usam (serializável). */
export type LeadFunil = {
  id: string;
  nome: string;
  setor: string;
  setorNome: string;
  setorIcone: string;
  cidade: string;
  uf: string;
  endereco: string;
  mapa: string;
  telefone: string;
  whatsapp: string;
  instagram: string;
  nota: number | null;
  avaliacoes: number;
  etapa: ProspectStage;
  proximoContato: string;
  propostaCents: number | null;
  notas: string;
  clienteId: string | null;
  historico: ProspectHistory[];
  site: { id: string; publicado: boolean; link?: string; capa?: string } | null;
};

export type CartaoHoje = { lead: LeadFunil; mensagem: string };

export type DadosHoje = {
  meta: number;
  feitos: number;
  esperando: number;
  prontos: CartaoHoje[];
  followups: LeadFunil[];
  semSite: LeadFunil[];
  visitas: { nome: string; prospectId: string | null; em: string }[];
};

export const ETAPA_ESTILO: Record<ProspectStage, { nome: string; cls: string; ponto: string }> = {
  NOVO: { nome: "Novos", cls: "bg-muted text-muted-foreground", ponto: "bg-slate-400" },
  CONTATADO: { nome: "Contatados", cls: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300", ponto: "bg-sky-500" },
  NEGOCIANDO: { nome: "Negociando", cls: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300", ponto: "bg-amber-500" },
  FECHADO: { nome: "Fechados", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300", ponto: "bg-emerald-500" },
  PERDIDO: { nome: "Perdidos", cls: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300", ponto: "bg-red-500" },
};

export const ETAPA_SINGULAR: Record<ProspectStage, string> = {
  NOVO: "Novo",
  CONTATADO: "Contatado",
  NEGOCIANDO: "Negociando",
  FECHADO: "Fechado",
  PERDIDO: "Perdido",
};

export const reais = (cents: number | null | undefined) =>
  cents == null ? "" : (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const paraCents = (s: string): number | null => {
  const t = String(s || "").trim();
  if (!t) return null;
  const n = Number(t.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
};

export const dataCurta = (iso: string) => (iso ? new Date(iso + "T12:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "");
