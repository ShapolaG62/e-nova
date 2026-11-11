// Baixa o yt-dlp oficial (github.com/yt-dlp/yt-dlp) para ./bin — usado nos cortes por link do YouTube.
// Uso: npm run setup:ytdlp   (rode de novo de tempos em tempos: o YouTube muda e o yt-dlp acompanha)
import { chmod, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const win = process.platform === "win32";
const asset = win ? "yt-dlp.exe" : process.platform === "darwin" ? "yt-dlp_macos" : "yt-dlp_linux";
const url = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${asset}`;
const dest = path.resolve("bin", win ? "yt-dlp.exe" : "yt-dlp");

const res = await fetch(url, { redirect: "follow" });
if (!res.ok) throw new Error(`Falha ao baixar ${url}: HTTP ${res.status}`);
await mkdir(path.dirname(dest), { recursive: true });
await writeFile(dest, Buffer.from(await res.arrayBuffer()));
if (!win) await chmod(dest, 0o755);
console.log(`✓ yt-dlp salvo em ${dest}`);
