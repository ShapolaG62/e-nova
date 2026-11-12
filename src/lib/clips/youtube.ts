import "server-only";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";

/**
 * Importação de vídeo do YouTube via yt-dlp (o YouTube não tem API oficial de download).
 * Uso restrito a vídeos do próprio cliente ou com autorização — a tela exige essa
 * confirmação e cada importação vai para a auditoria.
 */
export const MAX_YT_SECONDS = 3 * 3600;

/** Extrai o ID de 11 caracteres de qualquer formato de link do YouTube; null se não for YouTube. */
export function youtubeId(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^(www|m|music)\./, "");
  let id: string | null = null;
  if (host === "youtu.be") id = u.pathname.slice(1).split("/")[0];
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (u.pathname === "/watch") id = u.searchParams.get("v");
    else {
      const m = /^\/(shorts|live|embed|v)\/([^/?#]+)/.exec(u.pathname);
      id = m?.[2] ?? null;
    }
  }
  return id && /^[\w-]{11}$/.test(id) ? id : null;
}

function ytDlp(): string {
  const p = process.env.YTDLP_PATH ?? path.resolve("bin", process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp");
  if (!existsSync(p)) throw new Error("yt-dlp não está instalado no servidor (rode: npm run setup:ytdlp)");
  return p;
}

function run(args: string[], opts: { cwd?: string; onLine?: (line: string) => void; timeoutMs?: number }): Promise<string> {
  return new Promise((resolve, reject) => {
    const p = spawn(ytDlp(), args, { cwd: opts.cwd, windowsHide: true });
    let out = "";
    let err = "";
    p.stdout.on("data", (d) => {
      const s = d.toString();
      out += s;
      if (opts.onLine) s.split(/\r?\n|\r/).forEach((l: string) => l && opts.onLine!(l));
    });
    p.stderr.on("data", (d) => (err = (err + d.toString()).slice(-4000)));
    const timer = setTimeout(() => p.kill("SIGKILL"), opts.timeoutMs ?? 60 * 60_000);
    p.on("error", reject);
    p.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(out);
      else {
        const msg = /Private video|Sign in to confirm your age|members-only|This video is unavailable|Video unavailable/i.exec(err)?.[0];
        reject(new Error(msg ? `YouTube recusou: ${msg}` : `Falha ao baixar do YouTube: ${err.split("\n").filter(Boolean).slice(-2).join(" ").slice(0, 300)}`));
      }
    });
  });
}

const BASE = ["--no-playlist", "--js-runtimes", "node", "--no-warnings", "--ignore-config"];

export async function youtubeInfo(id: string) {
  const json = JSON.parse(await run([...BASE, "-J", `https://www.youtube.com/watch?v=${id}`], { timeoutMs: 90_000 }));
  if (json.is_live) throw new Error("Transmissão ao vivo em andamento: espere terminar para cortar.");
  return {
    title: String(json.title ?? "Vídeo do YouTube").slice(0, 200),
    durationSec: Number(json.duration ?? 0),
    channel: String(json.channel ?? json.uploader ?? "").slice(0, 200),
    channelId: String(json.channel_id ?? ""),
  };
}

/** Baixa em MP4 (até 1080p) para a pasta indicada e devolve o caminho do arquivo. */
export async function downloadYoutube(id: string, dir: string, onProgress: (pct: number) => void) {
  let last = -1;
  await run(
    [
      ...BASE,
      "-f", "bv*[height<=1080][ext=mp4]+ba[ext=m4a]/b[height<=1080][ext=mp4]/b",
      "--merge-output-format", "mp4",
      "--ffmpeg-location", String(ffmpegPath),
      "--max-filesize", "4G",
      // várias conexões ao mesmo tempo: o YouTube limita a velocidade por conexão
      "--concurrent-fragments", "8",
      "--newline",
      "-o", "video.%(ext)s",
      `https://www.youtube.com/watch?v=${id}`,
    ],
    {
      cwd: dir,
      onLine: (l) => {
        const m = /\[download\]\s+([\d.]+)%/.exec(l);
        if (m) {
          const pct = Math.floor(Number(m[1]));
          if (pct !== last) {
            last = pct;
            onProgress(pct);
          }
        }
      },
    },
  );
  const file = path.join(dir, "video.mp4");
  if (!existsSync(file)) throw new Error("O download terminou sem gerar o MP4");
  return file;
}

/** Lista os itens mais recentes de um perfil (TikTok etc.) sem baixar: JSON do yt-dlp. */
export async function listarPerfil(url: string, quantos = 15): Promise<Record<string, unknown>> {
  return JSON.parse(await run([...BASE, "--flat-playlist", "--playlist-end", String(quantos), "-J", url], { timeoutMs: 120_000 }));
}

/** Baixa um vídeo por link (TikTok etc.) em MP4 para a pasta e devolve o caminho. */
export async function baixarLink(url: string, dir: string) {
  await run([...BASE, "-f", "b[ext=mp4]/bv*+ba/b", "--merge-output-format", "mp4", "--ffmpeg-location", String(ffmpegPath), "--max-filesize", "2G", "-o", "video.%(ext)s", url], { cwd: dir, timeoutMs: 30 * 60_000 });
  const file = path.join(dir, "video.mp4");
  if (!existsSync(file)) throw new Error("O download terminou sem gerar o MP4");
  return file;
}
