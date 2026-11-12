// Teste de ponta a ponta do Gerador novo (história + personagem + estética + fotos + corrente de IAs).
// Cria um vídeo curto, espera o worker escrever e produzir, e mostra quem fez o quê.
import { readFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import { putObject } from "@/lib/storage";
import { enfileirarProducao, enfileirarRoteiro } from "@/lib/gerador/motor";

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function ate(id: string, fim: string[], limiteMin: number) {
  let ult = "";
  for (let i = 0; i < limiteMin * 12; i++) {
    const p = (await db.query.videoProjetos.findFirst({ where: eq(t.videoProjetos.id, id) }))!;
    const linha = `${p.status} ${p.progresso}% — ${p.etapa ?? ""}`;
    if (linha !== ult) { console.log(new Date().toISOString().slice(11, 19), linha); ult = linha; }
    if (fim.includes(p.status)) return p;
    await esperar(5000);
  }
  throw new Error("demorou demais");
}

async function main() {
  const u = await db.query.users.findFirst();
  const [row] = await db.insert(t.videoProjetos).values({
    titulo: process.env.CORTE ? "Teste: Como funciona" : "Teste: Dona Rita e o forno",
    brief: process.env.CORTE ? {
      tema: process.env.CORTE,
      estilo: "animacao", personagens: (process.env.PERS === "3d" ? "3d" : "corte"), formato: "como-funciona", duracaoAlvo: 60, proporcao: "9:16", visual: "imagem", fonteVisual: "ia",
      legendas: true, musica: false, revisar: true,
    } : {
      tema: "Dona Rita abre a padaria às 5h da manhã, o forno falha no dia da maior encomenda do ano e ela salva tudo com a ajuda do café da esquina. Final feliz, convite para visitar a padaria.",
      estilo: "fotos", formato: "historia", duracaoAlvo: 20, proporcao: "9:16", visual: "imagem", fonteVisual: "ia",
      personagem: "Dona Rita, 60 anos, cabelo grisalho preso em coque, avental vermelho, sorriso largo, dona de padaria",
      estetica: "3d-fofo", legendas: true, musica: false, revisar: true,
    },
    userId: u!.id, etapa: "Na fila do diretor…",
  }).returning({ id: t.videoProjetos.id });
  const id = row.id;
  // duas fotos "do cliente" para animar (as fotos das áreas servem de teste)
  const fotos = [];
  for (const [i, arq] of (process.env.CORTE ? [] : ["public/areas/vendas.jpg", "public/areas/operacao.jpg"]).entries()) {
    const k = `gerador/${id}/foto-${i + 1}.jpg`;
    await putObject(k, readFileSync(arq), "image/jpeg");
    fotos.push(k);
  }
  const p0 = (await db.query.videoProjetos.findFirst({ where: eq(t.videoProjetos.id, id) }))!;
  if (fotos.length) await db.update(t.videoProjetos).set({ brief: { ...p0.brief, fotosAnimar: fotos } }).where(eq(t.videoProjetos.id, id));
  console.log("projeto", id);

  await enfileirarRoteiro(id);
  const p1 = await ate(id, ["ROTEIRO_PRONTO", "FALHOU"], 6);
  if (p1.status === "FALHOU") { console.log("ERRO:", p1.erro); process.exit(1); }
  console.log("CADEIA:", p1.roteiro?.cadeia);
  console.log("PERSONAGENS:", JSON.stringify(p1.roteiro?.personagens));
  console.log("ESTILO:", p1.roteiro?.estiloVisual);
  for (const c of p1.roteiro!.cenas) console.log(` ${c.id}${c.visual.foto ? " [FOTO]" : ""}: ${c.narracao} | ${c.mundo3d ? JSON.stringify(c.mundo3d) : c.corte ? JSON.stringify(c.corte) : c.visual.prompt.slice(0, 90)}`);
  if (p1.roteiro?.mundo3d) console.log("MAQUETE:", JSON.stringify({ ...p1.roteiro.mundo3d, pecas: p1.roteiro.mundo3d.pecas.map((x) => ({ ...x, prims: x.prims?.length })) }));
  if (p1.roteiro?.corte) console.log("MUNDO:", JSON.stringify({ ...p1.roteiro.corte, pecas: p1.roteiro.corte.pecas.map((x) => ({ ...x, svg: x.svg ? x.svg.length + " chars" : undefined })) }));

  await enfileirarProducao(id);
  const p2 = await ate(id, ["PRONTO", "FALHOU"], 20);
  console.log("FIM:", p2.status, p2.erro ?? "");
  for (const c of p2.cenas) console.log(` ${c.id}: ${c.status} visual=${c.usadoVisual} voz=${c.usadoVoz} ${c.erro ?? ""}`);
  console.log("REVISAO:", JSON.stringify(p2.resultado?.revisao));
  const { listarPadroes } = await import("@/lib/gerador/padroes");
  console.log("PADROES:", (await listarPadroes()).map((x) => `${x.nome} (${x.projetoId === id ? "deste vídeo" : "outro"})`));
  process.exit(0);
}
main();
