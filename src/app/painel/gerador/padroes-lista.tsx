"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Bookmark, Clapperboard, Sparkles, Trash2 } from "lucide-react";
import { criarComPadraoAction, excluirPadraoAction } from "@/app/actions/gerador";
import { ActionForm, FieldError, FormMessage, SubmitButton } from "@/components/action-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export type PadraoCartao = { id: string; nome: string; capa: string | null; detalhes: string; personagem: string | null; usos: number };

/** "Seus padrões": cada vídeo pronto vira um padrão; 1 botão gera outro vídeo com ele. */
export function PadroesLista({ padroes }: { padroes: PadraoCartao[] }) {
  const [aberto, setAberto] = useState<PadraoCartao | null>(null);
  const [mesmo, setMesmo] = useState(true);
  const [pend, start] = useTransition();
  if (!padroes.length) return null;
  return (
    <section aria-labelledby="padroes" className="grid gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="padroes" className="flex items-center gap-2 text-lg font-semibold"><Bookmark className="size-4 text-signal" aria-hidden /> Seus padrões</h2>
        <p className="text-xs text-muted-foreground">Cada vídeo pronto vira um padrão</p>
      </div>
      <ul className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2 [scrollbar-width:thin]">
        {padroes.map((p) => (
          <li key={p.id} className="w-[15.5rem] shrink-0 snap-start">
            <article className="grid h-full grid-cols-[4.5rem_minmax(0,1fr)] gap-3 rounded-2xl border bg-card p-2.5">
              <div className="grid aspect-[9/16] place-items-center overflow-hidden rounded-lg bg-muted">
                {p.capa ? <img src={p.capa} alt="" className="size-full object-cover" loading="lazy" /> : <Clapperboard className="size-5 text-muted-foreground" aria-hidden />}
              </div>
              <div className="grid min-w-0 content-between gap-2">
                <div className="grid gap-1">
                  <h3 className="line-clamp-2 text-sm leading-snug font-semibold">{p.nome}</h3>
                  <p className="line-clamp-2 text-xs text-muted-foreground">{p.detalhes}</p>
                  <p className="text-[0.7rem] text-muted-foreground">{p.usos === 1 ? "1 vídeo" : `${p.usos} vídeos`}</p>
                </div>
                <div className="flex gap-1.5">
                  <Button size="sm" className="h-9 flex-1" onClick={() => { setMesmo(true); setAberto(p); }}>
                    <Sparkles /> Novo vídeo
                  </Button>
                  <Button
                    size="icon-sm" variant="ghost" className="size-9 text-muted-foreground" aria-label={`Apagar o padrão ${p.nome}`} disabled={pend}
                    onClick={() => { if (confirm(`Apagar o padrão “${p.nome}”? Os vídeos continuam.`)) start(async () => { const r = await excluirPadraoAction(p.id); if (r.ok) toast.success(r.message ?? "Apagado"); else toast.error(r.message ?? "Erro"); }); }}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
            </article>
          </li>
        ))}
      </ul>

      <Dialog open={!!aberto} onOpenChange={(v) => !v && setAberto(null)}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo vídeo com “{aberto?.nome}”</DialogTitle>
            <DialogDescription>Mesma estética, formato, duração e voz. Conte só a nova história.</DialogDescription>
          </DialogHeader>
          {aberto && (
            <ActionForm action={criarComPadraoAction} className="grid gap-4">
              <input type="hidden" name="padraoId" value={aberto.id} />
              <div className="grid gap-1.5">
                <label htmlFor="tema-padrao" className="text-sm font-medium">Nova história</label>
                <textarea id="tema-padrao" name="tema" rows={4} required autoFocus placeholder="Ex.: Dona Rita descobre que o forno quebrou na véspera do Natal e precisa salvar as encomendas." className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:text-sm dark:bg-input/30" />
                <FieldError name="tema" />
              </div>
              <fieldset className="grid gap-2">
                <legend className="mb-1 text-sm font-medium">Personagem</legend>
                <div className="grid grid-cols-2 gap-2">
                  <label className="grid cursor-pointer gap-0.5 rounded-xl border p-3 text-sm has-[:checked]:border-signal has-[:checked]:bg-signal/5">
                    <input type="radio" name="mesmoPersonagem" value="sim" checked={mesmo} onChange={() => setMesmo(true)} className="sr-only" />
                    <span className="font-semibold">O mesmo</span>
                    <span className="text-xs text-muted-foreground">{aberto.personagem ?? "Igual ao do padrão"}</span>
                  </label>
                  <label className="grid cursor-pointer gap-0.5 rounded-xl border p-3 text-sm has-[:checked]:border-signal has-[:checked]:bg-signal/5">
                    <input type="radio" name="mesmoPersonagem" value="nao" checked={!mesmo} onChange={() => setMesmo(false)} className="sr-only" />
                    <span className="font-semibold">Outro</span>
                    <span className="text-xs text-muted-foreground">Descreva abaixo</span>
                  </label>
                </div>
                {!mesmo && (
                  <textarea name="personagem" rows={2} maxLength={600} placeholder="Ex.: Seu Jorge, 45 anos, careca, barba grisalha, camisa xadrez azul." className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:text-sm dark:bg-input/30" />
                )}
              </fieldset>
              <FormMessage />
              <SubmitButton className="h-11 w-full sm:h-10">Escrever o roteiro</SubmitButton>
            </ActionForm>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
