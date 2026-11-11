"use server";

import { createWriteStream } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { headers } from "next/headers";
import { z } from "zod";
import { requirePermission, type SessionUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { audit } from "@/lib/audit";
import { rateLimit } from "@/lib/cache";
import { env } from "@/lib/env";
import { executar, SemProvedor } from "@/lib/ia-hub/roteador";
import { itemCatalogo } from "@/lib/ia-hub/catalogo";
import { apagarUpload, arquivoDoUpload, MAX_BYTES, pastaTrabalho, publicar, type ArquivoPronto } from "@/lib/ferramentas/arquivos";
import { baixar, lerLink, validarLink, type InfoLink, type Opcao } from "@/lib/ferramentas/baixador";
import { comprimirUm, compactarZip, converterUm, cortar, imagensParaPdf, NIVEIS, tipoDe, TODOS_FORMATOS, webmParaMp4 } from "@/lib/ferramentas/midia";
import { buscarPixabay, chavePixabay, salvarChavePixabay, urlPixabayValida, type ItemMidia } from "@/lib/ferramentas/pixabay";
import { gerarQr } from "@/lib/ferramentas/qr";
import { criarSessao, conferirToken, ipLocal, removerDaMesa } from "@/lib/ferramentas/celular";
import { cotacoes, criarCaixa, historico, lerMensagem, listarMensagens, type MensagemResumo } from "@/lib/ferramentas/servicos";
import { MOEDAS } from "@/lib/ferramentas/catalogo";
import { safeFetch } from "@/lib/net-safety";
import QRCode from "qrcode";

export type Resultado<T> = { ok: true; dados: T } | { ok: false; message: string };

const falha = (e: unknown): { ok: false; message: string } => {
  if (e instanceof z.ZodError) return { ok: false, message: e.issues[0]?.message ?? "Dados inválidos." };
  return { ok: false, message: e instanceof Error ? e.message : "Algo deu errado. Tente de novo." };
};

async function limite(me: SessionUser, nome: string, max: number, janelaS: number) {
  if (!(await rateLimit(`ferr:${nome}:${me.id}`, max, janelaS))) throw new Error("Muitos pedidos seguidos. Espere um pouco e tente de novo.");
}

const idsSchema = z.array(z.string().regex(/^[a-f0-9]{24}$/, "Arquivo inválido. Envie de novo.")).min(1, "Escolha pelo menos um arquivo.").max(20, "No máximo 20 arquivos por vez.");

/** Abre os uploads, roda o trabalho numa pasta temporária e sempre limpa tudo no fim. */
async function comArquivos<T>(me: SessionUser, ids: string[], fn: (arquivos: { caminho: string; nome: string; tamanho: number }[], pasta: string) => Promise<T>): Promise<T> {
  const arquivos = await Promise.all(ids.map((id) => arquivoDoUpload(me.id, id)));
  const pasta = await pastaTrabalho();
  try {
    return await fn(arquivos, pasta);
  } finally {
    await rm(pasta, { recursive: true, force: true });
    await Promise.all(ids.map((id) => apagarUpload(me.id, id)));
  }
}

// ───────── Conversor ─────────
export async function converterAction(input: { ids: string[]; formato: string }): Promise<Resultado<ArquivoPronto[]>> {
  const me = await requirePermission("ai:use");
  try {
    const { ids, formato } = z.object({ ids: idsSchema, formato: z.enum(TODOS_FORMATOS as [string, ...string[]], "Formato inválido.") }).parse(input);
    await limite(me, "midia", 40, 600);
    return {
      ok: true,
      dados: await comArquivos(me, ids, async (arquivos, pasta) => {
        if (formato === "pdf") {
          if (arquivos.some((a) => tipoDe(a.nome) !== "image")) throw new Error("Para PDF, envie só imagens.");
          const nome = arquivos.length === 1 ? `${path.parse(arquivos[0].nome).name}.pdf` : "imagens.pdf";
          const saida = await imagensParaPdf(arquivos.map((a) => a.caminho), path.join(pasta, nome));
          return [await publicar(me.id, saida, nome)];
        }
        const out: ArquivoPronto[] = [];
        for (const a of arquivos) {
          if (tipoDe(a.nome) === "other") throw new Error(`${a.nome}: tipo de arquivo não reconhecido.`);
          const sub = path.join(pasta, String(out.length));
          await mkdir(sub, { recursive: true });
          const saida = await converterUm(a.caminho, a.nome, formato, sub);
          out.push(await publicar(me.id, saida, path.basename(saida)));
        }
        return out;
      }),
    };
  } catch (e) {
    return falha(e);
  }
}

// ───────── Compressor e ZIP ─────────
export type Comprimido = ArquivoPronto & { antes: number; manteve: boolean };

export async function comprimirAction(input: { ids: string[]; nivel: string }): Promise<Resultado<Comprimido[]>> {
  const me = await requirePermission("ai:use");
  try {
    const { ids, nivel } = z.object({ ids: idsSchema, nivel: z.enum(Object.keys(NIVEIS) as [keyof typeof NIVEIS, ...(keyof typeof NIVEIS)[]]) }).parse(input);
    await limite(me, "midia", 40, 600);
    return {
      ok: true,
      dados: await comArquivos(me, ids, async (arquivos, pasta) => {
        const out: Comprimido[] = [];
        for (const a of arquivos) {
          const r = await comprimirUm(a.caminho, a.nome, nivel, pasta);
          out.push({ ...(await publicar(me.id, r.saida, path.basename(r.saida))), antes: r.antes, manteve: r.manteve });
        }
        return out;
      }),
    };
  } catch (e) {
    return falha(e);
  }
}

export async function zipAction(input: { ids: string[]; nome?: string }): Promise<Resultado<Comprimido>> {
  const me = await requirePermission("ai:use");
  try {
    const { ids, nome } = z.object({ ids: idsSchema, nome: z.string().trim().max(80).optional() }).parse(input);
    await limite(me, "midia", 40, 600);
    return {
      ok: true,
      dados: await comArquivos(me, ids, async (arquivos, pasta) => {
        const final = `${(nome || (arquivos.length === 1 ? path.parse(arquivos[0].nome).name : "arquivos")).replace(/[<>:"/\\|?*]/g, "_")}.zip`;
        const saida = await compactarZip(arquivos, path.join(pasta, final));
        const antes = arquivos.reduce((t, a) => t + a.tamanho, 0);
        return { ...(await publicar(me.id, saida, final)), antes, manteve: false };
      }),
    };
  } catch (e) {
    return falha(e);
  }
}

// ───────── Cortar vídeo ─────────
export async function cortarVideoAction(input: { id: string; trechos: [number, number][]; exato: boolean; semSom: boolean }): Promise<Resultado<ArquivoPronto>> {
  const me = await requirePermission("ai:use");
  try {
    const d = z.object({
      id: z.string().regex(/^[a-f0-9]{24}$/),
      trechos: z.array(z.tuple([z.number().min(0).max(86_400), z.number().min(0).max(86_400)])).min(1, "Marque pelo menos um trecho.").max(50),
      exato: z.boolean(),
      semSom: z.boolean(),
    }).parse(input);
    await limite(me, "midia", 40, 600);
    return {
      ok: true,
      dados: await comArquivos(me, [d.id], async ([a], pasta) => {
        const saida = await cortar(a.caminho, a.nome, d.trechos, { exato: d.exato, semSom: d.semSom }, pasta);
        return publicar(me.id, saida, path.basename(saida));
      }),
    };
  } catch (e) {
    return falha(e);
  }
}

// ───────── Gravar tela (WebM → MP4) ─────────
export async function gravacaoParaMp4Action(id: string): Promise<Resultado<ArquivoPronto>> {
  const me = await requirePermission("ai:use");
  try {
    z.string().regex(/^[a-f0-9]{24}$/).parse(id);
    await limite(me, "midia", 40, 600);
    return {
      ok: true,
      dados: await comArquivos(me, [id], async ([a], pasta) => {
        const saida = await webmParaMp4(a.caminho, pasta);
        return publicar(me.id, saida, path.basename(saida));
      }),
    };
  } catch (e) {
    return falha(e);
  }
}

// ───────── Baixador ─────────
const opcaoSchema = z.object({ tipo: z.enum(["video", "audio", "original"]), altura: z.number().int().min(144).max(4320).optional(), rotulo: z.string().max(60) });

export async function lerLinkAction(url: string): Promise<Resultado<InfoLink & { url: string }>> {
  const me = await requirePermission("ai:use");
  try {
    const limpo = await validarLink(z.string().trim().min(8, "Cole um link.").max(2000).parse(url));
    await limite(me, "baixador-info", 30, 600);
    return { ok: true, dados: { ...(await lerLink(limpo)), url: limpo } };
  } catch (e) {
    return falha(e);
  }
}

export async function baixarAction(input: { url: string; opcao: Opcao }): Promise<Resultado<ArquivoPronto>> {
  const me = await requirePermission("ai:use");
  try {
    const d = z.object({ url: z.string().trim().max(2000), opcao: opcaoSchema }).parse(input);
    const limpo = await validarLink(d.url);
    await limite(me, "baixador", 15, 600);
    const pasta = await pastaTrabalho();
    try {
      const arquivo = await baixar(limpo, d.opcao, pasta, MAX_BYTES);
      const pronto = await publicar(me.id, arquivo, path.basename(arquivo));
      await audit(me, "ferramentas.baixar", { meta: { host: new URL(limpo).hostname, tipo: d.opcao.tipo } });
      return { ok: true, dados: pronto };
    } finally {
      await rm(pasta, { recursive: true, force: true });
    }
  } catch (e) {
    return falha(e);
  }
}

// ───────── Banco de mídia (Pixabay) ─────────
export async function salvarChavePixabayAction(chave: string | null): Promise<Resultado<null>> {
  const me = await requirePermission("ai:use");
  try {
    if (!can(me.role, "system:view")) throw new Error("Só administradores podem trocar a chave da Pixabay.");
    const limpa = chave === null ? null : z.string().trim().regex(/^[\w-]{10,80}$/, "Essa chave não parece da Pixabay.").parse(chave);
    if (limpa) await buscarPixabay(limpa, "praia", "foto", 1); // confere antes de salvar
    await salvarChavePixabay(limpa);
    await audit(me, limpa ? "ferramentas.pixabay.salvar" : "ferramentas.pixabay.remover");
    return { ok: true, dados: null };
  } catch (e) {
    return falha(e);
  }
}

export async function buscarMidiaAction(input: { termo: string; tipo: "foto" | "video"; pagina: number }): Promise<Resultado<{ itens: ItemMidia[]; total: number }>> {
  const me = await requirePermission("ai:use");
  try {
    const d = z.object({ termo: z.string().trim().max(100), tipo: z.enum(["foto", "video"]), pagina: z.number().int().min(1).max(50) }).parse(input);
    await limite(me, "pixabay", 90, 60);
    const chave = await chavePixabay();
    if (!chave) throw new Error("A chave da Pixabay ainda não foi configurada.");
    return { ok: true, dados: await buscarPixabay(chave, d.termo || "natureza", d.tipo, d.pagina) };
  } catch (e) {
    return falha(e);
  }
}

/** Baixa o arquivo da Pixabay para o storage do E-Nova (eles pedem para não usar o link deles direto). */
export async function salvarMidiaAction(input: { url: string; nome: string }): Promise<Resultado<ArquivoPronto>> {
  const me = await requirePermission("ai:use");
  try {
    const d = z.object({ url: z.string().url().max(2000), nome: z.string().trim().max(120) }).parse(input);
    if (!urlPixabayValida(d.url)) throw new Error("Link fora da Pixabay.");
    await limite(me, "pixabay-baixar", 40, 600);
    const r = await safeFetch(d.url, { signal: AbortSignal.timeout(5 * 60_000) });
    if (!r.ok || !r.body) throw new Error(`A Pixabay não entregou o arquivo (${r.status}).`);
    const tam = Number(r.headers.get("content-length") ?? 0);
    if (tam > MAX_BYTES) throw new Error("Arquivo grande demais.");
    const ext = path.extname(new URL(d.url).pathname).slice(1).toLowerCase() || "jpg";
    const nome = `${d.nome.replace(/[^\p{L}\p{N} _-]/gu, "").replace(/\s+/g, "-").slice(0, 60) || "pixabay"}.${ext}`;
    const pasta = await pastaTrabalho();
    try {
      const destino = path.join(pasta, nome);
      let total = 0;
      const entrada = Readable.fromWeb(r.body as import("node:stream/web").ReadableStream).on("data", (c: Buffer) => {
        total += c.length;
        if (total > MAX_BYTES) entrada.destroy(new Error("Arquivo grande demais."));
      });
      await pipeline(entrada, createWriteStream(destino));
      return { ok: true, dados: await publicar(me.id, destino, nome) };
    } finally {
      await rm(pasta, { recursive: true, force: true });
    }
  } catch (e) {
    return falha(e);
  }
}

// ───────── QR Code ─────────
const cor = z.string().regex(/^#[0-9a-f]{6}$/i, "Cor inválida.");

export async function qrAction(fd: FormData): Promise<Resultado<{ png: string; svg: string | null }>> {
  const me = await requirePermission("ai:use");
  try {
    const d = z.object({
      texto: z.string().min(1, "Digite o texto ou link.").max(2000, "Texto longo demais para um QR Code."),
      escuro: cor,
      claro: cor,
      tamanho: z.coerce.number().int().min(256).max(2048),
    }).parse({ texto: fd.get("texto"), escuro: fd.get("escuro"), claro: fd.get("claro"), tamanho: fd.get("tamanho") });
    await limite(me, "qr", 120, 600);
    const logo = fd.get("logo");
    let buf: Buffer | null = null;
    if (logo instanceof File && logo.size > 0) {
      if (logo.size > 3 * 1024 * 1024) throw new Error("Logo grande demais (máx. 3 MB).");
      if (!/^image\/(png|jpe?g|webp|svg\+xml|gif|avif)$/.test(logo.type)) throw new Error("O logo precisa ser uma imagem (PNG, JPG, WEBP ou SVG).");
      buf = Buffer.from(await logo.arrayBuffer());
    }
    return { ok: true, dados: await gerarQr({ ...d, logo: buf }) };
  } catch (e) {
    return falha(e);
  }
}

// ───────── Tradutor e Chat (Central de IA) ─────────
type RespostaIA = { texto: string; ia: string };

const nomeIa = (id: string) => itemCatalogo(id)?.nome ?? id;
function erroIa(e: unknown) {
  if (e instanceof SemProvedor) {
    return { ok: false as const, message: e.tentativas.length ? "Nenhuma IA de texto conseguiu responder agora. Tente de novo em instantes." : "Nenhuma IA de texto está conectada. Cadastre uma chave na Central de IA." };
  }
  return falha(e);
}

export async function traduzirAction(input: { texto: string; destino: string }): Promise<Resultado<RespostaIA>> {
  const me = await requirePermission("ai:use");
  try {
    const d = z.object({ texto: z.string().trim().min(1, "Digite o texto.").max(12_000, "Texto longo demais (máx. 12 mil caracteres)."), destino: z.string().trim().min(2).max(40) }).parse(input);
    await limite(me, "ia-texto", 60, 600);
    const r = await executar("texto", {
      sistema: `Você é um tradutor profissional. Detecte o idioma do texto e traduza para ${d.destino}. Mantenha o tom, a formatação (quebras de linha, listas, markdown), números, links e nomes próprios. Responda SOMENTE com a tradução, sem aspas, sem explicações.`,
      prompt: d.texto,
      temperatura: 0.2,
    }, { userId: me.id });
    return { ok: true, dados: { texto: (r.texto ?? "").trim(), ia: nomeIa(r.usado.item) } };
  } catch (e) {
    return erroIa(e);
  }
}

export async function chatAction(input: { mensagens: { papel: "usuario" | "ia"; texto: string }[]; instrucoes?: string }): Promise<Resultado<RespostaIA>> {
  const me = await requirePermission("ai:use");
  try {
    const d = z.object({
      mensagens: z.array(z.object({ papel: z.enum(["usuario", "ia"]), texto: z.string().max(12_000) })).min(1).max(60),
      instrucoes: z.string().max(2000).optional(),
    }).parse(input);
    await limite(me, "ia-texto", 60, 600);
    // os adaptadores recebem um texto só: a conversa vai como transcrição (últimas mensagens, até ~16 mil caracteres)
    const linhas: string[] = [];
    let total = 0;
    for (const m of [...d.mensagens].reverse()) {
      const l = `${m.papel === "usuario" ? "Usuário" : "Assistente"}: ${m.texto}`;
      if (total + l.length > 16_000 && linhas.length) break;
      linhas.unshift(l);
      total += l.length;
    }
    const r = await executar("texto", {
      sistema: `Você é um assistente prestativo de uma agência de marketing. Responda em português do Brasil, de forma clara e direta, a não ser que peçam outro idioma.${d.instrucoes ? `\nInstruções do usuário: ${d.instrucoes}` : ""}\nA seguir vem a conversa até agora; responda só a última mensagem do usuário, sem repetir o prefixo "Assistente:".`,
      prompt: linhas.join("\n\n"),
      temperatura: 0.7,
    }, { userId: me.id });
    return { ok: true, dados: { texto: (r.texto ?? "").replace(/^Assistente:\s*/i, "").trim(), ia: nomeIa(r.usado.item) } };
  } catch (e) {
    return erroIa(e);
  }
}

// ───────── Transferir para o celular ─────────
export type SessaoCelular = { token: string; exp: number; enderecos: { rotulo: string; url: string; qr: string }[]; aviso: string | null };

export async function iniciarCelularAction(): Promise<Resultado<SessaoCelular>> {
  const me = await requirePermission("ai:use");
  try {
    await limite(me, "celular", 30, 600);
    const { token, exp } = criarSessao();
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
    const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || /^\d/.test(host) ? "http" : "https");
    const [hostname, porta] = host.split(":");
    const caminho = `/api/ferramentas/celular?t=${encodeURIComponent(token)}`;
    const ip = ipLocal();
    const local = !hostname || /^(localhost|127\.|\[?::1)/.test(hostname) || /^(10|192\.168|172\.(1[6-9]|2\d|3[01]))\./.test(hostname);
    const urls: { rotulo: string; url: string }[] = [];
    if (local && ip) urls.push({ rotulo: "Rede local (mesmo Wi-Fi)", url: `http://${ip}${porta ? `:${porta}` : ""}${caminho}` });
    if (!local && host) urls.push({ rotulo: "Endereço do E-Nova", url: `${proto}://${host}${caminho}` });
    if (local && !/localhost|127\.0\.0\.1/.test(env.APP_URL)) urls.push({ rotulo: "Endereço público", url: `${env.APP_URL.replace(/\/$/, "")}${caminho}` });
    if (!urls.length) urls.push({ rotulo: "Este computador", url: `${proto}://${host}${caminho}` });
    const enderecos = await Promise.all(urls.map(async (u) => ({ ...u, qr: await QRCode.toDataURL(u.url, { margin: 1, width: 480, errorCorrectionLevel: "M" }) })));
    await audit(me, "ferramentas.celular.iniciar");
    return {
      ok: true,
      dados: {
        token,
        exp,
        enderecos,
        aviso: local && !ip ? "Não achei a rede local deste computador. Confira se ele está no Wi-Fi ou no cabo." : null,
      },
    };
  } catch (e) {
    return falha(e);
  }
}

export async function removerDoCelularAction(token: string, id: string): Promise<Resultado<null>> {
  await requirePermission("ai:use");
  try {
    const s = conferirToken(token);
    if (!s) throw new Error("A sessão expirou. Gere um novo QR Code.");
    await removerDaMesa(s.sessao, z.string().regex(/^[a-f0-9]{24}$/).parse(id));
    return { ok: true, dados: null };
  } catch (e) {
    return falha(e);
  }
}

// ───────── Câmbio ─────────
export async function cambioAction(): Promise<Resultado<{ taxas: Record<string, number>; fonte: string; atualizado: string }>> {
  const me = await requirePermission("ai:use");
  try {
    await limite(me, "cambio", 60, 600);
    return { ok: true, dados: await cotacoes() };
  } catch (e) {
    return falha(e);
  }
}

export async function historicoCambioAction(moeda: string): Promise<Resultado<{ data: string; valor: number }[]>> {
  const me = await requirePermission("ai:use");
  try {
    const m = z.enum(MOEDAS.map(([c]) => c).filter((c) => c !== "BRL") as [string, ...string[]]).parse(moeda);
    await limite(me, "cambio", 60, 600);
    return { ok: true, dados: await historico(m) };
  } catch (e) {
    return falha(e);
  }
}

// ───────── E-mail temporário (mail.tm) ─────────
const tokenMt = z.string().min(20).max(2000).regex(/^[\w.-]+$/);

export async function criarEmailAction(): Promise<Resultado<{ endereco: string; token: string }>> {
  const me = await requirePermission("ai:use");
  try {
    await limite(me, "email-criar", 10, 600);
    return { ok: true, dados: await criarCaixa() };
  } catch (e) {
    return falha(e);
  }
}

export async function listarEmailsAction(token: string): Promise<Resultado<MensagemResumo[] | "expirou">> {
  const me = await requirePermission("ai:use");
  try {
    await limite(me, "email-ler", 200, 600);
    return { ok: true, dados: await listarMensagens(tokenMt.parse(token)) };
  } catch (e) {
    return falha(e);
  }
}

export async function lerEmailAction(token: string, id: string): Promise<Resultado<string>> {
  const me = await requirePermission("ai:use");
  try {
    await limite(me, "email-ler", 200, 600);
    return { ok: true, dados: await lerMensagem(tokenMt.parse(token), z.string().regex(/^[\w-]{1,64}$/).parse(id)) };
  } catch (e) {
    return falha(e);
  }
}
