"use client";

import { useState } from "react";
import { ActionForm, FieldError, FormMessage, SubmitButton } from "@/components/action-form";
import { cn } from "@/lib/utils";
import type { ActionState } from "@/lib/validation";

/** Escolhe uma das 3 sugestões da IA (ou escreve), edita e publica com 1 clique. */
export function ReplyComposer({
  drafts,
  initial,
  action,
  publishLabel,
}: {
  drafts: string[];
  initial: string;
  action: (prev: ActionState, form: FormData) => Promise<ActionState>;
  publishLabel: string;
}) {
  const [text, setText] = useState(initial || drafts[0] || "");
  return (
    <ActionForm action={action} className="grid gap-2">
      {drafts.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {drafts.map((d, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setText(d)}
              className={cn("rounded-md border px-2.5 py-1 text-xs", text === d ? "border-primary bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-muted")}
            >
              Sugestão {i + 1}
            </button>
          ))}
        </div>
      )}
      <textarea
        name="reply"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        placeholder="Escreva a resposta…"
        className="w-full rounded-lg border bg-transparent p-2.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      />
      <FieldError name="reply" />
      <FormMessage />
      <div>
        <SubmitButton className="h-10 w-full sm:h-9 sm:w-auto">{publishLabel}</SubmitButton>
      </div>
    </ActionForm>
  );
}
