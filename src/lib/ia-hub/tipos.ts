// Tipos da Central de IA (revezamento automático entre provedores).

/** Funções que a Central sabe executar. */
export type Capacidade =
  | "texto"          // redação, roteiros, análise (LLMs)
  | "imagem"         // gerar imagem a partir de texto
  | "editar-imagem"  // remover fundo, ampliar, limpar objetos
  | "video"          // texto/imagem → vídeo
  | "avatar"         // apresentador/avatar falando um roteiro
  | "cortes"         // achar trechos virais e gerar clipes verticais
  | "edicao-video"   // montagem/render por template (JSON)
  | "transcricao"    // áudio/vídeo → texto com tempos
  | "voz"            // texto → fala (TTS) e clonagem
  | "musica"         // gerar trilha/música
  | "limpar-audio";  // remover ruído / isolar voz

export const CAPACIDADES: { id: Capacidade; nome: string; descricao: string }[] = [
  { id: "texto", nome: "Texto e raciocínio", descricao: "Textos de sites, roteiros, respostas a avaliações, e-mails e agentes." },
  { id: "imagem", nome: "Imagens", descricao: "Banners, thumbnails, posts e fotos para os sites." },
  { id: "editar-imagem", nome: "Editar imagens", descricao: "Remover fundo, ampliar (upscale) e apagar objetos." },
  { id: "video", nome: "Vídeo com IA", descricao: "Gerar vídeos a partir de texto ou de uma imagem." },
  { id: "avatar", nome: "Avatares", descricao: "Apresentador digital falando o seu roteiro, com dublagem." },
  { id: "cortes", nome: "Cortes virais", descricao: "Achar os melhores trechos e gerar clipes 9:16 com legenda." },
  { id: "edicao-video", nome: "Edição programática", descricao: "Montar e renderizar vídeos por template, em lote." },
  { id: "transcricao", nome: "Transcrição", descricao: "Áudio e vídeo em texto, com tempos e oradores." },
  { id: "voz", nome: "Voz", descricao: "Narração (texto em fala) e clonagem de voz." },
  { id: "musica", nome: "Música", descricao: "Trilhas e músicas geradas por IA." },
  { id: "limpar-audio", nome: "Limpar áudio", descricao: "Remover ruído e isolar a voz." },
];

/** Como o E-Nova fala com o serviço. */
export type Via =
  | "openai-compat" // API no formato da OpenAI (OpenAI, DeepSeek, Groq, Mistral, Qwen, Together, Ollama…)
  | "anthropic" | "gemini" | "ollama"
  | "fal" | "replicate" // agregadores: um token roda dezenas de modelos
  | "direto"            // adaptador próprio do serviço
  | "local";            // roda no próprio servidor (Whisper, FFmpeg, motor de cortes)

/** Uma forma de chegar ao modelo (o mesmo modelo pode ter várias: direto, via fal.ai, via Replicate). */
export type Rota = {
  via: Via;
  provedor: string;      // id da credencial usada (ex.: "openai", "fal", "replicate", "elevenlabs")
  modelo?: string;       // id do modelo no provedor
  baseUrl?: string;      // para openai-compat
  opcoes?: Record<string, unknown>;
};

export type StatusCatalogo = "api" | "sem-api" | "framework";

export type ItemCatalogo = {
  id: string;
  nome: string;
  empresa: string;
  capacidades: Partial<Record<Capacidade, number>>; // nota de qualidade 1..10 por função (define a ordem "melhor primeiro")
  custo: 0 | 1 | 2 | 3; // 0 grátis/local … 3 caro (usado no modo Economia)
  rotas: Rota[];
  status?: StatusCatalogo; // padrão "api"
  nota?: string;           // observação mostrada na tela
  site?: string;
};

/** Credencial: uma chave pode servir a vários itens (ex.: fal.ai roda Kling, Luma, Wan…). */
export type Credencial = {
  id: string;
  nome: string;
  campos: { id: string; rotulo: string; segredo?: boolean; dica?: string }[];
  ondePegar: string;
  observacao?: string;
};

export type EntradaIA = {
  prompt?: string;
  sistema?: string;
  schemaJson?: Record<string, unknown>; // texto estruturado
  temperatura?: number;
  imagemUrl?: string;
  videoUrl?: string;
  audioUrl?: string;
  arquivo?: { buffer: Buffer; mime: string; nome: string };
  proporcao?: "16:9" | "9:16" | "1:1";
  duracao?: number;   // segundos (vídeo/música)
  voz?: string;       // id da voz (TTS/avatar)
  idioma?: string;    // "pt-BR"
  operacao?: "remover-fundo" | "ampliar" | "limpar";
  template?: string;  // edição programática
  dados?: Record<string, unknown>;
};

export type ArquivoGerado = { url?: string; buffer?: Buffer; mime: string; nome?: string };

export type SaidaIA = {
  texto?: string;
  json?: unknown;
  arquivos?: ArquivoGerado[];
  segmentos?: { inicio: number; fim: number; texto: string }[];
  meta?: Record<string, unknown>;
  tokens?: { entrada: number; saida: number };
};

export type ContextoAdaptador = {
  chave: Record<string, string>; // campos da credencial
  rota: Rota;
  item: ItemCatalogo;
  sinal: AbortSignal;
  progresso?: (pct: number, etapa?: string) => void | Promise<void>;
};

export type Adaptador = (cap: Capacidade, entrada: EntradaIA, ctx: ContextoAdaptador) => Promise<SaidaIA>;

/** Erros que fazem o roteador passar para o próximo provedor. */
export class FalhaProvedor extends Error {
  constructor(message: string, public readonly motivo: "sem-chave" | "limite" | "fora" | "recusado" | "formato" | "nao-suporta" | "erro" = "erro") {
    super(message);
  }
}
