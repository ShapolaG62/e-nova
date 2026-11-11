import "server-only";
import { spawn } from "node:child_process";
import ffmpegPath from "ffmpeg-static";

/** Roda o ffmpeg embutido (ffmpeg-static) e devolve o stderr (onde ele escreve as informações). */
export function ffmpeg(args: string[], opts: { cwd?: string; timeoutMs?: number } = {}): Promise<string> {
  if (!ffmpegPath) throw new Error("ffmpeg não encontrado (ffmpeg-static)");
  return new Promise((resolve, reject) => {
    const p = spawn(ffmpegPath as string, ["-hide_banner", "-y", ...args], { cwd: opts.cwd, windowsHide: true });
    let err = "";
    p.stderr.on("data", (d) => {
      err += d.toString();
      if (err.length > 200_000) err = err.slice(-100_000); // limita memória em vídeos longos
    });
    const timer = setTimeout(() => p.kill("SIGKILL"), opts.timeoutMs ?? 30 * 60_000);
    p.on("error", reject);
    p.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(err);
      else reject(new Error(`ffmpeg saiu com código ${code}: ${err.split("\n").slice(-6).join(" ").slice(0, 600)}`));
    });
  });
}

/** Duração e resolução do vídeo (lidas do cabeçalho que o ffmpeg imprime). */
export async function probe(file: string) {
  // "-f null -" com -t 0 só lê o cabeçalho; o ffmpeg "falha" sem saída, então tratamos o erro
  let info = "";
  try {
    info = await ffmpeg(["-i", file, "-t", "0", "-f", "null", "-"]);
  } catch (e) {
    info = e instanceof Error ? e.message : "";
  }
  const dur = /Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/.exec(info);
  const res = /Video: [^\n]*?(\d{2,5})x(\d{2,5})/.exec(info);
  const rot = /rotate\s*:\s*(-?\d+)/.exec(info) || /displaymatrix: rotation of (-?\d+)/.exec(info);
  let width = res ? Number(res[1]) : null;
  let height = res ? Number(res[2]) : null;
  if (rot && Math.abs(Number(rot[1])) % 180 === 90 && width && height) [width, height] = [height, width];
  return {
    durationSec: dur ? Number(dur[1]) * 3600 + Number(dur[2]) * 60 + Number(dur[3]) : null,
    width,
    height,
    hasAudio: /Audio: /.test(info),
  };
}

/**
 * Codificador de vídeo mais rápido disponível: a placa NVIDIA (NVENC) quando existir e funcionar,
 * senão o libx264 na CPU. Testa uma vez por processo. FFMPEG_ENCODER=cpu força a CPU.
 */
let encoderCache: Promise<"nvenc" | "cpu"> | null = null;
export function encoderDisponivel(): Promise<"nvenc" | "cpu"> {
  if (process.env.FFMPEG_ENCODER === "cpu") return Promise.resolve("cpu");
  encoderCache ??= ffmpeg(["-f", "lavfi", "-i", "color=c=black:s=256x256:d=0.2", "-c:v", "h264_nvenc", "-f", "null", "-"], { timeoutMs: 15_000 })
    .then(() => "nvenc" as const)
    .catch(() => "cpu" as const);
  return encoderCache;
}

/** Argumentos de codificação H.264 (qualidade parecida com crf 20–22 do libx264). */
export async function argsVideo(qualidade: "alta" | "normal" = "normal"): Promise<string[]> {
  return (await encoderDisponivel()) === "nvenc"
    ? ["-c:v", "h264_nvenc", "-preset", "p4", "-tune", "hq", "-rc", "vbr", "-cq", qualidade === "alta" ? "21" : "23", "-b:v", "0", "-pix_fmt", "yuv420p"]
    : ["-c:v", "libx264", "-preset", "veryfast", "-crf", qualidade === "alta" ? "20" : "22", "-pix_fmt", "yuv420p"];
}
