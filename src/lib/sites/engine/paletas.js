// Paletas prontas — vindas da skill theme-factory (10 temas de cor), adaptadas para sites.
// Cada paleta muda de uma vez: as 2 cores do negócio, o fundo (tema) e as fontes.
// As fontes originais da skill (DejaVu/FreeSans) não existem na web: cada paleta ganhou um par
// do Google Fonts escolhido para o mesmo clima.

// Fundos novos (mesmo formato dos TEMAS do render.js)
export const FUNDOS_PALETAS = {
  oceano: { nome: 'Oceano', bg: '#1a2332', bg2: '#202c3f', tx: '#f1faee', tx2: '#a8c3c8', linha: 'rgba(168,218,220,.16)', card: '#233046', escuro: true },
  praia: { nome: 'Pôr do sol', bg: '#fffaf3', bg2: '#fbefdc', tx: '#264653', tx2: '#5e7480', linha: 'rgba(38,70,83,.14)', card: '#ffffff', escuro: false },
  floresta: { nome: 'Floresta', bg: '#faf9f6', bg2: '#eef0e6', tx: '#1f331e', tx2: '#5f6655', linha: 'rgba(45,74,43,.15)', card: '#ffffff', escuro: false },
  minimal: { nome: 'Minimal', bg: '#ffffff', bg2: '#f2f3f4', tx: '#1f2a30', tx2: '#5d6b75', linha: 'rgba(54,69,79,.14)', card: '#ffffff', escuro: false },
  dourado: { nome: 'Dourado', bg: '#f7f0e6', bg2: '#ede1cf', tx: '#4a403a', tx2: '#7a6d63', linha: 'rgba(74,64,58,.16)', card: '#fffaf2', escuro: false },
  artico: { nome: 'Ártico', bg: '#fafafa', bg2: '#e7eff9', tx: '#1d2b40', tx2: '#56657b', linha: 'rgba(74,111,165,.18)', card: '#ffffff', escuro: false },
  deserto: { nome: 'Deserto', bg: '#f6ede4', bg2: '#ecdccd', tx: '#5d2e46', tx2: '#86606c', linha: 'rgba(93,46,70,.15)', card: '#fcf6f0', escuro: false },
  tech: { nome: 'Tech', bg: '#1e1e1e', bg2: '#262626', tx: '#ffffff', tx2: '#a3a3a3', linha: 'rgba(255,255,255,.12)', card: '#2a2a2a', escuro: true },
  botanico: { nome: 'Botânico', bg: '#f5f3ed', bg2: '#ebe7da', tx: '#24382b', tx2: '#5e6b5f', linha: 'rgba(74,124,89,.16)', card: '#fffdf8', escuro: false },
  galaxia: { nome: 'Galáxia', bg: '#2b1e3e', bg2: '#33254a', tx: '#e6e6fa', tx2: '#b4a8cc', linha: 'rgba(164,144,194,.2)', card: '#3a2b53', escuro: true },
};

export const PALETAS = [
  { id: 'oceano-profundo', nome: 'Oceano profundo', clima: 'Profissional e calmo', cores: ['#2d8b8b', '#a8dadc'], fundo: 'oceano', fontes: { titulo: 'Sora', corpo: 'Source Sans 3', pesoTitulo: 700 } },
  { id: 'por-do-sol', nome: 'Pôr do sol', clima: 'Quente e vibrante', cores: ['#e76f51', '#f4a261'], fundo: 'praia', fontes: { titulo: 'DM Serif Display', corpo: 'DM Sans', pesoTitulo: 400, eixos: { 'DM Serif Display': 'wght@400' } } },
  { id: 'copa-da-floresta', nome: 'Copa da floresta', clima: 'Natural e firme', cores: ['#2d4a2b', '#a4ac86'], fundo: 'floresta', fontes: { titulo: 'Cormorant Garamond', corpo: 'Karla', pesoTitulo: 700, tituloFallback: 'Georgia,serif' } },
  { id: 'minimalista', nome: 'Minimalista', clima: 'Limpo e atual', cores: ['#36454f', '#708090'], fundo: 'minimal', fontes: { titulo: 'Inter Tight', corpo: 'Inter', pesoTitulo: 700 } },
  { id: 'hora-dourada', nome: 'Hora dourada', clima: 'Acolhedor e outonal', cores: ['#c1666b', '#f4a900'], fundo: 'dourado', fontes: { titulo: 'Young Serif', corpo: 'Figtree', pesoTitulo: 400, eixos: { 'Young Serif': 'wght@400' }, tituloFallback: 'Georgia,serif' } },
  { id: 'gelo-artico', nome: 'Gelo ártico', clima: 'Frio e nítido', cores: ['#4a6fa5', '#7aa5d8'], fundo: 'artico', fontes: { titulo: 'Urbanist', corpo: 'Nunito Sans', pesoTitulo: 800 } },
  { id: 'rosa-do-deserto', nome: 'Rosa do deserto', clima: 'Suave e sofisticado', cores: ['#b87d6d', '#5d2e46'], fundo: 'deserto', fontes: { titulo: 'Marcellus', corpo: 'Mulish', pesoTitulo: 400, eixos: { Marcellus: 'wght@400' }, tituloFallback: 'Georgia,serif' } },
  { id: 'inovacao', nome: 'Inovação', clima: 'Tecnológico e ousado', cores: ['#0066ff', '#00e5ff'], fundo: 'tech', fontes: { titulo: 'Chakra Petch', corpo: 'Inter', pesoTitulo: 700, eixos: { 'Chakra Petch': 'wght@500;600;700' } } },
  { id: 'jardim-botanico', nome: 'Jardim botânico', clima: 'Fresco e orgânico', cores: ['#4a7c59', '#f9a620'], fundo: 'botanico', fontes: { titulo: 'Gloock', corpo: 'Work Sans', pesoTitulo: 400, eixos: { Gloock: 'wght@400' }, tituloFallback: 'Georgia,serif' } },
  { id: 'galaxia', nome: 'Galáxia', clima: 'Dramático e noturno', cores: ['#a490c2', '#4a4e8f'], fundo: 'galaxia', fontes: { titulo: 'Syne', corpo: 'Outfit', pesoTitulo: 700, eixos: { Syne: 'wght@500;600;700;800' } } },
];

export const listaPaletas = () => PALETAS.map(({ id, nome, clima, cores, fundo, fontes }) => ({
  id, nome, clima, cores, fundo: { id: fundo, bg: FUNDOS_PALETAS[fundo].bg, tx: FUNDOS_PALETAS[fundo].tx, escuro: FUNDOS_PALETAS[fundo].escuro }, fonte: fontes.titulo,
}));
