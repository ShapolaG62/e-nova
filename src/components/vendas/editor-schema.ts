// Campos editáveis de cada tipo de bloco do site gerado (porte fiel do editor original).

export const NOMES_BLOCO: Record<string, string> = {
  topo: "Topo",
  numeros: "Números",
  servicos: "Serviços",
  diferenciais: "Por que aqui",
  passos: "Como funciona",
  pacotes: "Pacotes / planos",
  galeria: "Galeria",
  historia: "Nossa história",
  depoimentos: "Depoimentos",
  faq: "Perguntas frequentes",
  cta: "Chamada final",
  contato: "Contato e mapa",
};

export const PALETA = ["#e11d48", "#ea580c", "#d97706", "#ca8a04", "#16a34a", "#0d9488", "#0284c7", "#2563eb", "#4f46e5", "#7c3aed", "#c026d3", "#334155"];

export const TIPOS_NOVOS = ["galeria", "depoimentos", "faq", "pacotes", "numeros", "passos", "diferenciais", "historia", "cta"] as const;

export const DESCRICAO_NOVO: Record<string, string> = {
  galeria: "Grade com as fotos do lugar",
  depoimentos: "O que os clientes dizem",
  faq: "Dúvidas mais comuns",
  pacotes: "Planos ou combos com preços",
  numeros: "Anos, clientes, nota…",
  passos: "Como funciona, em etapas",
  diferenciais: "Por que escolher vocês",
  historia: "A história do negócio",
  cta: "Faixa final com botão",
};

export type TipoCampo = "texto" | "area" | "linhas" | "sim" | "numero" | "foto" | "destaques" | "fotos";
export type Campo = [chave: string, rotulo: string, tipo: TipoCampo];

type Esquema = {
  campos?: Campo[];
  foto?: "capa";
  itens?: { titulo: string; campos: Campo[]; novo: Record<string, unknown> };
};

const cab = (intro = true): Campo[] => [
  ["etiqueta", "Etiqueta", "texto"],
  ["titulo", "Título", "texto"],
  ["destaques", "Palavras destacadas", "destaques"],
  ...(intro ? ([["intro", "Introdução", "area"]] as Campo[]) : []),
];

export const SCHEMA: Record<string, Esquema> = {
  topo: {
    campos: [
      ["linhaCima", "Linha de cima", "texto"],
      ["titulo", "Título", "texto"],
      ["destaques", "Palavras destacadas", "destaques"],
      ["subtitulo", "Subtítulo", "area"],
      ["botao", "Botão principal", "texto"],
      ["botao2", "Botão secundário (vazio = some)", "texto"],
      ["provas", "Micro-provas (uma por linha)", "linhas"],
    ],
    foto: "capa",
  },
  numeros: { itens: { titulo: "Número", campos: [["valor", "Valor", "texto"], ["rotulo", "Legenda", "texto"]], novo: { valor: "100+", rotulo: "clientes" } } },
  servicos: {
    campos: cab(),
    itens: { titulo: "Serviço", campos: [["titulo", "Nome", "texto"], ["texto", "Descrição", "area"], ["foto", "Foto (opcional)", "foto"]], novo: { titulo: "Novo serviço", texto: "Descreva o serviço." } },
  },
  diferenciais: { campos: cab(), itens: { titulo: "Diferencial", campos: [["titulo", "Título", "texto"], ["texto", "Texto", "area"]], novo: { titulo: "Novo diferencial", texto: "Descreva." } } },
  passos: { campos: cab(false), itens: { titulo: "Passo", campos: [["titulo", "Título", "texto"], ["texto", "Texto", "area"]], novo: { titulo: "Novo passo", texto: "Descreva." } } },
  pacotes: {
    campos: cab(),
    itens: {
      titulo: "Pacote",
      campos: [["nome", "Nome", "texto"], ["descricao", "Descrição", "texto"], ["itens", "O que inclui (um por linha)", "linhas"], ["destaque", 'Destacar como "mais pedido"', "sim"]],
      novo: { nome: "Novo pacote", descricao: "", itens: ["Item"] },
    },
  },
  galeria: { campos: [...cab(false), ["fotos", "Fotos da galeria", "fotos"]] },
  historia: { campos: [...cab(false), ["texto", "Texto (linha em branco separa parágrafos)", "area"], ["foto", "Foto", "foto"]] },
  depoimentos: {
    campos: cab(false),
    itens: { titulo: "Depoimento", campos: [["nome", "Nome", "texto"], ["texto", "Depoimento", "area"], ["nota", "Estrelas (1 a 5)", "numero"]], novo: { nome: "Cliente", texto: "Escreva um depoimento real.", nota: 5 } },
  },
  faq: { campos: cab(false), itens: { titulo: "Pergunta", campos: [["pergunta", "Pergunta", "texto"], ["resposta", "Resposta", "area"]], novo: { pergunta: "Nova pergunta?", resposta: "Resposta." } } },
  cta: { campos: [["titulo", "Título", "texto"], ["destaques", "Palavras destacadas", "destaques"], ["texto", "Texto", "area"], ["botao", "Botão", "texto"]] },
  contato: { campos: [["etiqueta", "Etiqueta", "texto"], ["titulo", "Título", "texto"], ["intro", "Texto", "area"]] },
};

export const EXEMPLOS_IA = [
  "Deixe o título mais curto e direto",
  "Escreva com um tom mais jovem",
  "Troque a cor para um verde mais escuro",
  "Adicione uma pergunta sobre estacionamento no FAQ",
];

export const ANIMACOES: [chave: string, rotulo: string, padrao: boolean][] = [
  ["entrada", "Entrada suave dos elementos", true],
  ["contadores", "Números que contam ao aparecer", true],
  ["progresso", "Barra de progresso de leitura", true],
  ["flutuante", "Botão flutuante do WhatsApp", true],
  ["parallax", "Parallax na foto do topo", false],
];

/** Palavras do título que podem virar destaque (sem repetir, com mais de 2 letras). */
export function palavrasDoTitulo(titulo: string): string[] {
  const vistas = new Set<string>();
  const r: string[] = [];
  for (const w of String(titulo || "").split(/\s+/)) {
    const p = w.replace(/[^\p{L}\d-]/gu, "");
    if (p.length > 2 && !vistas.has(p.toLowerCase())) {
      vistas.add(p.toLowerCase());
      r.push(p);
    }
  }
  return r;
}
