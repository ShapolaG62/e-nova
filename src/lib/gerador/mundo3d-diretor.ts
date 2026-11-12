import "server-only";
import { z } from "zod";
import { executar } from "@/lib/ia-hub/roteador";
import { FalhaProvedor } from "@/lib/ia-hub/tipos";
import { ACOES_BONECO, CAMERAS_3D, CHAOS_3D, FORMAS_3D, PECAS_3D, SONS, type Mundo3D, type Peca3D, type Prim3D } from "./animacao/tipos";
import { pegada } from "./animacao/mundo3d";

// Diretor do "mundo 3D": o roteiro já vem com as peças (da biblioteca do motor ou montadas pela IA
// com formas simples) e, em cada cena, o que entra, para onde a câmera olha e o que é explicado.

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const ref = z.string().max(24);
export const Peca3DSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,24}$/),
  nome: z.string().min(1).max(30),
  pronta: z.enum(PECAS_3D).optional().describe("use uma peça da biblioteca sempre que servir"),
  desenho: z.string().max(220).optional().describe("se não for pronta: o objeto descrito EM INGLÊS (forma, partes, cores) para ser montado com caixas e cilindros"),
  cor: hex.optional(),
  x: z.number().min(-10).max(10).describe("posição no chão em metros (esquerda/direita)"),
  z: z.number().min(-10).max(10).describe("posição no chão em metros (fundo negativo, frente positivo)"),
  escala: z.number().min(0.3).max(4).optional(),
  rot: z.number().min(-180).max(180).optional().describe("giro em graus (carro na estrada = 90)"),
  enterrada: z.boolean().optional().describe("abaixo do chão (sala, cofre enterrado, cano): o chão vira um corte"),
});
export const Mundo3DSchema = z.object({
  chao: z.enum(CHAOS_3D),
  ceu: z.enum(["dia", "entardecer", "noite"]).optional(),
  corBone: hex.optional(),
  pecas: z.array(Peca3DSchema).min(2).max(16),
});
export const Cena3DSchema = z.object({
  adiciona: z.array(ref).max(3).optional(),
  remove: z.array(ref).max(3).optional(),
  foco: ref.optional(),
  camera: z.enum(CAMERAS_3D).optional().describe("geral = o mundo todo de cima/de lado; perto = detalhe; lado; cima; baixo = de baixo para cima; dentro"),
  boneco: z.object({ acao: z.enum(ACOES_BONECO), perto: ref.optional() }).optional(),
  etiquetas: z.array(z.object({ peca: ref, texto: z.string().max(22), cor: z.enum(["azul", "vermelho", "verde", "amarelo"]).optional() })).max(3).optional(),
  selo: z.string().max(16).optional(),
  placa: z.object({ titulo: z.string().max(24), sub: z.string().max(40).optional() }).optional(),
  falha: ref.optional(),
  movendo: ref.optional().describe("peça que atravessa a cena (carro passando)"),
  ceu: z.enum(["dia", "entardecer", "noite"]).optional(),
  som: z.enum(SONS).optional(),
  destaques: z.array(z.string()).max(2).optional(),
});
export const Roteiro3DSchema = z.object({
  titulo: z.string().min(2).max(120),
  gancho: z.string(),
  tratamento: z.string().max(400),
  mundo3d: Mundo3DSchema,
  cenas: z.array(z.object({ narracao: z.string().min(2), mundo3d: Cena3DSchema })).min(5).max(40),
});

export const SISTEMA_3D = `
# Modo MUNDO 3D (animação 3D simples desenhada por código, sem IA de imagem)
O vídeo acontece numa MAQUETE 3D com contorno preto, cores chapadas e bonecos de cabeça redonda. A câmera voa entre planos (geral, perto, de lado, de cima). A cada passo da explicação UMA peça nova aparece crescendo. Se algo fica enterrado (sala, cofre, cano), o chão vira um corte e o público vê por dentro.
Preencha "mundo3d" (a maquete) e, em cada cena, "mundo3d" (o que acontece).

## A maquete (mundo3d.pecas)
- Liste TODAS as peças do vídeo (2 a 16) com x e z em metros (de -8 a 8). Elas só aparecem quando uma cena manda em "adiciona".
- Biblioteca pronta (prefira): casa, predio, muro, cofre, caixa, torre, cupula, arvore, poste, carro, caminhao, cabine (pedágio, guarita), cancela, estrada (longa no eixo z), ponte, agua, sala-enterrada, blocos (gelo, dinheiro: use cor), cerca, porta, escada, mesa, pessoa (figurante). "cor" muda a cor principal.
- Só invente peça ("desenho", em inglês) quando nada da biblioteca servir; ela será montada com caixas e cilindros.
- POSIÇÃO: o motor organiza sozinho (nada fica em cima de nada). Você só diz o LADO pelo x: negativo = esquerda, positivo = direita, 0 = tanto faz. Estrada fica no meio; carros e caminhões vão na pista.
- chao: "grama" na maioria dos temas; "asfalto" só em cidade grande; "areia" deserto/praia; "piso" dentro de prédio.
- MOVER uma peça (ex.: o cofre que vai para a sala enterrada): crie outra peça ("cofre-enterrado", enterrada: true) e, na cena, remove a antiga e adiciona a nova.

## Cada cena (cenas[].mundo3d)
- adiciona: a peça que a fala criou. foco + camera: aproxime ("perto") no detalhe explicado; volte para "geral" quando o mundo cresce; "cima" para mostrar o desenho de tudo; "lado" e "baixo" para variar. Mude a câmera quase toda cena: é o que dá vida.
- falha: no "Mas…", a peça que dá problema treme e pisca vermelha. movendo: carro passando, coisa atravessando.
- placa: na cena "Esse é o <nome>". selo: todo número verdadeiro dito na fala ("20 TONELADAS"). etiquetas: até 3 rótulos curtos apontando peças.
- boneco.acao segue a fala (cavando, carregando, apontando, pensando, comemorando, assustado), perto = a peça onde ele está.
- som: "whoosh" quando a câmera ou uma peça entra, "impacto" na falha, "ding" na solução, "tique" no selo. Nunca o mesmo em todas.
- Cenas de 2,5 a 4 s, UMA frase de até 12 palavras. 16 a 30 cenas para 60–120 s.
- Devolva o JSON COMPACTO, numa linha só. Omita campos opcionais que não usar.`;

/** IAs pequenas inventam valores: troca o que não existe pelo padrão e tira referências a peças que não existem. */
export function sanear3D(j: unknown): unknown {
  if (!j || typeof j !== "object") return j;
  const r = j as { mundo3d?: Record<string, unknown>; cenas?: unknown; tratamento?: unknown };
  if (typeof r.tratamento === "string") r.tratamento = r.tratamento.slice(0, 400);
  const um = <T extends readonly string[]>(lista: T, v: unknown, padrao?: T[number]) => ((lista as readonly unknown[]).includes(v) ? v : padrao);
  const num = (v: unknown, a: number, b: number, padrao: number) => { const x = typeof v === "number" ? v : Number(v); return Number.isFinite(x) ? Math.min(b, Math.max(a, x)) : padrao; };
  const cor = (v: unknown) => (typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v) ? v : undefined);
  const m = (r.mundo3d ??= {});
  m.chao = um(CHAOS_3D, m.chao, "grama");
  m.ceu = um(["dia", "entardecer", "noite"] as const, m.ceu);
  m.corBone = cor(m.corBone);
  const ids = new Set<string>();
  m.pecas = (Array.isArray(m.pecas) ? m.pecas : []).filter((p: { id?: unknown }) => p && typeof p.id === "string").slice(0, 16).map((p: Record<string, unknown>, i: number) => {
    let id = String(p.id).toLowerCase().normalize("NFD").replace(/[^a-z0-9-]/g, "").slice(0, 24) || `peca${i + 1}`;
    if (ids.has(id)) id = `${id.slice(0, 20)}-${i}`;
    ids.add(id);
    p.id = id;
    return {
      id, nome: String(p.nome ?? id).slice(0, 30), pronta: um(PECAS_3D, p.pronta), desenho: typeof p.desenho === "string" ? p.desenho.slice(0, 220) : undefined,
      cor: cor(p.cor), x: num(p.x, -10, 10, 0), z: num(p.z, -10, 10, 0), escala: p.escala === undefined ? undefined : num(p.escala, 0.3, 4, 1),
      rot: p.rot === undefined ? undefined : num(p.rot, -180, 180, 0), enterrada: p.enterrada === true || undefined,
    };
  });
  // com estrada, o asfalto já está nela: o chão em volta vira grama (tudo cinza fica sem vida)
  if (m.chao === "asfalto" && (m.pecas as { pronta?: string }[]).some((p) => p.pronta === "estrada")) m.chao = "grama";
  organizar3D(m.pecas as Peca3D[], Array.isArray(r.cenas) ? (r.cenas as { mundo3d?: { adiciona?: unknown } }[]).flatMap((x) => (Array.isArray(x.mundo3d?.adiciona) ? x.mundo3d!.adiciona as string[] : [])) : []);
  const so = (v: unknown) => (typeof v === "string" && ids.has(v) ? v : undefined);
  const lista = (v: unknown, max: number) => (Array.isArray(v) ? v.filter((x) => typeof x === "string" && ids.has(x)).slice(0, max) : undefined);
  if (Array.isArray(r.cenas)) for (const cena of r.cenas as { mundo3d?: Record<string, unknown> }[]) {
    const k = (cena.mundo3d ??= {});
    k.adiciona = lista(k.adiciona, 2);
    k.remove = lista(k.remove, 3);
    k.foco = so(k.foco);
    k.falha = so(k.falha);
    k.movendo = so(k.movendo);
    k.camera = um(CAMERAS_3D, k.camera);
    const b = k.boneco as { acao?: unknown; perto?: unknown } | undefined;
    k.boneco = b ? { acao: um(ACOES_BONECO, b.acao, "parado"), ...(so(b.perto) ? { perto: b.perto } : {}) } : undefined;
    k.etiquetas = Array.isArray(k.etiquetas) ? (k.etiquetas as Record<string, unknown>[]).filter((e) => so(e?.peca) && typeof e.texto === "string").slice(0, 3)
      .map((e) => ({ peca: e.peca as string, texto: (e.texto as string).slice(0, 22), cor: um(["azul", "vermelho", "verde", "amarelo"] as const, e.cor) })) : undefined;
    k.selo = typeof k.selo === "string" || typeof k.selo === "number" ? String(k.selo).slice(0, 16) : undefined;
    const pl = k.placa as { titulo?: unknown; sub?: unknown } | undefined;
    k.placa = pl && typeof pl.titulo === "string" ? { titulo: pl.titulo.slice(0, 24), ...(typeof pl.sub === "string" ? { sub: pl.sub.slice(0, 40) } : {}) } : undefined;
    k.ceu = um(["dia", "entardecer", "noite"] as const, k.ceu);
    k.som = um(SONS, k.som);
    k.destaques = Array.isArray(k.destaques) ? k.destaques.filter((d) => typeof d === "string").slice(0, 2) : undefined;
  }
  if (Array.isArray(r.cenas)) entrarCitadas((r.cenas as { mundo3d?: Record<string, unknown> }[]).map((c) => (c.mundo3d ??= {})));
  return j;
}

/**
 * Organizador da maquete: a IA diz O QUE existe e de que lado fica; quem decide ONDE é o motor,
 * com as medidas reais de cada peça — assim nada fica em cima de nada.
 * - Com estrada: ela fica reta no meio; veículos na pista, um atrás do outro; o resto em fila dos
 *   dois lados (lado pelo sinal do x que a IA deu), começando na frente da câmera.
 * - Sem estrada: uma fileira da esquerda para a direita, em ordem de entrada; se ficar longa, 2ª fileira atrás.
 * - Enterradas: fileira na frente, logo atrás do corte do terreno.
 */
export function organizar3D(pecas: Peca3D[], ordemEntrada: string[]) {
  const ordem = (id: string) => { const i = ordemEntrada.indexOf(id); return i === -1 ? 999 : i; };
  const lista = [...pecas].sort((a, b) => ordem(a.id) - ordem(b.id));
  const estrada = lista.find((p) => p.pronta === "estrada");
  const veiculo = (p: Peca3D) => p.pronta === "carro" || p.pronta === "caminhao";
  const fixa = (p: Peca3D) => p.pronta === "estrada" || p.pronta === "ponte" || p.pronta === "agua" || p.pronta === "sala-enterrada";
  const folga = 1.4;
  if (estrada) {
    estrada.x = 0; estrada.z = 0; estrada.rot = 0; estrada.escala = Math.min(estrada.escala ?? 1, 1.2);
    const meia = 3 * (estrada.escala ?? 1);
    // veículos: na pista, do fundo para a frente, com espaço do tamanho deles
    let zv = 7;
    for (const p of lista.filter((x) => veiculo(x) && !x.enterrada)) { const r = pegada(p); p.rot = 90; p.x = 0; p.z = zv - r; zv = p.z - r - folga; }
    // o resto: dois lados da estrada, cada lado é uma fila que vai para o fundo
    const cursor = { esq: 4, dir: 4 };
    let alterna = 0;
    for (const p of lista.filter((x) => !veiculo(x) && !fixa(x) && !x.enterrada)) {
      const lado = p.x < -0.5 ? "esq" : p.x > 0.5 ? "dir" : alterna++ % 2 ? "esq" : "dir";
      const r = pegada(p);
      p.x = (lado === "esq" ? -1 : 1) * (meia + 0.9 + r);
      p.z = cursor[lado] - r;
      cursor[lado] = p.z - r - folga;
    }
  } else {
    // fileira centralizada: posições calculadas da esquerda para a direita, depois centraliza
    const soltas = lista.filter((x) => !fixa(x) && !x.enterrada);
    const fileiras: Peca3D[][] = [soltas.slice(0, 5), soltas.slice(5)];
    fileiras.forEach((fila, f) => {
      const larguras = fila.map((p) => pegada(p) * 2);
      const total = larguras.reduce((a, b) => a + b, 0) + folga * Math.max(0, fila.length - 1);
      let x = -total / 2;
      fila.forEach((p, i) => { p.x = Math.round((x + larguras[i] / 2) * 10) / 10; p.z = f === 0 ? 0 : -7; x += larguras[i] + folga; });
    });
  }
  // enterradas: na frente, perto do corte (z ≈ 4), lado a lado
  const enterradas = lista.filter((x) => x.enterrada && x.pronta !== "sala-enterrada");
  const sala = lista.find((x) => x.pronta === "sala-enterrada");
  if (sala) { sala.x = 0; sala.z = 6; }
  const larg = enterradas.map((p) => pegada(p) * 2);
  let xe = -(larg.reduce((a, b) => a + b, 0) + folga * Math.max(0, enterradas.length - 1)) / 2;
  enterradas.forEach((p, i) => { p.x = Math.round((xe + larg[i] / 2) * 10) / 10; p.z = sala ? 6 : 5; xe += larg[i] + folga; });
}

const PrimSchema = z.object({ f: z.enum(FORMAS_3D), p: z.tuple([z.number(), z.number(), z.number()]), s: z.tuple([z.number(), z.number(), z.number()]), cor: hex, rot: z.number().optional() });
const SISTEMA_MONTAR = `You build ONE object for a simple low-poly 3D cartoon out of primitive shapes.
Shapes: "caixa" (box), "cilindro" (cylinder), "cone", "esfera" (sphere), "piramide".
Each shape: {"f": shape, "p": [x, y, z] = center of its BASE in meters (y=0 is the floor), "s": [width, height, depth] in meters, "cor": "#hex", "rot": degrees around the vertical axis (optional)}.
The whole object should be about 1 to 4 meters wide, standing on y=0, front facing +z. Use 3 to 14 shapes, bright flat colors, recognizable silhouette.
Answer as JSON {"prims": [...]} and nothing else.`;

/** Uma IA monta as peças que não estão na biblioteca, com formas simples (validadas e com medidas limitadas). */
export async function montarPecas3D(m: Mundo3D, userId?: string | null, avisar?: (etapa: string) => Promise<void> | void) {
  const faltam = m.pecas.filter((p) => !p.pronta && !p.prims?.length);
  let feitas = 0;
  const fila = [...faltam];
  await Promise.all(Array.from({ length: Math.min(3, fila.length) }, async () => {
    for (let p = fila.shift(); p; p = fila.shift()) {
      const alvo = p;
      try {
        await executar("texto", {
          sistema: SISTEMA_MONTAR, prompt: `Object: ${alvo.desenho || alvo.nome}.`,
          schemaJson: { type: "object", properties: { prims: { type: "array" } }, required: ["prims"] }, temperatura: 0.4,
        }, {
          userId, timeoutMs: 60_000,
          validar: (s) => {
            const lista = (s.json as { prims?: unknown } | undefined)?.prims;
            const ok = Array.isArray(lista) ? lista.map((x) => PrimSchema.safeParse(x)).filter((x) => x.success).map((x) => x.data) : [];
            if (ok.length < 2) throw new FalhaProvedor("formas fora do formato", "formato");
            const c = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
            alvo.prims = ok.slice(0, 16).map((x): Prim3D => ({ f: x.f, cor: x.cor, rot: x.rot, p: [c(x.p[0], -3, 3), c(x.p[1], 0, 6), c(x.p[2], -3, 3)], s: [c(x.s[0], 0.05, 6), c(x.s[1], 0.05, 6), c(x.s[2], 0.05, 6)] }));
          },
        });
      } catch {
        // não montou: vira uma caixa colorida (o vídeo nunca quebra)
        alvo.pronta = "caixa";
      }
      feitas++;
      await avisar?.(`montando as peças da maquete (${feitas} de ${faltam.length})…`);
    }
  }));
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
