"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeftRight, Copy, Inbox, Loader2, Mail, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";
import { cambioAction, criarEmailAction, historicoCambioAction, lerEmailAction, listarEmailsAction } from "@/app/actions/ferramentas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { selectClass } from "@/components/field";
import { MOEDAS } from "@/lib/ferramentas/catalogo";
import { cn } from "@/lib/utils";
import { BotaoAcao, copiar, Painel, Segmentado, useArmazenado } from "./comum";

// ════════════════════ Câmbio ════════════════════
type Cotacoes = { taxas: Record<string, number>; fonte: string; atualizado: string };

function dinheiro(v: number, moeda: string) {
  const codigo = moeda === "USDT" ? "USD" : moeda;
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: codigo, maximumFractionDigits: ["BTC", "ETH"].includes(moeda) ? 8 : 2 }).format(v);
  } catch {
    return `${v.toLocaleString("pt-BR", { maximumFractionDigits: 8 })} ${moeda}`;
  }
}
const nomeMoeda = (c: string) => MOEDAS.find(([m]) => m === c)?.[1] ?? c;

export function Cambio() {
  const [pref, setPref] = useArmazenado("enova.ferramentas.cambio");
  const [de, para] = (pref ?? "USD|BRL").split("|");
  const [valor, setValor] = useState("1");
  const [dados, setDados] = useState<Cotacoes | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [hist, setHist] = useState<{ moeda: string; pontos: { data: string; valor: number }[] } | null>(null);
  const base = de !== "BRL" ? de : para !== "BRL" ? para : null;

  useEffect(() => {
    let vivo = true;
    const carregar = () => cambioAction().then((r) => {
      if (!vivo) return;
      if (r.ok) {
        setDados(r.dados);
        setErro(null);
      } else setErro(r.message);
    });
    void carregar();
    const t = setInterval(carregar, 60_000);
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    if (!base) return;
    let vivo = true;
    void historicoCambioAction(base).then((r) => vivo && r.ok && setHist({ moeda: base, pontos: r.dados }));
    return () => {
      vivo = false;
    };
  }, [base]);

  const num = Number.parseFloat(valor.replace(/\./g, "").replace(",", ".")) || 0;
  const taxaDe = dados?.taxas[de];
  const taxaPara = dados?.taxas[para];
  const resultado = taxaDe && taxaPara ? (num * taxaDe) / taxaPara : null;


  const grafico = useMemo(() => {
    const pontos = hist && hist.moeda === base ? hist.pontos : [];
    if (pontos.length < 2) return null;
    const vs = pontos.map((p) => p.valor);
    const mn = Math.min(...vs);
    const mx = Math.max(...vs);
    const W = 420;
    const H = 110;
    const xy = vs.map((v, i) => [(i / (vs.length - 1)) * W, H - 6 - ((v - mn) / (mx - mn || 1)) * (H - 12)]);
    const d = xy.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
    return { d, W, H, mn, mx, variacao: (vs.at(-1)! / vs[0] - 1) * 100 };
  }, [hist, base]);

  const opcoes = MOEDAS.map(([c, n]) => <option key={c} value={c}>{c === "USDT" ? "USD" : c} — {n}</option>);

  return (
    <Painel titulo="Câmbio" descricao="Cotação das principais moedas em reais, atualizada a cada minuto.">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-end">
        <div className="grid gap-1.5">
          <Label htmlFor="cx-de">De</Label>
          <select id="cx-de" className={selectClass} value={de} onChange={(e) => setPref(`${e.target.value}|${para}`)}>{opcoes}</select>
        </div>
        <Button variant="outline" size="icon-lg" className="size-11 justify-self-center sm:size-9" onClick={() => setPref(`${para}|${de}`)} aria-label="Inverter moedas">
          <ArrowLeftRight />
        </Button>
        <div className="grid gap-1.5">
          <Label htmlFor="cx-para">Para</Label>
          <select id="cx-para" className={selectClass} value={para} onChange={(e) => setPref(`${de}|${e.target.value}`)}>{opcoes}</select>
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="cx-valor">Valor</Label>
        <Input id="cx-valor" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} className="h-12 text-lg tabular-nums sm:h-10" />
      </div>
      <div className="rounded-xl bg-muted/50 p-4">
        {erro && !dados ? (
          <p className="text-sm text-destructive">{erro}</p>
        ) : resultado === null ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Buscando cotação…</p>
        ) : (
          <>
            <button type="button" onClick={() => copiar(dinheiro(resultado, para), "Valor copiado")} className="text-left text-3xl font-bold tabular-nums [overflow-wrap:anywhere] sm:text-4xl" title="Copiar">
              {dinheiro(resultado, para)}
            </button>
            <p className="mt-1 text-sm text-muted-foreground">
              1 {nomeMoeda(de)} = {dinheiro(taxaDe! / taxaPara!, para)} • {dados?.fonte}
            </p>
          </>
        )}
      </div>
      {base && grafico && (
        <div className="grid gap-1">
          <p className="text-sm font-medium">
            {nomeMoeda(base)} em reais — últimos 30 dias{" "}
            <span className={cn("text-xs", grafico.variacao >= 0 ? "text-signal" : "text-destructive")}>{grafico.variacao >= 0 ? "+" : ""}{grafico.variacao.toFixed(2).replace(".", ",")}%</span>
          </p>
          <svg viewBox={`0 0 ${grafico.W} ${grafico.H}`} className="h-28 w-full" preserveAspectRatio="none" role="img" aria-label={`Variação de ${nomeMoeda(base)} em 30 dias`}>
            <path d={`${grafico.d} L ${grafico.W} ${grafico.H} L 0 ${grafico.H} Z`} className="fill-signal/15" />
            <path d={grafico.d} className="fill-none stroke-signal" strokeWidth={2} vectorEffect="non-scaling-stroke" />
          </svg>
          <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
            <span>mín. {dinheiro(grafico.mn, "BRL")}</span>
            <span>máx. {dinheiro(grafico.mx, "BRL")}</span>
          </div>
        </div>
      )}
      {dados && (
        <ul className="grid grid-cols-2 gap-1.5 text-sm sm:grid-cols-4">
          {["USD", "USDT", "EUR", "GBP", "ARS", "BTC"].filter((c) => dados.taxas[c]).map((c) => (
            <li key={c} className="rounded-lg border px-2.5 py-1.5">
              <span className="block text-xs text-muted-foreground">{nomeMoeda(c)}</span>
              <span className="tabular-nums">{dinheiro(dados.taxas[c], "BRL")}</span>
            </li>
          ))}
        </ul>
      )}
    </Painel>
  );
}

// ════════════════════ E-mail temporário ════════════════════
type Conta = { endereco: string; token: string };
type Mensagem = { id: string; assunto: string; de: string; resumo: string; em: string; codigo: string | null };

export function EmailTemporario() {
  const [bruto, setBruto] = useArmazenado("enova.ferramentas.email");
  const conta = useMemo<Conta | null>(() => {
    try {
      const c = JSON.parse(bruto ?? "null") as Conta | null;
      return c?.endereco && c.token ? c : null;
    } catch {
      return null;
    }
  }, [bruto]);
  const [msgs, setMsgs] = useState<Mensagem[]>([]);
  const [criando, setCriando] = useState(false);
  const [aberta, setAberta] = useState<{ id: string; texto: string | null } | null>(null);

  async function criar() {
    setCriando(true);
    try {
      const r = await criarEmailAction();
      if (!r.ok) return void toast.error(r.message);
      setMsgs([]);
      setAberta(null);
      setBruto(JSON.stringify(r.dados));
    } finally {
      setCriando(false);
    }
  }

  useEffect(() => {
    if (!conta) return;
    let vivo = true;
    const ler = async () => {
      const r = await listarEmailsAction(conta.token);
      if (!vivo || !r.ok) return;
      if (r.dados === "expirou") {
        setBruto(null);
        toast.message("A caixa temporária expirou. Crie um novo endereço.");
        return;
      }
      setMsgs(r.dados);
    };
    void ler();
    const t = setInterval(ler, 5000);
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, [conta, setBruto]);

  async function abrir(id: string) {
    if (aberta?.id === id) return setAberta(null);
    setAberta({ id, texto: null });
    const r = await lerEmailAction(conta!.token, id);
    setAberta({ id, texto: r.ok ? r.dados : r.message });
  }

  return (
    <Painel titulo="E-mail temporário" descricao="Um endereço descartável para cadastros e códigos de confirmação (serviço gratuito mail.tm).">
      {!conta ? (
        <div className="grid gap-3">
          <div><BotaoAcao ocupado={criando} onClick={criar} icone={<Mail data-icon="inline-start" />}>Criar endereço</BotaoAcao></div>
        </div>
      ) : (
        <>
          <div className="grid gap-2 rounded-xl border bg-background p-3">
            <span className="text-xs text-muted-foreground">Seu e-mail temporário</span>
            <span className="font-mono text-base [overflow-wrap:anywhere] select-all">{conta.endereco}</span>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <Button className="h-11 sm:h-8" onClick={() => copiar(conta.endereco, "Endereço copiado. Cole no site e espere aqui.")}><Copy data-icon="inline-start" /> Copiar</Button>
              <Button variant="outline" className="h-11 sm:h-8" onClick={criar} disabled={criando}>
                {criando ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <RefreshCw data-icon="inline-start" />} Novo endereço
              </Button>
            </div>
          </div>
          {!msgs.length ? (
            <p className="flex items-center justify-center gap-2 rounded-xl border border-dashed px-3 py-8 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Esperando e-mails… (confere a cada 5 segundos)
            </p>
          ) : (
            <ul className="grid gap-2">
              {msgs.map((m) => (
                <li key={m.id} className="rounded-xl border bg-background">
                  <button type="button" onClick={() => abrir(m.id)} className="grid w-full gap-0.5 p-3 text-left" aria-expanded={aberta?.id === m.id}>
                    <span className="flex items-start gap-2">
                      <Inbox className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                      <strong className="min-w-0 flex-1 text-sm [overflow-wrap:anywhere]">{m.assunto}</strong>
                      <span className="shrink-0 text-xs text-muted-foreground">{new Date(m.em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                    </span>
                    <span className="truncate pl-6 text-xs text-muted-foreground">{m.de}</span>
                    <span className="line-clamp-2 pl-6 text-sm text-muted-foreground">{m.resumo}</span>
                  </button>
                  {m.codigo && (
                    <div className="px-3 pb-3 pl-9">
                      <Button size="sm" className="h-10 sm:h-7" onClick={() => copiar(m.codigo!, `Código ${m.codigo} copiado`)}>
                        <Copy data-icon="inline-start" /> Código {m.codigo}
                      </Button>
                    </div>
                  )}
                  {aberta?.id === m.id && (
                    <div className="border-t px-3 py-3 text-sm whitespace-pre-wrap [overflow-wrap:anywhere] select-text">
                      {aberta.texto ?? <span className="inline-flex items-center gap-2 text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Abrindo…</span>}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      <p className="text-xs text-muted-foreground">Qualquer pessoa com este endereço pode ler a caixa. Não use em contas importantes (banco, e-mail principal, redes do cliente).</p>
    </Painel>
  );
}

// ════════════════════ Dados de teste (CPF/CNPJ) ════════════════════
function aleatorios(n: number) {
  const v = new Uint8Array(n);
  crypto.getRandomValues(v);
  return [...v].map((x) => x % 10);
}
function digitosCpf(b: number[]) {
  for (const len of [9, 10]) {
    let s = 0;
    for (let i = 0; i < len; i++) s += b[i] * (len + 1 - i);
    b.push(((s * 10) % 11) % 10);
  }
  return b;
}
function digitosCnpj(b: number[]) {
  for (const w of [[5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2], [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]]) {
    const r = w.reduce((t, x, i) => t + x * b[i], 0) % 11;
    b.push(r < 2 ? 0 : 11 - r);
  }
  return b;
}
const gerarCpf = () => {
  let b: number[];
  do b = aleatorios(9);
  while (new Set(b).size === 1);
  return digitosCpf(b).join("");
};
const gerarCnpj = () => digitosCnpj([...aleatorios(8), 0, 0, 0, 1]).join("");
const fmtCpf = (v: string) => v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
const fmtCnpj = (v: string) => v.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");

function validar(v: string): { ok: boolean; texto: string } | null {
  const d = v.replace(/\D/g, "");
  if (!d) return null;
  if (d.length === 11) {
    const ok = new Set(d).size > 1 && digitosCpf(d.slice(0, 9).split("").map(Number)).join("") === d;
    return { ok, texto: ok ? "CPF válido" : "CPF inválido" };
  }
  if (d.length === 14) {
    const ok = new Set(d).size > 1 && digitosCnpj(d.slice(0, 12).split("").map(Number)).join("") === d;
    return { ok, texto: ok ? "CNPJ válido" : "CNPJ inválido" };
  }
  return { ok: false, texto: "Digite 11 números (CPF) ou 14 (CNPJ)" };
}

export function DadosTeste() {
  const [tipo, setTipo] = useState<"cpf" | "cnpj">("cpf");
  const [pontuar, setPontuar] = useState(true);
  const [qtd, setQtd] = useState<"1" | "5" | "10">("1");
  const [lista, setLista] = useState<string[]>([]);
  const [conferir, setConferir] = useState("");
  const resultado = validar(conferir);

  function gerar() {
    setLista(Array.from({ length: Number(qtd) }, () => (tipo === "cpf" ? gerarCpf() : gerarCnpj())));
  }
  const mostrar = (v: string) => (pontuar ? (v.length === 11 ? fmtCpf(v) : fmtCnpj(v)) : v);

  return (
    <Painel titulo="Dados de teste" descricao="Gere CPF e CNPJ com dígitos verificadores válidos para testar formulários e sistemas. São números aleatórios: não pertencem a ninguém de propósito, e não devem ser usados para cadastros reais.">
      <div className="grid gap-3 sm:grid-cols-2">
        <Segmentado<"cpf" | "cnpj"> rotulo="Gerar" valor={tipo} onChange={(t) => { setTipo(t); setLista([]); }} colunas={2} opcoes={[{ v: "cpf", rotulo: "CPF" }, { v: "cnpj", rotulo: "CNPJ" }]} />
        <Segmentado<"1" | "5" | "10"> rotulo="Quantidade" valor={qtd} onChange={setQtd} opcoes={[{ v: "1", rotulo: "1" }, { v: "5", rotulo: "5" }, { v: "10", rotulo: "10" }]} />
      </div>
      <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
        <input type="checkbox" checked={pontuar} onChange={(e) => setPontuar(e.target.checked)} className="size-5 accent-signal" /> Com pontuação
      </label>
      <div className="grid gap-2 sm:flex">
        <BotaoAcao onClick={gerar} icone={<Sparkles data-icon="inline-start" />}>Gerar {tipo.toUpperCase()}</BotaoAcao>
        {lista.length > 1 && (
          <Button variant="outline" className="h-11 sm:h-9" onClick={() => copiar(lista.map(mostrar).join("\n"), "Lista copiada")}><Copy data-icon="inline-start" /> Copiar todos</Button>
        )}
      </div>
      {lista.length > 0 && (
        <ul className="grid gap-1.5 sm:grid-cols-2">
          {lista.map((v, i) => (
            <li key={`${v}-${i}`}>
              <button type="button" onClick={() => copiar(mostrar(v), `${mostrar(v)} copiado`)} className="flex min-h-11 w-full items-center gap-2 rounded-lg border bg-background px-3 font-mono text-base hover:bg-muted">
                <span className="flex-1 text-left tabular-nums">{mostrar(v)}</span>
                <Copy className="size-4 text-muted-foreground" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="grid gap-1.5 border-t pt-4">
        <Label htmlFor="conferir-doc">Conferir um CPF ou CNPJ</Label>
        <Input id="conferir-doc" inputMode="numeric" value={conferir} onChange={(e) => setConferir(e.target.value)} placeholder="000.000.000-00" className="h-11 font-mono sm:h-9" />
        {resultado && (
          <p className={cn("flex items-center gap-1.5 text-sm", resultado.ok ? "text-signal" : "text-destructive")}>
            <ShieldCheck className="size-4" aria-hidden /> {resultado.texto}
          </p>
        )}
      </div>
    </Painel>
  );
}
