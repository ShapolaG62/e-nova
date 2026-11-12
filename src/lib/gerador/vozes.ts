// Biblioteca de vozes de narração grátis (vozes neurais da Microsoft, sem chave e sem custo).
// Cada item é uma voz + um jeito de falar (velocidade e tom). No brief fica como "bib:<id>".
// Sem "server-only": a tela mostra a lista.

export type VozBiblioteca = {
  id: string;
  nome: string;
  descricao: string;
  categoria: "Narradores" | "Notícia e rapidez" | "Suspense e mistério" | "Personagens" | "Sotaques";
  voz: string;          // voz neural da Microsoft
  velocidade?: string;  // "+10%" mais rápido, "-10%" mais devagar
  tom?: string;         // "+20Hz" mais agudo, "-20Hz" mais grave
  genero: "feminina" | "masculina";
};

export const CATEGORIAS_VOZ = ["Narradores", "Notícia e rapidez", "Suspense e mistério", "Personagens", "Sotaques"] as const;

export const BIBLIOTECA_VOZES: VozBiblioteca[] = [
  // narradores naturais
  { id: "francisca", nome: "Francisca", descricao: "Narradora natural, clara e calma", categoria: "Narradores", voz: "pt-BR-FranciscaNeural", genero: "feminina" },
  { id: "antonio", nome: "Antônio", descricao: "Narrador natural, firme", categoria: "Narradores", voz: "pt-BR-AntonioNeural", genero: "masculina" },
  { id: "thalita", nome: "Thalita", descricao: "Expressiva, boa para histórias", categoria: "Narradores", voz: "pt-BR-ThalitaMultilingualNeural", genero: "feminina" },
  { id: "contadora", nome: "Contadora de histórias", descricao: "Thalita mais lenta e doce, para “Neste planeta…”", categoria: "Narradores", voz: "pt-BR-ThalitaMultilingualNeural", velocidade: "-4%", tom: "+3Hz", genero: "feminina" },
  { id: "documentario", nome: "Documentário", descricao: "Antônio pausado e grave", categoria: "Narradores", voz: "pt-BR-AntonioNeural", velocidade: "-8%", tom: "-4Hz", genero: "masculina" },
  // notícia
  { id: "reporter", nome: "Repórter rápido", descricao: "Antônio acelerado, para notícia e números", categoria: "Notícia e rapidez", voz: "pt-BR-AntonioNeural", velocidade: "+12%", genero: "masculina" },
  { id: "apresentadora", nome: "Apresentadora", descricao: "Francisca rápida e animada", categoria: "Notícia e rapidez", voz: "pt-BR-FranciscaNeural", velocidade: "+10%", tom: "+2Hz", genero: "feminina" },
  { id: "curiosidades", nome: "Curiosidades", descricao: "Thalita animada, ritmo de Shorts", categoria: "Notícia e rapidez", voz: "pt-BR-ThalitaMultilingualNeural", velocidade: "+14%", tom: "+4Hz", genero: "feminina" },
  // suspense
  { id: "suspense", nome: "Narrador de suspense", descricao: "Antônio lento e grave", categoria: "Suspense e mistério", voz: "pt-BR-AntonioNeural", velocidade: "-10%", tom: "-8Hz", genero: "masculina" },
  { id: "misterio", nome: "Mistério", descricao: "Thalita devagar, quase sussurrando", categoria: "Suspense e mistério", voz: "pt-BR-ThalitaMultilingualNeural", velocidade: "-12%", tom: "-4Hz", genero: "feminina" },
  { id: "terror", nome: "Voz de terror", descricao: "Bem grave e arrastada", categoria: "Suspense e mistério", voz: "pt-BR-AntonioNeural", velocidade: "-16%", tom: "-22Hz", genero: "masculina" },
  // personagens
  { id: "crianca", nome: "Criança", descricao: "Aguda e rápida", categoria: "Personagens", voz: "pt-BR-ThalitaMultilingualNeural", velocidade: "+6%", tom: "+38Hz", genero: "feminina" },
  { id: "desenho", nome: "Personagem de desenho", descricao: "Engraçada, aguda e acelerada", categoria: "Personagens", voz: "pt-BR-FranciscaNeural", velocidade: "+16%", tom: "+30Hz", genero: "feminina" },
  { id: "vovo", nome: "Vovô", descricao: "Antônio lento e cansado", categoria: "Personagens", voz: "pt-BR-AntonioNeural", velocidade: "-20%", tom: "-12Hz", genero: "masculina" },
  { id: "gigante", nome: "Gigante", descricao: "Muito grave, voz de monstro bonzinho", categoria: "Personagens", voz: "pt-BR-AntonioNeural", velocidade: "-12%", tom: "-38Hz", genero: "masculina" },
  { id: "robo", nome: "Robô", descricao: "Rápida e reta", categoria: "Personagens", voz: "pt-BR-FranciscaNeural", velocidade: "+8%", tom: "-15Hz", genero: "feminina" },
  // sotaques
  { id: "duarte", nome: "Duarte", descricao: "Português de Portugal", categoria: "Sotaques", voz: "pt-PT-DuarteNeural", genero: "masculina" },
  { id: "raquel", nome: "Raquel", descricao: "Português de Portugal", categoria: "Sotaques", voz: "pt-PT-RaquelNeural", genero: "feminina" },
  { id: "andrew", nome: "Andrew", descricao: "Fala português com sotaque americano", categoria: "Sotaques", voz: "en-US-AndrewMultilingualNeural", genero: "masculina" },
  { id: "ava", nome: "Ava", descricao: "Fala português com sotaque americano", categoria: "Sotaques", voz: "en-US-AvaMultilingualNeural", genero: "feminina" },
  { id: "vivienne", nome: "Vivienne", descricao: "Fala português com sotaque francês", categoria: "Sotaques", voz: "fr-FR-VivienneMultilingualNeural", genero: "feminina" },
  { id: "giuseppe", nome: "Giuseppe", descricao: "Fala português com sotaque italiano", categoria: "Sotaques", voz: "it-IT-GiuseppeMultilingualNeural", genero: "masculina" },
];

export const vozDaBiblioteca = (id?: string | null) =>
  id?.startsWith("bib:") ? BIBLIOTECA_VOZES.find((v) => v.id === id.slice(4)) : undefined;

/** Frase usada para a prévia de cada voz. */
export const FRASE_PREVIA = "Neste planeta, todo mundo mora no mesmo prédio. E o andar mostra quanto tempo livre você tem.";
