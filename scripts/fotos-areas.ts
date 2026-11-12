// Uso único: baixa da Pixabay uma foto para o cabeçalho de cada área do painel (public/areas/*.jpg).
// npx tsx --conditions=react-server --env-file=.env.local scripts/fotos-areas.ts [area=termo ...]
import { mkdirSync, writeFileSync } from "node:fs";
import { chavePixabay, buscarPixabay } from "@/lib/ferramentas/pixabay";

const TERMOS: Record<string, string> = {
  operacao: "team working office desk",
  vendas: "shop owner customer counter",
  conteudo: "video camera filming studio",
  gestao: "planning notebook desk charts",
  conta: "coffee laptop desk morning",
};
for (const a of process.argv.slice(2)) { const [k, v] = a.split("="); if (k && v) TERMOS[k] = v; }

async function main() {
const chave = await chavePixabay();
if (!chave) throw new Error("Sem chave da Pixabay");
mkdirSync("public/areas", { recursive: true });
const creditos: Record<string, string> = {};
for (const [area, termo] of Object.entries(TERMOS)) {
  const pular = Number(process.env[`PULAR_${area.toUpperCase()}`] ?? 0);
  const { itens } = await buscarPixabay(chave, { termo, tipo: "foto", pagina: 1, porPagina: 20, orientacao: "horizontal", idioma: "en", ordem: "popular" });
  const f = itens.filter((i) => i.largura >= 1600 && !/ai generated|mask/i.test(i.titulo))[pular];
  if (!f) { console.log(area, "sem foto"); continue; }
  const r = await fetch(f.url, { headers: { "User-Agent": "Mozilla/5.0" } });
  writeFileSync(`public/areas/${area}.jpg`, Buffer.from(await r.arrayBuffer()));
  creditos[area] = `${f.autor} — ${f.pagina}`;
  console.log(area, "ok", f.titulo);
}
writeFileSync("public/areas/creditos.json", JSON.stringify(creditos, null, 2));
process.exit(0);
}
main();
