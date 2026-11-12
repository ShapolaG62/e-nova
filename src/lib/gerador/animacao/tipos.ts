// Vocabulário da animação desenhada por código (sem IA de imagem/vídeo).
// O diretor de IA escolhe estes valores em cada cena; o desenho.ts sabe desenhar cada um.
// Sem "server-only": a tela usa as listas para os seletores.

export const CENARIOS = ["rua-noite", "casa", "corredor", "elevador", "quarto", "floresta", "loja", "cozinha", "escritorio", "ceu", "escuro", "painel", "predio", "apto-simples", "apto-rico", "cidade-neve", "sala-tv", "sala-aula"] as const;
export const PALETAS = ["noite", "terror", "quente", "neutro", "neon", "suave", "dia", "inverno"] as const;
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
  traco?: "desenho" | "recorte"; // jeito de desenhar o elenco (escolhido na tela, não pela IA)
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

// ───────── Mundo em corte ("Como funciona"): um lugar só, visto de lado com o chão aberto,
// que vai ganhando peças a cada passo da explicação (muro, poço, cúpula…). ─────────
export const AMBIENTES_CORTE = ["deserto", "campo", "cidade", "praia", "neve", "montanha", "floresta", "fabrica"] as const;
export const CEUS_CORTE = ["dia", "entardecer", "noite"] as const;
export const LUGARES_PECA = ["chao", "subsolo", "ceu"] as const;
// peças que o motor já sabe desenhar; o resto a IA desenha em SVG simples
export const PECAS_PRONTAS = ["buraco", "agua", "blocos", "muro", "cupula", "torre", "caixa", "cano", "terra-amontoada", "fogo"] as const;
export const ACOES_BONECO = ["parado", "andando", "cavando", "carregando", "apontando", "pensando", "comemorando", "assustado", "sem-boneco"] as const;
export const FLUXOS = ["quente", "frio", "agua", "ar", "forca"] as const;

export type PecaCorte = {
  id: string;            // curto, sem espaço (ex.: "muro")
  nome: string;          // rótulo em português (ex.: "muro de sombra")
  pronta?: (typeof PECAS_PRONTAS)[number]; // desenho pronto do motor
  desenho?: string;      // descrição em inglês para a IA desenhar (quando não é pronta)
  svg?: string;          // conteúdo SVG já limpo (viewBox 0 0 200 200), preenchido depois do roteiro
  cor?: string;          // #hex principal (peças prontas)
  lugar: (typeof LUGARES_PECA)[number];
  x: number;             // centro, 0 a 1 da largura
  largura: number;       // 0,06 a 0,7 da largura
  altura?: number;       // proporção altura/largura (padrão 1)
  dentro?: string;       // id de outra peça: esta fica no fundo dela (ex.: gelo dentro do poço)
};
export type CorteVideo = {
  ambiente: (typeof AMBIENTES_CORTE)[number];
  corBone?: string;      // cor do boné do boneco
  pecas: PecaCorte[];
};
export type CorteCena = {
  adiciona?: string[];   // ids que entram nesta cena (crescem do chão)
  remove?: string[];     // ids que saem
  foco?: string;         // câmera aproxima desta peça
  boneco?: { acao: (typeof ACOES_BONECO)[number]; x?: number }; // x de 0 a 1
  etiquetas?: { peca: string; texto: string; cor?: "azul" | "vermelho" | "verde" | "amarelo" }[];
  selo?: string;         // número em selo amarelo (ex.: "2.000 ANOS", "+3 °C")
  placa?: { titulo: string; sub?: string }; // plaquinha de papel com o nome da solução
  fluxo?: { tipo: (typeof FLUXOS)[number]; peca: string; sentido?: "sobe" | "desce" | "direita" | "esquerda" };
  ceu?: (typeof CEUS_CORTE)[number];
  som?: Som;
  destaques?: string[];
  falha?: string;        // id da peça que falha nesta cena (treme e pisca em vermelho)
};

// ───────── Mundo 3D simples ("Como funciona" em 3D): formas com sombra chapada e contorno preto,
// câmera que voa entre planos, bonecos de cabeça redonda. Desenhado por código, sem IA de imagem. ─────────
export const CHAOS_3D = ["grama", "areia", "asfalto", "neve", "terra", "piso"] as const;
export const PECAS_3D = ["casa", "predio", "muro", "cofre", "caixa", "torre", "cupula", "arvore", "poste", "carro", "caminhao", "cabine", "cancela", "estrada", "ponte", "agua", "sala-enterrada", "blocos", "cerca", "porta", "escada", "mesa", "pessoa"] as const;
export const FORMAS_3D = ["caixa", "cilindro", "cone", "esfera", "piramide"] as const;
export const CAMERAS_3D = ["geral", "perto", "lado", "cima", "baixo", "dentro"] as const;

export type Prim3D = {
  f: (typeof FORMAS_3D)[number];
  p: [number, number, number];   // centro da base (x, y, z) em metros, relativo à peça
  s: [number, number, number];   // largura, altura, profundidade
  cor: string;
  rot?: number;                  // giro em graus no eixo vertical
};
export type Peca3D = {
  id: string;
  nome: string;
  pronta?: (typeof PECAS_3D)[number];
  prims?: Prim3D[];              // peça montada pela IA com formas simples (quando não é pronta)
  desenho?: string;              // descrição em inglês para a IA montar (quando não é pronta)
  cor?: string;
  x: number; z: number;          // posição no chão, em metros (-8 a 8)
  escala?: number;               // 0,4 a 3
  rot?: number;                  // graus
  enterrada?: boolean;           // abaixo do chão (sala, cano) — o chão vira corte
};
export type Mundo3D = {
  chao: (typeof CHAOS_3D)[number];
  ceu?: "dia" | "entardecer" | "noite";
  corBone?: string;
  pecas: Peca3D[];
};
export type Cena3D = {
  adiciona?: string[];
  remove?: string[];
  foco?: string;                 // peça para onde a câmera olha
  camera?: (typeof CAMERAS_3D)[number];
  boneco?: { acao: (typeof ACOES_BONECO)[number]; perto?: string };
  etiquetas?: { peca: string; texto: string; cor?: "azul" | "vermelho" | "verde" | "amarelo" }[];
  selo?: string;
  placa?: { titulo: string; sub?: string };
  falha?: string;
  movendo?: string;              // peça que anda pela cena (carro passando, porta abrindo)
  ceu?: "dia" | "entardecer" | "noite";
  som?: Som;
  destaques?: string[];
};
