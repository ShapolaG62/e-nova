// Vocabulário da animação desenhada por código (sem IA de imagem/vídeo).
// O diretor de IA escolhe estes valores em cada cena; o desenho.ts sabe desenhar cada um.
// Sem "server-only": a tela usa as listas para os seletores.

export const CENARIOS = ["rua-noite", "casa", "corredor", "elevador", "quarto", "floresta", "loja", "cozinha", "escritorio", "ceu", "escuro", "painel", "predio", "apto-simples", "apto-rico"] as const;
export const PALETAS = ["noite", "terror", "quente", "neutro", "neon", "suave", "dia"] as const;
export const EXPRESSOES = ["neutro", "feliz", "rindo", "triste", "chorando", "surpreso", "bravo", "preocupado"] as const;
export const CABELOS = ["curto", "cacheado", "black", "longo", "coque", "franja", "careca", "bone"] as const;
export const ACOES = ["parado", "andando", "correndo", "assustado", "escondido", "celular", "apontando", "sentado", "sem-personagem"] as const;
export const OBJETOS = ["lanterna", "porta", "janela", "lua", "poste", "casas", "cachorro", "vulto", "bilhete", "arvores", "carro", "luz-ao-longe"] as const;
export const EFEITOS = ["nenhum", "perigo", "tremor", "luz-piscando", "chuva", "zoom"] as const;
export const SONS = ["nenhum", "impacto", "coracao", "passos", "porta", "vento", "ding", "notificacao", "susto", "latido", "whoosh", "tique"] as const;
// Os 4 primeiros contam história; os outros são peças de infográfico (notícia, números, "o que muda").
export const CARTOES = ["titulo", "regra", "celular", "numero", "contador", "troca", "barra", "calendario", "comparacao", "check"] as const;
export const CARTOES_HISTORIA = ["titulo", "regra", "celular", "numero"] as const;

export type Cenario = (typeof CENARIOS)[number];
export type Paleta = (typeof PALETAS)[number];
export type Acao = (typeof ACOES)[number];
export type Objeto = (typeof OBJETOS)[number];
export type Efeito = (typeof EFEITOS)[number];
export type Som = (typeof SONS)[number];

/**
 * Cartão sobre a cena. Campos por tipo:
 * - titulo/regra/celular/numero: como antes (titulo + texto; celular usa remetente).
 * - contador: titulo = número final ("2.305.966"), texto = rótulo; antes = número inicial (opcional). Conta na tela.
 * - troca: antes = valor velho (é riscado), titulo = valor novo (entra em vermelho), texto = rótulo.
 * - barra: titulo = rótulo, valor e meta (números); texto = o que falta ("FALTAM 7,7 MI").
 * - calendario: titulo = mês ("NOVEMBRO"), texto = dia ("19"); antes = dia anterior que vira a folha (opcional).
 * - comparacao: lados = dois lados lado a lado ("HOJE"/"1.000" × "2027"/"2.000"); titulo = pergunta acima.
 * - check: titulo = item conferido ("1.000 INSCRITOS"), texto = o que ainda falta (opcional, aparece riscado de vermelho).
 */
export type Cartao = {
  tipo: (typeof CARTOES)[number]; titulo: string; texto?: string; remetente?: string;
  antes?: string; valor?: number; meta?: number;
  lados?: { rotulo: string; valor: string }[];
};

export type AnimCena = {
  cenario: Cenario;
  paleta: Paleta;
  acao: Acao;
  direcao?: "esquerda" | "direita";
  objetos?: Objeto[];
  efeito?: Efeito;
  som?: Som;
  status?: string;          // etiqueta no canto de cima (ex.: "PASSOS ATRÁS")
  alerta?: boolean;         // etiqueta vermelha com bolinha
  cartao?: Cartao;          // cartão sobre a cena (regra, mensagem de celular, título, número)
  destaques?: string[];     // palavras da fala que acendem na legenda
  secao?: { n: number; total: number; titulo: string }; // "1/3 AS HORAS" com bolinhas de progresso
  fonte?: string;           // de onde vem a informação ("REVISTA EDGE"), etiqueta pequena acima da legenda
  medidor?: { rotulo: string; pct: number; de?: number }; // barra fixa no canto (ex.: LIMPEZA 50% → 65%)
  quem?: { nome: string; expressao?: Expressao }[]; // personagens do elenco nesta cena (até 2)
  plano?: "geral" | "close";  // close = rosto grande
  placar?: { valor: string; antes?: string }; // painel de LED (ex.: o andar), conta de "antes" até "valor"
  movimento?: "subindo" | "descendo"; // no prédio: a câmera sobe ou desce pelos andares
};

export type AnimVideo = {
  episodio?: string;        // etiqueta fixa no canto (ex.: "EP. 4/5 · NOITE 1")
  corPersonagem?: string;   // cor do boné/detalhe do personagem (#hex)
  escolha?: { a: string; b: string };
  manchete?: string;        // pergunta/título fixo no topo o vídeo todo; a palavra entre *asteriscos* fica amarela
  contagem?: string;        // contador fixo da série no canto (ex.: "FALTAM 26")
  elenco?: Personagem[];  // personagens de desenho fixos (até 4)
};

export type Expressao = (typeof EXPRESSOES)[number];
export type Cabelo = (typeof CABELOS)[number];

/** Personagem de desenho fixo do vídeo (estilo 2D liso). Igual em todas as cenas. */
export type Personagem = {
  nome: string;
  pele: string;          // #hex
  cabelo: Cabelo;
  corCabelo: string;     // #hex (no boné, a cor do boné)
  roupa: string;         // #hex da camiseta
  calca?: string;        // #hex
  idade: "crianca" | "adulto" | "idoso";
  oculos?: boolean;
  barba?: boolean;
};
