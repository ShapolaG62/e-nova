"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, ExternalLink, Zap } from "lucide-react";
import { criarSitesEmMassaAction } from "@/app/actions/vendas";
import type { LayoutInfo } from "@/lib/sites/engine";
import { AnelProgresso, Passos, Terminal, useProgressoSimulado } from "@/components/vendas/sites-ui";
import { Button, buttonVariants } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { selectClass } from "@/components/field";
import { cn } from "@/lib/utils";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Lead = Record<string, any>;
type SetorResumo = { id: string; nome: string; icone: string; servicos: string[] };
type Resultado = { ok: boolean; id?: string; nome: string; erro?: string };

const PASSOS = ["Empresas", "Serviços", "Visual", "Criar"];
const MAX = 10;
const agora = () => performance.now();

/**
 * "Sites em massa": até 10 sites de uma vez (Empresas → Serviços → Visual → Criar).
 * `iaRapida` = provedor de IA remoto (Gemini etc.); com a IA local os sites saem um por vez.
 */
export function MassaDialog({
  open, onOpenChange, leads, setores, layouts, iaRapida,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leads: Lead[];
  setores: SetorResumo[];
  layouts: LayoutInfo[];
  iaRapida: boolean;
}) {
  const porId = useMemo(() => new Map(setores.map((s) => [s.id, s])), [setores]);
  const setorValido = (id?: string) => (id && porId.has(id) ? id : porId.has("outro") ? "outro" : setores[0]?.id ?? "outro");

  const [passo, setPasso] = useState(0);
  const [itens, setItens] = useState<{ lead: Lead; setor: string; on: boolean }[]>([]);
  const [servicos, setServicos] = useState<Record<string, string[]>>({});
  const [layout, setLayout] = useState("auto");
  const [comIA, setComIA] = useState(iaRapida);
  const [criando, setCriando] = useState(false);
  const [res, setRes] = useState<{ resultados: Resultado[]; ms: number } | null>(null);
  const pct = useProgressoSimulado(criando, comIA);

  // Reinicia sempre que abrir com uma nova lista
  const [abertoAntes, setAbertoAntes] = useState(false);
  if (open !== abertoAntes) {
    setAbertoAntes(open);
    if (open) {
      setPasso(0);
      setItens(leads.map((lead, i) => ({ lead, setor: setorValido(lead.setor), on: i < MAX })));
      setServicos({});
      setLayout("auto");
      setComIA(iaRapida);
      setRes(null);
      setCriando(false);
    }
  }

  const ativos = itens.filter((i) => i.on);
  const setoresUsados = [...new Set(ativos.map((i) => i.setor))];

  const avancar = async () => {
    if (passo === 0) {
      if (!ativos.length) return toast.error("Escolha pelo menos uma empresa.");
      if (ativos.length > MAX) return toast.error(`No máximo ${MAX} sites por vez.`);
      const s = { ...servicos };
      for (const id of setoresUsados) if (!s[id]) s[id] = (porId.get(id)?.servicos ?? []).slice(0, 6);
      setServicos(s);
    }
    if (passo === 1 && setoresUsados.some((id) => !servicos[id]?.length)) return toast.error("Cada ramo precisa de pelo menos um serviço.");
    if (passo < 2) return setPasso(passo + 1);
    setPasso(3);
    setCriando(true);
    const t0 = agora();
    try {
      const r = await criarSitesEmMassaAction(
        ativos.map((a) => ({ lead: { ...a.lead, setor: a.setor }, setor: a.setor, servicos: servicos[a.setor] })),
        layout,
        comIA,
      );
      // Deixa o anel aparecer mesmo quando tudo sai em milissegundos
      await new Promise((ok) => setTimeout(ok, Math.max(0, 1400 - (agora() - t0))));
      if (!r.ok) {
        toast.error(r.message);
        setPasso(2);
      } else setRes(r.data);
    } catch {
      toast.error("Não foi possível criar os sites. Tente de novo.");
      setPasso(2);
    } finally {
      setCriando(false);
    }
  };

  const fechar = (v: boolean) => {
    if (criando) return; // não fecha no meio da criação
    onOpenChange(v);
  };

  const okCount = res?.resultados.filter((x) => x.ok).length ?? 0;

  return (
    <Dialog open={open} onOpenChange={fechar}>
      <DialogContent showCloseButton={!criando} className="flex max-h-[calc(100dvh-2rem)] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-1.5">
            <Zap className="size-4 text-primary" /> {ativos.length || leads.length} sites ao mesmo tempo
          </DialogTitle>
          <DialogDescription className="sr-only">Criação de vários sites de uma vez</DialogDescription>
          <Passos passos={PASSOS} atual={res ? 4 : passo} className="pt-1" />
        </DialogHeader>

        <div className="-mx-4 min-h-0 flex-1 overflow-y-auto px-4">
          {passo === 0 && (
            <div className="grid gap-3">
              <p className="text-sm text-muted-foreground">
                Confira o ramo de cada empresa: ele decide o visual, as cores e os textos. Tire quem não quiser nesta remessa (máximo {MAX}).
              </p>
              <ul className="grid gap-2">
                {itens.map((it, i) => (
                  <li key={it.lead.id ?? i} className={cn("flex flex-col gap-2 rounded-lg border p-2.5 sm:flex-row sm:items-center", it.on && "border-primary/50 bg-primary/5")}>
                    <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={it.on}
                        onChange={(e) => setItens(itens.map((x, j) => (j === i ? { ...x, on: e.target.checked } : x)))}
                        className="size-4 shrink-0 accent-[var(--primary)]"
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{it.lead.nome}</span>
                        <span className="block truncate text-xs text-muted-foreground">{it.lead.cidade}</span>
                      </span>
                    </label>
                    <select
                      value={it.setor}
                      onChange={(e) => setItens(itens.map((x, j) => (j === i ? { ...x, setor: e.target.value } : x)))}
                      className={cn(selectClass, "sm:w-56")}
                      aria-label={`Ramo de ${it.lead.nome}`}
                    >
                      {setores.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.icone} {s.nome}
                        </option>
                      ))}
                    </select>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {passo === 1 && (
            <div className="grid gap-3">
              <p className="text-sm text-muted-foreground">Serviços que vão aparecer nos sites de cada ramo.</p>
              {setoresUsados.map((id) => {
                const st = porId.get(id);
                const sel = servicos[id] ?? [];
                return (
                  <section key={id} className="grid gap-2 rounded-lg border p-3">
                    <b className="text-sm">
                      {st?.icone} {st?.nome}
                    </b>
                    <div className="flex flex-wrap gap-1.5">
                      {(st?.servicos ?? []).map((x) => {
                        const on = sel.includes(x);
                        return (
                          <button
                            key={x}
                            type="button"
                            aria-pressed={on}
                            onClick={() => setServicos({ ...servicos, [id]: on ? sel.filter((y) => y !== x) : [...sel, x].slice(0, 12) })}
                            className={cn(
                              "inline-flex min-h-8 items-center gap-1 rounded-full border px-3 py-1 text-sm",
                              on ? "border-primary bg-primary/10 font-medium text-primary" : "hover:bg-muted",
                            )}
                          >
                            {on && <Check className="size-3.5" />}
                            {x}
                          </button>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          )}

          {passo === 2 && (
            <div className="grid gap-3">
              <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Visual">
                {[{ id: "auto", nome: "Automático", descricao: "O melhor visual para cada ramo" }, ...layouts].map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    role="radio"
                    aria-checked={layout === l.id}
                    onClick={() => setLayout(l.id)}
                    className={cn(
                      "flex items-start justify-between gap-2 rounded-lg border p-3 text-left",
                      layout === l.id ? "border-primary bg-primary/5" : "hover:bg-muted/60",
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold">{l.nome}</span>
                      <span className="block text-xs text-muted-foreground">{l.descricao}</span>
                    </span>
                    {layout === l.id && <Check className="size-4 shrink-0 text-primary" />}
                  </button>
                ))}
              </div>
              <label className="flex items-start justify-between gap-3 rounded-lg border p-3 text-sm">
                <span>
                  <span className="font-medium">Textos com IA</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {iaRapida
                      ? "Textos personalizados para cada negócio (um pouco mais lento)."
                      : "Com a IA local os sites são feitos um por vez e pode levar 1–2 min cada. Sem IA, sai tudo em segundos."}
                  </span>
                </span>
                <Switch checked={comIA} onCheckedChange={(v) => setComIA(!!v)} className="mt-1" />
              </label>
            </div>
          )}

          {passo === 3 && (
            <div className="grid justify-items-center gap-4 py-2 text-center">
              {!res ? (
                <>
                  <AnelProgresso pct={pct} />
                  <p className="font-semibold">Montando {ativos.length} sites…</p>
                  <Terminal titulo="e-nova montar --massa" linhas={ativos.map((a) => ({ ok: false, texto: a.lead.nome }))} />
                </>
              ) : (
                <>
                  <AnelProgresso pct={100} pronto />
                  <p className="text-lg font-semibold">
                    {okCount} {okCount === 1 ? "site pronto" : "sites prontos"} em {(res.ms / 1000).toFixed(1).replace(".", ",")} s
                  </p>
                  <ul className="grid w-full gap-2 text-left">
                    {res.resultados.map((x, i) => (
                      <li key={x.id ?? i} className={cn("flex items-center gap-2 rounded-lg border p-2.5 text-sm", x.ok ? "border-emerald-500/40 bg-emerald-500/5" : "border-destructive/40")}>
                        <span className="min-w-0 flex-1 truncate font-medium">{x.nome}</span>
                        {x.ok && x.id ? (
                          <Link href={`/painel/sites/${x.id}`} onClick={() => onOpenChange(false)} className={buttonVariants({ variant: "outline", size: "sm" })}>
                            <ExternalLink /> Abrir
                          </Link>
                        ) : (
                          <span className="text-xs text-destructive">{x.erro || "Falhou"}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                  <Link href="/painel/funil" onClick={() => onOpenChange(false)} className={buttonVariants({ className: "h-10" })}>
                    Ir para o Funil mandar as mensagens <ArrowRight />
                  </Link>
                </>
              )}
            </div>
          )}
        </div>

        {passo < 3 && (
          <div className="-mx-4 -mb-4 flex items-center justify-between gap-2 rounded-b-xl border-t bg-muted/50 p-4">
            <Button variant="outline" className="h-10 sm:h-9" onClick={() => (passo ? setPasso(passo - 1) : onOpenChange(false))}>
              {passo ? (
                <>
                  <ArrowLeft /> Voltar
                </>
              ) : (
                "Cancelar"
              )}
            </Button>
            <Button className="h-10 sm:h-9" onClick={avancar}>
              {passo === 2 ? `Criar ${ativos.length} ${ativos.length === 1 ? "site" : "sites"}` : "Continuar"} <ArrowRight />
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
