"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowLeft, Building2, Check, ChevronDown, ChevronUp, Eye, EyeOff, ImageIcon, Loader2, Monitor,
  Palette, Pencil, Plus, Redo2, Smartphone, Tablet, Trash2, Undo2, WandSparkles,
} from "lucide-react";
import { toast } from "sonner";
import type { LayoutInfo, PaletaInfo, SiteDoc } from "@/lib/sites/engine";
import { novoBlocoAction, salvarSiteAction } from "@/app/actions/vendas";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { NOMES_BLOCO, PALETA } from "./editor-schema";
import { CabecalhoPainel, PainelAdicionar, PainelAnimacoes, PainelBloco, PainelCores, PainelFotos, PainelNegocio, type Mudar } from "./editor-paineis";
import { PedirIA } from "./editor-ia";
import { BotaoIA, Dica, Mini, Rotulo } from "./editor-pecas";

type Painel = "inicio" | "bloco" | "negocio" | "fotos" | "cores" | "animacoes" | "adicionar";
type Dispositivo = "desktop" | "tablet" | "celular";

const LARGURA: Record<Dispositivo, string> = { desktop: "max-w-full", tablet: "max-w-[820px]", celular: "max-w-[390px]" };

export function EditorSite({
  siteId,
  nome,
  inicial,
  layouts,
  coresSetor,
  temas,
  paletas = [],
}: {
  siteId: string;
  nome: string;
  inicial: SiteDoc;
  layouts: LayoutInfo[];
  coresSetor: [string, string][];
  temas: Record<string, string>;
  paletas?: PaletaInfo[];
}) {
  const [doc, setDoc] = useState<SiteDoc>(() => normalizar(inicial));
  const docRef = useRef(doc);
  const [sel, setSel] = useState<string | null>(null);
  const selRef = useRef(sel);
  const [painel, setPainel] = useState<Painel>("inicio");
  const [salvo, setSalvo] = useState(true);
  const [aplicando, startAplicar] = useTransition();
  const [dispositivo, setDispositivo] = useState<Dispositivo>("desktop");
  const [vista, setVista] = useState<"editar" | "previa">("editar");
  const [ia, setIa] = useState<{ blocoId: string | null } | null>(null);

  // Histórico (desfazer/refazer): JSON dos estados anteriores
  const hist = useRef<string[]>([]);
  const fut = useRef<string[]>([]);
  const ultimoPush = useRef(0);
  const [pilhas, setPilhas] = useState({ hist: 0, fut: 0 });

  useEffect(() => {
    selRef.current = sel;
  }, [sel]);

  const trocarDoc = useCallback((novo: SiteDoc) => {
    docRef.current = novo;
    setDoc(novo);
    setSalvo(false);
    setPilhas({ hist: hist.current.length, fut: fut.current.length });
  }, []);

  /** Aplica uma mudança no documento. `forcar=false` agrupa digitação contínua num passo só do histórico. */
  const mudar: Mudar = useCallback(
    (fn, forcar = true) => {
      const atual = docRef.current;
      const agora = Date.now();
      if (forcar || agora - ultimoPush.current > 900) {
        hist.current.push(JSON.stringify(atual));
        if (hist.current.length > 80) hist.current.shift();
        fut.current = [];
      }
      ultimoPush.current = agora;
      const novo = structuredClone(atual);
      fn(novo);
      trocarDoc(novo);
    },
    [trocarDoc],
  );

  const desfazer = useCallback(() => {
    const anterior = hist.current.pop();
    if (!anterior) return;
    fut.current.push(JSON.stringify(docRef.current));
    trocarDoc(JSON.parse(anterior));
  }, [trocarDoc]);
  const refazer = useCallback(() => {
    const prox = fut.current.pop();
    if (!prox) return;
    hist.current.push(JSON.stringify(docRef.current));
    trocarDoc(JSON.parse(prox));
  }, [trocarDoc]);

  const aplicar = useCallback(() => {
    const enviado = docRef.current;
    startAplicar(async () => {
      const r = await salvarSiteAction(siteId, enviado);
      if (!r.ok) {
        toast.error(r.message);
        return;
      }
      if (docRef.current === enviado) setSalvo(true);
      toast.success("Aplicado no site ✓");
    });
  }, [siteId]);

  // Aviso ao fechar a aba com alterações não aplicadas
  useEffect(() => {
    if (salvo) return;
    const antes = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", antes);
    return () => window.removeEventListener("beforeunload", antes);
  }, [salvo]);

  // Atalhos: Ctrl+Z / Ctrl+Shift+Z (fora de campos de texto) e Ctrl+S
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === "s") {
        e.preventDefault();
        aplicar();
        return;
      }
      const alvo = e.target as HTMLElement | null;
      if (alvo?.closest("input, textarea, [contenteditable]")) return;
      if (k === "z" && !e.shiftKey) {
        e.preventDefault();
        desfazer();
      } else if (k === "y" || (k === "z" && e.shiftKey)) {
        e.preventDefault();
        refazer();
      }
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [aplicar, desfazer, refazer]);

  // ───── Prévia ao vivo (duas molduras: carrega na de trás e troca, sem piscar) ─────
  const frames = [useRef<HTMLIFrameElement>(null), useRef<HTMLIFrameElement>(null)];
  const [ativo, setAtivo] = useState(0);
  const ativoRef = useRef(0);
  const [carregando, setCarregando] = useState(true);
  const seq = useRef(0);
  const primeira = useRef(true);

  useEffect(() => {
    const n = ++seq.current;
    const atraso = primeira.current ? 0 : 280;
    primeira.current = false;
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const r = await fetch("/api/vendas/render", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ site: doc, editor: true }),
          signal: ctrl.signal,
        });
        if (!r.ok) throw new Error(String(r.status));
        const html = await r.text();
        if (n !== seq.current) return;
        const frente = frames[ativoRef.current].current;
        const tras = frames[1 - ativoRef.current].current;
        if (!tras) return;
        let y = 0;
        try {
          y = frente?.contentWindow?.scrollY ?? 0;
        } catch {}
        tras.onload = () => {
          if (n !== seq.current) return;
          try {
            const d = tras.contentDocument!;
            d.querySelectorAll(".rv").forEach((x) => x.classList.add("on"));
            d.documentElement.style.scrollBehavior = "auto";
            tras.contentWindow!.scrollTo(0, y);
            if (selRef.current) d.querySelector(`[data-bloco="${CSS.escape(selRef.current)}"]`)?.classList.add("sel");
          } catch {}
          ativoRef.current = 1 - ativoRef.current;
          setAtivo(ativoRef.current);
          setCarregando(false);
        };
        tras.srcdoc = html;
      } catch (e) {
        if ((e as Error).name !== "AbortError") toast.error("Não consegui atualizar a prévia.");
      }
    }, atraso);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc]);

  const rolarPara = useCallback((id: string) => {
    frames[ativoRef.current].current?.contentWindow?.postMessage({ tipo: "rolar", id }, "*");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Clique num bloco dentro da prévia → abre a edição dele
  useEffect(() => {
    const aoMsg = (e: MessageEvent) => {
      const daPrevia = frames.some((f) => f.current?.contentWindow === e.source);
      if (!daPrevia || e.data?.tipo !== "bloco" || typeof e.data.id !== "string") return;
      setSel(e.data.id);
      setPainel("bloco");
      setVista("editar");
    };
    window.addEventListener("message", aoMsg);
    return () => window.removeEventListener("message", aoMsg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const abrirBloco = (id: string) => {
    setSel(id);
    setPainel("bloco");
    rolarPara(id);
  };
  const voltar = () => {
    setPainel("inicio");
    setSel(null);
  };

  const inserirBloco = async (tipo: string) => {
    const novo = await novoBlocoAction(tipo, docRef.current.setor);
    if (!novo) {
      toast.error("Não foi possível criar a seção.");
      return;
    }
    mudar((d) => {
      const i = sel ? d.blocos.findIndex((x) => x.id === sel) : -1;
      const contato = d.blocos.findIndex((x) => x.tipo === "contato");
      const pos = i >= 0 ? i + 1 : contato >= 0 ? contato : d.blocos.length;
      d.blocos.splice(pos, 0, novo);
    });
    setSel(novo.id);
    setPainel("bloco");
    toast.success(`Seção "${NOMES_BLOCO[tipo] ?? tipo}" adicionada`);
    setTimeout(() => rolarPara(novo.id), 700);
  };

  const podeDesfazer = pilhas.hist > 0;
  const podeRefazer = pilhas.fut > 0;

  return (
    <div className="grid grid-cols-1 gap-3 lg:h-[calc(100dvh-7.5rem)] lg:grid-rows-[auto_minmax(0,1fr)]">
      {/* Barra do topo */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Link
          href={`/painel/sites/${siteId}`}
          onClick={(e) => {
            if (!salvo && !window.confirm("Você tem alterações não aplicadas. Sair mesmo assim?")) e.preventDefault();
          }}
          className="inline-flex h-9 items-center gap-1 rounded-lg px-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Voltar
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg leading-tight font-bold sm:text-xl">{doc.negocio?.nome || nome}</h1>
          <p className="text-xs" aria-live="polite">
            {salvo ? (
              <span className="text-muted-foreground">Tudo salvo</span>
            ) : (
              <span className="font-medium text-amber-600 dark:text-amber-400">● Alterações não aplicadas</span>
            )}
          </p>
        </div>
        <div className="hidden gap-0.5 rounded-lg bg-muted p-0.5 lg:flex" role="group" aria-label="Tamanho da prévia">
          {([
            ["desktop", Monitor, "Computador"],
            ["tablet", Tablet, "Tablet"],
            ["celular", Smartphone, "Celular"],
          ] as const).map(([d, Icone, rotulo]) => (
            <button
              key={d}
              type="button"
              title={rotulo}
              aria-label={rotulo}
              aria-pressed={dispositivo === d}
              onClick={() => setDispositivo(d)}
              className={cn("grid h-8 w-9 place-items-center rounded-md text-muted-foreground transition", dispositivo === d && "bg-card text-foreground shadow-sm")}
            >
              <Icone className="size-4" />
            </button>
          ))}
        </div>
      </div>

      {/* Celular: alterna entre editar e ver a prévia */}
      <div className="flex gap-1 rounded-xl bg-muted p-1 lg:hidden">
        {(["editar", "previa"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setVista(v)}
            className={cn("flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm", vista === v ? "bg-card font-medium shadow-sm" : "text-muted-foreground")}
          >
            {v === "editar" ? <Pencil className="size-4" /> : <Eye className="size-4" />}
            {v === "editar" ? "Editar" : "Ver prévia"}
          </button>
        ))}
      </div>

      <div className="grid min-h-0 grid-cols-1 gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
        {/* Painel */}
        <aside className={cn("flex min-h-0 flex-col rounded-2xl border bg-card lg:overflow-hidden", vista === "previa" && "max-lg:hidden")}>
          <div className="min-h-0 flex-1 overflow-x-hidden p-4 max-lg:pb-24 lg:overflow-y-auto">
            {painel === "inicio" && (
              <PainelInicio
                doc={doc}
                mudar={mudar}
                layouts={layouts}
                temas={temas}
                paletas={paletas}
                aoAbrirBloco={abrirBloco}
                aoIr={(p) => setPainel(p)}
                aoPedirIA={() => setIa({ blocoId: null })}
              />
            )}
            {painel === "bloco" && sel && (
              <PainelBloco key={sel} siteId={siteId} doc={doc} blocoId={sel} mudar={mudar} aoVoltar={voltar} aoPedirIA={() => setIa({ blocoId: sel })} />
            )}
            {painel === "bloco" && !sel && <CabecalhoPainel titulo="Bloco não encontrado" aoVoltar={voltar} />}
            {painel === "adicionar" && <PainelAdicionar aoVoltar={voltar} aoInserir={inserirBloco} />}
            {painel === "negocio" && <PainelNegocio doc={doc} mudar={mudar} aoVoltar={voltar} />}
            {painel === "fotos" && <PainelFotos siteId={siteId} doc={doc} mudar={mudar} aoVoltar={voltar} />}
            {painel === "cores" && <PainelCores doc={doc} mudar={mudar} coresSetor={coresSetor} aoVoltar={voltar} />}
            {painel === "animacoes" && <PainelAnimacoes doc={doc} mudar={mudar} aoVoltar={voltar} />}
          </div>
          <div className="flex gap-2 border-t bg-card p-3 max-lg:fixed max-lg:inset-x-0 max-lg:bottom-[calc(4.6rem+env(safe-area-inset-bottom))] max-lg:z-20 max-lg:mx-3 max-lg:rounded-2xl max-lg:border max-lg:shadow-lg md:max-lg:bottom-4 md:max-lg:left-[248px]">
            <Button variant="outline" size="icon-lg" className="size-10" onClick={desfazer} disabled={!podeDesfazer} title="Desfazer (Ctrl+Z)" aria-label="Desfazer">
              <Undo2 />
            </Button>
            <Button variant="outline" size="icon-lg" className="size-10" onClick={refazer} disabled={!podeRefazer} title="Refazer (Ctrl+Shift+Z)" aria-label="Refazer">
              <Redo2 />
            </Button>
            <Button className="h-10 flex-1 font-semibold" onClick={aplicar} disabled={aplicando || salvo}>
              {aplicando ? <Loader2 className="animate-spin" /> : <Check />}
              {aplicando ? "Aplicando…" : salvo ? "Tudo aplicado" : "Aplicar no site"}
            </Button>
          </div>
        </aside>

        {/* Prévia */}
        <div className={cn("min-h-0 rounded-2xl border bg-muted/60 p-2 sm:p-3", vista === "editar" && "max-lg:hidden")}>
          <div className={cn("relative mx-auto h-[calc(100dvh-16rem)] min-h-[420px] w-full overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-border transition-[max-width] duration-300 lg:h-full lg:min-h-0", LARGURA[dispositivo])}>
            {[0, 1].map((i) => (
              <iframe
                key={i}
                ref={frames[i]}
                title={i === ativo ? "Prévia do site" : "Prévia (carregando)"}
                aria-hidden={i !== ativo}
                tabIndex={i === ativo ? 0 : -1}
                className={cn("absolute inset-0 size-full border-0 bg-white", i === ativo ? "z-10 opacity-100" : "pointer-events-none z-0 opacity-0")}
              />
            ))}
            {carregando && (
              <div className="absolute inset-0 z-20 grid place-items-center bg-white text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin" /> Montando a prévia…
                </span>
              </div>
            )}
          </div>
          <p className="mt-2 hidden text-center text-xs text-muted-foreground lg:block">Clique num bloco da prévia para editar.</p>
        </div>
      </div>

      <PedirIA
        aberto={ia}
        aoFechar={() => setIa(null)}
        siteId={siteId}
        docRef={docRef}
        tipo={ia?.blocoId ? (doc.blocos.find((b) => b.id === ia.blocoId)?.tipo ?? null) : null}
        aoAplicar={(novo) => {
          mudar((d) => {
            Object.assign(d, normalizar(novo));
          });
          toast.success("Feito! Confira na prévia (dá para desfazer).");
        }}
      />
    </div>
  );
}

/** Garante as partes opcionais do documento (fotos, animações, negócio). */
function normalizar(d: SiteDoc): SiteDoc {
  return {
    ...d,
    tema: d.tema || "auto",
    cores: { primaria: d.cores?.primaria || "#0d9488", secundaria: d.cores?.secundaria || "#334155" },
    negocio: d.negocio ?? {},
    fotos: { capa: d.fotos?.capa ?? "", lista: d.fotos?.lista ?? [] },
    animacoes: d.animacoes ?? {},
    blocos: d.blocos ?? [],
  };
}

// ───────────────────────── Painel inicial ─────────────────────────

function PainelInicio({
  doc,
  mudar,
  layouts,
  temas,
  paletas,
  aoAbrirBloco,
  aoIr,
  aoPedirIA,
}: {
  doc: SiteDoc;
  mudar: Mudar;
  layouts: LayoutInfo[];
  temas: Record<string, string>;
  paletas: PaletaInfo[];
  aoAbrirBloco: (id: string) => void;
  aoIr: (p: Painel) => void;
  aoPedirIA: () => void;
}) {
  const listaTemas: [string, string, string][] = [
    ["auto", "Padrão", "linear-gradient(135deg,#fff 50%,#111 50%)"],
    ["claro", temas.claro ?? "Claro", "#ffffff"],
    ["creme", temas.creme ?? "Creme", "#fbf7f1"],
    ["escuro", temas.escuro ?? "Escuro", "#0c0d10"],
    ["grafite", temas.grafite ?? "Grafite", "#1a1d23"],
    ["marca", "Marca", doc.cores.primaria],
  ];
  const tema = doc.tema || "auto";
  const primaria = doc.cores.primaria.toLowerCase();

  return (
    <div className="grid grid-cols-1 gap-6 [&>*]:min-w-0">
      <BotaoIA titulo="Pedir para a IA" texto="Escreva o que quer mudar e ela faz no site." onClick={aoPedirIA} />

      <section className="grid grid-cols-1 gap-2">
        <Rotulo>Visual (layout)</Rotulo>
        <div className="grid grid-cols-2 gap-1.5 [&>*]:min-w-0">
          {layouts.map((l) => {
            const ativo = l.id === doc.layout;
            return (
              <button
                key={l.id}
                type="button"
                aria-pressed={ativo}
                onClick={() =>
                  !ativo &&
                  mudar((d) => {
                    d.layout = l.id;
                    // com paleta escolhida, o fundo da paleta continua; sem paleta, volta ao fundo do visual
                    if (!d.paleta) d.tema = "auto";
                  })
                }
                className={cn(
                  "grid gap-0.5 rounded-xl border p-2.5 text-left transition",
                  ativo ? "border-primary bg-primary/10" : "bg-background hover:border-primary/50",
                )}
              >
                <span className="flex items-center justify-between gap-1 text-sm font-semibold">
                  <span className="truncate">{l.nome}</span>
                  {ativo && <Check className="size-3.5 shrink-0 text-primary" aria-hidden />}
                </span>
                <span className="line-clamp-2 text-[0.72rem] leading-snug text-muted-foreground">{l.descricao}</span>
              </button>
            );
          })}
        </div>
        <Dica>Troca o desenho inteiro do site. Textos, fotos e cores continuam.</Dica>
      </section>

      {paletas.length > 0 && (
        <section className="grid grid-cols-1 gap-2">
          <div className="flex items-center justify-between gap-2">
            <Rotulo>Paletas prontas</Rotulo>
            {doc.paleta && (
              <button type="button" onClick={() => mudar((d) => { d.paleta = undefined; d.tema = "auto"; })} className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
                Tirar paleta
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-1.5 [&>*]:min-w-0">
            {paletas.map((p) => {
              const ativa = doc.paleta === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={ativa}
                  onClick={() =>
                    mudar((d) => {
                      d.paleta = p.id;
                      d.cores = { primaria: p.cores[0], secundaria: p.cores[1] };
                      d.tema = p.fundo.id;
                    })
                  }
                  className={cn("grid overflow-hidden rounded-xl border text-left transition", ativa ? "border-primary ring-2 ring-primary/30" : "hover:border-primary/50")}
                >
                  {/* amostra: fundo da paleta com as duas cores e o "Aa" na cor do texto */}
                  <span className="flex h-11 items-center gap-1.5 px-2.5" style={{ background: p.fundo.bg, color: p.fundo.tx }}>
                    <span className="text-base font-semibold leading-none">Aa</span>
                    <span className="ml-auto size-4 rounded-full ring-1 ring-black/10" style={{ background: p.cores[0] }} />
                    <span className="size-4 rounded-full ring-1 ring-black/10" style={{ background: p.cores[1] }} />
                  </span>
                  <span className="grid gap-0.5 bg-background px-2.5 py-1.5">
                    <span className="flex items-center gap-1 truncate text-[0.8rem] font-semibold">
                      {ativa && <Check className="size-3.5 shrink-0 text-primary" aria-hidden />}
                      <span className="truncate">{p.nome}</span>
                    </span>
                    <span className="truncate text-[0.7rem] text-muted-foreground">{p.clima} · {p.fonte}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <Dica>Muda de uma vez as cores, o fundo e as fontes. Dá para ajustar as cores depois.</Dica>
        </section>
      )}

      <section className="grid grid-cols-1 gap-2">
        <Rotulo>Tema</Rotulo>
        <div className="grid grid-cols-6 gap-1.5 [&>*]:min-w-0">
          {listaTemas.map(([k, n, bg]) => (
            <button
              key={k}
              type="button"
              aria-pressed={tema === k}
              onClick={() =>
                mudar((d) => {
                  d.tema = k;
                })
              }
              className="group grid justify-items-center gap-1 text-[0.7rem] text-muted-foreground"
            >
              <span
                className={cn("block aspect-square w-full max-w-10 rounded-lg ring-1 ring-border transition", tema === k ? "ring-2 ring-primary ring-offset-2 ring-offset-card" : "group-hover:ring-primary/50")}
                style={{ background: bg }}
              />
              <span className={cn("truncate", tema === k && "font-medium text-foreground")}>{n}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-2">
        <div className="flex items-center justify-between">
          <Rotulo>Cor de destaque</Rotulo>
          <code className="text-xs text-muted-foreground">{doc.cores.primaria}</code>
        </div>
        <div className="grid grid-cols-6 gap-2 [&>*]:min-w-0">
          {PALETA.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Cor ${c}`}
              aria-pressed={c === primaria}
              onClick={() =>
                mudar((d) => {
                  d.cores.primaria = c;
                })
              }
              className={cn("grid aspect-square place-items-center rounded-full ring-offset-2 ring-offset-card transition", c === primaria ? "ring-2 ring-foreground" : "hover:scale-110")}
              style={{ background: c }}
            >
              {c === primaria && <Check className="size-4 text-white" />}
            </button>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-2">
        <div className="flex items-center justify-between gap-2">
          <Rotulo>Blocos do site</Rotulo>
          <Button variant="outline" size="sm" onClick={() => aoIr("adicionar")}>
            <Plus /> Adicionar seção
          </Button>
        </div>
        <ol className="grid grid-cols-1 gap-1">
          {doc.blocos.map((b, i) => {
            const oculto = b.visivel === false;
            const mover = (dir: -1 | 1) =>
              mudar((d) => {
                const j = i + dir;
                if (j < 0 || j >= d.blocos.length) return;
                [d.blocos[i], d.blocos[j]] = [d.blocos[j], d.blocos[i]];
              });
            return (
              <li key={b.id} className={cn("flex items-center gap-0.5 rounded-lg border bg-background pr-1 transition hover:border-primary/40", oculto && "opacity-55")}>
                <button type="button" onClick={() => aoAbrirBloco(b.id)} className="flex min-w-0 flex-1 items-center gap-2 py-2 pl-2.5 text-left text-sm">
                  <span className="num w-6 shrink-0 text-xs text-muted-foreground">#{i + 1}</span>
                  <span className={cn("truncate font-medium", oculto && "line-through")}>{NOMES_BLOCO[b.tipo] ?? b.tipo}</span>
                </button>
                <Mini rotulo="Subir" onClick={() => mover(-1)} disabled={i === 0}>
                  <ChevronUp />
                </Mini>
                <Mini rotulo="Descer" onClick={() => mover(1)} disabled={i === doc.blocos.length - 1}>
                  <ChevronDown />
                </Mini>
                <Mini
                  rotulo={oculto ? "Mostrar" : "Ocultar"}
                  onClick={() =>
                    mudar((d) => {
                      d.blocos[i].visivel = oculto;
                    })
                  }
                >
                  {oculto ? <EyeOff /> : <Eye />}
                </Mini>
                <Mini
                  rotulo="Remover"
                  perigo
                  onClick={() => {
                    mudar((d) => {
                      d.blocos.splice(i, 1);
                    });
                    toast("Seção removida (dá para desfazer)");
                  }}
                >
                  <Trash2 />
                </Mini>
              </li>
            );
          })}
        </ol>
        <Dica>Toque num bloco (aqui ou na prévia) para editar.</Dica>
      </section>

      <section className="grid grid-cols-1 gap-2">
        <Rotulo>Site inteiro</Rotulo>
        <div className="grid grid-cols-2 gap-2">
          {([
            ["negocio", Building2, "Negócio", "nome, telefone, endereço"],
            ["fotos", ImageIcon, "Fotos", "capa e galeria"],
            ["cores", Palette, "Cores", "marca e ajuste fino"],
            ["animacoes", WandSparkles, "Animações", "entradas e efeitos"],
          ] as const).map(([p, Icone, t, s]) => (
            <button key={p} type="button" onClick={() => aoIr(p)} className="flex items-start gap-2 rounded-xl border bg-background p-3 text-left transition hover:border-primary/50 hover:bg-accent/40">
              <Icone className="mt-0.5 size-4 shrink-0 text-primary" />
              <span className="grid min-w-0">
                <b className="text-sm">{t}</b>
                <small className="text-xs text-muted-foreground">{s}</small>
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
