// Estéticas prontas do Gerador de vídeos: o nome e a explicação aparecem na tela (pt-BR);
// o "prompt" (em inglês) vai junto em todas as imagens, para o vídeo inteiro ter a mesma cara.
// Estilos genéricos e originais: nunca o nome de um estúdio, filme ou artista.

export type Estetica = { id: string; nome: string; descricao: string; prompt: string; cor: string };

export const ESTETICAS: Estetica[] = [
  { id: "cinema", nome: "Cinema", descricao: "Luz dramática, profundidade, cara de filme", prompt: "cinematic film still, dramatic directional lighting, shallow depth of field, anamorphic lens, rich color grading, 35mm film grain", cor: "#c9853a" },
  { id: "realista", nome: "Realista", descricao: "Foto natural, luz do dia, gente de verdade", prompt: "natural documentary photograph, soft daylight, realistic skin texture, candid moment, true-to-life colors", cor: "#5f8d6b" },
  { id: "3d-fofo", nome: "3D fofo", descricao: "Personagens 3D arredondados, cores alegres", prompt: "stylized 3D animated film look, rounded friendly character design, soft global illumination, vibrant saturated colors, subsurface skin", cor: "#e0703c" },
  { id: "anime", nome: "Anime", descricao: "Traço japonês, céus vibrantes, emoção", prompt: "hand-drawn anime style illustration, clean line art, cel shading, vivid sky gradients, expressive eyes", cor: "#d0477a" },
  { id: "quadrinhos", nome: "Quadrinhos", descricao: "Contorno forte, retícula, cores chapadas", prompt: "comic book illustration, bold ink outlines, halftone dots, flat vivid colors, dynamic angles", cor: "#d93a2b" },
  { id: "aquarela", nome: "Aquarela", descricao: "Pintura suave, papel texturizado, delicado", prompt: "delicate watercolor painting, soft bleeding edges, textured paper, pastel washes, gentle light", cor: "#6aa4c8" },
  { id: "noir", nome: "Noir", descricao: "Preto e branco, sombras fortes, mistério", prompt: "black and white film noir, hard shadows, venetian blind light, high contrast, smoky atmosphere", cor: "#3a3f4a" },
  { id: "neon", nome: "Neon noturno", descricao: "Cidade à noite, néon rosa e azul, chuva", prompt: "neon-lit night city, magenta and cyan glow, wet reflective streets, moody haze, cinematic", cor: "#7a4dff" },
  { id: "anos-80", nome: "Anos 80", descricao: "Cores quentes, grão de VHS, nostalgia", prompt: "1980s retro photograph, warm faded colors, VHS grain, soft bloom, vintage wardrobe and props", cor: "#e3a33b" },
  { id: "minimalista", nome: "Minimalista", descricao: "Fundo limpo, poucas cores, elegante", prompt: "minimalist composition, clean pastel background, soft studio light, lots of negative space, elegant", cor: "#a7b0bd" },
];

export const estetica = (id?: string | null) => ESTETICAS.find((e) => e.id === id);
