"use client";

import { ChevronRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

// ───────────────────────── Peças pequenas ─────────────────────────

export function Rotulo({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{children}</p>;
}

export function Dica({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-muted-foreground">{children}</p>;
}

export function Mini({ rotulo, onClick, disabled, perigo, children }: { rotulo: string; onClick: () => void; disabled?: boolean; perigo?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={rotulo}
      aria-label={rotulo}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30 [&_svg]:size-4",
        perigo && "hover:bg-destructive/10 hover:text-destructive",
      )}
    >
      {children}
    </button>
  );
}

export function BotaoIA({ titulo, texto, onClick }: { titulo: string; texto: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-3 rounded-xl border border-primary/25 bg-gradient-to-br from-accent to-card p-3 text-left transition hover:border-primary/60"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
        <Sparkles className="size-4" />
      </span>
      <span className="grid min-w-0 flex-1">
        <b className="text-sm">{titulo}</b>
        <small className="text-xs text-muted-foreground">{texto}</small>
      </span>
      <ChevronRight className="size-4 text-muted-foreground transition group-hover:translate-x-0.5" />
    </button>
  );
}
