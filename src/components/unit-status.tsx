import { cn } from "@/lib/utils";

export const UNIT_STATUS = {
  ESTOQUE: { label: "Em estoque", cls: "bg-secondary text-secondary-foreground" },
  RESERVADA: { label: "Reservada", cls: "bg-sky-100 text-sky-800" },
  INSTALADA: { label: "Instalada", cls: "bg-accent text-accent-foreground" },
  DEFEITO: { label: "Com defeito", cls: "bg-amber-100 text-amber-900" },
  BAIXADA: { label: "Baixada", cls: "bg-muted text-muted-foreground line-through" },
} as const;

export const DEAL_LABEL = { VENDA: "Venda", ALUGUEL: "Aluguel", CORTESIA: "Cortesia" } as const;

export function UnitStatusBadge({ status, deal }: { status: keyof typeof UNIT_STATUS; deal?: keyof typeof DEAL_LABEL | null }) {
  const s = UNIT_STATUS[status];
  return (
    <span className={cn("inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap", s.cls)}>
      {status === "INSTALADA" && deal ? DEAL_LABEL[deal] : s.label}
    </span>
  );
}
