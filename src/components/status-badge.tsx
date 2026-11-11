import { cn } from "@/lib/utils";
import type { ClientStatus } from "@/db/schema";

const STYLE: Record<ClientStatus, { label: string; cls: string }> = {
  ACTIVE: { label: "Ativo", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" },
  TRIAL: { label: "Trial", cls: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300" },
  SUSPENDED_PAYMENT: { label: "Suspenso", cls: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300" },
};

export function StatusBadge({ status, trialEndsAt }: { status: ClientStatus; trialEndsAt?: Date | null }) {
  const expired = status === "TRIAL" && trialEndsAt && trialEndsAt < new Date();
  const s = STYLE[status];
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", s.cls, expired && "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300")}>
      {expired ? "Trial vencido" : s.label}
    </span>
  );
}

export function ActiveDot({ active }: { active: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs whitespace-nowrap">
      <span className={cn("size-2 rounded-full", active ? "bg-emerald-500" : "bg-muted-foreground/40")} />
      {active ? "Ativa" : "Desativada"}
    </span>
  );
}
