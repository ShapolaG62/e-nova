"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, Copy, Lightbulb, Loader2, MessageCircle, Phone, Shuffle, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { abordagemAction, ligacaoAction, registrarContatoAction } from "@/app/actions/vendas";
import { abrirWhats, copiar } from "@/lib/sites/client-utils";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type Mensagem = { etapa: string; dica?: string; texto: string };
export type Fala = { etapa: string; fala: string; coach: string };
export type Objecao = { objecao: string; resposta: string };
export type Abordagem = { mensagens: Mensagem[]; ia?: boolean; aviso?: string };

/** Selo "com IA" / "modelos prontos" conforme o que o servidor devolveu. */
export function SeloIA({ ia, aviso }: { ia?: boolean; aviso?: string }) {
  return ia ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
      <Sparkles className="size-3" /> com IA
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground" title={aviso}>
      modelos prontos
    </span>
  );
}

function Num({ n }: { n: number }) {
  return <span className="num grid size-6 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">{n}</span>;
}

/** As 5 mensagens de WhatsApp, com copiar e (se houver número) enviar. */
export function MensagensWhats({
  mensagens,
  whatsapp,
  aoEnviar,
}: {
  mensagens: Mensagem[];
  whatsapp?: string | null;
  aoEnviar?: (texto: string) => void | Promise<void>;
}) {
  return (
    <ol className="grid gap-2.5">
      {mensagens.map((m, i) => (
        <li key={i} className="grid gap-2 rounded-xl border bg-card p-3">
          <div className="flex items-center gap-2">
            <Num n={i + 1} />
            <b className="flex-1 text-sm">{m.etapa}</b>
            <Button variant="outline" size="sm" onClick={() => copiar(m.texto)} aria-label={`Copiar mensagem ${i + 1}`}>
              <Copy /> <span className="max-sm:sr-only">Copiar</span>
            </Button>
            {whatsapp && (
              <Button
                size="sm"
                className="bg-emerald-600 text-white hover:bg-emerald-700"
                aria-label={`Enviar mensagem ${i + 1} no WhatsApp`}
                onClick={() => {
                  abrirWhats(whatsapp, m.texto);
                  aoEnviar?.(m.texto);
                }}
              >
                <MessageCircle /> <span className="max-sm:sr-only">Enviar</span>
              </Button>
            )}
          </div>
          {m.dica && <p className="text-xs text-muted-foreground italic">{m.dica}</p>}
          <p className="rounded-lg bg-muted/60 p-2.5 text-sm whitespace-pre-line">{m.texto}</p>
        </li>
      ))}
    </ol>
  );
}

export function RoteiroLigacao({ roteiro }: { roteiro: Fala[] }) {
  return (
    <ol className="grid gap-2.5">
      {roteiro.map((r, i) => (
        <li key={i} className="grid gap-2 rounded-xl border bg-card p-3">
          <div className="flex items-center gap-2">
            <Num n={i + 1} />
            <b className="text-sm">{r.etapa}</b>
          </div>
          <p className="text-sm">“{r.fala}”</p>
          {r.coach && (
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-star" /> {r.coach}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}

/** Objeções comuns: sanfona (abordagem) ou cartões com copiar (ficha). */
export function ListaObjecoes({ objecoes, modo = "cartoes" }: { objecoes: Objecao[]; modo?: "cartoes" | "sanfona" }) {
  if (modo === "sanfona")
    return (
      <div className="grid gap-2">
        {objecoes.map((o, i) => (
          <details key={i} className="group rounded-xl border bg-card">
            <summary className="flex cursor-pointer list-none items-center gap-2 p-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
              <span className="flex-1">“{o.objecao}”</span>
              <ChevronDown className="size-4 shrink-0 text-muted-foreground transition group-open:rotate-180" />
            </summary>
            <div className="grid gap-2 px-3 pb-3">
              <p className="text-sm text-muted-foreground">{o.resposta}</p>
              <Button variant="outline" size="sm" className="justify-self-start" onClick={() => copiar(o.resposta)}>
                <Copy /> Copiar resposta
              </Button>
            </div>
          </details>
        ))}
      </div>
    );
  return (
    <div className="grid gap-2.5">
      {objecoes.map((o, i) => (
        <div key={i} className="grid gap-2 rounded-xl border bg-card p-3">
          <b className="text-sm">“{o.objecao}”</b>
          <p className="text-sm text-muted-foreground">{o.resposta}</p>
          <Button variant="outline" size="sm" className="justify-self-start" onClick={() => copiar(o.resposta)}>
            <Copy /> Copiar resposta
          </Button>
        </div>
      ))}
    </div>
  );
}

/** Aba "Roteiros" da ficha: 5 mensagens + ligação, gerados para o contato do funil. */
export function RoteirosDoContato({ prospectId, whatsapp, aoRegistrar }: { prospectId: string; whatsapp?: string | null; aoRegistrar?: () => void }) {
  const [ab, setAb] = useState<Abordagem | null>(null);
  const [lig, setLig] = useState<Fala[] | null>(null);
  const [outra, setOutra] = useState(false);
  const [erro, setErro] = useState(false);
  const [melhorando, setMelhorando] = useState(false);
  const [avisoIA, setAvisoIA] = useState("");

  // Mostra na hora os modelos prontos e, em paralelo, pede a versão sob medida para a IA
  const buscar = useCallback(() => {
    let vivo = true;
    Promise.all([abordagemAction({ prospectId, ia: false }), ligacaoAction({ prospectId, ia: false })])
      .then(([a, l]) => {
        if (!vivo) return;
        setAb(a as Abordagem);
        setLig(l as Fala[]);
        setMelhorando(true);
        abordagemAction({ prospectId })
          .then((r) => {
            if (!vivo) return;
            const x = r as Abordagem;
            if (x.ia) setAb(x);
            else setAvisoIA(x.aviso ?? "");
          })
          .catch(() => {})
          .finally(() => vivo && setMelhorando(false));
      })
      .catch(() => vivo && setErro(true));
    return () => {
      vivo = false;
    };
  }, [prospectId]);

  useEffect(() => buscar(), [buscar]);

  if (erro)
    return (
      <div className="grid justify-items-center gap-2 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
        Não consegui gerar os roteiros agora.
        <Button
          variant="outline"
          onClick={() => {
            setErro(false);
            buscar();
          }}
        >
          Tentar de novo
        </Button>
      </div>
    );
  if (!ab || !lig)
    return (
      <div className="grid gap-2.5" aria-busy="true">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Montando os roteiros…
        </p>
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    );

  return (
    <div className="grid gap-5">
      <section className="grid gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold">
            <MessageCircle className="size-4 text-emerald-600" /> WhatsApp — 5 mensagens
          </h3>
          <SeloIA ia={ab.ia} aviso={ab.aviso} />
          {melhorando && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" /> a IA está escrevendo uma versão sob medida…
            </span>
          )}
        </div>
        {!melhorando && !ab.ia && avisoIA && <p className="text-xs text-muted-foreground">{avisoIA}</p>}
        <MensagensWhats
          mensagens={ab.mensagens}
          whatsapp={whatsapp}
          aoEnviar={async (t) => {
            const r = await registrarContatoAction(prospectId, t);
            if (r.ok) {
              toast.success("Marcado como contatado ✓");
              aoRegistrar?.();
            } else toast.error(r.message);
          }}
        />
      </section>
      <section className="grid gap-2.5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold">
            <Phone className="size-4 text-primary" /> Roteiro de ligação
          </h3>
          <Button
            variant="outline"
            size="sm"
            disabled={outra}
            onClick={async () => {
              setOutra(true);
              try {
                setLig((await ligacaoAction({ prospectId })) as Fala[]);
              } catch {
                toast.error("Não consegui gerar outra versão.");
              }
              setOutra(false);
            }}
          >
            {outra ? <Loader2 className="animate-spin" /> : <Shuffle />} Outra versão
          </Button>
        </div>
        <div className={cn(outra && "opacity-50 transition")}>
          <RoteiroLigacao roteiro={lig} />
        </div>
      </section>
    </div>
  );
}
