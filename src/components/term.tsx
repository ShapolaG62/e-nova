"use client";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { GLOSSARY, type TermKey } from "@/lib/glossary";

/**
 * Sigla com explicação: sublinhado pontilhado; toque/clique abre o significado.
 * Popover (e não tooltip) para funcionar no celular, onde não existe "passar o mouse".
 */
export function Term({ k, children }: { k: TermKey; children?: React.ReactNode }) {
  const g = GLOSSARY[k];
  return (
    <Popover>
      <PopoverTrigger className="term inline cursor-help bg-transparent p-0 text-inherit" aria-label={`O que é ${k}?`}>
        {children ?? k}
      </PopoverTrigger>
      <PopoverContent className="w-72 text-sm" side="top">
        <p className="font-display text-base font-semibold">
          {k} <span className="font-sans text-sm font-normal text-muted-foreground">{g.name}</span>
        </p>
        <p className="mt-1 leading-relaxed text-muted-foreground">{g.text}</p>
        <a href={`/painel/glossario#${encodeURIComponent(k)}`} className="mt-2 inline-block text-xs font-medium text-primary underline-offset-2 hover:underline">
          Ver todas as siglas
        </a>
      </PopoverContent>
    </Popover>
  );
}
