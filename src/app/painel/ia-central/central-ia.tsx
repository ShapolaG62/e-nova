"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, ExternalLink, KeyRound, Loader2, PlugZap, Plus, RotateCcw, Search, SlidersHorizontal, Trash2 } from "lucide-react";
import { CATALOGO, CREDENCIAIS } from "@/lib/ia-hub/catalogo";
import { CAPACIDADES, type Capacidade, type Credencial, type ItemCatalogo } from "@/lib/ia-hub/tipos";
import type { PreferenciasIA } from "@/lib/ia-hub/config";
import { limparSaudeAction, salvarChavesAction, salvarPreferenciasAction, testarCredencialAction } from "@/app/actions/ia-hub";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { BarraNota, CadeiaTentativas, Custo, nomeCredencial, resumoRevezamento, rotuloRota, type TentativaView } from "./comum";

export type ExecucaoView = { id: number; capacidade: string; ok: boolean; tentativas: TentativaView[]; criadoEm: string };
type Saude = Record<string, { falhas: number; ate: number; ultimoErro?: string; emCastigo: boolean }>;

type Estado =
  | { tipo: "pronta" }
  | { tipo: "sem-chave"; credencial: string }
  | { tipo: "pausa"; erro?: string }
  | { tipo: "desligada" }
  | { tipo: "sem-api" }
  | { tipo: "framework" };

const quando = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const capNome = (id: string) => CAPACIDADES.find((c) => c.id === id)?.nome ?? id;

/** Mesma ordem do roteador (ordem manual → modo → nota), incluindo os desligados para poder religar. */
function ordenar(cap: Capacidade, prefs: PreferenciasIA): ItemCatalogo[] {
  const itens = CATALOGO.filter((i) => i.capacidades[cap] && (i.status ?? "api") === "api");
  const manual = prefs.ordem[cap] ?? [];
  return [...itens].sort((a, b) => {
    const ia = manual.indexOf(a.id), ib = manual.indexOf(b.id);
    if (ia !== -1 || ib !== -1) return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    if (prefs.modo === "economia" && a.custo !== b.custo) return a.custo - b.custo;
    return (b.capacidades[cap] ?? 0) - (a.capacidades[cap] ?? 0);
  });
}

function estadoDe(item: ItemCatalogo, prefs: PreferenciasIA, configuradas: Record<string, string>, saude: Saude): Estado {
  if (item.status === "sem-api") return { tipo: "sem-api" };
  if (item.status === "framework") return { tipo: "framework" };
  if (prefs.desligados.includes(item.id)) return { tipo: "desligada" };
  const comChave = item.rotas.filter((r) => configuradas[r.provedor]);
  if (!comChave.length) return { tipo: "sem-chave", credencial: item.rotas[0]?.provedor ?? "" };
  const estados = comChave.map((r) => saude[`${item.id}:${r.via}:${r.provedor}`]);
  if (estados.every((s) => s?.emCastigo)) return { tipo: "pausa", erro: estados.find((s) => s?.ultimoErro)?.ultimoErro };
  return { tipo: "pronta" };
}

export function CentralIA({ prefs: prefs0, configuradas, campos, listas, saude, execucoes }: {
  prefs: PreferenciasIA;
  configuradas: Record<string, string>;
  campos: Record<string, Record<string, string>>;
  listas: Record<string, string[]>;
  saude: Saude;
  execucoes: ExecucaoView[];
}) {
  const [prefs, setPrefs] = useState(prefs0);
  const [aba, setAba] = useState<string>("filas");
  const [cap, setCap] = useState<Capacidade>("texto");
  const [foco, setFoco] = useState<string | null>(null);
  const [salvando, startSalvar] = useTransition();

  const prontas = useMemo(() => {
    const out: Partial<Record<Capacidade, number>> = {};
    for (const c of CAPACIDADES) out[c.id] = ordenar(c.id, prefs).filter((i) => estadoDe(i, prefs, configuradas, saude).tipo === "pronta").length;
    return out;
  }, [prefs, configuradas, saude]);
  const conectadas = CREDENCIAIS.filter((c) => configuradas[c.id] && c.id !== "ollama").length;

  function salvar(novo: PreferenciasIA, msg?: string) {
    const antes = prefs;
    setPrefs(novo);
    startSalvar(async () => {
      const r = await salvarPreferenciasAction(novo);
      if (!r.ok) {
        setPrefs(antes);
        toast.error(r.message ?? "Não deu para salvar.");
      } else if (msg) toast.success(msg);
    });
  }

  function conectar(credId: string) {
    setFoco(credId);
    setAba("chaves");
  }

  return (
    <div className="grid gap-5">
      <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="grid gap-1.5">
          <p className="text-sm font-medium">Quem vai primeiro na fila?</p>
          <div role="radiogroup" aria-label="Modo da fila" className="flex gap-1 rounded-lg bg-muted p-1">
            {([
              ["qualidade", "Melhor qualidade primeiro"],
              ["economia", "Mais barato primeiro"],
            ] as const).map(([m, rotulo]) => (
              <button
                key={m}
                role="radio"
                aria-checked={prefs.modo === m}
                onClick={() => prefs.modo !== m && salvar({ ...prefs, modo: m }, m === "economia" ? "Agora as mais baratas vão primeiro." : "Agora as melhores vão primeiro.")}
                className={cn(
                  "flex-1 rounded-md px-3 py-1.5 text-sm transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                  prefs.modo === m ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {rotulo}
              </button>
            ))}
          </div>
        </div>
        <dl className="flex gap-5 text-sm">
          <div>
            <dt className="text-muted-foreground">Chaves conectadas</dt>
            <dd className="num text-xl font-semibold">{conectadas}<span className="text-sm font-normal text-muted-foreground"> de {CREDENCIAIS.length - 1}</span></dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Funções com IA pronta</dt>
            <dd className="num text-xl font-semibold">{CAPACIDADES.filter((c) => prontas[c.id]).length}<span className="text-sm font-normal text-muted-foreground"> de {CAPACIDADES.length}</span></dd>
          </div>
        </dl>
      </section>

      <Tabs value={aba} onValueChange={(v) => setAba(String(v))}>
        <TabsList className="w-full sm:w-fit">
          <TabsTrigger value="filas" className="px-3">Filas</TabsTrigger>
          <TabsTrigger value="chaves" className="px-3">Chaves</TabsTrigger>
          <TabsTrigger value="historico" className="px-3">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="filas" className="pt-2">
          <div className="grid gap-4 lg:grid-cols-[230px_minmax(0,1fr)]">
            <nav aria-label="Funções" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0">
              {CAPACIDADES.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCap(c.id)}
                  aria-current={cap === c.id ? "true" : undefined}
                  className={cn(
                    "flex shrink-0 items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none lg:border-transparent",
                    cap === c.id ? "border-ink bg-ink text-white lg:border-ink" : "bg-card hover:bg-muted lg:bg-transparent",
                  )}
                >
                  <span className="font-medium whitespace-nowrap">{c.nome}</span>
                  <span
                    className={cn(
                      "num rounded-full px-1.5 text-xs",
                      prontas[c.id] ? (cap === c.id ? "bg-white/15" : "bg-signal/15 text-signal") : cap === c.id ? "text-white/60" : "text-muted-foreground",
                    )}
                    title={`${prontas[c.id]} IA(s) prontas`}
                  >
                    {prontas[c.id]}
                  </span>
                </button>
              ))}
            </nav>

            <Fila
              cap={cap}
              prefs={prefs}
              configuradas={configuradas}
              saude={saude}
              salvando={salvando}
              onSalvar={salvar}
              onConectar={conectar}
            />
          </div>
        </TabsContent>

        <TabsContent value="chaves" className="pt-2">
          <Chaves configuradas={configuradas} campos={campos} listas={listas} foco={foco} onFocoUsado={() => setFoco(null)} />
        </TabsContent>

        <TabsContent value="historico" className="pt-2">
          <Historico execucoes={execucoes} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ───────── Fila de uma função ─────────
function Fila({ cap, prefs, configuradas, saude, salvando, onSalvar, onConectar }: {
  cap: Capacidade;
  prefs: PreferenciasIA;
  configuradas: Record<string, string>;
  saude: Saude;
  salvando: boolean;
  onSalvar: (p: PreferenciasIA, msg?: string) => void;
  onConectar: (credId: string) => void;
}) {
  const info = CAPACIDADES.find((c) => c.id === cap)!;
  const lista = ordenar(cap, prefs);
  const fora = CATALOGO.filter((i) => i.capacidades[cap] && (i.status ?? "api") !== "api");
  const manual = !!prefs.ordem[cap]?.length;
  const ativos = lista.filter((i) => !prefs.desligados.includes(i.id));
  const primeiro = ativos.find((i) => estadoDe(i, prefs, configuradas, saude).tipo === "pronta");

  function mover(idx: number, delta: number) {
    const ids = lista.map((i) => i.id);
    const j = idx + delta;
    if (j < 0 || j >= ids.length) return;
    [ids[idx], ids[j]] = [ids[j], ids[idx]];
    onSalvar({ ...prefs, ordem: { ...prefs.ordem, [cap]: ids } });
  }

  return (
    <section aria-labelledby="fila-titulo" className="min-w-0 rounded-2xl border bg-card">
      <header className="flex flex-wrap items-start justify-between gap-2 border-b p-4">
        <div className="min-w-0">
          <h2 id="fila-titulo" className="text-lg font-semibold">{info.nome}</h2>
          <p className="text-sm text-muted-foreground">{info.descricao}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {primeiro ? <>Agora quem trabalha primeiro é <strong className="text-foreground">{primeiro.nome.split(" (")[0]}</strong>.</> : "Nenhuma IA desta função está pronta: conecte uma chave abaixo."}
            {salvando && <Loader2 className="ml-1.5 inline size-3 animate-spin" aria-label="Salvando" />}
          </p>
        </div>
        {manual && (
          <Button variant="outline" size="sm" onClick={() => { const o = { ...prefs.ordem }; delete o[cap]; onSalvar({ ...prefs, ordem: o }, "Ordem automática de volta."); }}>
            <RotateCcw data-icon="inline-start" /> Voltar à ordem automática
          </Button>
        )}
      </header>

      {lista.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted-foreground">Nenhuma IA com API pública faz isso ainda.</p>
      ) : (
        <ol className="relative">
          {lista.map((item, idx) => {
            const est = estadoDe(item, prefs, configuradas, saude);
            const pos = ativos.indexOf(item);
            return (
              <LinhaFila
                key={item.id}
                item={item}
                cap={cap}
                pos={pos === -1 ? null : pos + 1}
                primeiro={primeiro?.id === item.id}
                ultimo={idx === lista.length - 1}
                estado={est}
                configuradas={configuradas}
                modelo={prefs.modelos[item.id] ?? ""}
                podeSubir={idx > 0}
                podeDescer={idx < lista.length - 1}
                onSubir={() => mover(idx, -1)}
                onDescer={() => mover(idx, 1)}
                onLigar={(on) =>
                  onSalvar({ ...prefs, desligados: on ? prefs.desligados.filter((x) => x !== item.id) : [...prefs.desligados, item.id] }, on ? `${item.nome.split(" (")[0]} voltou para a fila.` : `${item.nome.split(" (")[0]} desligada.`)
                }
                onModelo={(m) => {
                  const modelos = { ...prefs.modelos };
                  if (m.trim()) modelos[item.id] = m.trim();
                  else delete modelos[item.id];
                  if ((prefs.modelos[item.id] ?? "") !== (modelos[item.id] ?? "")) onSalvar({ ...prefs, modelos }, "Modelo salvo.");
                }}
                onConectar={onConectar}
              />
            );
          })}
        </ol>
      )}

      {fora.length > 0 && (
        <div className="border-t p-4">
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">Fora da fila</h3>
          <ul className="grid gap-2">
            {fora.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-muted/50 px-3 py-2 text-sm">
                <span className="font-medium">{item.nome}</span>
                <span className="text-xs text-muted-foreground">{item.empresa}</span>
                <EstadoBadge estado={estadoDe(item, prefs, configuradas, saude)} />
                {item.nota && <p className="w-full text-xs text-muted-foreground">{item.nota}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function EstadoBadge({ estado }: { estado: Estado }) {
  switch (estado.tipo) {
    case "pronta":
      return <Badge className="bg-emerald-600/12 text-emerald-800 dark:text-emerald-300">Pronta</Badge>;
    case "sem-chave":
      return <Badge variant="outline" className="text-muted-foreground">Sem chave</Badge>;
    case "pausa":
      return <Badge className="bg-amber-500/15 text-amber-800 dark:text-amber-300">Em pausa</Badge>;
    case "desligada":
      return <Badge variant="secondary">Desligada</Badge>;
    case "sem-api":
      return <Badge variant="secondary">Sem API pública</Badge>;
    case "framework":
      return <Badge variant="secondary">Framework – substituído pela Equipe de agentes</Badge>;
  }
}

function LinhaFila({ item, cap, pos, primeiro, ultimo, estado, configuradas, modelo, podeSubir, podeDescer, onSubir, onDescer, onLigar, onModelo, onConectar }: {
  item: ItemCatalogo;
  cap: Capacidade;
  pos: number | null;
  primeiro: boolean;
  ultimo: boolean;
  estado: Estado;
  configuradas: Record<string, string>;
  modelo: string;
  podeSubir: boolean;
  podeDescer: boolean;
  onSubir: () => void;
  onDescer: () => void;
  onLigar: (on: boolean) => void;
  onModelo: (m: string) => void;
  onConectar: (credId: string) => void;
}) {
  const [ajustes, setAjustes] = useState(false);
  const [tentando, startTentar] = useTransition();
  const ligada = estado.tipo !== "desligada";
  const nomeCurto = item.nome.split(" (")[0];
  const rotas = item.rotas.filter((r, i, a) => a.findIndex((x) => x.provedor === r.provedor && x.via === r.via) === i);

  return (
    <li className={cn("relative grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-3 px-4 py-3.5", !ultimo && "border-b", !ligada && "opacity-60")}>
      {/* trilho do revezamento: liga as posições da fila */}
      {!ultimo && <span aria-hidden className="absolute top-12 bottom-0 left-[2.1rem] w-px bg-border" />}
      <span
        className={cn(
          "num relative z-[1] flex size-9 items-center justify-center rounded-full border text-sm font-semibold",
          primeiro ? "border-signal bg-signal text-white" : estado.tipo === "pronta" ? "border-signal/50 bg-card text-signal" : "bg-card text-muted-foreground",
        )}
        aria-label={pos ? `Posição ${pos}` : "Fora da fila"}
      >
        {pos ?? "–"}
      </span>

      <div className="grid min-w-0 gap-1.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-medium">{item.nome}</span>
          <span className="text-xs text-muted-foreground">{item.empresa}</span>
          <EstadoBadge estado={estado} />
          {primeiro && <span className="text-xs font-medium text-signal">trabalha primeiro</span>}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <BarraNota nota={item.capacidades[cap] ?? 0} />
          <Custo custo={item.custo} />
          <span className="flex flex-wrap gap-1">
            {rotas.map((r, i) => (
              <span
                key={i}
                title={`Usa a chave de ${nomeCredencial(r.provedor)}`}
                className={cn("rounded-md border px-1.5 py-0.5 text-[11px]", configuradas[r.provedor] ? "border-signal/40 text-foreground" : "border-dashed text-muted-foreground")}
              >
                {rotuloRota(r)}
              </span>
            ))}
          </span>
        </div>

        {item.nota && <p className="text-xs text-muted-foreground">{item.nota}</p>}

        {estado.tipo === "pausa" && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-900 dark:text-amber-200">
            <span className="min-w-0 flex-1 break-words">Último erro: {estado.erro ?? "falhou várias vezes seguidas"}</span>
            <Button
              size="xs"
              variant="outline"
              disabled={tentando}
              onClick={() => startTentar(async () => { const r = await limparSaudeAction(`${item.id}:`); toast[r.ok ? "success" : "error"](r.message ?? ""); })}
            >
              <RotateCcw data-icon="inline-start" /> Tentar de novo
            </Button>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          {estado.tipo === "sem-chave" && (
            <Button size="sm" onClick={() => onConectar(estado.credencial)}>
              <PlugZap data-icon="inline-start" /> Conectar
            </Button>
          )}
          <Button size="icon-sm" variant="ghost" aria-label={`Subir ${nomeCurto}`} disabled={!podeSubir} onClick={onSubir}>
            <ArrowUp />
          </Button>
          <Button size="icon-sm" variant="ghost" aria-label={`Descer ${nomeCurto}`} disabled={!podeDescer} onClick={onDescer}>
            <ArrowDown />
          </Button>
          <Button size="sm" variant="ghost" aria-expanded={ajustes} onClick={() => setAjustes((v) => !v)}>
            <SlidersHorizontal data-icon="inline-start" /> Modelo{modelo ? " (trocado)" : ""}
          </Button>
          <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            {ligada ? "Ligada" : "Desligada"}
            <Switch checked={ligada} onCheckedChange={(v) => onLigar(!!v)} aria-label={`Usar ${nomeCurto}`} />
          </label>
        </div>

        {ajustes && (
          <form
            className="flex flex-col gap-1.5 rounded-lg bg-muted/50 p-2.5 sm:flex-row sm:items-end"
            onSubmit={(e) => { e.preventDefault(); onModelo(String(new FormData(e.currentTarget).get("modelo") ?? "")); }}
          >
            <div className="grid flex-1 gap-1">
              <Label htmlFor={`modelo-${item.id}`} className="text-xs">Modelo usado na 1ª rota (deixe vazio para o padrão)</Label>
              <Input id={`modelo-${item.id}`} name="modelo" defaultValue={modelo} placeholder={item.rotas[0]?.modelo ?? "padrão do serviço"} className="h-9 font-mono text-xs" />
            </div>
            <Button type="submit" size="lg" variant="outline">Salvar modelo</Button>
          </form>
        )}
      </div>
    </li>
  );
}

// ───────── Chaves ─────────
function Chaves({ configuradas, campos, listas, foco, onFocoUsado }: { configuradas: Record<string, string>; campos: Record<string, Record<string, string>>; listas: Record<string, string[]>; foco: string | null; onFocoUsado: () => void }) {
  const [busca, setBusca] = useState("");
  const [soConectadas, setSoConectadas] = useState(false);
  const q = busca.trim().toLowerCase();
  const lista = CREDENCIAIS.filter((c) => {
    if (soConectadas && !configuradas[c.id]) return false;
    if (!q) return true;
    return c.nome.toLowerCase().includes(q) || libera(c.id).some((l) => l.itens.some((i) => i.toLowerCase().includes(q)));
  });

  useEffect(() => {
    if (!foco) return;
    const t = setTimeout(() => {
      const el = document.getElementById(`cred-${foco}`);
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
      el?.querySelector<HTMLInputElement>("input")?.focus({ preventScroll: true });
      onFocoUsado();
    }, 80);
    return () => clearTimeout(t);
  }, [foco, onFocoUsado]);

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar serviço ou IA (ex.: fal, Kling, voz)" className="h-10 pl-8 sm:h-9" aria-label="Buscar credencial" />
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Switch checked={soConectadas} onCheckedChange={(v) => setSoConectadas(!!v)} /> Só as conectadas
        </label>
      </div>
      {lista.length === 0 ? (
        <p className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          {soConectadas && !q ? "Nenhuma chave conectada ainda. Desligue o filtro e cole a primeira — fal.ai sozinha já libera imagem, vídeo e música." : "Nada encontrado com essa busca."}
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {lista.map((c) => (
            <CartaoCredencial key={`${c.id}:${JSON.stringify(campos[c.id] ?? {})}:${!!configuradas[c.id]}:${(listas[c.id] ?? []).join()}`} cred={c} conectada={!!configuradas[c.id]} valores={campos[c.id] ?? {}} chaves={listas[c.id] ?? []} destaque={foco === c.id} />
          ))}
        </div>
      )}
    </div>
  );
}

/** O que a credencial destrava, agrupado por função. */
function libera(credId: string) {
  const out: { cap: string; itens: string[] }[] = [];
  for (const c of CAPACIDADES) {
    const itens = CATALOGO.filter((i) => i.capacidades[c.id] && i.rotas.some((r) => r.provedor === credId)).map((i) => i.nome.split(" (")[0]);
    if (itens.length) out.push({ cap: c.nome, itens });
  }
  return out;
}

function CartaoCredencial({ cred, conectada, valores, chaves, destaque }: { cred: Credencial; conectada: boolean; valores: Record<string, string>; chaves: string[]; destaque: boolean }) {
  const [form, setForm] = useState<Record<string, string>>(() => Object.fromEntries(cred.campos.map((f) => [f.id, valores[f.id] ?? ""])));
  const [pend, start] = useTransition();
  const [acao, setAcao] = useState<"salvar" | "testar" | "remover" | null>(null);
  const [resultado, setResultado] = useState<{ ok: boolean; msg: string } | null>(null);
  const destrava = libera(cred.id);
  const local = cred.id === "ollama";
  const mudou = cred.campos.some((f) => (form[f.id] ?? "") !== (valores[f.id] ?? ""));

  const rodar = (qual: "salvar" | "testar" | "remover", fn: () => Promise<{ ok?: boolean; message?: string }>) => {
    setAcao(qual);
    setResultado(null);
    start(async () => {
      const r = await fn();
      if (qual === "testar") setResultado({ ok: !!r.ok, msg: r.message ?? "" });
      else toast[r.ok ? "success" : "error"](r.message ?? (r.ok ? "Pronto." : "Não deu certo."));
      setAcao(null);
    });
  };

  return (
    <article
      id={`cred-${cred.id}`}
      className={cn("flex scroll-mt-24 flex-col gap-3 rounded-2xl border bg-card p-4", conectada && "border-signal/40", destaque && "ring-3 ring-signal/40")}
    >
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold">{cred.nome}</h3>
          {destrava.length > 0 && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Libera {destrava.map((d) => `${d.cap.charAt(0).toLowerCase() + d.cap.slice(1)} (${d.itens.join(", ")})`).join("; ")}
            </p>
          )}
        </div>
        {local ? (
          <Badge variant="secondary">No computador</Badge>
        ) : conectada ? (
          <Badge className="bg-emerald-600/12 text-emerald-800 dark:text-emerald-300"><KeyRound /> Conectada</Badge>
        ) : (
          <Badge variant="outline" className="text-muted-foreground">Sem chave</Badge>
        )}
      </header>

      {cred.observacao && <p className="rounded-lg bg-muted/60 px-2.5 py-1.5 text-xs">{cred.observacao}</p>}

      {!local && (
        <form
          className="grid gap-2.5"
          onSubmit={(e) => { e.preventDefault(); rodar("salvar", () => salvarChavesAction(cred.id, form)); }}
        >
          {cred.campos.map((f) => (
            <div key={f.id} className="grid gap-1">
              <Label htmlFor={`${cred.id}-${f.id}`} className="text-xs">{f.rotulo}</Label>
              <Input
                id={`${cred.id}-${f.id}`}
                type={f.segredo ? "password" : "text"}
                autoComplete="off"
                spellCheck={false}
                value={form[f.id] ?? ""}
                onFocus={(e) => f.segredo && /^••/.test(e.target.value) && e.target.select()}
                onChange={(e) => setForm((s) => ({ ...s, [f.id]: e.target.value }))}
                placeholder={f.segredo && conectada ? "mantém a chave atual" : f.dica ?? "cole aqui"}
                className="h-10 font-mono text-xs sm:h-9"
              />
              {f.dica && <p className="text-[11px] text-muted-foreground">{f.dica}</p>}
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-1.5">
            <Button type="submit" disabled={pend || !mudou}>
              {acao === "salvar" && <Loader2 data-icon="inline-start" className="animate-spin" />} Salvar
            </Button>
            <Button type="button" variant="outline" disabled={pend || !conectada || mudou} onClick={() => rodar("testar", () => testarCredencialAction(cred.id, 0))} title={mudou ? "Salve antes de testar" : undefined}>
              {acao === "testar" ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <PlugZap data-icon="inline-start" />} Testar
            </Button>
            {conectada && (
              <Button type="button" variant="ghost" className="text-destructive" disabled={pend} onClick={() => confirm(chaves.length > 1 ? `Remover a chave 1 de ${cred.nome}? A chave 2 passa a ser a primeira.` : `Remover a chave de ${cred.nome}?`) && rodar("remover", () => salvarChavesAction(cred.id, null, 0))}>
                <Trash2 data-icon="inline-start" /> Remover
              </Button>
            )}
            <a href={cred.ondePegar} target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex items-center gap-1 text-xs text-signal underline-offset-4 hover:underline">
              Onde pegar a chave <ExternalLink className="size-3" />
            </a>
          </div>
        </form>
      )}

      {!local && chaves.length > 0 && cred.campos.some((f) => f.segredo) && <ChavesExtras cred={cred} chaves={chaves} />}

      {local && (
        <div className="flex flex-wrap items-center gap-1.5">
          <Button type="button" variant="outline" disabled={pend} onClick={() => rodar("testar", () => testarCredencialAction(cred.id))}>
            {acao === "testar" ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <PlugZap data-icon="inline-start" />} Testar a IA local
          </Button>
          <a href={cred.ondePegar} target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex items-center gap-1 text-xs text-signal underline-offset-4 hover:underline">
            Instalar o Ollama <ExternalLink className="size-3" />
          </a>
        </div>
      )}

      {resultado && (
        <p role="status" className={cn("rounded-lg px-2.5 py-1.5 text-xs break-words", resultado.ok ? "bg-emerald-600/10 text-emerald-900 dark:text-emerald-200" : "bg-destructive/10 text-destructive")}>
          {resultado.msg}
        </p>
      )}
    </article>
  );
}

// ───────── Histórico ─────────
function Historico({ execucoes }: { execucoes: ExecucaoView[] }) {
  const [filtro, setFiltro] = useState<"todas" | "revezou" | "falhou">("todas");
  const lista = execucoes.filter((e) => filtro === "todas" || (filtro === "falhou" ? !e.ok : e.tentativas.some((t) => !t.ok)));
  if (execucoes.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
        Nenhuma execução ainda. Quando alguma função de IA rodar (um texto, uma imagem, uma transcrição), o revezamento aparece aqui.
      </div>
    );
  }
  return (
    <section className="rounded-2xl border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b p-4">
        <h2 className="font-semibold">Últimas {execucoes.length} execuções</h2>
        <div className="flex gap-1 rounded-lg bg-muted p-1 text-sm">
          {([
            ["todas", "Todas"],
            ["revezou", "Com revezamento"],
            ["falhou", "Falharam"],
          ] as const).map(([k, r]) => (
            <button key={k} aria-pressed={filtro === k} onClick={() => setFiltro(k)} className={cn("rounded-md px-2.5 py-1", filtro === k ? "bg-background font-medium shadow-sm" : "text-muted-foreground")}>
              {r}
            </button>
          ))}
        </div>
      </header>
      {lista.length === 0 ? (
        <p className="p-8 text-center text-sm text-muted-foreground">Nada com esse filtro.</p>
      ) : (
        <ul className="divide-y">
          {lista.map((e) => (
            <li key={e.id} className="grid gap-1.5 px-4 py-3">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                <span className={cn("size-2 rounded-full", e.ok ? "bg-emerald-600" : "bg-destructive")} aria-hidden />
                <span className="font-medium">{capNome(e.capacidade)}</span>
                <span className="text-muted-foreground">{resumoRevezamento(e.tentativas)}</span>
                <time className="ml-auto text-xs text-muted-foreground" dateTime={e.criadoEm}>{quando.format(new Date(e.criadoEm))}</time>
              </div>
              <CadeiaTentativas tentativas={e.tentativas} />
              {e.tentativas.some((t) => !t.ok) && (
                <details className="text-xs text-muted-foreground">
                  <summary className="cursor-pointer select-none">Ver os erros</summary>
                  <ul className="mt-1 grid gap-1">
                    {e.tentativas.filter((t) => !t.ok).map((t, i) => (
                      <li key={i} className="break-words"><strong className="text-foreground">{t.item}</strong> ({rotuloRota(t)}): {t.erro}</li>
                    ))}
                  </ul>
                </details>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Chaves extras do mesmo serviço: quando a 1ª acaba o limite ou o crédito, a Central usa a 2ª, depois a 3ª…
 * Mostra só os 4 últimos caracteres; cada uma pode ser testada ou removida.
 */
function ChavesExtras({ cred, chaves }: { cred: Credencial; chaves: string[] }) {
  const [abrir, setAbrir] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [pend, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; msg: string } | null>(null);
  const extras = chaves.slice(1);
  const rodar = (fn: () => Promise<{ ok?: boolean; message?: string }>, teste = false) =>
    start(async () => {
      setMsg(null);
      const r = await fn();
      if (teste) setMsg({ ok: !!r.ok, msg: r.message ?? "" });
      else toast[r.ok ? "success" : "error"](r.message ?? (r.ok ? "Pronto." : "Não deu certo."));
      if (r.ok && !teste) { setAbrir(false); setForm({}); }
    });
  return (
    <div className="grid gap-2 border-t pt-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium">Chaves de reserva <span className="font-normal text-muted-foreground">— entram sozinhas quando a anterior acaba</span></p>
        <span className="text-xs text-muted-foreground">{chaves.length} no total</span>
      </div>
      {extras.length > 0 && (
        <ul className="grid gap-1.5">
          {extras.map((m, j) => {
            const i = j + 1;
            return (
              <li key={i} className="flex flex-wrap items-center gap-1.5 rounded-lg bg-muted/50 px-2.5 py-1.5">
                <span className="text-xs font-medium">Chave {i + 1}</span>
                <span className="font-mono text-xs text-muted-foreground">{m}</span>
                <span className="ml-auto flex gap-1">
                  <Button type="button" size="sm" variant="ghost" className="h-8" disabled={pend} onClick={() => rodar(() => testarCredencialAction(cred.id, i), true)}><PlugZap /> Testar</Button>
                  <Button type="button" size="sm" variant="ghost" className="h-8 text-destructive" disabled={pend} aria-label={`Remover a chave ${i + 1}`}
                    onClick={() => confirm(`Remover a chave ${i + 1} de ${cred.nome}?`) && rodar(() => salvarChavesAction(cred.id, null, i))}><Trash2 /></Button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {abrir ? (
        <form className="grid gap-2 rounded-lg border p-2.5" onSubmit={(e) => { e.preventDefault(); rodar(() => salvarChavesAction(cred.id, form, chaves.length)); }}>
          {cred.campos.map((f) => (
            <div key={f.id} className="grid gap-1">
              <Label htmlFor={`${cred.id}-extra-${f.id}`} className="text-xs">{f.rotulo} (chave {chaves.length + 1})</Label>
              <Input id={`${cred.id}-extra-${f.id}`} type={f.segredo ? "password" : "text"} autoComplete="off" spellCheck={false} value={form[f.id] ?? ""}
                onChange={(e) => setForm((s) => ({ ...s, [f.id]: e.target.value }))} placeholder="cole aqui" className="h-10 font-mono text-xs sm:h-9" />
            </div>
          ))}
          <div className="flex gap-1.5">
            <Button type="submit" disabled={pend || !cred.campos.filter((f) => f.segredo).every((f) => (form[f.id] ?? "").trim())}>
              {pend && <Loader2 data-icon="inline-start" className="animate-spin" />} Salvar reserva
            </Button>
            <Button type="button" variant="ghost" disabled={pend} onClick={() => { setAbrir(false); setForm({}); }}>Cancelar</Button>
          </div>
        </form>
      ) : chaves.length < 10 && (
        <Button type="button" variant="outline" className="h-10 w-full sm:h-9 sm:w-fit" onClick={() => setAbrir(true)}><Plus data-icon="inline-start" /> Adicionar outra chave</Button>
      )}
      {msg && <p role="status" className={cn("rounded-lg px-2.5 py-1.5 text-xs break-words", msg.ok ? "bg-emerald-600/10 text-emerald-900 dark:text-emerald-200" : "bg-destructive/10 text-destructive")}>{msg.msg}</p>}
    </div>
  );
}
