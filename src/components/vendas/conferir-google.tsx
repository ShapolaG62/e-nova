"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, ExternalLink, Loader2, MapPin } from "lucide-react";
import { aplicarGoogleAction, conferirGoogleAction } from "@/app/actions/vendas";
import type { ConferenciaGoogle } from "@/lib/sites/service";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/** Botão "Conferir no Google Maps": mostra o que mudou no Maps e deixa trocar dados, fotos e depoimentos. */
export function ConferirGoogle({ siteId, aoAplicar }: { siteId: string; aoAplicar: () => void }) {
  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [aplicando, setAplicando] = useState(false);
  const [erro, setErro] = useState("");
  const [c, setC] = useState<ConferenciaGoogle | null>(null);
  const [o, setO] = useState({ dados: true, fotos: true, depoimentos: true });

  const conferir = async () => {
    setAberto(true); setErro(""); setC(null); setCarregando(true);
    const r = await conferirGoogleAction(siteId);
    setCarregando(false);
    if (!r.ok) return setErro(r.message);
    setC(r.data);
    setO({ dados: r.data.diferencas.length > 0, fotos: r.data.fotosGoogle > 0, depoimentos: r.data.avaliacoesTexto > 0 });
  };

  const aplicar = async () => {
    setAplicando(true);
    const r = await aplicarGoogleAction(siteId, o);
    setAplicando(false);
    if (!r.ok) return toast.error(r.message);
    toast.success(r.data.length ? `Atualizado com o Google: ${r.data.join(", ")}.` : "Nada para trocar.");
    setAberto(false);
    aoAplicar();
  };

  const nada = !o.dados && !o.fotos && !o.depoimentos;
  return (
    <>
      <Button variant="outline" className="h-10 sm:h-9" onClick={conferir}>
        <MapPin /> Conferir no Google
      </Button>
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-h-[88svh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Conferir com o Google Maps</DialogTitle>
            <DialogDescription>Compara o site com o que está hoje no perfil do negócio no Google e deixa você trocar pelo que está lá.</DialogDescription>
          </DialogHeader>

          {carregando && <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Procurando no Google Maps…</p>}
          {erro && <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{erro}</p>}

          {c && (
            <div className="grid gap-4 text-sm">
              <div className="rounded-lg border bg-muted/40 px-3 py-2.5">
                <p className="font-medium">{c.encontrado}</p>
                <p className="text-muted-foreground">{c.endereco}</p>
                {c.mapa && <a href={c.mapa} target="_blank" rel="noopener" className="mt-1 inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline">Ver no Maps <ExternalLink className="size-3.5" /></a>}
              </div>

              {c.diferencas.length === 0 ? (
                <p className="flex items-center gap-2 text-muted-foreground"><CheckCircle2 className="size-4 text-emerald-600" /> Os dados do site já batem com o Google.</p>
              ) : (
                <div className="grid gap-2">
                  <p className="font-medium">{c.diferencas.length === 1 ? "1 informação diferente" : `${c.diferencas.length} informações diferentes`}</p>
                  <ul className="grid gap-2">
                    {c.diferencas.map((d) => (
                      <li key={d.campo} className="rounded-lg border px-3 py-2">
                        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{d.rotulo}</p>
                        <p className="mt-1 break-words text-muted-foreground line-through decoration-1">{d.site}</p>
                        <p className="break-words">{d.google}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <fieldset className="grid gap-2">
                <legend className="mb-1 font-medium">O que trocar pelo que está no Google</legend>
                <Opcao marcado={o.dados} desativado={!c.diferencas.length} aoMudar={(v) => setO({ ...o, dados: v })}>
                  Dados (nome, endereço, telefone, WhatsApp, horários, nota)
                </Opcao>
                <Opcao marcado={o.fotos} desativado={!c.fotosGoogle} aoMudar={(v) => setO({ ...o, fotos: v })}>
                  Fotos: {c.fotosGoogle ? `usar as ${c.fotosGoogle} fotos do Google (a primeira vira a capa)` : "o perfil não tem fotos no Google"}
                </Opcao>
                <Opcao marcado={o.depoimentos} desativado={!c.avaliacoesTexto} aoMudar={(v) => setO({ ...o, depoimentos: v })}>
                  Depoimentos: {c.avaliacoesTexto ? "usar avaliações reais de 4 e 5 estrelas" : "sem avaliações com texto no Google"}
                </Opcao>
              </fieldset>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setAberto(false)}>Fechar</Button>
            {c && (
              <Button onClick={aplicar} disabled={aplicando || nada}>
                {aplicando ? <Loader2 className="animate-spin" /> : <MapPin />} Trocar pelo do Google
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Opcao({ marcado, desativado, aoMudar, children }: { marcado: boolean; desativado?: boolean; aoMudar: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label className={`flex min-h-11 cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 ${desativado ? "cursor-not-allowed opacity-55" : "hover:bg-muted/50"}`}>
      <input type="checkbox" className="mt-0.5 size-4 accent-[var(--primary)]" checked={marcado && !desativado} disabled={desativado} onChange={(e) => aoMudar(e.target.checked)} />
      <span>{children}</span>
    </label>
  );
}
