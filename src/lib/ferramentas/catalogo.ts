/** Catálogo das Ferramentas (usado no servidor e no navegador — sem dependências de Node). */
export const GRUPOS = ["Arquivos e vídeo", "Utilidades", "Extras"] as const;
export type Grupo = (typeof GRUPOS)[number];

export const FERRAMENTAS = [
  { id: "conversor", nome: "Conversor", grupo: "Arquivos e vídeo", desc: "Vídeo, áudio e imagem para outro formato." },
  { id: "compressor", nome: "Compressor", grupo: "Arquivos e vídeo", desc: "Deixe arquivos mais leves ou junte em ZIP." },
  { id: "cortar-video", nome: "Cortar vídeo", grupo: "Arquivos e vídeo", desc: "Escolha os trechos que ficam." },
  { id: "baixador", nome: "Baixador", grupo: "Arquivos e vídeo", desc: "YouTube, Instagram, TikTok e outros." },
  { id: "banco-midia", nome: "Banco de mídia", grupo: "Arquivos e vídeo", desc: "Fotos, vídeos, GIFs e emojis animados prontos para usar." },
  { id: "gravar-tela", nome: "Gravar tela", grupo: "Utilidades", desc: "Grave a tela direto no navegador." },
  { id: "qrcode", nome: "QR Code", grupo: "Utilidades", desc: "Link, texto, Wi-Fi ou WhatsApp, com logo." },
  { id: "conta-gotas", nome: "Conta-gotas", grupo: "Utilidades", desc: "Pegue a cor de qualquer ponto." },
  { id: "recortar-imagem", nome: "Recortar imagem", grupo: "Utilidades", desc: "Formatos prontos para redes sociais." },
  { id: "tradutor", nome: "Tradutor", grupo: "Utilidades", desc: "Tradução com a Central de IA." },
  { id: "chat-ia", nome: "Chat com IA", grupo: "Utilidades", desc: "Converse com a IA da Central." },
  { id: "celular", nome: "Transferir para o celular", grupo: "Extras", desc: "Passe arquivos pelo QR Code." },
  { id: "cambio", nome: "Câmbio", grupo: "Extras", desc: "Cotação ao vivo e conversor." },
  { id: "email-temporario", nome: "E-mail temporário", grupo: "Extras", desc: "Caixa descartável para cadastros." },
  { id: "dados-teste", nome: "Dados de teste", grupo: "Extras", desc: "CPF e CNPJ válidos para testes." },
] as const satisfies readonly { id: string; nome: string; grupo: Grupo; desc: string }[];

export type FerramentaId = (typeof FERRAMENTAS)[number]["id"];
export const ehFerramenta = (id: unknown): id is FerramentaId => FERRAMENTAS.some((f) => f.id === id);

export const MOEDAS = [
  ["BRL", "Real"], ["USD", "Dólar comercial"], ["USDT", "Dólar turismo"], ["EUR", "Euro"], ["GBP", "Libra"], ["ARS", "Peso argentino"],
  ["CAD", "Dólar canadense"], ["AUD", "Dólar australiano"], ["CHF", "Franco suíço"], ["JPY", "Iene"], ["CNY", "Yuan"], ["BTC", "Bitcoin"], ["ETH", "Ethereum"],
] as const;
export type Moeda = (typeof MOEDAS)[number][0];

/** Formatos de saída do conversor, por tipo de entrada. */
export const FORMATOS_SAIDA = {
  video: ["mp4", "mkv", "mov", "webm", "avi", "gif", "mp3", "wav", "m4a"],
  audio: ["mp3", "wav", "flac", "ogg", "m4a", "opus"],
  image: ["png", "jpg", "webp", "avif", "tiff", "gif", "bmp", "ico", "pdf"],
} as const;

export function tipoPorNome(nome: string): "video" | "audio" | "image" | "other" {
  const e = nome.split(".").pop()?.toLowerCase() ?? "";
  if (["mp4", "mkv", "mov", "avi", "webm", "flv", "wmv", "m4v", "3gp", "ts", "mts", "mpeg", "mpg"].includes(e)) return "video";
  if (["mp3", "wav", "flac", "ogg", "m4a", "aac", "opus", "wma", "aiff", "aif", "amr"].includes(e)) return "audio";
  if (["png", "jpg", "jpeg", "jfif", "webp", "bmp", "tif", "tiff", "gif", "avif", "heic", "heif", "svg", "ico"].includes(e)) return "image";
  return "other";
}

export function tamanhoLegivel(b: number) {
  if (b >= 1e9) return `${(b / 1e9).toFixed(1).replace(".", ",")} GB`;
  if (b >= 1e6) return `${(b / 1e6).toFixed(1).replace(".", ",")} MB`;
  return `${Math.max(1, Math.round(b / 1e3))} KB`;
}
