import "server-only";
import { mkdir, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { TranscriptSegment } from "@/db/schema";
import { candidatos, executar, SemProvedor } from "@/lib/ia-hub/roteador";
import { ffmpeg } from "./ffmpeg";

// Transcrição rápida dos Cortes: o áudio vai em pedaços de 60 s, 4 de cada vez, pela Central de IA.
// Cada pedaço escolhe a melhor IA de transcrição (Groq, Gemini, Deepgram…) e cai sozinho para a próxima
// — no fim da fila está o Whisper do próprio servidor. Pedaços curtos também seguram o erro de tempo
// de modelos como o Gemini, que escorregam em áudio longo.

const PEDACO = 60;
const PARALELO = 3;

export async function transcreverRapido(o: {
  wav: string; dir: string; duracao: number; userId?: string | null;
  progresso: (pct: number, etapa: string) => Promise<void> | void;
}): Promise<{ segmentos: TranscriptSegment[]; usados: string[] }> {
  const pasta = path.join(o.dir, "pedacos");
  await mkdir(pasta, { recursive: true });
  await ffmpeg(["-i", o.wav, "-f", "segment", "-segment_time", String(PEDACO), "-ac", "1", "-ar", "16000", "-c:a", "libmp3lame", "-b:a", "48k", "pedacos/p%04d.mp3"], { cwd: o.dir });
  const arquivos = (await readdir(pasta)).filter((a) => a.endsWith(".mp3")).sort();
  const resultados: TranscriptSegment[][] = new Array(arquivos.length);
  const usados = new Set<string>();
  let feitos = 0;
  const fila = arquivos.map((a, i) => ({ a, i }));
  await Promise.all(Array.from({ length: Math.min(PARALELO, fila.length) }, async () => {
    for (let item = fila.shift(); item; item = fila.shift()) {
      const { a, i } = item;
      const buffer = await readFile(path.join(pasta, a));
      const r = await transcreverPedaco(buffer, a, o.userId, (s) => o.progresso(Math.round((feitos / arquivos.length) * 100), `Transcrevendo a fala (${feitos} de ${arquivos.length} pedaços · ${s})`));
      usados.add(r.usado.item);
      const base = i * PEDACO;
      const fimPedaco = Math.min(o.duracao, base + PEDACO);
      resultados[i] = (r.segmentos ?? [])
        .map((s) => ({ start: round(base + s.inicio), end: round(Math.min(fimPedaco, base + s.fim)), text: s.texto.trim() }))
        .filter((s) => s.text && s.end > s.start && s.start < fimPedaco);
      feitos++;
      await o.progresso(Math.round((feitos / arquivos.length) * 100), `Transcrevendo a fala (${feitos} de ${arquivos.length} pedaços · ${[...usados].join(", ")})`);
    }
  }));
  // costura: sem sobreposição entre o fim de um pedaço e o começo do próximo
  const segmentos = resultados.flat().sort((x, y) => x.start - y.start);
  for (let k = 1; k < segmentos.length; k++) if (segmentos[k].start < segmentos[k - 1].end) segmentos[k - 1].end = Math.max(segmentos[k - 1].start + 0.2, segmentos[k].start);
  return { segmentos, usados: [...usados] };
}

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * Um pedaço: primeiro só as IAs na nuvem (rápidas). Se elas recusarem por estarem cheias ou no limite por minuto
 * (comum no plano grátis), espera alguns segundos e tenta de novo — é bem mais rápido que cair no Whisper da CPU.
 * Só depois de 3 voltas o Whisper local entra.
 */
async function transcreverPedaco(buffer: Buffer, nome: string, userId: string | null | undefined, avisar: (s: string) => Promise<void> | void) {
  const entrada = { arquivo: { buffer, mime: "audio/mpeg", nome }, idioma: "pt-BR" };
  const nuvem = [...new Set((await candidatos("transcricao")).filter((c) => c.temChave && c.rota.via !== "local").map((c) => c.item.id))];
  if (nuvem.length) {
    for (let volta = 1; volta <= 3; volta++) {
      try {
        return await executar("transcricao", entrada, { userId, timeoutMs: 90_000, somente: nuvem });
      } catch (e) {
        if (!(e instanceof SemProvedor)) throw e;
        const passageiro = e.tentativas.every((t) => /((429|500|502|503|504))|tempo esgotado|limite|fora do ar/i.test(t.erro ?? ""));
        if (!passageiro || volta === 3) break;
        const pedido = Math.max(0, ...e.tentativas.map((t) => Number(/retry[^0-9]{0,20}(d+(?:.d+)?)s*s/i.exec(t.erro ?? "")?.[1] ?? 0)));
        const espera = Math.min(30, Math.max(4 * volta, pedido + 1)) + Math.random() * 2;
        await avisar(`IA cheia, tentando de novo em ${Math.round(espera)} s`);
        await new Promise((r) => setTimeout(r, espera * 1000));
      }
    }
  }
  return executar("transcricao", entrada, { userId, timeoutMs: 600_000 });
}
