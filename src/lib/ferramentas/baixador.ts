import "server-only";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";
import { ffmpeg } from "@/lib/clips/ffmpeg";
import { youtubeId } from "@/lib/clips/youtube";
import { assertPublicUrl } from "@/lib/net-safety";

/**
 * Baixador (YouTube, Instagram, TikTok e outros) com o mesmo yt-dlp que o módulo de cortes usa
 * (instalado em ./bin por `npm run setup:ytdlp`). Só aceita sites conhecidos — o yt-dlp
 * busca a URL a partir do servidor, então um domínio qualquer seria uma porta para SSRF.
 */
const SITES = [
  "youtube.com", "youtu.be", "youtube-nocookie.com", "instagram.com", "tiktok.com", "facebook.com", "fb.watch",
  "x.com", "twitter.com", "vimeo.com", "dailymotion.com", "twitch.tv", "kwai.com", "pinterest.com", "pin.it",
  "reddit.com", "soundcloud.com", "threads.net", "linkedin.com",
];

export const SITES_ACEITOS = ["YouTube", "Instagram", "TikTok", "Facebook", "X (Twitter)", "Vimeo", "Kwai", "Pinterest", "Reddit", "SoundCloud", "Twitch"];

export async function validarLink(raw: string): Promise<string> {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    throw new Error("Cole um link completo, começando com https://");
  }
  const host = u.hostname.toLowerCase().replace(/^www\.|^m\.|^vm\.|^vt\./, "");
  if (!SITES.some((s) => host === s || host.endsWith(`.${s}`))) throw new Error("Esse site não é aceito. Use links do YouTube, Instagram, TikTok, Facebook, X, Vimeo e similares.");
  const yt = youtubeId(u.toString());
  if (yt) return `https://www.youtube.com/watch?v=${yt}`;
  await assertPublicUrl(u);
  return u.toString();
}

function binario(): string {
  const p = process.env.YTDLP_PATH ?? path.resolve("bin", process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp");
  if (!existsSync(p)) throw new Error("O baixador ainda não está instalado no servidor. Um administrador precisa rodar: npm run setup:ytdlp");
  return p;
}

function erroAmigavel(stderr: string) {
  const l = stderr.split("\n").filter((x) => /ERROR/.test(x)).pop() ?? stderr.trim().split("\n").pop() ?? "";
  if (/Unsupported URL/i.test(l)) return "Esse link não é suportado.";
  if (/Private|login|sign in|cookies/i.test(l)) return "Esse conteúdo é privado ou precisa de login.";
  if (/not available|unavailable/i.test(l)) return "Esse vídeo não está disponível.";
  if (/File is larger than max-filesize/i.test(l)) return "O arquivo passa do limite de tamanho do servidor.";
  return l.replace(/^ERROR:\s*/, "").slice(0, 300) || "Não foi possível ler esse link.";
}

function rodar(args: string[], opts: { cwd?: string; timeoutMs?: number } = {}): Promise<string> {
  const exe = binario();
  return new Promise((resolve, reject) => {
    const p = spawn(exe, ["--no-warnings", "--ignore-config", "--no-playlist", "--js-runtimes", "node", ...args], { cwd: opts.cwd, windowsHide: true });
    let out = "";
    let err = "";
    p.stdout.on("data", (d) => {
      if (out.length < 20_000_000) out += d.toString();
    });
    p.stderr.on("data", (d) => (err = (err + d.toString()).slice(-6000)));
    const timer = setTimeout(() => p.kill("SIGKILL"), opts.timeoutMs ?? 30 * 60_000);
    p.on("error", reject);
    p.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(out);
      else reject(new Error(erroAmigavel(err)));
    });
  });
}

export type Opcao = { tipo: "video" | "audio" | "original"; altura?: number; rotulo: string };
export type InfoLink = { titulo: string; autor: string; duracao: number; miniatura: string | null; site: string; opcoes: Opcao[] };

export async function lerLink(url: string): Promise<InfoLink> {
  const j = JSON.parse(await rodar(["-J", url], { timeoutMs: 90_000 })) as {
    title?: string; uploader?: string; channel?: string; duration?: number; thumbnail?: string; extractor_key?: string; is_live?: boolean;
    formats?: { vcodec?: string; acodec?: string; height?: number }[];
  };
  if (j.is_live) throw new Error("Transmissão ao vivo em andamento: espere terminar para baixar.");
  const formatos = j.formats ?? [];
  const alturas = [...new Set(formatos.filter((f) => f.vcodec && f.vcodec !== "none" && f.height).map((f) => f.height!))].sort((a, b) => b - a);
  const opcoes: Opcao[] = [];
  for (const h of [2160, 1440, 1080, 720, 480, 360]) if (alturas.some((x) => x >= h)) opcoes.push({ tipo: "video", altura: h, rotulo: `Vídeo MP4 ${h >= 2160 ? "4K" : `${h}p`}` });
  if (!opcoes.length && alturas.length) opcoes.push({ tipo: "video", altura: alturas[0], rotulo: `Vídeo MP4 ${alturas[0]}p` });
  if (formatos.some((f) => f.acodec && f.acodec !== "none")) opcoes.push({ tipo: "audio", rotulo: "Só o áudio (MP3)" });
  if (!opcoes.length) opcoes.push({ tipo: "original", rotulo: "Arquivo original" });
  return {
    titulo: String(j.title ?? "Sem título").slice(0, 200),
    autor: String(j.uploader ?? j.channel ?? "").slice(0, 120),
    duracao: Number(j.duration ?? 0),
    miniatura: j.thumbnail && /^https:\/\//.test(j.thumbnail) ? j.thumbnail : null,
    site: String(j.extractor_key ?? ""),
    opcoes,
  };
}

/** Baixa para a pasta e devolve o caminho do arquivo final. */
export async function baixar(url: string, opcao: Opcao, pasta: string, maxBytes: number): Promise<string> {
  const args = ["--newline", "--windows-filenames", "--restrict-filenames", "--max-filesize", String(maxBytes), "--ffmpeg-location", String(ffmpegPath), "-o", "%(title).80B.%(ext)s"];
  if (opcao.tipo === "video") {
    const h = Math.min(2160, Math.max(144, Math.floor(opcao.altura ?? 1080)));
    args.push("-f", `bv*[height<=${h}][vcodec^=avc1]+ba[ext=m4a]/bv*[height<=${h}]+ba/b[height<=${h}]/b`, "--merge-output-format", "mp4");
  } else if (opcao.tipo === "audio") {
    args.push("-f", "ba[ext=m4a]/ba/b");
  }
  args.push(url);
  await rodar(args, { cwd: pasta });
  const arquivos = (await readdir(pasta)).filter((f) => !/\.(part|ytdl|temp)$/i.test(f) && !/\.f\d+\./.test(f));
  if (!arquivos[0]) throw new Error("O download terminou sem gerar arquivo.");
  const baixado = path.join(pasta, arquivos[0]);
  if (opcao.tipo !== "audio" || /\.mp3$/i.test(baixado)) return baixado;
  // o yt-dlp precisaria do ffprobe para extrair MP3; convertemos com o ffmpeg embutido
  const mp3 = path.join(pasta, `${path.parse(arquivos[0]).name}.mp3`);
  await ffmpeg(["-i", baixado, "-vn", "-c:a", "libmp3lame", "-q:a", "2", mp3]);
  return mp3;
}
