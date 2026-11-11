import "server-only";
import { desc, gte } from "drizzle-orm";
import { db, t } from "@/db";
import { CATALOGO } from "./catalogo";
import { chavesLista, preferencias } from "./config";
import { adaptadorPara } from "./adaptadores";
import { FalhaProvedor, type Capacidade, type EntradaIA, type ItemCatalogo, type Rota, type SaidaIA } from "./tipos";

// ───────── saúde dos provedores (disjuntor) ─────────
// Quem falha 3 vezes seguidas fica "de castigo" por alguns minutos: o roteador pula direto para o próximo.
type Saude = { falhas: number; ate: number; ultimoErro?: string };
const g = globalThis as unknown as { __iaSaude?: Map<string, Saude> };
const saude = (g.__iaSaude ??= new Map());
const chaveSaude = (item: ItemCatalogo, rota: Rota) => `${item.id}:${rota.via}:${rota.provedor}`;

function registrarFalha(k: string, erro: string, motivo: FalhaProvedor["motivo"]) {
  const s = saude.get(k) ?? { falhas: 0, ate: 0 };
  s.falhas++;
  s.ultimoErro = erro.slice(0, 300);
  // limite de uso/cota: castigo maior; erro de chave: até alguém trocar a chave
  const minutos = motivo === "sem-chave" || motivo === "recusado" ? 60 : motivo === "limite" ? 10 : s.falhas >= 3 ? 5 : 0;
  if (minutos) s.ate = Date.now() + minutos * 60_000;
  saude.set(k, s);
}
export function estadoSaude() {
  return Object.fromEntries([...saude.entries()].map(([k, v]) => [k, { ...v, emCastigo: v.ate > Date.now() }]));
}
export function limparSaude(prefixo?: string) {
  for (const k of [...saude.keys()]) if (!prefixo || k.startsWith(prefixo)) saude.delete(k);
  // "Tentar de novo": grava um marco no banco para ignorar as falhas anteriores
  void db.insert(t.iaExecucoes).values({ capacidade: "reset", ok: true, tentativas: prefixo ? [{ item: prefixo.split(":")[0], via: prefixo.split(":")[1] ?? "", provedor: prefixo.split(":")[2] ?? "", ok: true, ms: 0 }] : [] }).catch(() => {});
}

// ───────── controle de concorrência por provedor (ideia do Free Claude Code) ─────────
// Planos grátis aceitam poucos pedidos ao mesmo tempo: em vez de tomar 429 e "queimar" a chave,
// o pedido espera a vez (até 45 s) dentro do mesmo processo.
const SIMULTANEOS: Record<string, number> = { gemini: 2, pollinations: 1, groq: 3, cloudflare: 3, openrouter: 2, huggingface: 2, nvidia: 3, cerebras: 3, sambanova: 2 };
const go = globalThis as unknown as { __iaOcupados?: Map<string, number> };
const ocupados = (go.__iaOcupados ??= new Map());
async function pegarVaga(provedor: string, sinal: AbortSignal): Promise<() => void> {
  const max = SIMULTANEOS[provedor] ?? 4;
  const limite = Date.now() + 45_000;
  while ((ocupados.get(provedor) ?? 0) >= max && Date.now() < limite && !sinal.aborted) await new Promise((r) => setTimeout(r, 250));
  ocupados.set(provedor, (ocupados.get(provedor) ?? 0) + 1);
  let solto = false;
  return () => { if (!solto) { solto = true; ocupados.set(provedor, Math.max(0, (ocupados.get(provedor) ?? 1) - 1)); } };
}

// ───────── ordem de tentativa ─────────
export type Candidato = { item: ItemCatalogo; rota: Rota; nota: number; temChave: boolean; chaves: number; chavesFora: number; emCastigo: boolean; motivoFora?: string };

/**
 * Falhas recentes registradas no banco (valem para o painel e para o worker, que são processos diferentes).
 * Chave recusada ou sem crédito: pausa de 30 min. Três falhas seguidas: pausa de 5 min.
 */
async function pausasDoBanco(): Promise<Map<string, string>> {
  const desde = new Date(Date.now() - 30 * 60_000);
  const linhas = await db.select({ capacidade: t.iaExecucoes.capacidade, tentativas: t.iaExecucoes.tentativas, em: t.iaExecucoes.createdAt }).from(t.iaExecucoes)
    .where(gte(t.iaExecucoes.createdAt, desde)).orderBy(desc(t.iaExecucoes.createdAt)).limit(200).catch(() => []);
  const seq = new Map<string, { falhas: number; fechado: boolean; erro?: string; em: number }>();
  const pausados = new Map<string, string>();
  for (const l of linhas) {
    if (l.capacidade === "reset" && !l.tentativas.length) break; // "tentar de novo" geral
    if (l.capacidade === "reset") {
      // "tentar de novo" de um serviço: libera todas as chaves dele
      for (const tt of l.tentativas) for (let i = 0; i < 10; i++) {
        const k = `${tt.item}:${tt.via}:${tt.provedor}#${i}`;
        if (!seq.has(k)) seq.set(k, { falhas: 0, fechado: true, em: l.em.getTime() });
      }
      continue;
    }
    for (const tt of [...l.tentativas].reverse()) {
      const k = `${tt.item}:${tt.via}:${tt.provedor}#${tt.chave ?? 0}`;
      const s = seq.get(k) ?? { falhas: 0, fechado: false, em: l.em.getTime() };
      if (s.fechado) continue;
      if (tt.ok) { s.fechado = true; seq.set(k, s); continue; }
      s.falhas++; s.erro ??= tt.erro;
      seq.set(k, s);
      const grave = /\((401|402|403|429)\)|limite|crédito|chave inválida/i.test(tt.erro ?? "");
      if (grave || (s.falhas >= 3 && Date.now() - s.em < 5 * 60_000)) pausados.set(k, tt.erro ?? "falhou");
    }
  }
  return pausados;
}

export async function candidatos(cap: Capacidade, opts: { preferir?: string } = {}): Promise<Candidato[]> {
  const pref = await preferencias();
  const pausas = await pausasDoBanco();
  const itens = CATALOGO.filter((i) => i.capacidades[cap] && (i.status ?? "api") === "api" && !pref.desligados.includes(i.id));
  const manual = pref.ordem[cap] ?? [];
  const ordenados = [...itens].sort((a, b) => {
    if (opts.preferir) { if (a.id === opts.preferir) return -1; if (b.id === opts.preferir) return 1; }
    const ia = manual.indexOf(a.id), ib = manual.indexOf(b.id);
    if (ia !== -1 || ib !== -1) return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    if (pref.modo === "economia" && a.custo !== b.custo) return a.custo - b.custo;
    return (b.capacidades[cap] ?? 0) - (a.capacidades[cap] ?? 0);
  });
  const out: Candidato[] = [];
  for (const item of ordenados) {
    for (const rota0 of item.rotas) {
      const rota = pref.modelos[item.id] && rota0 === item.rotas[0] ? { ...rota0, modelo: pref.modelos[item.id] } : rota0;
      const chaves = await chavesLista(rota.provedor);
      const k = chaveSaude(item, rota);
      const fora = chaves.map((_, i) => { const s = saude.get(`${k}#${i}`); return (s && s.ate > Date.now() ? s.ultimoErro ?? "pausada" : null) ?? pausas.get(`${k}#${i}`) ?? null; });
      const todasFora = chaves.length > 0 && fora.every(Boolean);
      out.push({ item, rota, nota: item.capacidades[cap] ?? 0, temChave: chaves.length > 0, chaves: chaves.length, chavesFora: fora.filter(Boolean).length, emCastigo: todasFora, motivoFora: todasFora ? fora.find(Boolean) ?? undefined : undefined });
    }
  }
  return out;
}

export type Tentativa = { item: string; via: string; provedor: string; modelo?: string; chave?: number; ok: boolean; ms: number; erro?: string };
export class SemProvedor extends Error {
  constructor(public readonly cap: Capacidade, public readonly tentativas: Tentativa[]) {
    super(tentativas.length ? `Nenhuma IA conseguiu fazer "${cap}" agora.` : `Nenhuma IA configurada para "${cap}". Cadastre uma chave na Central de IA.`);
  }
}

/**
 * Executa uma função de IA com revezamento automático:
 * tenta a melhor IA configurada; se falhar (erro, limite, fora do ar), passa para a próxima.
 */
export async function executar(cap: Capacidade, entrada: EntradaIA, opts: { preferir?: string; timeoutMs?: number; userId?: string | null; progresso?: (pct: number, etapa?: string) => void | Promise<void>; somente?: string[]; validar?: (s: SaidaIA) => void } = {}): Promise<SaidaIA & { usado: Tentativa; tentativas: Tentativa[] }> {
  // convenção da tela: no Avatar, "template" é o id do avatar
  if (cap === "avatar" && entrada.template && !entrada.dados?.avatar) entrada = { ...entrada, dados: { ...(entrada.dados ?? {}), avatar: entrada.template } };
  const lista = (await candidatos(cap, opts)).filter((c) => c.temChave && (!opts.somente || opts.somente.includes(c.item.id)));
  const tentativas: Tentativa[] = [];
  // quem está de castigo vai para o fim (ainda pode salvar se todo o resto falhar)
  const ordem = [...lista.filter((c) => !c.emCastigo), ...lista.filter((c) => c.emCastigo)];
  const queimadas = new Set<string>(); // chaves que já falharam por limite/recusa nesta execução
  for (const c of ordem) {
    const k = chaveSaude(c.item, c.rota);
    const adaptador = adaptadorPara(c.rota);
    if (!adaptador) continue;
    const chaves = await chavesLista(c.rota.provedor);
    // chaves de castigo vão para o fim (ainda podem salvar se todas as outras falharem)
    const idx = chaves.map((_, i) => i).sort((a, b) => Number((saude.get(`${k}#${a}`)?.ate ?? 0) > Date.now()) - Number((saude.get(`${k}#${b}`)?.ate ?? 0) > Date.now()));
    for (const i of idx) {
      const kc = `${k}#${i}`;
      if (queimadas.has(`${c.rota.provedor}#${i}`)) continue;
      const t0 = Date.now();
      const sinal = AbortSignal.timeout(opts.timeoutMs ?? (cap === "texto" ? 120_000 : 15 * 60_000));
      const soltar = await pegarVaga(c.rota.provedor, sinal);
      try {
        await opts.progresso?.(0, `Tentando ${c.item.nome}${chaves.length > 1 ? ` (chave ${i + 1} de ${chaves.length})` : ""}…`);
        const r = await adaptador(cap, entrada, { chave: chaves[i], rota: c.rota, item: c.item, sinal, progresso: opts.progresso });
        soltar();
        opts.validar?.(r); // resposta fora do formato também passa a vez
        const usado: Tentativa = { item: c.item.id, via: c.rota.via, provedor: c.rota.provedor, modelo: c.rota.modelo, chave: i, ok: true, ms: Date.now() - t0 };
        tentativas.push(usado);
        saude.delete(kc);
        await log(cap, tentativas, opts.userId).catch(() => {});
        return { ...r, usado, tentativas };
      } catch (e) {
        soltar();
        const motivo = e instanceof FalhaProvedor ? e.motivo : sinal.aborted ? "fora" : "erro";
        const msg = e instanceof Error ? e.message : String(e);
        tentativas.push({ item: c.item.id, via: c.rota.via, provedor: c.rota.provedor, modelo: c.rota.modelo, chave: i, ok: false, ms: Date.now() - t0, erro: msg.slice(0, 300) });
        if (motivo !== "nao-suporta") registrarFalha(kc, msg, motivo);
        // só problema DA CHAVE (limite, crédito, recusada) faz tentar a próxima chave do mesmo serviço;
        // serviço fora do ar, formato ou "não suporta" passam direto para a próxima IA
        if (!(motivo === "limite" || motivo === "recusado" || motivo === "sem-chave")) break;
        queimadas.add(`${c.rota.provedor}#${i}`);
      }
    }
  }
  await log(cap, tentativas, opts.userId).catch(() => {});
  throw new SemProvedor(cap, tentativas);
}

async function log(cap: Capacidade, tentativas: Tentativa[], userId?: string | null) {
  if (!tentativas.length) return;
  await db.insert(t.iaExecucoes).values({ capacidade: cap, ok: tentativas.some((x) => x.ok), tentativas, userId: userId ?? null });
}

/** Ajuda os adaptadores a classificar respostas HTTP. */
export async function checarResposta(r: Response, quem: string): Promise<void> {
  if (r.ok) return;
  const corpo = (await r.text().catch(() => "")).slice(0, 300);
  if (r.status === 401 || r.status === 403) throw new FalhaProvedor(`${quem}: chave inválida ou sem permissão (${r.status}) ${corpo}`, "recusado");
  if (r.status === 402 || r.status === 429) throw new FalhaProvedor(`${quem}: limite/crédito esgotado (${r.status}) ${corpo}`, "limite");
  if (r.status >= 500) throw new FalhaProvedor(`${quem}: fora do ar (${r.status})`, "fora");
  throw new FalhaProvedor(`${quem}: erro ${r.status} ${corpo}`, "erro");
}
