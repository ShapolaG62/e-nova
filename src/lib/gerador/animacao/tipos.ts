// Vocabulário da animação desenhada por código (sem IA de imagem/vídeo).
// O diretor de IA escolhe estes valores em cada cena; o desenho.ts sabe desenhar cada um.
// Sem "server-only": a tela usa as listas para os seletores.

export const CENARIOS = ["rua-noite", "casa", "corredor", "elevador", "quarto", "floresta", "loja", "cozinha", "escritorio", "ceu", "escuro"] as const;
export const PALETAS = ["noite", "terror", "quente", "neutro", "neon"] as const;
export const ACOES = ["parado", "andando", "correndo", "assustado", "escondido", "celular", "apontando", "sentado", "sem-personagem"] as const;
export const OBJETOS = ["lanterna", "porta", "janela", "lua", "poste", "casas", "cachorro", "vulto", "bilhete", "arvores", "carro", "luz-ao-longe"] as const;
export const EFEITOS = ["nenhum", "perigo", "tremor", "luz-piscando", "chuva", "zoom"] as const;
export const SONS = ["nenhum", "impacto", "coracao", "passos", "porta", "vento", "ding", "notificacao", "susto", "latido"] as const;
export const CARTOES = ["titulo", "regra", "celular", "numero"] as const;

export type Cenario = (typeof CENARIOS)[number];
export type Paleta = (typeof PALETAS)[number];
export type Acao = (typeof ACOES)[number];
export type Objeto = (typeof OBJETOS)[number];
export type Efeito = (typeof EFEITOS)[number];
export type Som = (typeof SONS)[number];

export type Cartao = { tipo: (typeof CARTOES)[number]; titulo: string; texto?: string; remetente?: string };

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
};

export type AnimVideo = {
  episodio?: string;        // etiqueta fixa no canto (ex.: "EP. 4/5 · NOITE 1")
  corPersonagem?: string;   // cor do boné/detalhe do personagem (#hex)
  escolha?: { a: string; b: string };
};
