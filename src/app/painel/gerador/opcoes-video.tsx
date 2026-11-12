"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, Sparkles } from "lucide-react";
import { BIBLIOTECA_VOZES, CATEGORIAS_VOZ } from "@/lib/gerador/vozes";

// ───────── estilo dos personagens (só na animação desenhada) ─────────
const ESTILOS = [
  { id: "desenho", nome: "Desenho 2D", texto: "Cabeça redonda e rosto expressivo, como “Neste planeta…”" },
  { id: "recorte", nome: "Recorte de papel", texto: "Cabeça larga, gorro e cidadezinha na neve" },
  { id: "silhueta", nome: "Silhueta", texto: "Boneco de boné, suspense de “Você decide”" },
] as const;

export function EstiloPersonagens() {
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1.5 text-sm font-medium">Personagens <span className="font-normal text-muted-foreground">(na animação desenhada)</span></legend>
      <div className="grid grid-cols-3 gap-2">
        {ESTILOS.map((e) => (
          <label key={e.id} className="grid cursor-pointer gap-1.5 rounded-xl border p-1.5 text-xs has-[:checked]:border-signal has-[:checked]:bg-signal/5 has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50">
            <input type="radio" name="personagens" value={e.id} defaultChecked={e.id === "desenho"} className="sr-only" />
            <img src={`/api/gerador/amostra?e=${e.id}`} alt="" width={270} height={480} loading="lazy" className="aspect-[9/16] w-full rounded-lg bg-muted object-cover" />
            <span className="px-0.5 font-semibold">{e.nome}</span>
            <span className="px-0.5 pb-0.5 leading-snug text-muted-foreground">{e.texto}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

// ───────── biblioteca de vozes grátis ─────────
type Minha = { id: string; nome: string };
const EVENTO_VOZ = "enova:escolher-voz";

export function EscolherVoz({ minhas }: { minhas: Minha[] }) {
  const cats = [...(minhas.length ? ["Minhas vozes"] : []), ...CATEGORIAS_VOZ, "Outras"] as string[];
  const [cat, setCat] = useState<string>("Narradores");
  const [tocando, setTocando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);

  // as receitas prontas escolhem a voz por evento: muda a aba para a voz aparecer marcada
  useEffect(() => {
    const f = (ev: Event) => {
      const id = (ev as CustomEvent<string>).detail;
      const v = BIBLIOTECA_VOZES.find((b) => `bib:${b.id}` === id);
      if (v) setCat(v.categoria);
    };
    window.addEventListener(EVENTO_VOZ, f);
    return () => window.removeEventListener(EVENTO_VOZ, f);
  }, []);
  useEffect(() => () => audio.current?.pause(), []);

  function ouvir(id: string) {
    setErro(null);
    if (tocando === id) { audio.current?.pause(); setTocando(null); return; }
    audio.current?.pause();
    const a = new Audio(`/api/gerador/voz-previa?v=${encodeURIComponent(id)}`);
    audio.current = a;
    setTocando(id);
    a.onended = () => setTocando(null);
    a.onerror = () => { setTocando(null); setErro("Não consegui tocar essa voz agora. Tente de novo em instantes."); };
    a.play().catch(() => setTocando(null));
  }

  const item = (valor: string, nome: string, descricao: string, categoria: string, previa: boolean) => (
    <div key={valor} className={`${categoria === cat ? "flex" : "hidden"} items-center gap-2 rounded-lg border px-2.5 py-2 has-[:checked]:border-signal has-[:checked]:bg-signal/5`}>
      <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-2.5 text-sm">
        <input type="radio" name="voz" value={valor} defaultChecked={valor === "bib:francisca"} className="mt-0.5 size-4 shrink-0 accent-[var(--primary)]" />
        <span className="min-w-0"><span className="font-medium">{nome}</span><span className="block text-xs text-muted-foreground">{descricao}</span></span>
      </label>
      {previa && (
        <button type="button" onClick={() => ouvir(valor)} aria-label={tocando === valor ? `Parar ${nome}` : `Ouvir ${nome}`}
          className="grid size-10 shrink-0 place-items-center rounded-full border hover:bg-muted sm:size-9">
          {tocando === valor ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
        </button>
      )}
    </div>
  );

  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1.5 text-sm font-medium">Voz da narração <span className="font-normal text-muted-foreground">({BIBLIOTECA_VOZES.length} vozes grátis)</span></legend>
      <div role="tablist" aria-label="Tipo de voz" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {cats.map((c) => (
          <button key={c} type="button" role="tab" aria-selected={c === cat} onClick={() => setCat(c)}
            className={`h-9 shrink-0 rounded-full border px-3 text-xs font-medium ${c === cat ? "border-signal bg-signal/10 text-foreground" : "text-muted-foreground hover:bg-muted"}`}>
            {c}
          </button>
        ))}
      </div>
      <div className="grid max-h-72 gap-1.5 overflow-y-auto pr-0.5">
        {minhas.map((m) => item(`minha:${m.id}`, m.nome, "Sua voz clonada (tela Minha voz)", "Minhas vozes", false))}
        {BIBLIOTECA_VOZES.map((v) => item(`bib:${v.id}`, v.nome, `${v.descricao} · ${v.genero}`, v.categoria, true))}
        {item("", "Melhor voz da Central", "A melhor voz ligada na Central de IA (pode ser paga)", "Outras", false)}
      </div>
      {erro && <p role="alert" className="text-xs text-destructive">{erro}</p>}
    </fieldset>
  );
}

// ───────── receitas prontas ─────────
type Receita = {
  titulo: string; resumo: string; dicas: string[];
  campos: { tema: string; formato: string; estilo: "animacao" | "fotos"; personagens: "desenho" | "recorte" | "silhueta"; duracao: number; voz: string };
};

const RECEITAS: Receita[] = [
  {
    titulo: "“Neste planeta…” com personagens de desenho",
    resumo: "O mesmo caminho do vídeo das gêmeas no prédio.",
    dicas: [
      "No tema, escreva a regra do mundo em uma frase e quem são os 2 personagens.",
      "Deixe 45 a 60 s: dá tempo de mostrar a regra, as duas vidas e a virada.",
      "Antes de produzir, revise o roteiro: troque expressões e peça close nas reações.",
    ],
    campos: { tema: "Neste planeta, todo mundo mora no mesmo prédio e o andar mostra quanto tempo livre você tem na semana. Quem trabalha demais vai descendo; quem descansa sobe. Duas irmãs gêmeas fazem escolhas diferentes.", formato: "mundo-absurdo", estilo: "animacao", personagens: "desenho", duracao: 50, voz: "bib:contadora" },
  },
  {
    titulo: "Recorte de papel: comédia de cidade pequena",
    resumo: "Personagens de papel, neve e humor rápido.",
    dicas: [
      "Funciona melhor com 3 personagens bem diferentes (uma criança, um adulto, um idoso).",
      "Peça situações absurdas do dia a dia e falas curtas, com reação em close.",
      "Vozes animadas (Curiosidades, Personagem de desenho) combinam com esse estilo.",
    ],
    campos: { tema: "Na cidadezinha gelada, três amigos descobrem que o boneco de neve da praça aparece cada manhã num lugar diferente, e ninguém viu quem mudou ele de lugar.", formato: "historia", estilo: "animacao", personagens: "recorte", duracao: 45, voz: "bib:curiosidades" },
  },
  {
    titulo: "Notícia com números",
    resumo: "Infográfico com contadores, valores riscados e calendário.",
    dicas: [
      "Coloque no tema os números exatos e a fonte; o diretor não inventa dados.",
      "Use a voz Repórter rápido e 35 a 45 s.",
    ],
    campos: { tema: "Notícia: a partir de fevereiro, a meta para monetizar Shorts dobra de 10 para 20 milhões de views em 90 dias. Fonte: Central de Ajuda do YouTube.", formato: "noticia", estilo: "animacao", personagens: "silhueta", duracao: 40, voz: "bib:reporter" },
  },
  {
    titulo: "“Você decide” de suspense",
    resumo: "Silhueta, noite e escolha A ou B no fim.",
    dicas: ["Descreva o lugar estranho e a ameaça; o final abre a votação sozinho.", "A voz Narrador de suspense deixa o clima mais tenso."],
    campos: { tema: "Você entra num elevador às 3 da manhã e ele começa a parar em andares que não existem.", formato: "voce-decide", estilo: "animacao", personagens: "silhueta", duracao: 60, voz: "bib:suspense" },
  },
  {
    titulo: "Série diária com votação",
    resumo: "Episódios com contador “faltam X dias” e medidor de progresso.",
    dicas: ["Diga no tema qual é o dia, o resultado da última votação e o desafio de hoje.", "Repita o mesmo elenco em todos os episódios."],
    campos: { tema: "Dia 4 de 30: vocês escolheram que o Léo corte o cabelo, só que ele tem 12 reais na conta.", formato: "serie-diaria", estilo: "animacao", personagens: "desenho", duracao: 60, voz: "bib:curiosidades" },
  },
];

function aplicar(r: Receita) {
  const f = document.getElementById("form-novo-video") as HTMLFormElement | null;
  if (!f) return;
  const valor = (nome: string, v: string) => {
    const el = f.elements.namedItem(nome) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | RadioNodeList | null;
    if (!el) return;
    if (el instanceof RadioNodeList) { for (const r of Array.from(el) as HTMLInputElement[]) r.checked = r.value === v; return; }
    el.value = v;
    el.dispatchEvent(new Event("input", { bubbles: true }));
  };
  valor("tema", r.campos.tema);
  valor("formato", r.campos.formato);
  valor("estilo", r.campos.estilo);
  valor("personagens", r.campos.personagens);
  valor("duracaoAlvo", String(r.campos.duracao));
  valor("voz", r.campos.voz);
  window.dispatchEvent(new CustomEvent(EVENTO_VOZ, { detail: r.campos.voz }));
  const tema = f.elements.namedItem("tema") as HTMLTextAreaElement | null;
  tema?.scrollIntoView({ behavior: "smooth", block: "center" });
  tema?.focus({ preventScroll: true });
}

export function Receitas() {
  return (
    <details className="group rounded-2xl border bg-card p-4">
      <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
        <Sparkles className="size-4 text-signal" aria-hidden /> Receitas prontas: como chegar em cada resultado
      </summary>
      <ul className="mt-3 grid gap-2.5">
        {RECEITAS.map((r) => (
          <li key={r.titulo} className="grid gap-2 rounded-xl border p-3">
            <div>
              <p className="text-sm font-semibold">{r.titulo}</p>
              <p className="text-xs text-muted-foreground">{r.resumo}</p>
            </div>
            <ul className="grid list-disc gap-1 pl-4 text-xs text-muted-foreground">
              {r.dicas.map((d) => <li key={d}>{d}</li>)}
            </ul>
            <button type="button" onClick={() => aplicar(r)} className="h-10 rounded-lg border px-3 text-sm font-medium hover:bg-muted sm:h-9 sm:justify-self-start">
              Usar esta receita
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}
