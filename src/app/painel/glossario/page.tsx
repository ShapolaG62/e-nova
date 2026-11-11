import type { Metadata } from "next";
import { PageHeader } from "@/components/page";
import { GLOSSARY } from "@/lib/glossary";

export const metadata: Metadata = { title: "Glossário" };

export default function Page() {
  const entries = Object.entries(GLOSSARY).sort(([a], [b]) => a.localeCompare(b, "pt-BR"));
  return (
    <div className="grid max-w-3xl grid-cols-1 gap-6">
      <PageHeader title="Glossário" subtitle="O que cada sigla do painel quer dizer. Toque em qualquer termo sublinhado para ver a explicação na hora." />
      <dl className="grid gap-px overflow-hidden rounded-2xl border bg-border">
        {entries.map(([k, g]) => (
          <div key={k} id={k} className="grid gap-1 bg-card px-5 py-4 target:bg-accent sm:grid-cols-[150px_1fr] sm:gap-6">
            <dt>
              <span className="font-display text-xl font-semibold">{k}</span>
            </dt>
            <dd>
              <p className="font-medium">{g.name}</p>
              <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{g.text}</p>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
