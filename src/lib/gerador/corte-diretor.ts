import "server-only";
import sharp from "sharp";
import { z } from "zod";
import { executar } from "@/lib/ia-hub/roteador";
import { FalhaProvedor } from "@/lib/ia-hub/tipos";
import { limparSvgPeca } from "./animacao/corte";
import { ACOES_BONECO, AMBIENTES_CORTE, CEUS_CORTE, FLUXOS, LUGARES_PECA, PECAS_PRONTAS, SONS, type CorteVideo } from "./animacao/tipos";

// Diretor do "mundo em corte": o roteiro já vem com o mundo (as peças e onde ficam) e, em cada cena,
// o que entra, o que aparece com etiqueta, selo ou plaquinha. Depois, uma IA desenha as peças que o
// motor não tem prontas (SVG simples, limpo antes de usar).

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const PecaSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,20}$/).describe("id curto, minúsculo, sem espaço"),
  nome: z.string().min(1).max(30).describe("nome em português (vira etiqueta/plaquinha)"),
  pronta: z.enum(PECAS_PRONTAS).optional().describe("use uma peça pronta sempre que servir"),
  desenho: z.string().max(220).optional().describe("se não for pronta: o objeto descrito EM INGLÊS para um ilustrador (forma, cor, material)"),
  cor: hex.optional(),
  lugar: z.enum(LUGARES_PECA).describe("chao = em cima do chão; subsolo = enterrado (poço, sala, cano); ceu = no ar"),
  x: z.number().min(0).max(1).describe("centro horizontal, de 0 (esquerda) a 1 (direita)"),
  largura: z.number().min(0.04).max(0.8).describe("fração da largura da tela"),
  altura: z.number().min(0.1).max(4).optional().describe("altura ÷ largura (muro alto e fino = 4; tanque raso = 0,12)"),
  dentro: z.string().optional().describe("id da peça onde esta fica no fundo (ex.: gelo dentro do poço)"),
});
export const CorteVideoSchema = z.object({
  ambiente: z.enum(AMBIENTES_CORTE),
  corBone: hex.optional().describe("cor do boné do boneco, igual no vídeo todo"),
  pecas: z.array(PecaSchema).min(2).max(14),
});
const ref = z.string().max(20);
export const CorteCenaSchema = z.object({
  adiciona: z.array(ref).max(3).optional().describe("ids das peças que ENTRAM nesta cena (crescem do chão). Normalmente uma."),
  remove: z.array(ref).max(3).optional(),
  foco: ref.optional().describe("câmera aproxima desta peça (detalhe por dentro)"),
  boneco: z.object({ acao: z.enum(ACOES_BONECO), x: z.number().min(0).max(1).optional() }).optional(),
  etiquetas: z.array(z.object({ peca: ref, texto: z.string().max(22), cor: z.enum(["azul", "vermelho", "verde", "amarelo"]).optional() })).max(3).optional(),
  selo: z.string().max(16).optional().describe("número curto em selo amarelo (ex.: '+3 °C', '2.000 ANOS', '20 TONELADAS')"),
  placa: z.object({ titulo: z.string().max(24), sub: z.string().max(40).optional() }).optional().describe("plaquinha de papel com o NOME da solução, na cena do 'Esse é o…'"),
  fluxo: z.object({ tipo: z.enum(FLUXOS), peca: ref, sentido: z.enum(["sobe", "desce", "direita", "esquerda"]).optional() }).optional(),
  ceu: z.enum(CEUS_CORTE).optional(),
  som: z.enum(SONS).optional(),
  destaques: z.array(z.string()).max(2).optional(),
  falha: ref.optional().describe("peça que falha nesta cena (treme e fica vermelha) — no 'Mas…'"),
});
export const RoteiroCorteSchema = z.object({
  titulo: z.string().min(2).max(120),
  gancho: z.string(),
  tratamento: z.string().max(400),
  corte: CorteVideoSchema,
  cenas: z.array(z.object({ narracao: z.string().min(2), corte: CorteCenaSchema })).min(5).max(40),
});

export const SISTEMA_CORTE = `
# Modo MUNDO EM CORTE (animação desenhada por código, sem IA de imagem)
O vídeo inteiro acontece num LUGAR SÓ, visto de lado, com o chão cortado como um desenho técnico: em cima o céu e o chão, embaixo o terreno aberto (onde ficam poços, salas, canos). Um boneco palito de boné colorido constrói as coisas. A cada passo da explicação UMA peça nova cresce do chão. No fim, o mundo inteiro está montado.
Preencha "corte" (o mundo) e, em cada cena, "corte" (o que acontece).

## O mundo (corte.pecas)
- Liste TODAS as peças que vão aparecer no vídeo (2 a 14), com lugar, x, largura e altura. Elas ficam paradas onde você mandar; só entram quando uma cena manda em "adiciona".
- Prefira as peças prontas: buraco (poço/sala cavada, lugar subsolo), agua (tanque, lago), blocos (gelo, caixas, dinheiro, tijolos empilhados — use cor), muro, cupula, torre, caixa (cofre, máquina), cano, terra-amontoada, fogo. Use "cor" para mudar o material.
- Só invente peça desenhada ("desenho", em inglês, objeto simples e reconhecível) quando nenhuma pronta servir.
- Medidas: tela vertical; chão a 43% da altura. Peças no chão: largura 0,08 a 0,5. Coisas enterradas: lugar "subsolo", altura 0,6 a 1,4 (fundas). Conteúdo de um poço/sala usa "dentro".
- Espalhe as peças em x (0,12 a 0,88): duas peças no mesmo lugar e na mesma hora NÃO podem ter o mesmo x. Deixe espaço para o boneco.
- Pense grande: peças no chão com largura 0,15 a 0,4; poços e salas enterradas com largura 0,4 a 0,6 e altura 0,7 a 1,2 (o terreno aberto ocupa metade da tela e deve ser usado).
- MOVER uma peça (ex.: o cofre que é enterrado): crie uma segunda peça ("cofre-enterrado", lugar subsolo, dentro da sala) e, na cena, remove a antiga e adiciona a nova.

## Cada cena (cenas[].corte)
- adiciona: a peça que a fala acabou de criar ("Então você levanta um muro…" → adiciona ["muro"]). Uma por cena, no máximo duas.
- falha: no "Mas…", a peça que dá problema treme vermelha.
- placa: na cena "Esse é o <nome>": titulo = o nome (curto), sub = o que ele faz em poucas palavras.
- selo: todo número verdadeiro dito na fala aparece em selo, compacto ("+3 °C", "2.000 ANOS").
- etiquetas: até 3 rótulos curtos apontando peças ("ÁGUA RASA", "AR FRIO"), cor do ponto pelo sentido (azul frio/água, vermelho quente/perigo, verde ok).
- fluxo: mostre o fenômeno invisível — quente sobe (vermelho), frio desce (azul), água/ar andando, força empurrando.
- foco: aproxime numa peça quando a fala explica o detalhe dela; volte para geral (sem foco) quando o mundo cresce.
- boneco.acao segue a fala: cavando, carregando, apontando (para a peça nova), pensando (no problema), comemorando (no resultado), assustado (na falha). "sem-boneco" raramente.
- ceu: mude só quando a hora importa (noite fria → dia quente).
- som: "whoosh" quando uma peça entra, "impacto" na falha, "ding" na solução, "tique" no selo. Nunca o mesmo som em todas.
- destaques: 1 ou 2 palavras-chave da própria fala (ficam amarelas).
- Cenas curtas (2,5 a 4 s): UMA frase de até 12 palavras. 16 a 30 cenas para 60–120 s (umas 4 cenas a cada 15 s).
- Use etiquetas em pelo menos um terço das cenas: elas explicam o que cada peça é.
- Devolva o JSON COMPACTO, numa linha só (a resposta tem limite de tamanho). Omita campos opcionais que não usar.`;

/** IAs pequenas inventam valores: troca o que não existe pelo padrão e tira referências a peças que não existem. */
export function sanearCorte(j: unknown): unknown {
  if (!j || typeof j !== "object") return j;
  const r = j as { corte?: Record<string, unknown>; cenas?: unknown; tratamento?: unknown };
  if (typeof r.tratamento === "string") r.tratamento = r.tratamento.slice(0, 400);
  const um = <T extends readonly string[]>(lista: T, v: unknown, padrao?: T[number]) => ((lista as readonly unknown[]).includes(v) ? v : padrao);
  const num = (v: unknown, a: number, b: number, padrao: number) => { const x = typeof v === "number" ? v : Number(v); return Number.isFinite(x) ? Math.min(b, Math.max(a, x)) : padrao; };
  const cor = (v: unknown) => (typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v) ? v : undefined);
  const c = (r.corte ??= {});
  c.ambiente = um(AMBIENTES_CORTE, c.ambiente, "campo");
  c.corBone = cor(c.corBone);
  const ids = new Set<string>();
  c.pecas = (Array.isArray(c.pecas) ? c.pecas : []).filter((p: { id?: unknown }) => p && typeof p.id === "string").slice(0, 14).map((p: Record<string, unknown>, i: number) => {
    let id = String(p.id).toLowerCase().normalize("NFD").replace(/[^a-z0-9-]/g, "").slice(0, 20) || `peca${i + 1}`;
    if (ids.has(id)) id = `${id.slice(0, 17)}-${i}`;
    ids.add(id);
    p.id = id;
    return {
      id, nome: String(p.nome ?? id).slice(0, 30), pronta: um(PECAS_PRONTAS, p.pronta), desenho: typeof p.desenho === "string" ? p.desenho.slice(0, 220) : undefined,
      cor: cor(p.cor), lugar: um(LUGARES_PECA, p.lugar, "chao"), x: num(p.x, 0, 1, 0.5), largura: num(p.largura, 0.04, 0.8, 0.25),
      altura: p.altura === undefined ? undefined : num(p.altura, 0.1, 4, 1), dentro: typeof p.dentro === "string" ? p.dentro : undefined,
    };
  });
  for (const p of c.pecas as { dentro?: string }[]) if (p.dentro && !ids.has(p.dentro)) delete p.dentro;
  espalhar(c.pecas as { id: string; lugar: string; x: number; largura: number; dentro?: string }[], Array.isArray(r.cenas) ? (r.cenas as { corte?: { adiciona?: unknown } }[]).flatMap((x) => (Array.isArray(x.corte?.adiciona) ? x.corte!.adiciona as string[] : [])) : []);
  const so = (v: unknown) => (typeof v === "string" && ids.has(v) ? v : undefined);
  const lista = (v: unknown, max: number) => (Array.isArray(v) ? v.filter((x) => typeof x === "string" && ids.has(x)).slice(0, max) : undefined);
  if (Array.isArray(r.cenas)) for (const cena of r.cenas as { corte?: Record<string, unknown> }[]) {
    const k = (cena.corte ??= {});
    k.adiciona = lista(k.adiciona, 2);
    k.remove = lista(k.remove, 3);
    k.foco = so(k.foco);
    k.falha = so(k.falha);
    const b = k.boneco as { acao?: unknown; x?: unknown } | undefined;
    k.boneco = b ? { acao: um(ACOES_BONECO, b.acao, "parado"), ...(b.x !== undefined ? { x: num(b.x, 0, 1, 0.8) } : {}) } : undefined;
    k.etiquetas = Array.isArray(k.etiquetas) ? (k.etiquetas as Record<string, unknown>[]).filter((e) => so(e?.peca) && typeof e.texto === "string").slice(0, 3)
      .map((e) => ({ peca: e.peca as string, texto: (e.texto as string).slice(0, 22), cor: um(["azul", "vermelho", "verde", "amarelo"] as const, e.cor) })) : undefined;
    k.selo = typeof k.selo === "string" || typeof k.selo === "number" ? String(k.selo).slice(0, 16) : undefined;
    const pl = k.placa as { titulo?: unknown; sub?: unknown } | undefined;
    k.placa = pl && typeof pl.titulo === "string" ? { titulo: pl.titulo.slice(0, 24), ...(typeof pl.sub === "string" ? { sub: pl.sub.slice(0, 40) } : {}) } : undefined;
    const f = k.fluxo as { tipo?: unknown; peca?: unknown; sentido?: unknown } | undefined;
    k.fluxo = f && so(f.peca) && um(FLUXOS, f.tipo) ? { tipo: f.tipo, peca: f.peca, sentido: um(["sobe", "desce", "direita", "esquerda"] as const, f.sentido) } : undefined;
    k.ceu = um(CEUS_CORTE, k.ceu);
    k.som = um(SONS, k.som);
    k.destaques = Array.isArray(k.destaques) ? k.destaques.filter((d) => typeof d === "string").slice(0, 2) : undefined;
  }
  if (Array.isArray(r.cenas)) entrarCitadas((r.cenas as { corte?: Record<string, unknown> }[]).map((c) => (c.corte ??= {})));
  return j;
}

const SISTEMA_DESENHO = `You draw ONE object as a tiny SVG for a flat 2D explainer cartoon (simple stick-figure world).
Rules: viewBox "0 0 200 200"; the object sits on the BOTTOM edge (its base touches y=200) and fills most of the width;
only <g>, <path>, <rect>, <circle>, <ellipse>, <line>, <polyline>, <polygon>; flat solid colors (no gradients, no filters, no images, no text);
thick dark outlines: stroke="#2a2420" stroke-width="5"; 4 to 25 shapes; friendly, readable at small size.
Answer as JSON {"svg": "<svg ...>...</svg>"} and nothing else.`;

/** Pede para uma IA desenhar as peças que não são prontas; peça que não sair fica como caixa com o nome. */
export async function desenharPecas(corte: CorteVideo, userId?: string | null, avisar?: (etapa: string) => Promise<void> | void) {
  const faltam = corte.pecas.filter((p) => !p.pronta && !p.svg);
  let feitas = 0;
  const fila = [...faltam];
  await Promise.all(Array.from({ length: Math.min(3, fila.length) }, async () => {
    for (let p = fila.shift(); p; p = fila.shift()) {
      const alvo = p;
      try {
        await executar("texto", {
          sistema: SISTEMA_DESENHO,
          prompt: `Object: ${alvo.desenho || alvo.nome}. Shape: about ${Math.round((alvo.altura ?? 1) * 100)}% as tall as wide.`,
          schemaJson: { type: "object", properties: { svg: { type: "string" } }, required: ["svg"] }, temperatura: 0.4,
        }, {
          userId, timeoutMs: 60_000,
          validar: (s) => {
            const bruto = (s.json as { svg?: unknown } | undefined)?.svg ?? s.texto;
            const limpo = typeof bruto === "string" ? limparSvgPeca(bruto) : null;
            if (!limpo) throw new FalhaProvedor("desenho fora do formato", "formato");
            alvo.svg = limpo;
          },
        });
        // confere se o desenho abre de verdade (SVG quebrado derrubaria o vídeo inteiro)
        await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">${alvo.svg}</svg>`)).png().toBuffer();
      } catch { delete alvo.svg; }
      feitas++;
      await avisar?.(`desenhando as peças do mundo (${feitas} de ${faltam.length})…`);
    }
  }));
}

/**
 * IAs pequenas costumam pôr tudo em x = 0,5. Peças do mesmo lugar (chão/subsolo) que se cobrem são
 * empurradas para o espaço livre mais perto, na ordem em que entram no vídeo. Peças "dentro" não mexem.
 */
function espalhar(pecas: { id: string; lugar: string; x: number; largura: number; dentro?: string }[], ordemEntrada: string[]) {
  const ordem = (id: string) => { const i = ordemEntrada.indexOf(id); return i === -1 ? 999 : i; };
  for (const lugar of ["chao", "subsolo"]) {
    const grupo = pecas.filter((p) => p.lugar === lugar && !p.dentro).sort((a, b) => ordem(a.id) - ordem(b.id));
    const postas: { a: number; b: number }[] = [];
    for (const p of grupo) {
      let w = p.largura;
      const livre = (x: number) => postas.every((q) => x + w / 2 + 0.02 <= q.a || x - w / 2 - 0.02 >= q.b);
      let x = Math.min(0.96 - w / 2, Math.max(0.04 + w / 2, p.x));
      if (!livre(x)) {
        let achou = false;
        for (let d = 0.02; d < 1 && !achou; d += 0.02) for (const c of [x + d, x - d]) if (!achou && c - w / 2 >= 0.04 && c + w / 2 <= 0.96 && livre(c)) { x = c; achou = true; }
        if (!achou) { w = Math.max(0.06, w * 0.7); p.largura = w; }
      }
      p.x = Math.round(x * 100) / 100;
      postas.push({ a: x - w / 2, b: x + w / 2 });
    }
  }
}

/** Peça citada numa cena (foco, etiqueta, falha, fluxo, movendo) antes de ter entrado: entra nessa cena. */
function entrarCitadas(cenas: Record<string, unknown>[]) {
  const vis = new Set<string>();
  for (const k of cenas) {
    const add = (Array.isArray(k.adiciona) ? k.adiciona : []) as string[];
    for (const id of add) vis.add(id);
    const citadas = [k.foco, k.falha, k.movendo, (k.fluxo as { peca?: string } | undefined)?.peca, ...((k.etiquetas as { peca?: string }[] | undefined) ?? []).map((e) => e.peca)]
      .filter((x): x is string => typeof x === 'string');
    for (const id of citadas) if (!vis.has(id)) { add.push(id); vis.add(id); }
    if (add.length) k.adiciona = add.slice(0, 3);
    for (const id of (Array.isArray(k.remove) ? k.remove : []) as string[]) vis.delete(id);
  }
}
