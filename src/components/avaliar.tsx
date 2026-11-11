"use client";

import { useState, useTransition } from "react";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import { avaliarAction } from "@/app/actions/aprendizado";
import { cn } from "@/lib/utils";

/** 👍/👎 que ensina a ferramenta (autoaprendizado). */
export function Avaliar({ area, alvoId, inicial, compacto = false }: { area: "cortes" | "videos"; alvoId: string; inicial?: 1 | -1; compacto?: boolean }) {
  const [nota, setNota] = useState<1 | -1 | undefined>(inicial);
  const [pend, start] = useTransition();
  const votar = (v: 1 | -1) =>
    start(async () => {
      const r = await avaliarAction(area, alvoId, v);
      if (r.ok) setNota(v);
      (r.ok ? toast.success : toast.error)(r.message ?? "Pronto.");
    });
  const base = "inline-flex items-center justify-center gap-1.5 rounded-md border text-xs font-medium transition-colors disabled:opacity-50";
  const tam = compacto ? "size-9" : "h-9 px-3";
  return (
    <div className="inline-flex items-center gap-1.5" role="group" aria-label="Ensinar a ferramenta">
      {!compacto && <span className="text-xs text-muted-foreground">Ficou bom?</span>}
      <button type="button" disabled={pend} aria-pressed={nota === 1} onClick={() => votar(1)} title="Gostei — faça mais assim"
        className={cn(base, tam, nota === 1 ? "border-emerald-600 bg-emerald-600/15 text-emerald-700 dark:text-emerald-300" : "hover:bg-muted")}>
        <ThumbsUp className="size-4" aria-hidden />{!compacto && "Gostei"}
      </button>
      <button type="button" disabled={pend} aria-pressed={nota === -1} onClick={() => votar(-1)} title="Não gostei — evite isso"
        className={cn(base, tam, nota === -1 ? "border-red-600 bg-red-600/15 text-red-700 dark:text-red-300" : "hover:bg-muted")}>
        <ThumbsDown className="size-4" aria-hidden />{!compacto && "Não"}
      </button>
    </div>
  );
}
