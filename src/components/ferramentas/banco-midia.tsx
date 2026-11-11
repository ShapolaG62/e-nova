"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Camera, Download, ExternalLink, Film, KeyRound, LayoutGrid, Loader2, Maximize2, Palette, PenTool, Play, Save, Search, Smile, Sparkles, Sticker, Trash2, X,
} from "lucide-react";
import { buscarMidiaAction, salvarChaveGiphyAction, salvarChavePixabayAction, salvarMidiaAction } from "@/app/actions/ferramentas";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { BotaoAcao, ListaResultados, Painel, type ArquivoPronto } from "./comum";

type Item = {
  id: string; titulo: string; miniatura: string; previa?: string; url: string; autor: string; pagina: string; duracao: number;
  tipo: "foto" | "video" | "gif" | "emoji"; largura: number; altura: number; fonte: string; emoji?: string;
};
type Aba = "tudo" | "foto" | "ilustracao" | "vetor" | "video" | "gifs" | "stickers" | "emojis";

const ABAS: { id: Aba; rotulo: string; icone: React.ComponentType<{ className?: string }>; fonte: "pixabay" | "giphy" | "emojis" }[] = [
  { id: "tudo", rotulo: "Tudo", icone: LayoutGrid, fonte: "pixabay" },
  { id: "foto", rotulo: "Fotos", icone: Camera, fonte: "pixabay" },
  { id: "ilustracao", rotulo: "Ilustrações", icone: Palette, fonte: "pixabay" },
  { id: "vetor", rotulo: "Vetores", icone: PenTool, fonte: "pixabay" },
  { id: "video", rotulo: "Vídeos", icone: Film, fonte: "pixabay" },
  { id: "gifs", rotulo: "GIFs", icone: Sparkles, fonte: "giphy" },
  { id: "stickers", rotulo: "Figurinhas", icone: Sticker, fonte: "giphy" },
  { id: "emojis", rotulo: "Emojis", icone: Smile, fonte: "emojis" },
];

const CATEGORIAS: [string, string][] = [
  ["backgrounds", "Fundos"], ["business", "Negócios"], ["food", "Comida"], ["people", "Pessoas"], ["nature", "Natureza"], ["places", "Lugares"],
  ["travel", "Viagem"], ["fashion", "Moda"], ["health", "Saúde"], ["education", "Educação"], ["computer", "Tecnologia"], ["buildings", "Construções"],
  ["animals", "Animais"], ["sports", "Esportes"], ["music", "Música"], ["feelings", "Sentimentos"], ["industry", "Indústria"], ["transportation", "Transporte"],
  ["science", "Ciência"], ["religion", "Religião"],
];
const CAT_EMOJI: [string, string][] = [
  ["Smileys and emotions", "Carinhas"], ["People", "Pessoas"], ["Animals and nature", "Animais e natureza"], ["Food and drink", "Comida"],
  ["Travel and places", "Lugares"], ["Activities and events", "Atividades"], ["Objects", "Objetos"], ["Symbols", "Símbolos"], ["Flags", "Bandeiras"],
];
const previaLocal = (u?: string) => (u ? `/api/ferramentas/previa?u=${encodeURIComponent(u)}` : undefined);
const chip = (ativo: boolean) => cn(
  "inline-flex min-h-9 shrink-0 items-center rounded-md border px-3 text-sm transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:min-h-8",
  ativo ? "border-primary bg-primary/15 font-medium text-foreground" : "text-muted-foreground hover:border-primary/50 hover:text-foreground",
);

export function BancoMidia({ temChave: chaveInicial, temChaveGiphy: giphyInicial, podeConfigurar }: { temChave: boolean; temChaveGiphy: boolean; podeConfigurar: boolean }) {
  const [chaves, setChaves] = useState({ pixabay: chaveInicial, giphy: giphyInicial });
  const [aba, setAba] = useState<Aba>(chaveInicial ? "tudo" : "emojis");
  const [termo, setTermo] = useState("");
  const [buscado, setBuscado] = useState("");
  const [categoria, setCategoria] = useState("");
  const [ordem, setOrdem] = useState<"popular" | "latest">("popular");
  const [destaques, setDestaques] = useState(false);
  const [todasCategorias, setTodasCategorias] = useState(false);
  const [itens, setItens] = useState<Item[]>([]);
  const [pagina, setPagina] = useState(0);
  const [total, setTotal] = useState(0);
  const [carregando, setCarregando] = useState(false);
  const [fim, setFim] = useState(false);
  const [aberto, setAberto] = useState<Item | null>(null);
  const [salvando, setSalvando] = useState<string | null>(null);
  const [salvos, setSalvos] = useState<ArquivoPronto[]>([]);
  const seq = useRef(0);
  const sentinela = useRef<HTMLDivElement>(null);

  const fonte = ABAS.find((a) => a.id === aba)!.fonte;
  const semChave = (fonte === "pixabay" && !chaves.pixabay) || (fonte === "giphy" && !chaves.giphy);

  const carregar = useCallback(async (pag: number) => {
    const meu = ++seq.current;
    if (pag === 1) { setItens([]); setPagina(0); setFim(false); setTotal(0); }
    setCarregando(true);
    try {
      const r = await buscarMidiaAction({ aba, termo: buscado, pagina: pag, categoria: categoria || undefined, ordem, destaques });
      if (meu !== seq.current) return; // chegou uma busca mais nova
      if (!r.ok) {
        if (r.message === "SEM_CHAVE_GIPHY") setChaves((c) => ({ ...c, giphy: false }));
        else toast.error(r.message);
        setFim(true);
        return;
      }
      setItens((atual) => {
        const vistos = new Set(atual.map((i) => i.id));
        return pag === 1 ? r.dados.itens : [...atual, ...r.dados.itens.filter((i) => !vistos.has(i.id))];
      });
      setTotal(r.dados.total);
      setPagina(pag);
      setFim(!r.dados.itens.length || pag * (aba === "emojis" ? 60 : 30) >= r.dados.total);
    } finally {
      if (meu === seq.current) setCarregando(false);
    }
  }, [aba, buscado, categoria, ordem, destaques]);

  // troca de aba/filtro/busca = recomeça do topo (sem precisar digitar nada)
  useEffect(() => {
    if (semChave) return;
    const t = setTimeout(() => void carregar(1), 120); // pequena espera: cliques rápidos nos filtros viram uma busca só
    return () => clearTimeout(t);
  }, [carregar, semChave]);

  // rolagem infinita: quando o fim da grade aparece, carrega a próxima página
  useEffect(() => {
    const el = sentinela.current;
    if (!el) return;
    const obs = new IntersectionObserver((e) => { if (e[0]?.isIntersecting && !carregando && !fim && pagina > 0) void carregar(pagina + 1); }, { rootMargin: "600px" });
    obs.observe(el);
    return () => obs.disconnect();
  }, [carregar, carregando, fim, pagina]);

  function trocarAba(a: Aba) { setAba(a); setCategoria(""); setTodasCategorias(false); }

  async function salvar(item: Item, baixar = false) {
    setSalvando(item.id);
    try {
      const nome = item.emoji ? `emoji-${item.id.slice(3)}` : item.titulo.split(",")[0] || item.id;
      const r = await salvarMidiaAction({ url: item.url, nome });
      if (!r.ok) return void toast.error(r.message);
      setSalvos((s) => [r.dados, ...s]);
      if (baixar) {
        const a = document.createElement("a");
        a.href = r.dados.url; a.download = r.dados.nome; document.body.appendChild(a); a.click(); a.remove();
      } else toast.success("Salvo no E-Nova (link logo abaixo da busca).");
    } finally {
      setSalvando(null);
    }
  }

  async function gravarChave(qual: "pixabay" | "giphy", nova: string | null) {
    const r = qual === "pixabay" ? await salvarChavePixabayAction(nova) : await salvarChaveGiphyAction(nova);
    if (!r.ok) return void toast.error(r.message);
    setChaves((c) => ({ ...c, [qual]: !!nova }));
    toast.success(nova ? "Chave salva e conferida!" : "Chave removida.");
  }

  const categoriasVisiveis = aba === "emojis" ? CAT_EMOJI : todasCategorias ? CATEGORIAS : CATEGORIAS.slice(0, 8);
  const placeholder = aba === "emojis" ? "Ex.: feliz, fogo, coração, 🎉" : fonte === "giphy" ? "Ex.: parabéns, uau, obrigado" : "Ex.: padaria, escritório, praia";

  return (
    <Painel
      titulo="Banco de mídia"
      descricao="Fotos, ilustrações, vetores e vídeos da Pixabay, GIFs e figurinhas do GIPHY e emojis animados do Google — prontos para usar."
      acao={podeConfigurar && (chaves.pixabay || chaves.giphy) ? (
        <details className="relative">
          <summary className="flex h-9 cursor-pointer list-none items-center gap-1.5 rounded-md px-2 text-sm text-muted-foreground hover:bg-muted">
            <KeyRound className="size-4" /> Chaves
          </summary>
          <div className="absolute right-0 z-20 mt-1 grid w-56 gap-1 rounded-lg border bg-popover p-1.5 shadow-lg">
            {chaves.pixabay && <button type="button" className="flex items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-muted" onClick={() => confirm("Remover a chave da Pixabay?") && gravarChave("pixabay", null)}><Trash2 className="size-4" /> Remover chave da Pixabay</button>}
            {chaves.giphy && <button type="button" className="flex items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-muted" onClick={() => confirm("Remover a chave do GIPHY?") && gravarChave("giphy", null)}><Trash2 className="size-4" /> Remover chave do GIPHY</button>}
          </div>
        </details>
      ) : undefined}
    >
      {/* tipos de mídia: botões grandes, todos à vista */}
      <div role="tablist" aria-label="Tipo de mídia" className="grid grid-cols-4 gap-1.5 sm:grid-cols-8">
        {ABAS.map((a) => {
          const Icone = a.icone;
          const ativo = aba === a.id;
          return (
            <button key={a.id} type="button" role="tab" aria-selected={ativo} onClick={() => trocarAba(a.id)}
              className={cn(
                "flex min-h-16 flex-col items-center justify-center gap-1 rounded-lg border px-1 py-2 text-xs transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:text-[0.8rem]",
                ativo ? "border-primary bg-primary/15 font-semibold text-foreground" : "bg-background/40 text-muted-foreground hover:border-primary/50 hover:text-foreground",
              )}>
              <Icone className={cn("size-5", ativo && "text-primary")} />
              <span className="leading-tight">{a.rotulo}</span>
            </button>
          );
        })}
      </div>

      {semChave ? (
        <ChaveFaltando qual={fonte === "giphy" ? "giphy" : "pixabay"} podeConfigurar={podeConfigurar} onSalvar={(c) => gravarChave(fonte === "giphy" ? "giphy" : "pixabay", c)} />
      ) : (
        <>
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setBuscado(termo.trim()); }}>
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={termo} onChange={(e) => setTermo(e.target.value)} placeholder={placeholder} aria-label="Pesquisar" className="h-11 pl-9 sm:h-10" />
              {termo && (
                <button type="button" onClick={() => { setTermo(""); setBuscado(""); }} className="absolute top-1/2 right-1.5 grid size-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-muted" aria-label="Limpar pesquisa">
                  <X className="size-4" />
                </button>
              )}
            </div>
            <Button type="submit" className="h-11 shrink-0 px-4 sm:h-10" disabled={carregando && pagina === 0}><Search /> <span className="sr-only sm:not-sr-only">Buscar</span></Button>
          </form>

          {fonte !== "giphy" && (
            <div className="grid gap-2">
              <div className="flex flex-wrap gap-1.5" aria-label="Categorias">
                <button type="button" className={chip(!categoria)} onClick={() => setCategoria("")}>Todas</button>
                {categoriasVisiveis.map(([id, nome]) => (
                  <button key={id} type="button" className={chip(categoria === id)} aria-pressed={categoria === id} onClick={() => setCategoria(categoria === id ? "" : id)}>{nome}</button>
                ))}
                {aba !== "emojis" && (
                  <button type="button" className="inline-flex min-h-9 items-center px-2 text-sm text-primary hover:underline sm:min-h-8" onClick={() => setTodasCategorias((v) => !v)}>
                    {todasCategorias ? "Menos" : `+${CATEGORIAS.length - 8} categorias`}
                  </button>
                )}
              </div>
              {fonte === "pixabay" && (
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <div className="inline-flex rounded-md border p-0.5" role="group" aria-label="Ordem">
                    {(["popular", "latest"] as const).map((o) => (
                      <button key={o} type="button" aria-pressed={ordem === o} onClick={() => setOrdem(o)}
                        className={cn("min-h-8 rounded px-3", ordem === o ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                        {o === "popular" ? "Populares" : "Recentes"}
                      </button>
                    ))}
                  </div>
                  <label className="inline-flex min-h-9 items-center gap-2"><input type="checkbox" checked={destaques} onChange={(e) => setDestaques(e.target.checked)} className="size-4 accent-[var(--primary)]" /> Escolhas dos editores</label>
                </div>
              )}
            </div>
          )}

          <ListaResultados arquivos={salvos} />

          <p className="text-xs text-muted-foreground" aria-live="polite">
            {carregando && pagina === 0 ? "Carregando…" : total ? `${total.toLocaleString("pt-BR")} ${aba === "emojis" ? "emojis" : "resultados"}${buscado ? ` para “${buscado}”` : buscado === "" && fonte === "giphy" ? " em alta agora" : ""}` : ""}
          </p>

          {!carregando && pagina > 0 && !itens.length && <p className="py-8 text-center text-sm text-muted-foreground">Nada encontrado. Tente outra palavra ou outra categoria.</p>}

          {aba === "emojis" ? (
            <ul className="grid grid-cols-5 gap-1.5 sm:grid-cols-8 lg:grid-cols-10">
              {itens.map((it) => (
                <li key={it.id}>
                  <button type="button" onClick={() => setAberto(it)} title={it.titulo}
                    className="grid aspect-square w-full place-items-center rounded-lg border bg-background/40 text-3xl transition-transform hover:scale-110 hover:border-primary/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:text-4xl">
                    <span aria-hidden>{it.emoji}</span><span className="sr-only">{it.titulo}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <ul className="columns-2 gap-2 sm:columns-3 lg:columns-4 [&>li]:mb-2 [&>li]:break-inside-avoid">
              {itens.map((it) => (
                <li key={it.id} className="group relative overflow-hidden rounded-lg bg-muted">
                  <button type="button" onClick={() => setAberto(it)} className="block w-full focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none" aria-label={`Abrir ${it.titulo}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={it.miniatura} alt={it.titulo} loading="lazy" referrerPolicy="no-referrer"
                      style={it.largura && it.altura ? { aspectRatio: `${it.largura} / ${it.altura}` } : undefined}
                      className="w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                    {it.tipo === "video" && <span className="absolute top-1.5 left-1.5 inline-flex items-center gap-1 rounded bg-black/70 px-1.5 py-0.5 text-[0.7rem] text-white"><Play className="size-3" /> {it.duracao}s</span>}
                    {it.tipo === "gif" && <span className="absolute top-1.5 left-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[0.7rem] font-semibold text-white">GIF</span>}
                  </button>
                  {/* ações sempre visíveis no celular; no computador aparecem ao passar o mouse */}
                  <div className="absolute inset-x-0 bottom-0 flex gap-1 bg-gradient-to-t from-black/80 to-transparent p-1.5 pt-6 sm:opacity-0 sm:transition-opacity sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
                    <button type="button" onClick={() => salvar(it)} disabled={!!salvando} className="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-md bg-white/15 text-xs text-white backdrop-blur hover:bg-white/25" title="Salvar no E-Nova">
                      {salvando === it.id ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}<span className="hidden sm:inline">Salvar</span>
                    </button>
                    <button type="button" onClick={() => salvar(it, true)} disabled={!!salvando} className="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-md bg-white/15 text-xs text-white backdrop-blur hover:bg-white/25" title="Baixar">
                      <Download className="size-3.5" /><span className="hidden sm:inline">Baixar</span>
                    </button>
                    <button type="button" onClick={() => setAberto(it)} className="inline-flex size-8 items-center justify-center rounded-md bg-white/15 text-white backdrop-blur hover:bg-white/25" aria-label="Ver grande">
                      <Maximize2 className="size-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div ref={sentinela} className="grid min-h-10 place-items-center">
            {carregando && <Loader2 className="size-5 animate-spin text-muted-foreground" aria-label="Carregando mais" />}
            {!carregando && !fim && pagina > 0 && <Button variant="outline" className="h-10" onClick={() => carregar(pagina + 1)}>Carregar mais</Button>}
          </div>

          <p className="text-xs text-muted-foreground">
            {fonte === "pixabay" && "Pixabay: uso comercial liberado, sem precisar dar crédito. Use “Salvar” em vez de copiar o link deles."}
            {fonte === "giphy" && "GIPHY: ótimo para Stories e mensagens; confira a licença antes de usar em anúncio pago."}
            {fonte === "emojis" && "Emojis animados do Google (Noto), licença CC BY 4.0 — grátis, inclusive comercial."}
          </p>
        </>
      )}

      <Dialog open={!!aberto} onOpenChange={(v) => !v && setAberto(null)}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-3xl">
          {aberto && (
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_14rem]">
              <div className="grid place-items-center overflow-hidden rounded-lg bg-black/60">
                {aberto.tipo === "video" || (aberto.tipo === "gif" && aberto.previa) ? (
                  <video src={previaLocal(aberto.previa)} poster={aberto.miniatura} autoPlay muted loop playsInline controls={aberto.tipo === "video"} className="max-h-[60dvh] w-full object-contain" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={aberto.tipo === "emoji" ? aberto.miniatura : aberto.tipo === "gif" ? aberto.url : aberto.url} alt={aberto.titulo} referrerPolicy="no-referrer" className={cn("max-h-[60dvh] w-full object-contain", aberto.tipo === "emoji" && "max-w-64 p-4")} />
                )}
              </div>
              <div className="grid content-start gap-2.5">
                <DialogTitle className="text-base leading-snug normal-case [font-family:var(--font-body)]">{aberto.emoji ? `${aberto.emoji} ` : ""}{aberto.titulo}</DialogTitle>
                <DialogDescription className="text-xs">
                  {aberto.fonte} · por {aberto.autor}{aberto.largura ? ` · ${aberto.largura}×${aberto.altura}` : ""}{aberto.tipo === "video" ? ` · ${aberto.duracao}s` : ""}
                </DialogDescription>
                <BotaoAcao ocupado={salvando === aberto.id} onClick={() => salvar(aberto)} icone={<Save data-icon="inline-start" />} className="sm:w-full">Salvar no E-Nova</BotaoAcao>
                <Button variant="outline" className="h-11 sm:h-9" disabled={!!salvando} onClick={() => salvar(aberto, true)}><Download data-icon="inline-start" /> Baixar</Button>
                <a href={aberto.pagina} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center justify-center gap-1.5 rounded-md border text-sm hover:bg-muted sm:h-9">
                  <ExternalLink className="size-4" /> Ver na {aberto.fonte}
                </a>
                {aberto.tipo === "video" && <p className="text-xs text-muted-foreground">A prévia é em qualidade baixa; o arquivo salvo vem na melhor qualidade disponível.</p>}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Painel>
  );
}

function ChaveFaltando({ qual, podeConfigurar, onSalvar }: { qual: "pixabay" | "giphy"; podeConfigurar: boolean; onSalvar: (c: string) => Promise<void> }) {
  const [chave, setChave] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const pix = qual === "pixabay";
  return (
    <div className="grid gap-3 rounded-xl border border-dashed border-primary/50 bg-primary/5 p-4">
      <p className="flex items-center gap-2 text-sm font-medium"><KeyRound className="size-4 text-primary" /> Falta a chave grátis {pix ? "da Pixabay" : "do GIPHY"}</p>
      {podeConfigurar ? (
        <>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            {pix ? (
              <>
                <li>Crie uma conta grátis em pixabay.com.</li>
                <li>Abra <a className="text-foreground underline" href="https://pixabay.com/api/docs/" target="_blank" rel="noopener noreferrer">pixabay.com/api/docs</a> e copie a chave em “Parameters → key”.</li>
              </>
            ) : (
              <>
                <li>Entre em <a className="text-foreground underline" href="https://developers.giphy.com/dashboard/" target="_blank" rel="noopener noreferrer">developers.giphy.com</a> e crie um app do tipo <strong>API</strong> (grátis).</li>
                <li>Copie a “API Key” que aparece no painel.</li>
              </>
            )}
            <li>Cole abaixo. Ela fica guardada criptografada no servidor.</li>
          </ol>
          <form className="grid gap-2 sm:flex sm:items-end" onSubmit={async (e) => { e.preventDefault(); if (!chave.trim()) return; setOcupado(true); try { await onSalvar(chave.trim()); } finally { setOcupado(false); } }}>
            <div className="grid min-w-0 flex-1 gap-1.5">
              <Label htmlFor={`chave-${qual}`}>Chave {pix ? "da Pixabay" : "do GIPHY"}</Label>
              <Input id={`chave-${qual}`} value={chave} onChange={(e) => setChave(e.target.value)} autoComplete="off" spellCheck={false} className="h-11 font-mono sm:h-9" />
            </div>
            <BotaoAcao type="submit" ocupado={ocupado} disabled={!chave.trim()}>Salvar chave</BotaoAcao>
          </form>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Peça a um administrador para colar a chave {pix ? "da Pixabay" : "do GIPHY"} aqui.</p>
      )}
      <p className="text-xs text-muted-foreground">Enquanto isso, os <strong>Emojis</strong> funcionam sem chave.</p>
    </div>
  );
}
