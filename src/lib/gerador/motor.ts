import "server-only";
import { copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import type { VideoBrief, VideoCenaProducao, VideoProjeto, VideoResultado, VideoRoteiro } from "@/db/schema";
import { enqueue } from "@/lib/jobs";
import { safeFetch } from "@/lib/net-safety";
import { getObjectBuffer, putObject } from "@/lib/storage";
import { argsVideo, ffmpeg, probe } from "@/lib/clips/ffmpeg";
import { executar, SemProvedor } from "@/lib/ia-hub/roteador";
import type { SaidaIA } from "@/lib/ia-hub/tipos";
import { escreverRoteiro, promptDaCena, type ExtrasRoteiro } from "./diretor";
import { conferirPersonagem, descreverFoto } from "./visao";
import { padraoDoProjeto, pegarPadrao } from "./padroes";
import { DIMENSOES } from "./formatos";
import { quemFaz } from "./quem";
import { vozDaBiblioteca } from "./vozes";
import { midiaDoBanco, midiaEscolhida } from "./banco";
import { renderAnimacao, type CenaRender } from "./animacao/render";
import type { AnimCena } from "./animacao/tipos";

// Motor do Gerador de vídeos: roteiro → cenas (visual + voz pela Central de IA) → montagem no FFmpeg → revisão.

const EXT: Record<string, string> = { "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov", "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "audio/mpeg": "mp3", "audio/wav": "wav", "audio/mp4": "m4a", "audio/ogg": "ogg" };
const FPS = 30;
const ANIM_PADRAO: AnimCena = { cenario: "rua-noite", paleta: "noite", acao: "parado" };

async function atualizar(id: string, v: Partial<typeof t.videoProjetos.$inferInsert>) {
  await db.update(t.videoProjetos).set({ ...v, updatedAt: new Date() }).where(eq(t.videoProjetos.id, id));
}
async function carregar(id: string): Promise<VideoProjeto> {
  const p = await db.query.videoProjetos.findFirst({ where: eq(t.videoProjetos.id, id) });
  if (!p) throw new Error("Projeto de vídeo não encontrado");
  return p;
}
const msg = (e: unknown) =>
  e instanceof SemProvedor
    ? `${e.message}${e.tentativas.length ? " (" + e.tentativas.map((x) => `${x.item}: ${x.erro ?? "falhou"}`).join("; ").slice(0, 600) + ")" : ""}`
    : e instanceof Error ? e.message : String(e);

// ───────── 1. Roteiro ─────────
export async function roteirizar(id: string) {
  const p = await carregar(id);
  await atualizar(id, { status: "ROTEIRIZANDO", progresso: 10, etapa: "O diretor está escrevendo o roteiro…", erro: null });
  try {
    const extras = await prepararExtras(p, (etapa) => atualizar(id, { etapa, progresso: 15 }));
    const roteiro = await escreverRoteiro(p.brief, {
      userId: p.userId,
      extras,
      progresso: async (_pct, etapa) => { if (etapa) await atualizar(id, { etapa: `O diretor está escrevendo o roteiro — ${etapa.replace(/…$/, "")}…`, progresso: 30 }); },
    });
    await atualizar(id, {
      status: "ROTEIRO_PRONTO", progresso: 100, etapa: (roteiro.cadeia?.join(", ") ?? `Roteiro escrito por ${roteiro.usado ?? "IA"}`).slice(0, 200), roteiro, titulo: roteiro.titulo.slice(0, 200),
      cenas: roteiro.cenas.map((c) => ({ id: c.id, status: "PENDENTE" })),
    });
  } catch (e) {
    await atualizar(id, { status: "FALHOU", etapa: "Não consegui escrever o roteiro", erro: msg(e).slice(0, 2000) });
  }
}

const mimeDaChave = (k: string) => (/\.png$/i.test(k) ? "image/png" : /\.webp$/i.test(k) ? "image/webp" : "image/jpeg");

/** Corrente de IAs, primeiro elo: a IA que enxerga descreve a foto do personagem e as fotos para animar. */
async function prepararExtras(p: VideoProjeto, avisar: (etapa: string) => Promise<void>): Promise<ExtrasRoteiro> {
  const b = p.brief;
  const extras: ExtrasRoteiro = {};
  if (b.padraoId) extras.padrao = await pegarPadrao(b.padraoId);
  if (b.fotoPersonagem && !(extras.padrao && b.mesmoPersonagem !== false)) {
    await avisar("Uma IA que enxerga imagens está olhando a foto do personagem…");
    extras.personagemFoto = await descreverFoto(await getObjectBuffer(b.fotoPersonagem), mimeDaChave(b.fotoPersonagem), "personagem", p.userId).catch(() => null);
  }
  if (b.fotosAnimar?.length) {
    extras.fotos = [];
    for (const [i, chave] of b.fotosAnimar.slice(0, 12).entries()) {
      await avisar(`Uma IA que enxerga imagens está olhando a foto ${i + 1} de ${Math.min(12, b.fotosAnimar.length)}…`);
      const d = await descreverFoto(await getObjectBuffer(chave), mimeDaChave(chave), "cena", p.userId).catch(() => null);
      extras.fotos.push({ chave, descricao: d ?? `photo ${i + 1} sent by the client` });
    }
  }
  return extras;
}

// ───────── 2. Cenas ─────────
async function baixarSaida(s: SaidaIA): Promise<{ buffer: Buffer; mime: string }> {
  const a = s.arquivos?.[0];
  if (!a) throw new Error("A IA não devolveu arquivo");
  if (a.buffer) return { buffer: a.buffer, mime: a.mime };
  const r = await safeFetch(a.url!, { signal: AbortSignal.timeout(180_000) });
  if (!r.ok) throw new Error(`não consegui baixar o resultado (${r.status})`);
  return { buffer: Buffer.from(await r.arrayBuffer()), mime: r.headers.get("content-type")?.split(";")[0] || a.mime };
}

/**
 * Serviços grátis têm limite por minuto (ex.: Pollinations = 1 imagem a cada 45 s por IP).
 * Quando TODAS as IAs falharam só por limite curto, espera o tempo pedido e tenta de novo.
 */
async function comPaciencia<T>(fn: () => Promise<T>, avisar: (etapa: string) => Promise<void>, voltas = 8): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (e) {
      if (!(e instanceof SemProvedor) || i >= voltas || !e.tentativas.length) throw e;
      const curtos = e.tentativas.map((x) => {
        const m = /retry after (\d+)\s*s|tente em (\d+)\s*s|(\d+) seconds/i.exec(x.erro ?? "");
        return /limite|429|402|FREE_LIMIT|rate/i.test(x.erro ?? "") ? Number(m?.[1] ?? m?.[2] ?? m?.[3] ?? 50) : null;
      });
      if (curtos.some((s) => s === null || s > 120)) throw e;
      const espera = Math.max(...(curtos as number[])) + 2 + Math.floor(Math.random() * 6);
      await avisar(`esperando a vez na IA grátis (${espera} s)…`);
      await new Promise((r) => setTimeout(r, espera * 1000));
    }
  }
}

/** Descrição fixa do personagem que aparece nesta cena (para a conferência), ou null. */
function personagemDaCena(roteiro: VideoRoteiro, prompt: string) {
  const ps = roteiro.personagens ?? [];
  const citados = ps.filter((x) => x.nome && prompt.toLowerCase().includes(x.nome.toLowerCase()));
  return citados.length ? citados.map((x) => `${x.nome}: ${x.descricao}`).join(". ") : null;
}

const ehVozMicrosoft =(v?: string) => !!v && /^[a-z]{2}-[A-Z]{2}-\w+Neural$/.test(v);

async function gerarCena(p: VideoProjeto, roteiro: VideoRoteiro, cenaId: string, progresso: (etapa: string) => Promise<void>, usados: Set<string> = new Set()): Promise<VideoCenaProducao> {
  const cena = roteiro.cenas.find((c) => c.id === cenaId)!;
  const brief = p.brief;
  const out: VideoCenaProducao = { id: cenaId, status: "PRONTA" };

  // visual: vídeo quando pedido (cai para imagem se nenhuma IA de vídeo conseguir)
  // na animação desenhada por código não há imagem para gerar: só a voz
  const animado = brief.estilo === "animacao";
  const prompt = promptDaCena(roteiro, cena.visual.prompt, brief.proporcao);
  let visual: { buffer: Buffer; mime: string } | null = null;
  const fonte = brief.fonteVisual ?? "ia";

  // 0) foto enviada pelo cliente para animar
  if (!animado && cena.visual.foto) {
    const buf = await getObjectBuffer(cena.visual.foto);
    const mime = mimeDaChave(cena.visual.foto);
    if (cena.visual.tipo === "video") {
      try {
        await progresso(`Cena ${cenaId}: animando a foto com IA de vídeo…`);
        const r = await executar("video", { prompt, proporcao: brief.proporcao, duracao: 5, imagemUrl: `data:${mime};base64,${buf.toString("base64")}` }, { userId: p.userId });
        visual = await baixarSaida(r); out.usadoVisual = `foto do cliente animada por ${r.usado.item}`;
      } catch { /* sem IA de vídeo: a foto ganha movimento de câmera na montagem */ }
    }
    if (!visual) { visual = { buffer: buf, mime }; out.usadoVisual = "foto do cliente"; }
  }
  // 1) mídia escolhida à mão no editor (Banco de mídia)
  if (!animado && !visual && cena.visual.escolhida) {
    try {
      await progresso(`Cena ${cenaId}: usando a mídia escolhida…`);
      const m = await midiaEscolhida(cena.visual.escolhida);
      visual = m; out.usadoVisual = "banco-de-midia"; out.midiaBanco = { url: m.item.url, pagina: m.item.pagina, autor: m.item.autor, fonte: m.item.fonte };
    } catch (e) { out.erro = `A mídia escolhida não baixou; procurei outra. ${msg(e).slice(0, 200)}`; }
  }
  // 2) Banco de mídia primeiro: foto/vídeo pronto, grátis e sem gastar IA
  let exemplo: Awaited<ReturnType<typeof midiaDoBanco>> = null;
  if (!animado && !visual && (fonte === "banco" || fonte === "referencia")) {
    await progresso(`Cena ${cenaId}: procurando no Banco de mídia…`);
    exemplo = await midiaDoBanco(brief, cena, usados, fonte === "referencia" ? { so: "foto" } : {}).catch(() => null);
    if (exemplo && fonte === "banco") {
      visual = exemplo; out.usadoVisual = "banco-de-midia";
      out.midiaBanco = { url: exemplo.item.url, pagina: exemplo.item.pagina, autor: exemplo.item.autor, fonte: exemplo.item.fonte };
    }
  }
  if (!visual && !animado && cena.visual.tipo === "video") {
    try {
      await progresso(`Cena ${cenaId}: gerando o clipe de vídeo…`);
      const r = await executar("video", { prompt, proporcao: brief.proporcao, duracao: cena.duracaoAlvo > 6 ? 10 : 5 }, { userId: p.userId, progresso: (_n, e) => (e ? progresso(`Cena ${cenaId}: ${e}`) : undefined) });
      visual = await baixarSaida(r);
      out.usadoVisual = r.usado.item;
    } catch (e) {
      out.erro = `Vídeo indisponível, usei imagem. ${msg(e).slice(0, 300)}`;
    }
  }
  if (!visual && !animado) {
    await progresso(`Cena ${cenaId}: desenhando a imagem…`);
    // 3) IA — no modo referência, a foto do banco vai junto como EXEMPLO a seguir (composição, luz, assunto)
    const ref = fonte === "referencia" && exemplo && exemplo.mime.startsWith("image/") ? `data:${exemplo.mime};base64,${exemplo.buffer.toString("base64")}` : undefined;
    const pedido = ref ? `${prompt} Use the reference image only as an example to follow for composition, lighting and subject; create a new, original image (do not copy it).` : prompt;
    if (ref && exemplo) out.midiaBanco = { url: exemplo.item.url, pagina: exemplo.item.pagina, autor: exemplo.item.autor, fonte: `${exemplo.item.fonte} (exemplo)` };
    const r = await comPaciencia(
      () => executar("imagem", { prompt: pedido, proporcao: brief.proporcao, ...(ref ? { imagemUrl: ref } : {}) }, { userId: p.userId, progresso: (_n, e) => (e ? progresso(`Cena ${cenaId}: ${e}`) : undefined) }),
      (e) => progresso(`Cena ${cenaId}: ${e}`),
    );
    visual = await baixarSaida(r);
    out.usadoVisual = r.usado.item;
    const ficha = personagemDaCena(roteiro, cena.visual.prompt);
    if (ficha && brief.revisar !== false && visual.mime.startsWith("image/")) {
      await progresso(`Cena ${cenaId}: conferindo se o personagem saiu igual…`);
      const v = await conferirPersonagem(visual.buffer, visual.mime, ficha, p.userId);
      if (!v.ok) {
        await progresso(`Cena ${cenaId}: personagem diferente (${(v.motivo ?? "").slice(0, 60)}); desenhando de novo…`);
        try {
          const r2 = await comPaciencia(() => executar("imagem", { prompt: `${pedido} Keep the character exactly as described.` , proporcao: brief.proporcao }, { userId: p.userId }), (e) => progresso(`Cena ${cenaId}: ${e}`), 3);
          visual = await baixarSaida(r2);
          out.usadoVisual = `${r2.usado.item} (refeita após conferência)`;
        } catch { /* fica a primeira */ }
      }
    }
  }
  if (visual) {
    out.visualMime = visual.mime;
    out.visualChave = `gerador/${p.id}/${cenaId}-visual.${EXT[visual.mime] ?? "bin"}`;
    await putObject(out.visualChave, visual.buffer, visual.mime);
  } else out.usadoVisual = "animacao";

  // voz
  await progresso(`Cena ${cenaId}: gravando a narração…`);
  // voz da biblioteca grátis: voz da Microsoft + velocidade e tom do preset
  const bib = vozDaBiblioteca(brief.voz);
  const rv = await comPaciencia(
    () => bib
      ? executar("voz", { prompt: cena.narracao, voz: bib.voz, idioma: "pt-BR", dados: { velocidade: bib.velocidade, tom: bib.tom } }, { userId: p.userId, somente: ["edge-tts"] })
      : executar("voz", { prompt: cena.narracao, voz: brief.voz, idioma: "pt-BR" }, brief.voz?.startsWith("minha:")
        ? { userId: p.userId, somente: ["minha-voz-cartesia", "minha-voz-local"], timeoutMs: 6 * 60_000 } // voz clonada: Cartesia, depois o computador
        : { userId: p.userId, preferir: ehVozMicrosoft(brief.voz) ? "edge-tts" : undefined }),
    (e) => progresso(`Cena ${cenaId}: ${e}`),
  );
  const audio = await baixarSaida(rv);
  out.usadoVoz = rv.usado.item;
  out.audioChave = `gerador/${p.id}/${cenaId}-voz.${EXT[audio.mime] ?? "mp3"}`;
  await putObject(out.audioChave, audio.buffer, audio.mime);
  return out;
}

/** Gera as cenas pendentes/que falharam (3 de cada vez) e depois monta. */
export async function produzir(id: string, o: { refazer?: string[] } = {}) {
  const p = await carregar(id);
  const roteiro = p.roteiro;
  if (!roteiro) throw new Error("Sem roteiro");
  let cenas: VideoCenaProducao[] = roteiro.cenas.map((c) => {
    const atual = p.cenas.find((x) => x.id === c.id);
    return atual && atual.status === "PRONTA" && !o.refazer?.includes(c.id) ? atual : { id: c.id, status: "PENDENTE" as const };
  });
  const fila = cenas.filter((c) => c.status !== "PRONTA").map((c) => c.id);
  const usados = new Set(cenas.flatMap((c) => (c.midiaBanco?.url ? [c.midiaBanco.url] : [])));
  await atualizar(id, { status: "PRODUZINDO", progresso: 3, etapa: "Preparando as cenas…", erro: null, cenas });

  let feitas = 0;
  let ultimo = 0;
  const salvar = async (etapa?: string, forcar = false) => {
    if (!forcar && Date.now() - ultimo < 1500) return;
    ultimo = Date.now();
    await atualizar(id, { cenas, progresso: Math.round(5 + (75 * feitas) / Math.max(1, fila.length)), ...(etapa ? { etapa } : {}) });
  };
  const trabalhar = async (cenaId: string) => {
    cenas = cenas.map((c) => (c.id === cenaId ? { ...c, status: "GERANDO" } : c));
    await salvar(undefined, true);
    let r: VideoCenaProducao;
    try {
      r = await gerarCena(p, roteiro, cenaId, (etapa) => salvar(etapa), usados);
    } catch (e) {
      r = { id: cenaId, status: "FALHOU", erro: msg(e).slice(0, 600) };
    }
    feitas++;
    cenas = cenas.map((c) => (c.id === cenaId ? r : c));
    await salvar(`${feitas} de ${fila.length} cenas prontas`, true);
  };
  const pendentes = [...fila];
  // só IA de imagem grátis (limite por IP): uma cena por vez para não brigar pela vez
  const imagemSoGratis = p.brief.estilo === "animacao" || p.brief.fonteVisual === "banco" ? false : ((await quemFaz(["imagem"]))[0]?.gratis ?? true);
  await Promise.all(Array.from({ length: Math.min(imagemSoGratis ? 1 : 3, pendentes.length) }, async () => {
    for (let c = pendentes.shift(); c; c = pendentes.shift()) await trabalhar(c);
  }));

  const falhas = cenas.filter((c) => c.status !== "PRONTA");
  if (falhas.length) {
    await atualizar(id, { status: "FALHOU", cenas, etapa: `${falhas.length} cena(s) não ficaram prontas`, erro: falhas.map((f) => `Cena ${f.id}: ${f.erro ?? "falhou"}`).join("\n").slice(0, 2000) });
    return;
  }
  await montar(id);
}

// ───────── 3. Montagem ─────────
const assTempo = (s: number) => {
  const cs = Math.max(0, Math.round(s * 100));
  return `${Math.floor(cs / 360000)}:${String(Math.floor(cs / 6000) % 60).padStart(2, "0")}:${String(Math.floor(cs / 100) % 60).padStart(2, "0")}.${String(cs % 100).padStart(2, "0")}`;
};
const assTexto = (s: string) => s.replace(/[{}\\]/g, "").replace(/\n/g, " ");

// Palavras que não podem terminar um bloco de legenda (artigo + substantivo, preposição + objeto, número + unidade…)
const LIGA = new Set("a o as os um uma uns umas de do da dos das em no na nos nas num numa por pelo pela pelos pelas pra pro para com sem e ou que se não nem ao à aos às mais muito seu sua meu minha".split(" "));

/** Agrupa a fala em blocos de leitura: corta na pontuação e nunca deixa uma palavra de ligação no fim do bloco. */
function blocosDeLeitura(palavras: string[], maxPalavras: number, maxLetras: number) {
  const out: string[][] = [];
  let atual: string[] = [];
  const fecha = () => { if (atual.length) out.push(atual); atual = []; };
  for (const [i, w] of palavras.entries()) {
    atual.push(w);
    const letras = atual.join(" ").length;
    const prox = palavras[i + 1];
    const ultimaLiga = LIGA.has(w.toLowerCase()) || /^\d+[.,]?\d*$/.test(w);
    if (/[.!?…;:]$/.test(w)) fecha();
    else if (/,$/.test(w) && atual.length >= 2) fecha();
    else if (!ultimaLiga && (atual.length >= maxPalavras || letras >= maxLetras)) fecha();
    else if (prox && atual.length >= maxPalavras + 2) fecha(); // limite duro
  }
  fecha();
  return out;
}

/** Legendas palavra a palavra (grupos curtos), distribuídas pelo tamanho de cada palavra na duração da fala. */
function legendas(brief: VideoBrief, blocos: { inicio: number; fala: number; dur: number; narracao: string; textoNaTela?: string }[]) {
  const [W, H] = DIMENSOES[brief.proporcao];
  const vertical = brief.proporcao === "9:16";
  const tam = Math.round(W * (vertical ? 0.07 : 0.045));
  const linhas: string[] = [];
  for (const b of blocos) {
    if (b.textoNaTela) linhas.push(`Dialogue: 1,${assTempo(b.inicio)},${assTempo(b.inicio + b.dur)},Topo,,0,0,0,,${assTexto(b.textoNaTela).toUpperCase()}`);
    if (!brief.legendas) continue;
    const palavras = b.narracao.split(/\s+/).filter(Boolean);
    const peso = (w: string) => Math.max(2, w.replace(/[^\p{L}\p{N}]/gu, "").length) + (/[.,!?;:…]$/.test(w) ? 3 : 0);
    const total = palavras.reduce((a, w) => a + peso(w), 0) || 1;
    let t0 = b.inicio + 0.05;
    for (const grupo of blocosDeLeitura(palavras, vertical ? 4 : 7, vertical ? 22 : 42)) {
      const t1 = t0 + (b.fala * grupo.reduce((a, w) => a + peso(w), 0)) / total;
      linhas.push(`Dialogue: 0,${assTempo(t0)},${assTempo(Math.max(t0 + 0.25, t1))},Legenda,,0,0,0,,${assTexto(grupo.join(" ")).toUpperCase()}`);
      t0 = t1;
    }
  }
  return `[Script Info]
ScriptType: v4.00+
PlayResX: ${W}
PlayResY: ${H}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Legenda,Arial,${tam},&H00FFFFFF,&H0000E9FF,&H00000000,&H78000000,-1,0,0,0,100,100,0,0,1,${Math.round(tam / 11)},2,2,${Math.round(W * 0.08)},${Math.round(W * 0.08)},${Math.round(H * (vertical ? 0.22 : 0.1))},1
Style: Topo,Arial,${Math.round(tam * 0.95)},&H00FFFFFF,&H00FFFFFF,&H00000000,&HB4101010,-1,0,0,0,100,100,0,0,3,${Math.round(tam / 5)},0,8,${Math.round(W * 0.08)},${Math.round(W * 0.08)},${Math.round(H * (vertical ? 0.1 : 0.07))},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${linhas.join("\n")}
`;
}

/** Filtro de movimento lento de câmera para uma imagem parada (Ken Burns). */
function movimento(camera: string | undefined, W: number, H: number, n: number, i: number) {
  const mov = (camera ?? "").toLowerCase();
  const tipo = /afast|out/.test(mov) ? "afastar" : /esq|left/.test(mov) ? "pan-esq" : /dir|right/.test(mov) ? "pan-dir" : /parad|static/.test(mov) ? "parado" : ["aproximar", "afastar", "pan-dir", "aproximar", "pan-esq"][i % 5];
  const z = tipo === "aproximar" ? `1+0.14*on/${n}` : tipo === "afastar" ? `1.14-0.14*on/${n}` : tipo === "parado" ? "1.02" : "1.12";
  const x = tipo === "pan-dir" ? `(iw-iw/zoom)*on/${n}` : tipo === "pan-esq" ? `(iw-iw/zoom)*(1-on/${n})` : "iw/2-(iw/zoom/2)";
  return `scale=${W * 2}:${H * 2}:force_original_aspect_ratio=increase,crop=${W * 2}:${H * 2},zoompan=z='${z}':x='${x}':y='ih/2-(ih/zoom/2)':d=${n}:s=${W}x${H}:fps=${FPS},setsar=1`;
}

export async function montar(id: string) {
  const p = await carregar(id);
  const roteiro = p.roteiro!;
  const brief = p.brief;
  const animado = brief.estilo === "animacao";
  const [W, H] = animado ? DIMENSOES["9:16"] : DIMENSOES[brief.proporcao];
  await atualizar(id, { status: "PRODUZINDO", progresso: 80, etapa: "Montando o vídeo…", erro: null });
  const dir = await mkdtemp(path.join(os.tmpdir(), "enova-gerador-"));
  try {
    // trilha (opcional): só se alguma IA de música estiver disponível
    let musicaArq: string | null = null;
    let musicaChave = p.resultado?.musicaChave;
    if (brief.musica && !animado) {
      try {
        if (!musicaChave) {
          await atualizar(id, { etapa: "Compondo a trilha…" });
          const total = roteiro.cenas.reduce((a, c) => a + c.duracaoAlvo, 0);
          const r = await executar("musica", { prompt: `${roteiro.musica ?? "upbeat modern background music"}, instrumental, no vocals`, duracao: Math.ceil(total + 5) }, { userId: p.userId });
          const m = await baixarSaida(r);
          musicaChave = `gerador/${id}/musica.${EXT[m.mime] ?? "mp3"}`;
          await putObject(musicaChave, m.buffer, m.mime);
        }
        musicaArq = path.join(dir, "musica");
        await writeFile(musicaArq, await getObjectBuffer(musicaChave));
      } catch { musicaArq = null; musicaChave = undefined; }
    }

    const blocos: { inicio: number; fala: number; dur: number; narracao: string; textoNaTela?: string }[] = [];
    let t0 = 0;
    if (animado) {
      // animação desenhada por código: cenário, personagem, efeitos, cartões, legenda e sons
      const cenasR: CenaRender[] = [];
      for (const [i, c] of roteiro.cenas.entries()) {
        const prod = p.cenas.find((x) => x.id === c.id);
        if (!prod?.audioChave) throw new Error(`A cena ${c.id} não tem voz`);
        const aud = path.join(dir, `a${i}.mp3`);
        await writeFile(aud, await getObjectBuffer(prod.audioChave));
        const fala = (await probe(aud)).durationSec ?? c.duracaoAlvo;
        const ultima = i === roteiro.cenas.length - 1;
        const dur = Math.max(1.5, fala + (ultima ? (roteiro.anim?.escolha ? 2.2 : 0.9) : 0.35));
        const base = c.anim ?? ANIM_PADRAO;
        cenasR.push({ anim: { ...base, status: base.status ?? c.textoNaTela?.toUpperCase().slice(0, 24) }, dur, fala, narracao: c.narracao, audio: aud, ...(c.corte ? { corte: c.corte } : {}), ...(c.mundo3d ? { mundo3d: c.mundo3d } : {}) });
        blocos.push({ inicio: t0, fala, dur, narracao: c.narracao, textoNaTela: c.textoNaTela });
        t0 += dur;
      }
      const tenso = cenasR.some((c) => c.anim.paleta === "terror" || c.anim.efeito === "perigo");
      let ult = 0;
      await renderAnimacao({
        dir, W, H, cenas: cenasR, video: roteiro.anim ?? {}, legendas: brief.legendas, ...(roteiro.corte ? { corte: roteiro.corte } : {}), ...(roteiro.mundo3d ? { mundo3d: roteiro.mundo3d } : {}), clima: !roteiro.corte && !roteiro.mundo3d && (tenso || cenasR[0]?.anim.paleta === "noite") ? "tensao" : "leve",
        progresso: async (pct) => { if (Date.now() - ult > 2000) { ult = Date.now(); await atualizar(id, { progresso: Math.round(80 + pct * 15), etapa: `Desenhando a animação… ${Math.round(pct * 100)}%` }); } },
      });
    } else {
    // segmentos de vídeo, um por cena, com a duração da fala
    const segs: string[] = [];
    const audios: { arq: string; dur: number }[] = [];
    for (const [i, c] of roteiro.cenas.entries()) {
      const prod = p.cenas.find((x) => x.id === c.id);
      if (!prod?.visualChave || !prod.audioChave) throw new Error(`A cena ${c.id} não tem imagem ou voz`);
      await atualizar(id, { progresso: Math.round(80 + (12 * i) / roteiro.cenas.length), etapa: `Montando a cena ${i + 1} de ${roteiro.cenas.length}…` });
      const vis = path.join(dir, `v${i}.${EXT[prod.visualMime ?? ""] ?? "bin"}`);
      const aud = path.join(dir, `a${i}.mp3`);
      await writeFile(vis, await getObjectBuffer(prod.visualChave));
      await writeFile(aud, await getObjectBuffer(prod.audioChave));
      const fala = (await probe(aud)).durationSec ?? c.duracaoAlvo;
      const dur = Math.max(1.5, fala + (i === roteiro.cenas.length - 1 ? 0.9 : 0.35));
      const n = Math.ceil(dur * FPS);
      const seg = path.join(dir, `s${i}.mp4`);
      const enc = [...(await argsVideo("alta")), "-r", String(FPS), "-an"];
      if (prod.visualMime?.startsWith("video/")) {
        await ffmpeg(["-stream_loop", "-1", "-i", vis, "-t", dur.toFixed(3), "-vf", `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},fps=${FPS},setsar=1`, ...enc, seg]);
      } else {
        // o Pollinations grátis carimba a marca no canto de baixo: corta uma faixa fina antes de enquadrar
        const semMarca = prod.usadoVisual === "pollinations-imagem" ? "crop=iw:ih*0.94:0:0," : "";
        await ffmpeg(["-i", vis, "-vf", semMarca + movimento(c.visual.camera, W, H, n, i), "-frames:v", String(n), ...enc, seg]);
      }
      segs.push(seg);
      audios.push({ arq: aud, dur });
      blocos.push({ inicio: t0, fala, dur, narracao: c.narracao, textoNaTela: c.textoNaTela });
      t0 += dur;
    }

    await atualizar(id, { progresso: 93, etapa: "Juntando cenas, voz, trilha e legendas…" });
    await writeFile(path.join(dir, "lista.txt"), segs.map((s) => `file '${path.basename(s)}'`).join("\n"));
    await ffmpeg(["-f", "concat", "-safe", "0", "-i", "lista.txt", "-c", "copy", "video.mp4"], { cwd: dir });

    // voz de todas as cenas em sequência (cada uma com a duração da sua cena)
    const entradasA = audios.flatMap((a) => ["-i", a.arq]);
    const filtroA = audios.map((a, i) => `[${i}:a]aresample=48000,aformat=channel_layouts=stereo,apad,atrim=0:${a.dur.toFixed(3)}[a${i}]`).join(";")
      + `;${audios.map((_, i) => `[a${i}]`).join("")}concat=n=${audios.length}:v=0:a=1,loudnorm=I=-16:TP=-1.5:LRA=11[voz]`;
    await ffmpeg([...entradasA, "-filter_complex", filtroA, "-map", "[voz]", "-ar", "48000", "voz.wav"], { cwd: dir });
    let trilha = "voz.wav";
    if (musicaArq) {
      // música baixa e "abaixando" sozinha quando a voz entra (ducking)
      await ffmpeg([
        "-i", "voz.wav", "-stream_loop", "-1", "-i", musicaArq, "-filter_complex",
        `[1:a]aresample=48000,aformat=channel_layouts=stereo,volume=0.22,atrim=0:${t0.toFixed(3)},afade=t=out:st=${Math.max(0, t0 - 1.5).toFixed(3)}:d=1.5[m];[0:a]asplit=2[v][sc];[m][sc]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=400[md];[v][md]amix=inputs=2:duration=first:normalize=0[out]`,
        "-map", "[out]", "mix.wav",
      ], { cwd: dir });
      trilha = "mix.wav";
    }

    await writeFile(path.join(dir, "legenda.ass"), legendas(brief, blocos), "utf8");
    let fontsdir = "";
    const fonte = process.env.CAPTION_FONT ?? (process.platform === "win32" ? "C:\\Windows\\Fonts\\arialbd.ttf" : "");
    if (fonte) try { await copyFile(fonte, path.join(dir, path.basename(fonte))); fontsdir = ":fontsdir=."; } catch { /* usa a padrão */ }
    await ffmpeg([
      "-i", "video.mp4", "-i", trilha, "-vf", `subtitles=legenda.ass${fontsdir}`, "-map", "0:v", "-map", "1:a",
      ...(await argsVideo("alta")), "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", "final.mp4",
    ], { cwd: dir });
    }

    // capa e folha de quadros para a revisão
    await ffmpeg(["-ss", Math.min(1, t0 / 2).toFixed(2), "-i", "final.mp4", "-frames:v", "1", "-q:v", "3", "capa.jpg"], { cwd: dir });
    const passo = Math.max(1, t0 / 12);
    await ffmpeg(["-i", "final.mp4", "-vf", `fps=1/${passo.toFixed(3)},scale=${Math.round(W / 4)}:-2,tile=6x2:padding=6:color=black`, "-frames:v", "1", "-q:v", "4", "folha.jpg"], { cwd: dir });

    const final = path.join(dir, "final.mp4");
    const info = await probe(final);
    const buf = await readFile(final);
    const videoChave = `gerador/${id}/video.mp4`;
    await putObject(videoChave, buf, "video/mp4");
    await putObject(`gerador/${id}/capa.jpg`, await readFile(path.join(dir, "capa.jpg")), "image/jpeg");
    await putObject(`gerador/${id}/folha.jpg`, await readFile(path.join(dir, "folha.jpg")), "image/jpeg");

    // "pronto = assistido": checagens objetivas do arquivo final
    const dur = info.durationSec ?? t0;
    const revisao: VideoResultado["revisao"] = [
      { item: "Duração perto do pedido", ok: Math.abs(dur - brief.duracaoAlvo) <= Math.max(8, brief.duracaoAlvo * 0.35), detalhe: `${Math.round(dur)} s de ${brief.duracaoAlvo} s pedidos` },
      { item: "Gancho rápido (1ª cena até 4 s)", ok: (blocos[0]?.dur ?? 99) <= 4.5, detalhe: `${(blocos[0]?.dur ?? 0).toFixed(1)} s` },
      { item: "Tem áudio", ok: info.hasAudio },
      { item: "Resolução certa", ok: info.width === W && info.height === H, detalhe: `${info.width}×${info.height}` },
      { item: "Legendas", ok: brief.legendas, detalhe: brief.legendas ? "palavra a palavra, no terço de baixo" : "desligadas" },
      animado
        ? { item: "Som", ok: true, detalhe: "clima de fundo e efeitos sonoros gerados no servidor" }
        : { item: "Trilha sonora", ok: !brief.musica || !!musicaArq, detalhe: brief.musica ? (musicaArq ? "com ducking sob a voz" : "nenhuma IA de música disponível; saiu só com a voz") : "desligada" },
      { item: "Cenas longas demais (> 9 s)", ok: !blocos.some((b) => b.dur > 9), detalhe: blocos.filter((b) => b.dur > 9).map((b, i) => `cena ${i + 1}`).join(", ") || "nenhuma" },
    ];

    let outputAssetId: string | null = p.outputAssetId;
    if (p.clientId) {
      const [asset] = await db.insert(t.mediaAssets).values({
        clientId: p.clientId, storageKey: videoChave, filename: `${(roteiro.titulo || "video").replace(/[^\p{L}\p{N} _-]/gu, "").slice(0, 60) || "video"}.mp4`,
        mime: "video/mp4", sizeBytes: buf.length, status: "READY", createdBy: p.userId,
      }).returning({ id: t.mediaAssets.id });
      outputAssetId = asset.id;
    }
    await atualizar(id, {
      status: "PRONTO", progresso: 100, etapa: "Vídeo pronto", outputAssetId,
      resultado: { videoChave, capaChave: `gerador/${id}/capa.jpg`, folhaChave: `gerador/${id}/folha.jpg`, duracao: dur, musicaChave, revisao },
    });
    // memória: o vídeo pronto vira um padrão (personagem, estética, formato, voz…) para gerar outro com 1 botão
    await padraoDoProjeto(await carregar(id)).catch(() => null);
  } catch (e) {
    await atualizar(id, { status: "FALHOU", etapa: "A montagem falhou", erro: msg(e).slice(0, 2000) });
    throw e;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function enfileirarRoteiro(id: string) { await enqueue("video.roteiro", { id }, { maxAttempts: 1 }); }
export async function enfileirarProducao(id: string, refazer?: string[]) { await enqueue("video.produzir", { id, ...(refazer?.length ? { refazer } : {}) }, { maxAttempts: 1, dedupeKey: `video:${id}` }); }
export async function enfileirarMontagem(id: string) { await enqueue("video.montar", { id }, { maxAttempts: 1, dedupeKey: `video:${id}` }); }
