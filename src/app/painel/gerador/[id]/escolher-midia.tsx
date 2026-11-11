"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Camera, Check, Film, Images, Loader2, Search } from "lucide-react";
import { buscarMidiaAction } from "@/app/actions/ferramentas";
import { trocarMidiaCenaAction } from "@/app/actions/gerador";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Item = { id: string; titulo: string; miniatura: string; url: string; largura: number; altura: number; tipo: string; duracao: number };

/** Escolher no Banco de mídia a foto/vídeo de UMA cena (sem gastar IA). */
export function EscolherMidia({ projeto, cenaId, buscaInicial, vertical, desabilitado }: { projeto: string; cenaId: string; buscaInicial: string; vertical: boolean; desabilitado: boolean }) {
  const [aberto, setAberto] = useState(false);
  const [termo, setTermo] = useState(buscaInicial);
  const [busca, setBusca] = useState(buscaInicial);
  const [tipo, setTipo] = useState<"foto" | "video">("foto");
  const [itens, setItens] = useState<Item[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [escolhendo, setEscolhendo] = useState<string | null>(null);
  const [, start] = useTransition();
  const router = useRouter();

  useEffect(() => {
    if (!aberto) return;
    let vivo = true;
    const t = setTimeout(async () => {
      setCarregando(true);
      const r = await buscarMidiaAction({ aba: tipo, termo: busca, pagina: 1 });
      if (!vivo) return;
      setCarregando(false);
      if (!r.ok) return void toast.error(r.message);
      // no vertical, mostra primeiro o que já é vertical
      const ord = [...r.dados.itens].sort((a, b) => (vertical ? Number(b.altura > b.largura) - Number(a.altura > a.largura) : 0));
      setItens(ord);
    }, 100);
    return () => { vivo = false; clearTimeout(t); };
  }, [aberto, busca, tipo, vertical]);

  const escolher = (it: Item) => {
    setEscolhendo(it.id);
    start(async () => {
      const r = await trocarMidiaCenaAction(projeto, cenaId, it.url);
      setEscolhendo(null);
      (r.ok ? toast.success : toast.error)(r.message ?? "Pronto.");
      if (r.ok) { setAberto(false); router.refresh(); }
    });
  };

  return (
    <>
      <Button size="sm" variant="outline" className="h-9" disabled={desabilitado} onClick={() => setAberto(true)}><Images /> Banco de mídia</Button>
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-3xl">
          <DialogTitle className="text-lg">Escolher no Banco de mídia</DialogTitle>
          <DialogDescription>Fotos e vídeos prontos da Pixabay, grátis e liberados para uso comercial. A voz da cena continua a mesma.</DialogDescription>
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setBusca(termo.trim()); }}>
            <Input value={termo} onChange={(e) => setTermo(e.target.value)} placeholder="Ex.: bakery bread, coffee morning" aria-label="Buscar no banco" className="h-11 min-w-0 flex-1 sm:h-10" />
            <Button type="submit" className="h-11 sm:h-10"><Search /> <span className="sr-only sm:not-sr-only">Buscar</span></Button>
          </form>
          <div className="inline-flex w-fit rounded-md border p-0.5" role="group" aria-label="Tipo">
            {([["foto", "Fotos", Camera], ["video", "Vídeos", Film]] as const).map(([v, r, I]) => (
              <button key={v} type="button" aria-pressed={tipo === v} onClick={() => setTipo(v)} className={cn("inline-flex min-h-9 items-center gap-1.5 rounded px-3 text-sm", tipo === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                <I className="size-4" /> {r}
              </button>
            ))}
          </div>
          {carregando ? (
            <div className="grid h-40 place-items-center"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
          ) : !itens.length ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Nada encontrado. Tente palavras em inglês e mais simples (ex.: “bread”, “office”).</p>
          ) : (
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {itens.map((it) => (
                <li key={it.id}>
                  <button type="button" disabled={!!escolhendo} onClick={() => escolher(it)} title={it.titulo}
                    className="group relative block w-full overflow-hidden rounded-lg bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={it.miniatura} alt={it.titulo} loading="lazy" referrerPolicy="no-referrer" className={cn("w-full object-cover transition-transform group-hover:scale-105", vertical ? "aspect-[9/16]" : "aspect-video")} />
                    {it.tipo === "video" && <span className="absolute top-1 left-1 rounded bg-black/70 px-1 text-[0.65rem] text-white">{it.duracao}s</span>}
                    <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-black/70 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                      {escolhendo === it.id ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />} Usar nesta cena
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
