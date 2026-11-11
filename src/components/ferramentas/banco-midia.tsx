"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Download, ExternalLink, KeyRound, Loader2, Search, Trash2, X } from "lucide-react";
import { buscarMidiaAction, salvarChavePixabayAction, salvarMidiaAction } from "@/app/actions/ferramentas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BotaoAcao, ListaResultados, Painel, Segmentado, type ArquivoPronto } from "./comum";

type Item = { id: number; titulo: string; miniatura: string; url: string; autor: string; pagina: string; duracao: number; tipo: "foto" | "video"; largura: number; altura: number };

export function BancoMidia({ temChave: chaveInicial, podeConfigurar }: { temChave: boolean; podeConfigurar: boolean }) {
  const [temChave, setTemChave] = useState(chaveInicial);
  const [chave, setChave] = useState("");
  const [salvandoChave, setSalvandoChave] = useState(false);
  const [tipo, setTipo] = useState<"foto" | "video">("foto");
  const [termo, setTermo] = useState("");
  const [itens, setItens] = useState<Item[]>([]);
  const [pagina, setPagina] = useState(1);
  const [total, setTotal] = useState(0);
  const [buscando, setBuscando] = useState(false);
  const [buscou, setBuscou] = useState(false);
  const [aberto, setAberto] = useState<Item | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [salvos, setSalvos] = useState<ArquivoPronto[]>([]);

  async function gravarChave(nova: string | null) {
    setSalvandoChave(true);
    try {
      const r = await salvarChavePixabayAction(nova);
      if (!r.ok) return void toast.error(r.message);
      setTemChave(!!nova);
      setChave("");
      toast.success(nova ? "Chave salva e conferida!" : "Chave removida.");
    } finally {
      setSalvandoChave(false);
    }
  }

  async function buscar(pag = 1, t = tipo) {
    setBuscando(true);
    try {
      const r = await buscarMidiaAction({ termo, tipo: t, pagina: pag });
      if (!r.ok) return void toast.error(r.message);
      setItens((atual) => (pag === 1 ? r.dados.itens : [...atual, ...r.dados.itens]));
      setTotal(r.dados.total);
      setPagina(pag);
      setBuscou(true);
    } finally {
      setBuscando(false);
    }
  }

  async function salvar(item: Item) {
    setSalvando(true);
    try {
      const r = await salvarMidiaAction({ url: item.url, nome: item.titulo.split(",")[0] || `pixabay-${item.id}` });
      if (!r.ok) return void toast.error(r.message);
      setSalvos((s) => [r.dados, ...s]);
      toast.success("Arquivo salvo no E-Nova.");
    } finally {
      setSalvando(false);
    }
  }

  if (!temChave) {
    return (
      <Painel titulo="Banco de mídia" descricao="Fotos e vídeos grátis da Pixabay, liberados para uso comercial sem precisar dar crédito.">
        <div className="grid gap-3 rounded-xl border border-dashed border-signal/50 bg-signal/5 p-4">
          <p className="flex items-center gap-2 text-sm font-medium"><KeyRound className="size-4 text-signal" /> Falta a chave grátis da Pixabay</p>
          {podeConfigurar ? (
            <>
              <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
                <li>Crie uma conta grátis em pixabay.com.</li>
                <li>Abra <a className="text-foreground underline" href="https://pixabay.com/api/docs/" target="_blank" rel="noopener noreferrer">pixabay.com/api/docs</a> e copie a chave que aparece em “Parameters → key”.</li>
                <li>Cole abaixo. Ela fica guardada criptografada no servidor.</li>
              </ol>
              <form className="grid gap-2 sm:flex sm:items-end" onSubmit={(e) => { e.preventDefault(); if (chave.trim()) void gravarChave(chave.trim()); }}>
                <div className="grid min-w-0 flex-1 gap-1.5">
                  <Label htmlFor="chave-pixabay">Chave da Pixabay</Label>
                  <Input id="chave-pixabay" value={chave} onChange={(e) => setChave(e.target.value)} autoComplete="off" spellCheck={false} className="h-11 font-mono sm:h-9" />
                </div>
                <BotaoAcao type="submit" ocupado={salvandoChave} disabled={!chave.trim()}>Salvar chave</BotaoAcao>
              </form>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Peça a um administrador para colar a chave da Pixabay aqui nas Ferramentas.</p>
          )}
        </div>
      </Painel>
    );
  }

  return (
    <Painel
      titulo="Banco de mídia"
      descricao="Fotos e vídeos grátis da Pixabay, liberados para uso comercial sem precisar dar crédito."
      acao={podeConfigurar ? (
        <Button variant="ghost" size="sm" className="h-9 text-muted-foreground" onClick={() => { if (confirm("Remover a chave da Pixabay?")) void gravarChave(null); }} disabled={salvandoChave}>
          <Trash2 data-icon="inline-start" /> Remover chave
        </Button>
      ) : undefined}
    >
      <Segmentado<"foto" | "video"> rotulo="Procurar" valor={tipo} onChange={(t) => { setTipo(t); setItens([]); setBuscou(false); if (termo) void buscar(1, t); }} colunas={2} opcoes={[{ v: "foto", rotulo: "Fotos" }, { v: "video", rotulo: "Vídeos" }]} />
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void buscar(1); }}>
        <Input value={termo} onChange={(e) => setTermo(e.target.value)} placeholder="Ex.: padaria, escritório, praia" aria-label="Buscar" className="h-11 min-w-0 flex-1 sm:h-9" />
        <Button type="submit" size="lg" className="h-11 shrink-0 px-4 sm:h-9" disabled={buscando}>
          {buscando ? <Loader2 className="animate-spin" /> : <Search />}
          <span className="sr-only sm:not-sr-only">Buscar</span>
        </Button>
      </form>

      {aberto && (
        <div className="grid gap-3 rounded-xl border bg-background p-3 sm:grid-cols-[minmax(0,1fr)_220px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={aberto.miniatura} alt={aberto.titulo} className="max-h-80 w-full rounded-lg bg-muted object-contain" referrerPolicy="no-referrer" />
          <div className="grid content-start gap-2">
            <div className="flex items-start gap-2">
              <p className="min-w-0 flex-1 text-sm font-medium">{aberto.titulo}</p>
              <button type="button" onClick={() => setAberto(null)} className="flex size-9 shrink-0 items-center justify-center rounded-md hover:bg-muted" aria-label="Fechar">
                <X className="size-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Por {aberto.autor} • {aberto.largura}×{aberto.altura}{aberto.tipo === "video" ? ` • ${aberto.duracao}s` : ""}
            </p>
            <BotaoAcao ocupado={salvando} onClick={() => salvar(aberto)} icone={<Download data-icon="inline-start" />} className="sm:w-full">
              {salvando ? "Salvando…" : "Salvar no E-Nova"}
            </BotaoAcao>
            <a href={aberto.pagina} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center justify-center gap-1.5 rounded-lg border text-sm hover:bg-muted sm:h-9">
              <ExternalLink className="size-4" /> Ver na Pixabay
            </a>
          </div>
        </div>
      )}

      <ListaResultados arquivos={salvos} />

      {buscou && !itens.length && !buscando && <p className="py-6 text-center text-sm text-muted-foreground">Nada encontrado. Tente outra palavra.</p>}
      {itens.length > 0 && (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {itens.map((it) => (
            <li key={`${it.tipo}-${it.id}`}>
              <button type="button" onClick={() => setAberto(it)} className="group relative block w-full overflow-hidden rounded-lg bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={it.miniatura} alt={it.titulo} loading="lazy" referrerPolicy="no-referrer" className="aspect-[4/3] w-full object-cover transition-transform group-hover:scale-105" />
                {it.tipo === "video" && <span className="absolute right-1.5 bottom-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[0.7rem] text-white">{it.duracao}s</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {itens.length > 0 && itens.length < total && (
        <Button variant="outline" className="h-11 w-full sm:h-9" onClick={() => buscar(pagina + 1)} disabled={buscando}>
          {buscando && <Loader2 data-icon="inline-start" className="animate-spin" />} Carregar mais
        </Button>
      )}
      <p className="text-xs text-muted-foreground">Imagens e vídeos da Pixabay. Use “Salvar no E-Nova” em vez de copiar o link deles: a Pixabay não permite usar os links diretos de forma permanente.</p>
    </Painel>
  );
}
