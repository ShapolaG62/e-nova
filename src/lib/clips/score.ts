import type { TranscriptSegment } from "@/db/schema";

/**
 * Heurísticas de viralidade que rodam sem IA: gancho do começo, ritmo da fala,
 * energia do áudio e "fechamento" do trecho. A IA local refina gancho/emoção/valor.
 */
const HOOK_WORDS = [
  "segredo", "ninguém", "nunca", "pare", "erro", "erros", "como", "por que", "porque", "dica", "verdade", "cuidado",
  "incrível", "absurdo", "você", "olha", "atenção", "jeito", "melhor", "pior", "maior", "ninguem", "sabia", "imagina",
  "o que", "descobri", "acontece", "problema", "solução", "rápido", "grátis", "dinheiro", "minuto", "passo",
];
const EMOTION_WORDS = ["amo", "odeio", "medo", "chorei", "rir", "risada", "nossa", "meu deus", "caramba", "sério", "louco", "emocion", "feliz", "triste", "raiva", "surpre"];

export type Pesos = { gancho: number; emocao: number; valor: number; ritmo: number; energia: number };
const PADRAO: Pesos = { gancho: 0.35, emocao: 0.2, valor: 0.2, ritmo: 0.15, energia: 0.1 };

export type Candidate = { start: number; end: number; text: string; scores: { gancho: number; emocao: number; valor: number; ritmo: number; energia: number }; heuristic: number };

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const count = (text: string, words: string[]) => words.reduce((n, w) => n + (text.includes(w) ? 1 : 0), 0);

function scoreWindow(segs: TranscriptSegment[], energy: number[], w: Pesos = PADRAO, alvo?: number): Candidate {
  const start = segs[0].start;
  const end = segs[segs.length - 1].end;
  const text = segs.map((s) => s.text).join(" ").replace(/\s+/g, " ").trim();
  const lower = text.toLowerCase();
  const firstSentence = segs.slice(0, 2).map((s) => s.text).join(" ").toLowerCase();
  const dur = Math.max(1, end - start);
  const words = text.split(/\s+/).length;

  // Gancho: pergunta, números, palavras de curiosidade nos primeiros segundos
  const gancho = clamp(30 + count(firstSentence, HOOK_WORDS) * 14 + (/\?/.test(firstSentence) ? 18 : 0) + (/\d/.test(firstSentence) ? 10 : 0));
  // Emoção: exclamações e palavras emocionais
  const emocao = clamp(25 + (text.match(/!/g)?.length ?? 0) * 8 + count(lower, EMOTION_WORDS) * 12);
  // Valor: "como", "passo", números, listas — conteúdo útil
  const valor = clamp(30 + count(lower, ["como", "passo", "dica", "jeito", "forma", "maneira", "aprenda", "funciona", "primeiro", "segundo"]) * 9 + (text.match(/\d+/g)?.length ?? 0) * 4);
  // Ritmo: fala entre ~2,3 e ~3,6 palavras/s é o ponto doce de vídeos curtos
  const wps = words / dur;
  const ritmo = clamp(wps >= 2.3 && wps <= 3.6 ? 90 : wps < 2.3 ? 90 - (2.3 - wps) * 45 : 90 - (wps - 3.6) * 30);
  // Energia: volume médio do trecho comparado ao vídeo todo
  const slice = energy.slice(Math.floor(start), Math.ceil(end));
  const avg = slice.length ? slice.reduce((a, b) => a + b, 0) / slice.length : 0;
  const globalAvg = energy.length ? energy.reduce((a, b) => a + b, 0) / energy.length : 1;
  const energia = clamp(50 + ((avg - globalAvg) / Math.max(0.05, globalAvg)) * 60);

  // Bônus por terminar numa frase completa (o corte não "morre" no meio)
  const fechado = /[.!?]$/.test(text) ? 6 : 0;
  // duração perto da que a equipe costuma aprovar ganha um empurrão (autoaprendizado)
  const pertoDoAlvo = alvo ? Math.max(0, 6 - Math.abs(dur - alvo) / 4) : 0;
  const heuristic = clamp(gancho * w.gancho + emocao * w.emocao + valor * w.valor + ritmo * w.ritmo + energia * w.energia + fechado + pertoDoAlvo);
  return { start, end, text, scores: { gancho, emocao, valor, ritmo, energia }, heuristic };
}

/**
 * Gera janelas de 20–60 s começando em inícios de frase, pontua cada uma
 * e escolhe as melhores sem sobreposição.
 */
export function pickCandidates(segments: TranscriptSegment[], energy: number[], max = 8, minLen = 20, maxLen = 60, aprendido: { pesos?: Pesos; alvo?: number } = {}): Candidate[] {
  const all: Candidate[] = [];
  for (let i = 0; i < segments.length; i++) {
    const win: TranscriptSegment[] = [];
    for (let j = i; j < segments.length; j++) {
      win.push(segments[j]);
      const len = segments[j].end - segments[i].start;
      if (len > maxLen) break;
      if (len >= minLen) all.push(scoreWindow([...win], energy, aprendido.pesos, aprendido.alvo));
    }
  }
  all.sort((a, b) => b.heuristic - a.heuristic);
  const chosen: Candidate[] = [];
  for (const c of all) {
    if (chosen.length >= max) break;
    if (chosen.every((o) => c.end <= o.start || c.start >= o.end)) chosen.push(c);
  }
  // Vídeo curto sem janela de 20 s: usa o vídeo todo como um corte
  if (!chosen.length && segments.length) chosen.push(scoreWindow(segments, energy, aprendido.pesos, aprendido.alvo));
  return chosen;
}

export function finalScore(s: Candidate["scores"], w: Pesos = PADRAO) {
  return clamp(s.gancho * w.gancho + s.emocao * w.emocao + s.valor * w.valor + s.ritmo * w.ritmo + s.energia * w.energia);
}
