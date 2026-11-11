"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { AlertTriangle, Check, CheckCheck, Loader2, MapPin, PencilLine, PlugZap, Plus, Search, Wand2, Wrench, X, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Field, selectClass } from "@/components/field";
import { EmptyState } from "@/components/page";
import { LeadCard } from "@/components/vendas/lead-card";
import { LocalPicker, lembrarLocal, type Local } from "@/components/vendas/local-picker";
import { MassaDialog } from "@/components/vendas/massa-dialog";
import { ConectarGoogleDialog, ErroGooglePainel, type EstadoGoogle } from "@/components/google-conexao";
import { adicionarAoFunilAction, cadastrarManualAction, prospectarAction } from "@/app/actions/vendas";
import type { ErroGoogle } from "@/lib/sites/google-erros";
import type { LayoutInfo, LeadBusca, listaSetores } from "@/lib/sites/engine";
import { cn } from "@/lib/utils";

type Setores = ReturnType<typeof listaSetores>;
type Resultado = { leads: LeadBusca[]; analisadas: number; comSite: number; semSite: number; demo: boolean };

const QTDS = [10, 20, 40] as const;

type GoogleInfo = { estado: EstadoGoogle; erro: string | null };
type Conexao = { google: GoogleInfo; podeConfigurar: boolean };

export function Prospeccao({
  setores,
  layouts,
  paises,
  iaRapida,
  google,
  podeConfigurar,
}: {
  setores: Setores;
  layouts: LayoutInfo[];
  paises: Record<string, { nome: string }>;
  iaRapida: boolean;
} & Conexao) {
  const [modo, setModo] = useState<"auto" | "manual">("auto");
  return (
    <Tabs value={modo} onValueChange={(v) => setModo(v as "auto" | "manual")} className="gap-4">
      <TabsList className="h-10! w-full sm:w-fit">
        <TabsTrigger value="auto" className="px-3">
          <Zap /> Busca automática
        </TabsTrigger>
        <TabsTrigger value="manual" className="px-3">
          <PencilLine /> Cadastro manual
        </TabsTrigger>
      </TabsList>
      <TabsContent value="auto" keepMounted>
        <BuscaAutomatica setores={setores} layouts={layouts} paises={paises} iaRapida={iaRapida} google={google} podeConfigurar={podeConfigurar} />
      </TabsContent>
      <TabsContent value="manual">
        <CadastroManual setores={setores} />
      </TabsContent>
    </Tabs>
  );
}

/** Cartão de destaque quando o Google Maps não está conectado (ou a chave está com erro). */
function CartaoConectar({ google, podeConfigurar, onConectar, onDemo }: Conexao & { onConectar: () => void; onDemo: () => void }) {
  const comErro = google.estado === "erro";
  return (
    <section aria-labelledby="conectar-google-t" className="rounded-2xl border border-primary/25 bg-gradient-to-br from-accent/80 via-card to-card p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
          <MapPin className="size-6" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="conectar-google-t" className="text-lg leading-snug font-semibold sm:text-xl">
            {comErro ? "A conexão com o Google Maps parou de funcionar" : "Conectar Google Maps para buscar empresas reais"}
          </h2>
          <p className="mt-1 max-w-prose text-sm text-muted-foreground">
            {comErro
              ? `Último erro: ${google.erro ?? "o Google recusou a chave"}. Enquanto isso, as buscas usam empresas fictícias.`
              : "Hoje a busca mostra empresas fictícias (modo demonstração). Cole uma chave da Places API e passe a encontrar negócios de verdade, com telefone, nota e fotos."}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          {podeConfigurar ? (
            <Button type="button" className="h-10 px-4" onClick={onConectar}>
              <PlugZap /> {comErro ? "Corrigir a conexão" : "Conectar Google Maps"}
            </Button>
          ) : (
            <p className="max-w-56 text-xs text-muted-foreground">Peça a um sócio para conectar em Configurações.</p>
          )}
          <Button type="button" variant="ghost" size="sm" onClick={onDemo}>
            Usar modo demonstração
          </Button>
        </div>
      </div>
    </section>
  );
}

function BuscaAutomatica({ setores, layouts, paises, iaRapida, google, podeConfigurar }: { setores: Setores; layouts: LayoutInfo[]; paises: Record<string, { nome: string }>; iaRapida: boolean } & Conexao) {
  const router = useRouter();
  const [setor, setSetor] = useState("barbearia");
  const [local, setLocal] = useState<Local>({ pais: "BR", uf: "", cidade: "" });
  const [termo, setTermo] = useState("");
  const [qtd, setQtd] = useState<(typeof QTDS)[number]>(10);
  const [soSemSite, setSoSemSite] = useState(true);
  const [buscando, startBusca] = useTransition();
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [enviando, setEnviando] = useState<Set<string>>(new Set());
  const [loteEnviando, setLoteEnviando] = useState(false);
  const [massaAberta, setMassaAberta] = useState(false);
  const [conectarAberto, setConectarAberto] = useState(false);
  const [usarDemo, setUsarDemo] = useState(false);
  const [erroBusca, setErroBusca] = useState<ErroGoogle | null>(null);
  const semConexao = google.estado === "sem-chave" || google.estado === "erro";
  const corrigir = () => setConectarAberto(true);

  const leads = resultado?.leads ?? [];
  const selecionadosLista = leads.filter((l) => selecionados.has(l.id));

  const buscar = (e: React.FormEvent) => {
    e.preventDefault();
    if (local.cidade.trim().length < 2) {
      toast.error("Escolha a cidade.");
      return;
    }
    lembrarLocal({ ...local, setor });
    // Chave com erro conhecido: busca em demonstração até a pessoa corrigir
    const demo = usarDemo || google.estado === "erro";
    startBusca(async () => {
      const r = await prospectarAction({ setor, termo: termo.trim(), pais: local.pais, uf: local.uf, cidade: local.cidade.trim(), quantidade: qtd, soSemSite, demo });
      if (!r.ok) {
        if ("google" in r && r.google) {
          setErroBusca(r.google);
          setResultado(null);
          router.refresh(); // o status da conexão passou para "com erro"
        } else toast.error(r.message);
        return;
      }
      setErroBusca(null);
      setResultado(r.data);
      setSelecionados(new Set());
    });
  };

  const marcarNoFunil = (ids: string[]) =>
    setResultado((r) => (r ? { ...r, leads: r.leads.map((l) => (ids.includes(l.id) ? { ...l, noCrm: true } : l)) } : r));

  const enviarUm = async (lead: LeadBusca) => {
    setEnviando((s) => new Set(s).add(lead.id));
    const r = await adicionarAoFunilAction([lead]);
    setEnviando((s) => {
      const n = new Set(s);
      n.delete(lead.id);
      return n;
    });
    if (!r.ok) return toast.error(r.message);
    marcarNoFunil([lead.id]);
    toast.success("Adicionado ao funil");
  };

  const enviarLote = async () => {
    const lista = selecionadosLista.filter((l) => !l.noCrm);
    if (!lista.length) {
      toast.info("Os selecionados já estão no funil.");
      return;
    }
    setLoteEnviando(true);
    const r = await adicionarAoFunilAction(lista);
    setLoteEnviando(false);
    if (!r.ok) return toast.error(r.message);
    marcarNoFunil(lista.map((l) => l.id));
    setSelecionados(new Set());
    toast.success(`${r.data} ${r.data === 1 ? "adicionado" : "adicionados"} ao funil`);
  };

  const criarSite = (lead: LeadBusca) => {
    try {
      sessionStorage.setItem("enova:lead", JSON.stringify(lead));
    } catch {
      /* sem armazenamento */
    }
    router.push("/painel/sites/novo?origem=busca");
  };

  const abrirMassa = () => {
    if (selecionadosLista.length > 10) toast.info("Até 10 sites por vez: vamos usar os 10 primeiros.");
    setMassaAberta(true);
  };

  const toggle = (id: string, on: boolean) =>
    setSelecionados((s) => {
      const n = new Set(s);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });

  const n = selecionados.size;

  return (
    <div className={cn("grid gap-5", n > 0 && "pb-24 md:pb-20")}>
      {semConexao && !usarDemo && !erroBusca && (
        <CartaoConectar google={google} podeConfigurar={podeConfigurar} onConectar={corrigir} onDemo={() => setUsarDemo(true)} />
      )}
      <ConectarGoogleDialog
        open={conectarAberto}
        onOpenChange={(v) => {
          setConectarAberto(v);
          if (!v) setErroBusca(null);
        }}
      />
      <form onSubmit={buscar} className="grid gap-4 rounded-2xl border bg-card p-4 shadow-xs sm:p-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[1.2fr_1fr_1fr_1.2fr_auto] xl:items-end">
          <div className="grid gap-1.5">
            <Label htmlFor="ramo">Ramo</Label>
            <select id="ramo" className={selectClass} value={setor} onChange={(e) => setSetor(e.target.value)}>
              {setores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.icone} {s.nome}
                </option>
              ))}
            </select>
          </div>
          <LocalPicker
            paises={paises}
            value={local}
            onChange={setLocal}
            // Último ramo usado (lido depois de montar para não divergir do HTML do servidor)
            onRestaurado={(s) => s.setor && setores.some((x) => x.id === s.setor) && setSetor(s.setor)}
          />
          <Button type="submit" disabled={buscando} className="h-10 px-5 sm:col-span-2 xl:col-span-1 xl:h-9">
            {buscando ? <Loader2 className="animate-spin" /> : <Search />}
            {buscando ? "Buscando…" : "Buscar"}
          </Button>
        </div>

        <div className="flex flex-col gap-3 border-t pt-4 md:flex-row md:flex-wrap md:items-center md:gap-x-6">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Trazer</span>
            <div className="inline-flex rounded-lg bg-muted p-[3px]" role="radiogroup" aria-label="Quantidade de negócios">
              {QTDS.map((q) => (
                <button
                  key={q}
                  type="button"
                  role="radio"
                  aria-checked={qtd === q}
                  onClick={() => setQtd(q)}
                  className={cn(
                    "rounded-md px-3 py-1 text-sm font-medium transition-colors",
                    qtd === q ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {q}
                </button>
              ))}
            </div>
            <span className="text-sm text-muted-foreground">negócios</span>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium whitespace-nowrap">
            <Switch checked={soSemSite} onCheckedChange={setSoSemSite} />
            Só quem não tem site
          </label>
          <Input
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            placeholder="Termo personalizado (opcional)"
            aria-label="Termo personalizado"
            maxLength={80}
            className="h-10 sm:h-9 md:ml-auto md:max-w-72"
          />
        </div>
      </form>

      {!buscando && erroBusca && (
        <ErroGooglePainel erro={erroBusca}>
          {podeConfigurar ? (
            <Button type="button" size="sm" onClick={corrigir}>
              <Wrench /> Corrigir a conexão
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">Peça a um sócio para corrigir em Configurações.</span>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setErroBusca(null);
              setUsarDemo(true);
            }}
          >
            Usar modo demonstração
          </Button>
        </ErroGooglePainel>
      )}

      {buscando && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-60 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      )}

      {!buscando && resultado && (
        <>
          <div className="grid gap-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span>
                <b className="num text-foreground">{resultado.analisadas}</b> analisados
              </span>
              <span>
                <b className="num text-foreground">{resultado.semSite}</b> sem site
              </span>
              <span>
                <b className="num text-foreground">{resultado.comSite}</b> já têm site
              </span>
              <span>ordenados por oportunidade</span>
            </div>
            {resultado.demo && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2.5 text-sm">
                <AlertTriangle className="size-4 shrink-0 text-warning-foreground" />
                <p className="min-w-0 flex-1">
                  <b>Modo demonstração:</b> estas empresas são fictícias, servem só para treinar.
                </p>
                {podeConfigurar ? (
                  <Button type="button" variant="outline" size="sm" onClick={corrigir}>
                    <PlugZap /> Conectar Google Maps
                  </Button>
                ) : (
                  <Link href="/painel/configuracoes" className="text-xs font-medium text-primary underline-offset-2 hover:underline">
                    Ver Configurações
                  </Link>
                )}
              </div>
            )}
            {leads.length > 0 && (
              <div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelecionados(new Set(leads.map((l) => l.id)))}
                >
                  <CheckCheck /> Selecionar todos ({leads.length})
                </Button>
              </div>
            )}
          </div>

          {leads.length === 0 ? (
            <EmptyState icon={<Search />} title="Nenhum negócio encontrado">
              Tente outra cidade, outro ramo ou desligue “Só quem não tem site”.
            </EmptyState>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {leads.map((l) => (
                <LeadCard
                  key={l.id}
                  lead={l}
                  selecionado={selecionados.has(l.id)}
                  onToggle={(on) => toggle(l.id, on)}
                  acoes={
                    <>
                      <Button type="button" className="h-10 sm:h-9" onClick={() => criarSite(l)}>
                        <Wand2 /> Criar site
                      </Button>
                      {l.noCrm ? (
                        <Button type="button" variant="secondary" className="h-10 sm:h-9" disabled>
                          <Check /> No funil
                        </Button>
                      ) : (
                        <Button type="button" variant="outline" className="h-10 sm:h-9" disabled={enviando.has(l.id)} onClick={() => enviarUm(l)}>
                          {enviando.has(l.id) ? <Loader2 className="animate-spin" /> : <Plus />} Enviar ao CRM
                        </Button>
                      )}
                    </>
                  }
                />
              ))}
            </div>
          )}
        </>
      )}

      {!buscando && !resultado && !erroBusca && (
        <EmptyState icon={<MapPin />} title="Comece pela cidade">
          Escolha o ramo e a cidade e toque em <b className="text-foreground">Buscar</b>.
        </EmptyState>
      )}

      {n > 0 && (
        <div className="fixed inset-x-3 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-20 md:right-6 md:bottom-5 md:left-[calc(248px+1.5rem)]">
          <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-2 rounded-2xl border bg-card/95 p-2.5 shadow-lg backdrop-blur sm:flex-nowrap sm:px-4">
            <b className="text-sm">
              {n} {n === 1 ? "selecionado" : "selecionados"}
            </b>
            <Button type="button" variant="ghost" size="sm" onClick={() => setSelecionados(new Set())}>
              <X /> Limpar
            </Button>
            <span className="hidden flex-1 sm:block" />
            <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
              <Button type="button" variant="outline" className="h-10 sm:h-9" disabled={loteEnviando} onClick={enviarLote}>
                {loteEnviando ? <Loader2 className="animate-spin" /> : <Plus />}
                <span className="truncate">
                  <span className="sm:hidden">Ao funil ({n})</span>
                  <span className="max-sm:hidden">Adicionar ao funil ({n})</span>
                </span>
              </Button>
              <Button type="button" className="h-10 sm:h-9" onClick={abrirMassa}>
                <Zap />
                <span className="truncate">
                  <span className="sm:hidden">{n === 1 ? "Criar 1 site" : `Criar ${Math.min(n, 10)} sites`}</span>
                  <span className="max-sm:hidden">{n === 1 ? "Criar 1 site em massa" : `Criar ${Math.min(n, 10)} sites em massa`}</span>
                </span>
              </Button>
            </div>
          </div>
        </div>
      )}

      <MassaDialog
        open={massaAberta}
        onOpenChange={setMassaAberta}
        leads={selecionadosLista.slice(0, 10)}
        setores={setores}
        layouts={layouts}
        iaRapida={iaRapida}
      />
    </div>
  );
}

function CadastroManual({ setores }: { setores: Setores }) {
  const [salvando, startSalvar] = useTransition();
  const [erro, setErro] = useState("");

  const enviar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const d = Object.fromEntries(new FormData(form)) as Record<string, string>;
    setErro("");
    startSalvar(async () => {
      const r = await cadastrarManualAction({
        nome: d.nome ?? "",
        setor: d.setor ?? "outro",
        telefone: d.telefone ?? "",
        cidade: d.cidade ?? "",
        uf: (d.uf ?? "").toUpperCase(),
        endereco: d.endereco ?? "",
        instagram: d.instagram ?? "",
      });
      if (!r.ok) {
        setErro(r.message);
        toast.error(r.message);
        return;
      }
      toast.success("Adicionado ao funil");
      form.reset();
    });
  };

  return (
    <form onSubmit={enviar} className="grid gap-4 rounded-2xl border bg-card p-4 sm:p-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field name="nome" label="Nome do negócio" required minLength={2} maxLength={200} placeholder="ex.: Barbearia do Zé" />
        <div className="grid gap-1.5">
          <Label htmlFor="setor-manual">Ramo</Label>
          <select id="setor-manual" name="setor" defaultValue="barbearia" className={selectClass}>
            {setores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.icone} {s.nome}
              </option>
            ))}
          </select>
        </div>
        <Field name="telefone" label="WhatsApp / telefone" inputMode="tel" placeholder="(11) 98765-4321" maxLength={40} />
        <div className="grid grid-cols-[1fr_5.5rem] gap-3">
          <Field name="cidade" label="Cidade" maxLength={120} />
          <Field name="uf" label="UF" maxLength={2} placeholder="SP" />
        </div>
        <Field name="endereco" label="Endereço" maxLength={300} />
        <Field name="instagram" label="Instagram" placeholder="@perfil" maxLength={80} />
      </div>
      {erro && <p className="text-sm text-destructive">{erro}</p>}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Button type="submit" disabled={salvando} className="h-10 sm:h-9">
          {salvando ? <Loader2 className="animate-spin" /> : <Plus />} Adicionar ao funil
        </Button>
        <span className="text-xs text-muted-foreground">O cadastro manual é ilimitado e não gasta nada.</span>
      </div>
    </form>
  );
}
