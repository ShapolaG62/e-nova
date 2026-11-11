"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft, ArrowRight, Check, Copy, ImagePlus, MapPin, MessageCircle, Pencil, Phone, Plus, Search, Sparkles, Star, Users, X, AtSign,
} from "lucide-react";
import { abordagemAction, criarSiteAction } from "@/app/actions/vendas";
import type { Abordagem, LayoutInfo } from "@/lib/sites/engine";
import { abrirWhats, copiar, fotoGoogleUrl, iniciais } from "@/lib/sites/client-utils";
import { AnelProgresso, Passos, Terminal, useProgressoSimulado } from "@/components/vendas/sites-ui";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { selectClass } from "@/components/field";
import { cn } from "@/lib/utils";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Lead = Record<string, any> & { nome: string };
type SetorResumo = { id: string; nome: string; icone: string; busca: string; cores: [string, string][]; servicos: string[]; visuais: string[] };

const PASSOS = ["Setor", "Negócio", "Detalhes", "Abordagem"];
const TITULOS = ["Qual o setor do negócio?", "Para qual negócio é o site?", "Confira os dados do negócio", "Sua abordagem profissional"];
const SUBTITULOS = [
  "Define o vocabulário, as cores sugeridas e os serviços do site.",
  "Escolha um negócio do seu funil, cadastre à mão ou busque no Google.",
  "Já vem preenchido com o que achamos. Ajuste o que quiser.",
  "Mensagens prontas para mandar no WhatsApp. Depois, é só gerar o site.",
];

const celularBR = (tel: string) => {
  const d = String(tel || "").replace(/\D/g, "");
  return d.length === 11 && d[2] === "9" ? "55" + d : "";
};

export function NovoSiteWizard({
  setores, layouts, tons, funil, leadInicial, setorInicial, iaRapida,
}: {
  setores: SetorResumo[];
  layouts: LayoutInfo[];
  tons: Record<string, string>;
  funil: Lead[];
  leadInicial: Lead | null;
  setorInicial: string;
  iaRapida: boolean;
}) {
  const router = useRouter();
  const porId = useMemo(() => new Map(setores.map((s) => [s.id, s])), [setores]);
  const valido = (id?: string | null) => (id && porId.has(id) ? id : "");

  const setor0 = valido(setorInicial) || valido(leadInicial?.setor);
  const [passo, setPasso] = useState(leadInicial && setor0 ? 2 : setor0 ? 1 : 0);
  const [setorId, setSetorId] = useState(setor0);
  const [lead, setLead] = useState<Lead | null>(leadInicial);
  const [todosServ, setTodosServ] = useState<string[]>(() => porId.get(setor0)?.servicos ?? []);
  const [servicos, setServicos] = useState<string[]>(() => porId.get(setor0)?.servicos.slice(0, 6) ?? []);
  const [cores, setCores] = useState<{ nome: string; hex: string }[]>(() => (porId.get(setor0)?.cores ?? []).map(([nome, hex]) => ({ nome, hex })));
  const [tom, setTom] = useState(() => ("profissional" in tons ? "profissional" : Object.keys(tons)[0] ?? ""));
  const [layout, setLayout] = useState("auto");
  const [fotosUrls, setFotosUrls] = useState<string[]>([]);
  const [comIA, setComIA] = useState(iaRapida);
  const [abordagem, setAbordagem] = useState<Abordagem | null>(null);
  const [gerando, setGerando] = useState(false);

  const aplicarSetor = (id: string) => {
    const st = porId.get(id);
    setSetorId(id);
    setTodosServ(st?.servicos ?? []);
    setServicos(st?.servicos.slice(0, 6) ?? []);
    setCores((st?.cores ?? []).map(([nome, hex]) => ({ nome, hex })));
    setAbordagem(null);
  };

  // Negócio escolhido na tela de Prospecção (guardado no sessionStorage)
  useEffect(() => {
    const t = setTimeout(() => {
      let vindo: Lead | null = null;
      try {
        const raw = sessionStorage.getItem("enova:lead");
        sessionStorage.removeItem("enova:lead");
        if (raw) vindo = JSON.parse(raw);
      } catch { /* ignora */ }
      if (!vindo?.nome) return;
      const sid = valido(setorInicial) || valido(vindo.setor);
      setLead(vindo);
      if (sid) aplicarSetor(sid);
      setPasso(sid ? 2 : 0);
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [passo]);

  const st = porId.get(setorId);

  return (
    <div className="grid grid-cols-1 gap-5">
      <div className="grid gap-3">
        <Link href="/painel/sites" className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Meus sites
        </Link>
        <div>
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-wider text-primary uppercase">
            <Sparkles className="size-3.5" /> Novo site
          </p>
          <h1 className="mt-1 text-[1.65rem] leading-tight font-bold sm:text-[2rem]">{TITULOS[passo]}</h1>
          <p className="mt-1 max-w-prose text-[0.95rem] text-muted-foreground">{SUBTITULOS[passo]}</p>
        </div>
        <Passos passos={PASSOS} atual={passo} />
      </div>

      {passo === 0 && (
        <PassoSetor
          setores={setores}
          atual={setorId}
          onEscolher={(id) => {
            aplicarSetor(id);
            setPasso(lead ? 2 : 1);
          }}
        />
      )}

      {passo === 1 && st && (
        <PassoNegocio
          setor={st}
          funil={funil}
          onTrocarSetor={() => setPasso(0)}
          onUsar={(l) => {
            setLead(l);
            setAbordagem(null);
            setPasso(2);
          }}
        />
      )}

      {passo === 2 && st && lead && (
        <PassoDetalhes
          setor={st}
          lead={lead}
          layouts={layouts}
          tons={tons}
          iaRapida={iaRapida}
          estado={{ todosServ, servicos, cores, tom, layout, fotosUrls, comIA }}
          set={{ setTodosServ, setServicos, setCores, setTom, setLayout, setFotosUrls, setComIA }}
          onTrocarLead={() => {
            setLead(null);
            setPasso(1);
          }}
          onVoltar={() => setPasso(1)}
          onContinuar={(novo) => {
            setLead(novo);
            setAbordagem(null);
            setPasso(3);
          }}
        />
      )}

      {passo === 3 && st && lead && (
        <PassoAbordagem
          lead={lead}
          setorId={setorId}
          comIA={comIA}
          abordagem={abordagem}
          setAbordagem={setAbordagem}
          onVoltar={() => setPasso(2)}
          onGerar={() => setGerando(true)}
        />
      )}

      {/* Fallback: passo pede setor/negócio que não existe mais */}
      {passo > 0 && !st && (
        <Rodape onVoltar={() => setPasso(0)} />
      )}

      {lead && st && (
        <GerarDialog
          aberto={gerando}
          onFechar={() => setGerando(false)}
          comIA={comIA}
          temFotosGoogle={(lead.fotos?.length ?? 0) > 0}
          executar={() =>
            criarSiteAction({
              lead: { ...lead, setor: setorId },
              setor: setorId,
              servicos,
              cores: cores.map((c) => c.hex),
              tom,
              layout: layout === "auto" ? undefined : layout,
              fotosUrls,
              comIA,
              nome: lead.nome,
            })
          }
          onPronto={(id) => router.push(`/painel/sites/${id}`)}
        />
      )}
    </div>
  );
}

function Rodape({ onVoltar, children }: { onVoltar?: () => void; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
      {onVoltar ? (
        <Button variant="outline" className="h-10" onClick={onVoltar}>
          <ArrowLeft /> Voltar
        </Button>
      ) : (
        <span />
      )}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">{children}</div>
    </div>
  );
}

function Secao({ titulo, dica, children, className }: { titulo: string; dica?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("grid gap-3 rounded-xl border bg-card p-4 sm:p-5", className)}>
      <div>
        <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">{titulo}</h2>
        {dica && <p className="mt-1 text-sm text-muted-foreground">{dica}</p>}
      </div>
      {children}
    </section>
  );
}

function Chip({ on, onClick, children }: { on?: boolean; onClick?: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        "inline-flex min-h-8 items-center gap-1 rounded-full border px-3 py-1 text-sm transition-colors",
        on ? "border-primary bg-primary/10 font-medium text-primary" : "bg-background hover:bg-muted",
      )}
    >
      {on && <Check className="size-3.5" />}
      {children}
    </button>
  );
}

// ───────── 1. Setor ─────────
function PassoSetor({ setores, atual, onEscolher }: { setores: SetorResumo[]; atual: string; onEscolher: (id: string) => void }) {
  const [f, setF] = useState("");
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const lista = setores.filter((s) => norm(s.nome).includes(norm(f)));
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={f} onChange={(e) => setF(e.target.value)} placeholder="Buscar setor…" className="h-10 pl-8 sm:h-9" aria-label="Buscar setor" />
        </div>
        <span className="text-sm text-muted-foreground">{lista.length} setores</span>
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {lista.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onEscolher(s.id)}
            className={cn(
              "flex min-h-24 flex-col items-center justify-center gap-1.5 rounded-xl border bg-card p-3 text-center text-sm font-medium transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-sm focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
              s.id === atual && "border-primary bg-primary/5 text-primary ring-1 ring-primary",
            )}
          >
            <span className="text-3xl leading-none" aria-hidden>
              {s.icone}
            </span>
            {s.nome}
          </button>
        ))}
        {lista.length === 0 && <p className="col-span-full py-8 text-center text-sm text-muted-foreground">Nenhum setor com esse nome.</p>}
      </div>
    </div>
  );
}

// ───────── 2. Negócio ─────────
function FotoLead({ lead, className }: { lead: Lead; className?: string }) {
  const foto = lead.fotos?.[0];
  return foto ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={fotoGoogleUrl(foto)} alt="" className={cn("size-12 shrink-0 rounded-lg object-cover", className)} loading="lazy" />
  ) : (
    <span className={cn("grid size-12 shrink-0 place-items-center rounded-lg bg-primary/10 font-bold text-primary", className)}>{iniciais(lead.nome)}</span>
  );
}

function Nota({ lead }: { lead: Lead }) {
  if (lead.nota == null) return null;
  return (
    <span className="inline-flex items-center gap-1">
      <Star className="size-3 fill-amber-400 text-amber-400" />
      {Number(lead.nota).toFixed(1).replace(".", ",")} ({lead.avaliacoes ?? 0})
    </span>
  );
}

function PassoNegocio({ setor, funil, onTrocarSetor, onUsar }: { setor: SetorResumo; funil: Lead[]; onTrocarSetor: () => void; onUsar: (l: Lead) => void }) {
  const [aba, setAba] = useState<"funil" | "manual">(funil.length ? "funil" : "manual");
  const [f, setF] = useState("");
  const lista = funil
    .filter((l) => `${l.nome} ${l.cidade}`.toLowerCase().includes(f.toLowerCase()))
    .sort((a, b) => Number(b.setor === setor.id) - Number(a.setor === setor.id));

  const manual = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const whatsapp = celularBR(d.telefone);
    onUsar({
      ...d,
      nome: d.nome.trim(),
      uf: d.uf.trim().toUpperCase(),
      id: "m" + Date.now().toString(36),
      whatsapp,
      celular: !!whatsapp,
      situacaoSite: "sem",
      origem: "manual",
      fotos: [],
      horarios: [],
    });
  };

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card px-4 py-3 text-sm">
        <span className="rounded-full bg-primary/10 px-2.5 py-0.5 font-medium text-primary">
          {setor.icone} Nicho: {setor.nome}
        </span>
        <button type="button" className="text-sm text-primary underline-offset-4 hover:underline" onClick={onTrocarSetor}>
          trocar
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="flex flex-1 gap-1 rounded-xl bg-muted p-1 sm:flex-none" role="tablist">
          {(
            [
              ["funil", "Do meu funil", Users],
              ["manual", "Cadastrar à mão", Pencil],
            ] as const
          ).map(([id, rotulo, Icone]) => (
            <button
              key={id}
              role="tab"
              aria-selected={aba === id}
              type="button"
              onClick={() => setAba(id)}
              className={cn(
                "inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium sm:flex-none",
                aba === id ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icone className="size-4" /> {rotulo}
            </button>
          ))}
        </div>
        <Link href="/painel/prospeccao" className={buttonVariants({ variant: "outline", className: "h-10 w-full sm:w-auto" })}>
          <Search /> Buscar no Google
        </Link>
      </div>

      {aba === "funil" ? (
        funil.length === 0 ? (
          <div className="grid justify-items-center gap-2 rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            Nenhum negócio sem site no funil.
            <Link href="/painel/prospeccao" className="text-primary hover:underline">
              Buscar negócios no Google
            </Link>
          </div>
        ) : (
          <div className="grid gap-3">
            <div className="relative sm:max-w-xs">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={f} onChange={(e) => setF(e.target.value)} placeholder="Filtrar por nome ou cidade" className="h-10 pl-8 sm:h-9" />
            </div>
            <ul className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
              {lista.map((l) => (
                <li key={l.id} className="flex flex-col gap-3 rounded-xl border bg-card p-3.5">
                  <div className="flex items-start gap-3">
                    <FotoLead lead={l} />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{l.nome}</p>
                      <p className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                        {l.cidade && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="size-3" />
                            {l.cidade}
                            {l.uf ? ` - ${l.uf}` : ""}
                          </span>
                        )}
                        <Nota lead={l} />
                      </p>
                    </div>
                  </div>
                  <Button className="mt-auto h-10 w-full sm:h-9" onClick={() => onUsar(l)}>
                    Usar este negócio <ArrowRight />
                  </Button>
                </li>
              ))}
              {lista.length === 0 && <li className="col-span-full py-6 text-center text-sm text-muted-foreground">Nada encontrado.</li>}
            </ul>
          </div>
        )
      ) : (
        <form onSubmit={manual} className="grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-2 sm:p-5">
          <Campo nome="nome" rotulo="Nome do negócio" required />
          <Campo nome="telefone" rotulo="WhatsApp / telefone" placeholder="(11) 98765-4321" inputMode="tel" />
          <Campo nome="cidade" rotulo="Cidade" required />
          <Campo nome="uf" rotulo="UF" maxLength={2} />
          <Campo nome="endereco" rotulo="Endereço" className="sm:col-span-2" />
          <Campo nome="instagram" rotulo="Instagram" placeholder="@perfil" />
          <div className="flex items-end">
            <Button type="submit" className="h-10 w-full sm:w-auto">
              Usar este negócio <ArrowRight />
            </Button>
          </div>
        </form>
      )}
      <Rodape onVoltar={onTrocarSetor} />
    </div>
  );
}

function Campo({
  nome, rotulo, className, ...input
}: { nome: string; rotulo: string; className?: string } & Omit<React.ComponentProps<"input">, "name">) {
  const id = `c-${nome}`;
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={id}>{rotulo}</Label>
      <Input id={id} name={nome} className="h-10 sm:h-9" {...input} />
    </div>
  );
}

// ───────── 3. Detalhes ─────────
type EstadoDet = { todosServ: string[]; servicos: string[]; cores: { nome: string; hex: string }[]; tom: string; layout: string; fotosUrls: string[]; comIA: boolean };
type SetDet = {
  setTodosServ: (v: string[]) => void; setServicos: (v: string[]) => void; setCores: (v: { nome: string; hex: string }[]) => void;
  setTom: (v: string) => void; setLayout: (v: string) => void; setFotosUrls: (v: string[]) => void; setComIA: (v: boolean) => void;
};

function PassoDetalhes({
  setor, lead, layouts, tons, iaRapida, estado, set, onTrocarLead, onVoltar, onContinuar,
}: {
  setor: SetorResumo; lead: Lead; layouts: LayoutInfo[]; tons: Record<string, string>; iaRapida: boolean;
  estado: EstadoDet; set: SetDet; onTrocarLead: () => void; onVoltar: () => void; onContinuar: (l: Lead) => void;
}) {
  const [det, setDet] = useState({
    nome: lead.nome ?? "", endereco: lead.endereco ?? "", telefone: lead.telefone ?? "", cidade: lead.cidade ?? "",
    instagram: lead.instagram ?? "", bairro: lead.bairro ?? "",
  });
  const [novoServ, setNovoServ] = useState("");
  const [novaFoto, setNovaFoto] = useState("");
  const { todosServ, servicos, cores, tom, layout, fotosUrls, comIA } = estado;
  const fotosG = lead.fotos?.length ?? 0;
  const c0 = cores[0]?.hex ?? "#0b8f8c";
  const c1 = cores[1]?.hex ?? c0;
  const campo = (k: keyof typeof det) => ({ value: det[k], onChange: (e: React.ChangeEvent<HTMLInputElement>) => setDet({ ...det, [k]: e.target.value }) });

  const addServ = (e: React.FormEvent) => {
    e.preventDefault();
    const v = novoServ.trim().slice(0, 80);
    if (!v) return;
    if (!todosServ.includes(v)) set.setTodosServ([...todosServ, v]);
    if (!servicos.includes(v)) set.setServicos([...servicos, v]);
    setNovoServ("");
  };
  const addFoto = (e: React.FormEvent) => {
    e.preventDefault();
    const v = novaFoto.trim();
    if (!/^https?:\/\/\S+$/i.test(v)) return toast.error("Cole um endereço começando com https://");
    if (fotosUrls.length >= 10) return toast.error("No máximo 10 fotos.");
    set.setFotosUrls([...fotosUrls, v]);
    setNovaFoto("");
  };

  const continuar = () => {
    if (!servicos.length) return toast.error("Escolha pelo menos um serviço.");
    if (servicos.length > 12) return toast.error("Escolha no máximo 12 serviços.");
    const mudouTel = det.telefone !== (lead.telefone ?? "");
    onContinuar({
      ...lead,
      ...det,
      nome: det.nome.trim() || lead.nome,
      whatsapp: mudouTel || !lead.whatsapp ? celularBR(det.telefone) || lead.whatsapp || "" : lead.whatsapp,
    });
  };

  return (
    <div className="grid gap-4">
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.65fr)]">
        <div className="grid gap-4">
          <Secao titulo="Identidade">
            <div className="grid gap-1.5">
              <Label htmlFor="d-nome">Nome do site</Label>
              <Input id="d-nome" className="h-10 sm:h-9" {...campo("nome")} />
            </div>
          </Secao>

          <Secao titulo="Identidade visual" dica={`Cores sugeridas para ${setor.nome.toLowerCase()}. Toque na cor para trocar.`}>
            <div className="grid gap-3 sm:grid-cols-2">
              {cores.map((c, i) => (
                <label key={i} className="flex cursor-pointer items-center gap-3 rounded-lg border p-2.5 hover:bg-muted/50">
                  <input
                    type="color"
                    value={c.hex}
                    onChange={(e) => set.setCores(cores.map((x, j) => (j === i ? { ...x, hex: e.target.value } : x)))}
                    className="size-11 shrink-0 cursor-pointer rounded-md border-0 bg-transparent p-0"
                    aria-label={`Cor ${i ? "secundária" : "principal"}`}
                  />
                  <span className="min-w-0 text-sm">
                    <span className="block truncate font-medium">{c.nome}</span>
                    <span className="text-xs text-muted-foreground">
                      {i ? "Secundária" : "Principal"} · {c.hex.toUpperCase()}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            <div className="h-10 rounded-lg" style={{ background: `linear-gradient(90deg, ${c0}, ${c1})` }} aria-hidden />
          </Secao>

          <Secao titulo="Contato e localização">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5 sm:col-span-2">
                <Label htmlFor="d-end">Endereço</Label>
                <Input id="d-end" className="h-10 sm:h-9" {...campo("endereco")} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="d-tel">Telefone / WhatsApp</Label>
                <Input id="d-tel" inputMode="tel" className="h-10 sm:h-9" {...campo("telefone")} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="d-cid">Cidade</Label>
                <Input id="d-cid" className="h-10 sm:h-9" {...campo("cidade")} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="d-ig">Instagram</Label>
                <Input id="d-ig" placeholder="@perfil" className="h-10 sm:h-9" {...campo("instagram")} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="d-bai">Bairro</Label>
                <Input id="d-bai" className="h-10 sm:h-9" {...campo("bairro")} />
              </div>
            </div>
          </Secao>

          <Secao titulo="O que o negócio oferece" dica="Já marcamos os mais comuns do ramo. Cada um vira um item no site.">
            <div className="flex flex-wrap gap-2">
              {todosServ.map((s) => (
                <Chip key={s} on={servicos.includes(s)} onClick={() => set.setServicos(servicos.includes(s) ? servicos.filter((x) => x !== s) : [...servicos, s])}>
                  {s}
                </Chip>
              ))}
            </div>
            <form onSubmit={addServ} className="flex gap-2 sm:max-w-md">
              <Input value={novoServ} onChange={(e) => setNovoServ(e.target.value)} placeholder="Adicionar outro serviço" className="h-10 sm:h-9" maxLength={80} />
              <Button type="submit" variant="outline" className="h-10 sm:h-9">
                <Plus /> Adicionar
              </Button>
            </form>
          </Secao>

          <Secao
            titulo="Fotos do negócio (opcional)"
            dica={
              <>
                {fotosG ? (
                  <b className="text-foreground">{fotosG} fotos do Google serão usadas automaticamente.</b>
                ) : (
                  "Sem fotos do Google: o site usa um visual com as cores e as iniciais."
                )}{" "}
                Para incluir mais, cole o endereço direto da imagem (no Instagram ou no Google: botão direito na foto → “Copiar endereço da imagem”).
              </>
            }
          >
            <form onSubmit={addFoto} className="flex gap-2">
              <Input value={novaFoto} onChange={(e) => setNovaFoto(e.target.value)} placeholder="https://…/foto.jpg" className="h-10 sm:h-9" inputMode="url" />
              <Button type="submit" variant="outline" className="h-10 sm:h-9">
                <ImagePlus /> Adicionar
              </Button>
            </form>
            {fotosUrls.length > 0 && (
              <ul className="grid gap-1.5">
                {fotosUrls.map((u, i) => (
                  <li key={i} className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm">
                    <ImagePlus className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{u}</span>
                    <button type="button" aria-label={`Remover foto ${i + 1}`} className="text-muted-foreground hover:text-destructive" onClick={() => set.setFotosUrls(fotosUrls.filter((_, j) => j !== i))}>
                      <X className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Secao>
        </div>

        <div className="grid gap-4">
          <section className="grid gap-3 rounded-xl border bg-card p-4">
            <div className="flex items-center gap-3">
              <FotoLead lead={lead} />
              <div className="min-w-0">
                <p className="truncate font-semibold">{lead.nome}</p>
                <span
                  className={cn(
                    "mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium",
                    lead.situacaoSite === "rede" ? "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300" : "bg-primary/10 text-primary",
                  )}
                >
                  {lead.situacaoSite === "rede" ? "Só tem rede social" : lead.situacaoSite === "tem" ? "Já tem site" : "Sem site"}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
              {lead.whatsapp && (
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
                  <MessageCircle className="size-3" /> WhatsApp
                </span>
              )}
              {!lead.whatsapp && lead.telefone && (
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
                  <Phone className="size-3" /> {lead.telefone}
                </span>
              )}
              {lead.instagram && (
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
                  <AtSign className="size-3" /> {lead.instagram}
                </span>
              )}
              <Nota lead={lead} />
            </div>
            <button type="button" onClick={onTrocarLead} className="w-fit text-sm text-primary underline-offset-4 hover:underline">
              Trocar negócio
            </button>
          </section>

          <Secao titulo="Tom de voz">
            <div className="grid gap-1.5" role="radiogroup" aria-label="Tom de voz">
              {Object.entries(tons).map(([k, v]) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={tom === k}
                  onClick={() => set.setTom(k)}
                  className={cn(
                    "flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left text-sm",
                    tom === k ? "border-primary bg-primary/5 font-medium text-primary" : "hover:bg-muted/60",
                  )}
                >
                  {v}
                  {tom === k && <Check className="size-4 shrink-0" />}
                </button>
              ))}
            </div>
          </Secao>

          <Secao titulo="Visual do site">
            <select value={layout} onChange={(e) => set.setLayout(e.target.value)} className={selectClass} aria-label="Visual do site">
              <option value="auto">Automático (melhor para o ramo)</option>
              {layouts.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.nome} — {v.descricao}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Depois dá para gerar outros visuais e voltar.{" "}
              <Link href="/painel/visuais" target="_blank" className="text-primary hover:underline">
                Ver todos
              </Link>
            </p>
          </Secao>

          <Secao titulo="Textos">
            <label className="flex items-start justify-between gap-3 text-sm">
              <span>
                <span className="font-medium">Escrever os textos com IA</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {iaRapida ? "Textos personalizados para este negócio." : "A IA local pode levar 1–2 min por site no seu computador."}
                </span>
              </span>
              <Switch checked={comIA} onCheckedChange={(v) => set.setComIA(!!v)} className="mt-1" />
            </label>
          </Secao>
        </div>
      </div>
      <Rodape onVoltar={onVoltar}>
        <Button className="h-10 px-4" onClick={continuar}>
          Continuar <ArrowRight />
        </Button>
      </Rodape>
    </div>
  );
}

// ───────── 4. Abordagem ─────────
function PassoAbordagem({
  lead, setorId, comIA, abordagem, setAbordagem, onVoltar, onGerar,
}: {
  lead: Lead; setorId: string; comIA: boolean; abordagem: Abordagem | null;
  setAbordagem: (a: Abordagem) => void; onVoltar: () => void; onGerar: () => void;
}) {
  const [erro, setErro] = useState("");
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    if (abordagem) return;
    let vivo = true;
    abordagemAction({ lead: { ...lead, setor: setorId }, setor: setorId, link: "", ia: comIA })
      .then((a) => vivo && setAbordagem(a))
      .catch((e) => vivo && setErro(e instanceof Error ? e.message : "Não foi possível montar as mensagens."));
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tentativa]);

  const a = abordagem;
  return (
    <div className="grid gap-4">
      {!a ? (
        erro ? (
          <div className="grid justify-items-center gap-3 rounded-xl border border-dashed p-8 text-center text-sm">
            <p className="text-destructive">{erro}</p>
            <Button variant="outline" onClick={() => {
                setErro("");
                setTentativa((n) => n + 1);
              }}>
              Tentar de novo
            </Button>
          </div>
        ) : (
          <div className="grid gap-3" aria-busy="true">
            {comIA && <p className="text-sm text-muted-foreground">Escrevendo as mensagens com IA…</p>}
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        )
      ) : (
        <>
          <section className="grid grid-cols-2 gap-4 rounded-xl border bg-card p-4 sm:grid-cols-4 sm:p-5">
            {(
              [
                ["Empresa", a.resumo.empresa],
                ["Nicho", a.resumo.nicho],
                ["Cidade", a.resumo.cidade],
                ["Objetivo", a.resumo.objetivo],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="min-w-0">
                <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">{k}</p>
                <p className="mt-0.5 font-semibold break-words">{v || "—"}</p>
              </div>
            ))}
          </section>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => copiar(a.mensagens.map((m) => m.texto).join("\n\n"))}>
              <Copy /> Copiar tudo
            </Button>
            {lead.whatsapp ? (
              <Button className="bg-[#1f9d55] text-white hover:bg-[#1a8a4a]" onClick={() => abrirWhats(lead.whatsapp, a.mensagens[0]?.texto)}>
                <MessageCircle /> Enviar 1ª mensagem no WhatsApp
              </Button>
            ) : (
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                Telefone fixo ou sem número: copie as mensagens ou ligue
              </span>
            )}
            {a.ia && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                <Sparkles className="size-3" /> Escrito pela IA
              </span>
            )}
          </div>
          {a.aviso && <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">{a.aviso}</p>}

          <ol className="grid gap-3">
            {a.mensagens.map((m, i) => (
              <li key={i} className="grid gap-2 rounded-xl border bg-card p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{i + 1}</span>
                  <b className="mr-auto">{m.etapa}</b>
                  <Button size="sm" variant="outline" onClick={() => copiar(m.texto)}>
                    <Copy /> Copiar
                  </Button>
                  {lead.whatsapp && (
                    <Button size="sm" variant="outline" onClick={() => abrirWhats(lead.whatsapp, m.texto)}>
                      <MessageCircle /> Enviar esta
                    </Button>
                  )}
                </div>
                {m.dica && <p className="text-xs text-muted-foreground italic">{m.dica}</p>}
                <p className="rounded-lg bg-muted/60 p-3 text-sm whitespace-pre-wrap">{m.texto}</p>
              </li>
            ))}
          </ol>
          <p className="text-xs text-muted-foreground">Dica: a mensagem com o link da prévia é gerada quando você publicar o site.</p>
        </>
      )}
      <Rodape onVoltar={onVoltar}>
        <Button className="h-11 px-5 text-[0.95rem]" onClick={onGerar}>
          <Sparkles /> Agora sim — gerar o site
        </Button>
      </Rodape>
    </div>
  );
}

// ───────── Geração ─────────
function GerarDialog({
  aberto, onFechar, comIA, temFotosGoogle, executar, onPronto,
}: {
  aberto: boolean;
  onFechar: () => void;
  comIA: boolean;
  temFotosGoogle: boolean;
  executar: () => Promise<{ ok: true; data: { id: string; ms: number; aviso: string | null } } | { ok: false; message: string }>;
  onPronto: (id: string) => void;
}) {
  const etapas = useMemo(
    () => [
      "lendo o briefing do negócio",
      "aplicando as regras do setor",
      comIA ? "escrevendo os textos com IA" : "escrevendo os textos de cada item",
      temFotosGoogle ? "baixando as fotos do Google" : "preparando as imagens",
      "montando os blocos do site",
      "aplicando cores e tipografia",
      "conferindo a versão para celular",
    ],
    [comIA, temFotosGoogle],
  );
  const [fim, setFim] = useState<{ s: string } | null>(null);
  const [rodando, setRodando] = useState(false);
  const [abertoAntes, setAbertoAntes] = useState(false);
  if (aberto !== abertoAntes) {
    setAbertoAntes(aberto);
    if (aberto) {
      setFim(null);
      setRodando(true);
    }
  }
  const pct = useProgressoSimulado(rodando, comIA);
  const feitas = fim ? etapas.length : Math.min(etapas.length, Math.floor(pct / (90 / etapas.length)));

  useEffect(() => {
    if (!aberto) return;
    let vivo = true;
    const t0 = performance.now();
    // Deixa a animação aparecer mesmo quando o motor responde em milissegundos
    const minimo = <T,>(x: T) => new Promise<T>((ok) => setTimeout(() => ok(x), Math.max(0, 1600 - (performance.now() - t0))));
    executar()
      .then(minimo)
      .then((r) => {
        if (!vivo) return;
        setRodando(false);
        if (!r.ok) {
          toast.error(r.message);
          onFechar();
          return;
        }
        setFim({ s: (r.data.ms / 1000).toFixed(1).replace(".", ",") });
        if (r.data.aviso) toast.warning(r.data.aviso);
        setTimeout(() => onPronto(r.data.id), 800);
      })
      .catch(() => {
        if (!vivo) return;
        setRodando(false);
        toast.error("Não foi possível gerar o site. Tente de novo.");
        onFechar();
      });
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  return (
    <Dialog open={aberto} onOpenChange={() => { /* não fecha durante a geração */ }}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{fim ? "Site pronto!" : "Montando o site"}</DialogTitle>
          <DialogDescription>{comIA && !fim ? "Com IA isso pode levar um pouco mais." : "Motor próprio da E-Nova."}</DialogDescription>
        </DialogHeader>
        <div className="grid justify-items-center gap-4">
          <AnelProgresso pct={pct} pronto={!!fim} />
          <Terminal
            titulo="e-nova montar --site"
            linhas={etapas.slice(0, feitas).map((texto) => ({ texto }))}
            final={fim ? `Site pronto em ${fim.s} s ✦` : undefined}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
