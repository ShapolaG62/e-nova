import "server-only";
import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { stat, writeFile, copyFile } from "node:fs/promises";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";
import sharp from "sharp";
import { ffmpeg } from "@/lib/clips/ffmpeg";
import { extDe, semExt } from "./arquivos";
import { FORMATOS_SAIDA } from "./catalogo";

/** Conversor, compressor, ZIP e cortador (portado do MeuStudio). */
export const EXT = {
  video: ["mp4", "mkv", "mov", "avi", "webm", "flv", "wmv", "m4v", "3gp", "ts", "mts", "mpeg", "mpg"],
  audio: ["mp3", "wav", "flac", "ogg", "m4a", "aac", "opus", "wma", "aiff", "aif", "amr"],
  image: ["png", "jpg", "jpeg", "jfif", "webp", "bmp", "tif", "tiff", "gif", "avif", "heic", "heif", "svg", "ico"],
} as const;
export type Tipo = "video" | "audio" | "image" | "other";

export function tipoDe(nome: string): Tipo {
  const e = extDe(nome);
  for (const k of ["video", "audio", "image"] as const) if ((EXT[k] as readonly string[]).includes(e)) return k;
  return "other";
}

export const FORMATOS = FORMATOS_SAIDA;
export const TODOS_FORMATOS = [...new Set([...FORMATOS.video, ...FORMATOS.audio, ...FORMATOS.image])] as string[];

/** Codecs e duração (lê o cabeçalho que o ffmpeg imprime ao abrir o arquivo). */
export function inspecionar(arquivo: string): Promise<{ duracao: number; video: string | null; audio: string | null }> {
  return new Promise((resolve) => {
    if (!ffmpegPath) return resolve({ duracao: 0, video: null, audio: null });
    const p = spawn(ffmpegPath as string, ["-hide_banner", "-i", arquivo], { windowsHide: true });
    let err = "";
    p.stderr.on("data", (d) => {
      if (err.length < 60_000) err += d.toString();
    });
    const fim = () => {
      const dur = /Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/.exec(err);
      const v = /Stream #[^\n]*?Video: (\w+)/.exec(err.replace(/Stream #[^\n]*\(attached pic\)[^\n]*/g, ""));
      const a = /Stream #[^\n]*?Audio: (\w+)/.exec(err);
      resolve({ duracao: dur ? Number(dur[1]) * 3600 + Number(dur[2]) * 60 + Number(dur[3]) : 0, video: v?.[1] ?? null, audio: a?.[1] ?? null });
    };
    p.on("error", fim);
    p.on("close", fim);
  });
}

const RECODIFICAR = ["-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k"];

// ───────── conversão ─────────
export async function converterUm(entrada: string, nome: string, formato: string, pasta: string): Promise<string> {
  const tipo = tipoDe(nome);
  const saida = path.join(pasta, `${semExt(nome)}.${formato}`);
  if (tipo === "image" && formato !== "bmp" && !(extDe(nome) === "gif" && formato === "mp4")) {
    if (formato === "ico") return escreverIco(entrada, saida);
    if (formato === "pdf") return imagensParaPdf([entrada], saida);
    const animada = extDe(nome) === "gif" && formato === "gif";
    let img = sharp(entrada, { animated: animada, limitInputPixels: 268_402_689 }).rotate();
    if (formato === "jpg") img = img.flatten({ background: "#ffffff" }).jpeg({ quality: 92, mozjpeg: true });
    else if (formato === "png") img = img.png();
    else if (formato === "webp") img = img.webp({ quality: 90 });
    else if (formato === "avif") img = img.avif({ quality: 60 });
    else if (formato === "tiff") img = img.tiff();
    else if (formato === "gif") img = img.gif();
    else throw new Error(`Imagem não pode virar ${formato.toUpperCase()}.`);
    await img.toFile(saida);
    return saida;
  }
  if (tipo === "image" && formato !== "bmp") throw new Error(`Imagem não pode virar ${formato.toUpperCase()}.`);
  if (tipo === "audio" && !(FORMATOS.audio as readonly string[]).includes(formato)) throw new Error(`Áudio não pode virar ${formato.toUpperCase()}.`);

  const info = await inspecionar(entrada);
  const a = ["-i", entrada];
  switch (formato) {
    case "mp4":
    case "mov": {
      const copia = ["h264", "hevc"].includes(info.video ?? "") && (!info.audio || ["aac", "mp3", "alac"].includes(info.audio));
      a.push(...(copia ? ["-c", "copy"] : RECODIFICAR), "-movflags", "+faststart");
      break;
    }
    case "mkv": a.push("-c", "copy", "-map", "0"); break;
    case "webm": a.push("-c:v", "libvpx-vp9", "-crf", "32", "-b:v", "0", "-row-mt", "1", "-c:a", "libopus", "-b:a", "128k"); break;
    case "avi": a.push("-c:v", "mpeg4", "-q:v", "3", "-c:a", "libmp3lame", "-q:a", "3"); break;
    case "gif": a.push("-vf", "fps=12,scale='min(540,iw)':-1:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse", "-loop", "0"); break;
    case "bmp": a.push("-frames:v", "1"); break;
    case "mp3": a.push("-vn", "-c:a", "libmp3lame", "-q:a", "2"); break;
    case "wav": a.push("-vn", "-c:a", "pcm_s16le"); break;
    case "flac": a.push("-vn", "-c:a", "flac"); break;
    case "ogg": a.push("-vn", "-c:a", "libvorbis", "-q:a", "5"); break;
    case "m4a": a.push("-vn", "-c:a", "aac", "-b:a", "192k"); break;
    case "opus": a.push("-vn", "-c:a", "libopus", "-b:a", "128k"); break;
    default: throw new Error(`Formato não suportado: ${formato}`);
  }
  a.push(saida);
  try {
    await ffmpeg(a);
  } catch (e) {
    // cópia direta falhou (codec incompatível com o contêiner): recodifica
    if (a.includes("copy") && ["mp4", "mov", "mkv"].includes(formato)) await ffmpeg(["-i", entrada, ...RECODIFICAR, saida]);
    else throw e;
  }
  return saida;
}

/** ICO com vários tamanhos (16 a 256 px). */
async function escreverIco(entrada: string, saida: string) {
  const tamanhos = [16, 24, 32, 48, 64, 128, 256];
  const pngs = await Promise.all(tamanhos.map((s) => sharp(entrada).resize(s, s, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer()));
  const cab = Buffer.alloc(6 + 16 * tamanhos.length);
  cab.writeUInt16LE(0, 0);
  cab.writeUInt16LE(1, 2);
  cab.writeUInt16LE(tamanhos.length, 4);
  let pos = cab.length;
  tamanhos.forEach((s, i) => {
    const e = 6 + i * 16;
    cab.writeUInt8(s >= 256 ? 0 : s, e);
    cab.writeUInt8(s >= 256 ? 0 : s, e + 1);
    cab.writeUInt16LE(1, e + 4);
    cab.writeUInt16LE(32, e + 6);
    cab.writeUInt32LE(pngs[i].length, e + 8);
    cab.writeUInt32LE(pos, e + 12);
    pos += pngs[i].length;
  });
  await writeFile(saida, Buffer.concat([cab, ...pngs]));
  return saida;
}

/** PDF simples: uma imagem por página. */
export async function imagensParaPdf(entradas: string[], saida: string) {
  const partes: Buffer[] = [];
  const offsets: number[] = [];
  let pos = 0;
  const push = (b: Buffer | string) => {
    const buf = typeof b === "string" ? Buffer.from(b, "latin1") : b;
    partes.push(buf);
    pos += buf.length;
  };
  const obj = (n: number, corpo: (Buffer | string)[]) => {
    offsets[n] = pos;
    push(`${n} 0 obj\n`);
    corpo.forEach(push);
    push("\nendobj\n");
  };
  push("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  const n = entradas.length;
  obj(1, ["<< /Type /Catalog /Pages 2 0 R >>"]);
  obj(2, [`<< /Type /Pages /Kids [${entradas.map((_, i) => `${3 + i * 3} 0 R`).join(" ")}] /Count ${n} >>`]);
  for (let i = 0; i < n; i++) {
    const { data, info } = await sharp(entradas[i]).rotate().flatten({ background: "#ffffff" }).jpeg({ quality: 90 }).toBuffer({ resolveWithObject: true });
    const w = info.width * 0.75;
    const h = info.height * 0.75;
    const p = 3 + i * 3;
    obj(p, [`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im${i} ${p + 2} 0 R >> >> /Contents ${p + 1} 0 R >>`]);
    const conteudo = `q ${w} 0 0 ${h} 0 0 cm /Im${i} Do Q`;
    obj(p + 1, [`<< /Length ${conteudo.length} >>\nstream\n`, conteudo, "\nendstream"]);
    obj(p + 2, [`<< /Type /XObject /Subtype /Image /Width ${info.width} /Height ${info.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${data.length} >>\nstream\n`, data, "\nendstream"]);
  }
  const total = 3 + n * 3;
  const xref = pos;
  let x = `xref\n0 ${total}\n0000000000 65535 f \n`;
  for (let i = 1; i < total; i++) x += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  push(`${x}trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  await writeFile(saida, Buffer.concat(partes));
  return saida;
}

// ───────── compressão ─────────
export const NIVEIS = {
  leve: { crf: 23, ab: "128k", mp3: "192k", q: 85, png: 90 },
  equilibrada: { crf: 28, ab: "96k", mp3: "128k", q: 72, png: 75 },
  maxima: { crf: 32, ab: "64k", mp3: "80k", q: 60, png: 60, maxDim: 1920, maxVideo: 720 },
} as const;
export type Nivel = keyof typeof NIVEIS;

export async function comprimirUm(entrada: string, nome: string, nivel: Nivel, pasta: string) {
  const L: { crf: number; ab: string; mp3: string; q: number; png: number; maxDim?: number; maxVideo?: number } = NIVEIS[nivel];
  const tipo = tipoDe(nome);
  const base = semExt(nome);
  let saida: string;
  if (tipo === "video") {
    saida = path.join(pasta, `${base} (comprimido).mp4`);
    const args = ["-i", entrada, "-c:v", "libx264", "-preset", "medium", "-crf", String(L.crf), "-pix_fmt", "yuv420p"];
    if (L.maxVideo) args.push("-vf", `scale='if(gt(iw,ih),-2,min(${L.maxVideo},iw))':'if(gt(iw,ih),min(${L.maxVideo},ih),-2)'`);
    args.push("-c:a", "aac", "-b:a", L.ab, "-movflags", "+faststart", saida);
    await ffmpeg(args);
  } else if (tipo === "audio") {
    saida = path.join(pasta, `${base} (comprimido).mp3`);
    await ffmpeg(["-i", entrada, "-vn", "-c:a", "libmp3lame", "-b:a", L.mp3, saida]);
  } else if (tipo === "image") {
    const e = extDe(nome);
    const fmt = e === "jpeg" ? "jpg" : ["png", "webp", "jpg"].includes(e) ? e : "jpg";
    saida = path.join(pasta, `${base} (comprimido).${fmt}`);
    let img = sharp(entrada).rotate();
    if (L.maxDim) img = img.resize(L.maxDim, L.maxDim, { fit: "inside", withoutEnlargement: true });
    if (fmt === "png") img = img.png({ palette: true, quality: L.png, compressionLevel: 9, effort: 8 });
    else if (fmt === "webp") img = img.webp({ quality: L.q, effort: 6 });
    else img = img.flatten({ background: "#ffffff" }).jpeg({ quality: L.q, mozjpeg: true });
    await img.toFile(saida);
  } else {
    throw new Error(`${nome}: para esse tipo use "Compactar em ZIP".`);
  }
  const antes = (await stat(entrada)).size;
  const depois = (await stat(saida)).size;
  // ficou maior? entrega o original (com o nome novo)
  if (depois >= antes) {
    await copyFile(entrada, saida);
    return { saida, antes, depois: antes, manteve: true };
  }
  return { saida, antes, depois, manteve: false };
}

export async function compactarZip(arquivos: { caminho: string; nome: string }[], saida: string) {
  const { ZipArchive } = await import("archiver");
  await new Promise<void>((resolve, reject) => {
    const destino = createWriteStream(saida);
    const arc = new ZipArchive({ zlib: { level: 9 } });
    arc.on("error", reject);
    destino.on("close", () => resolve());
    destino.on("error", reject);
    arc.pipe(destino);
    const usados = new Set<string>();
    for (const a of arquivos) {
      let nome = a.nome;
      for (let i = 2; usados.has(nome.toLowerCase()); i++) nome = `${semExt(a.nome)} (${i})${path.extname(a.nome)}`;
      usados.add(nome.toLowerCase());
      arc.file(a.caminho, { name: nome });
    }
    void arc.finalize();
  });
  return saida;
}

// ───────── cortar vídeo ─────────
/** trechos: lista de [início, fim] em segundos que FICAM no vídeo. */
export async function cortar(entrada: string, nome: string, trechos: [number, number][], opts: { exato: boolean; semSom: boolean }, pasta: string) {
  const info = await inspecionar(entrada);
  if (!info.video) throw new Error("Não achei vídeo nesse arquivo.");
  const dur = info.duracao || Infinity;
  const validos = trechos
    .map(([s, e]) => [Math.max(0, s), Math.min(dur, e)] as [number, number])
    .filter(([s, e]) => e - s >= 0.1)
    .sort((a, b) => a[0] - b[0]);
  if (!validos.length) throw new Error("Escolha pelo menos um trecho com início antes do fim.");
  const ext = extDe(nome) || "mp4";
  const temSom = !!info.audio && !opts.semSom;
  if (opts.exato) {
    const saida = path.join(pasta, `${semExt(nome)} (cortado).mp4`);
    let fc = "";
    let cat = "";
    validos.forEach(([s, e], i) => {
      fc += `[0:v]trim=start=${s}:end=${e},setpts=PTS-STARTPTS[v${i}];`;
      if (temSom) fc += `[0:a]atrim=start=${s}:end=${e},asetpts=PTS-STARTPTS[a${i}];`;
      cat += `[v${i}]${temSom ? `[a${i}]` : ""}`;
    });
    fc += `${cat}concat=n=${validos.length}:v=1:a=${temSom ? 1 : 0}[v]${temSom ? "[a]" : ""}`;
    const args = ["-i", entrada, "-filter_complex", fc, "-map", "[v]"];
    if (temSom) args.push("-map", "[a]", "-c:a", "aac", "-b:a", "192k");
    args.push("-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart", saida);
    await ffmpeg(args);
    return saida;
  }
  // rápido: copia sem recodificar (corta no quadro-chave mais próximo)
  const saida = path.join(pasta, `${semExt(nome)} (cortado).${ext}`);
  const partes: string[] = [];
  for (let i = 0; i < validos.length; i++) {
    const [s, e] = validos[i];
    const parte = path.join(pasta, `parte-${i}.${ext}`);
    const args = ["-ss", String(s), "-i", entrada, "-t", String(e - s), "-map", "0:v:0"];
    if (temSom) args.push("-map", "0:a:0?");
    args.push("-c", "copy", "-avoid_negative_ts", "make_zero", parte);
    await ffmpeg(args);
    partes.push(parte);
  }
  const lista = path.join(pasta, "lista.txt");
  await writeFile(lista, partes.map((p) => `file '${path.basename(p).replace(/'/g, "'\\''")}'`).join("\n"));
  await ffmpeg(["-f", "concat", "-safe", "0", "-i", "lista.txt", "-c", "copy", path.basename(saida)], { cwd: pasta });
  return saida;
}

/** Gravação de tela: WebM do navegador → MP4. */
export async function webmParaMp4(entrada: string, pasta: string) {
  const carimbo = new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-");
  const saida = path.join(pasta, `Gravação ${carimbo}.mp4`);
  await ffmpeg(["-i", entrada, "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", "-vf", "pad=ceil(iw/2)*2:ceil(ih/2)*2", "-r", "30", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", saida]);
  return saida;
}
