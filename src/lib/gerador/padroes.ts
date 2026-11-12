import "server-only";
import { randomUUID } from "node:crypto";
import type { VideoBrief, VideoProjeto, VideoRoteiro } from "@/db/schema";
import { getSetting, setSetting } from "@/lib/settings";

/**
 * Padrões de vídeo: a "memória" de um vídeo que deu certo.
 * Guarda tudo menos a história (personagem, estética, formato, voz, duração…) e os personagens
 * e o estilo visual que o diretor fixou, para gerar outro vídeo igual com 1 botão.
 */
export type PadraoVideo = {
  id: string;
  nome: string;
  criadoEm: string;
  userId: string | null;
  projetoId: string;              // vídeo que originou o padrão (a capa vem dele)
  capaChave?: string;
  usos: number;
  brief: Omit<VideoBrief, "tema" | "fotosAnimar" | "padraoId" | "mesmoPersonagem">;
  personagens?: VideoRoteiro["personagens"];
  estiloVisual?: string;
  anim?: Pick<NonNullable<VideoRoteiro["anim"]>, "elenco" | "corPersonagem" | "episodio"> & { traco?: string };
};

const CHAVE = "gerador.padroes";

export async function listarPadroes(): Promise<PadraoVideo[]> {
  return (await getSetting<PadraoVideo[]>(CHAVE, [])).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
}
export async function pegarPadrao(id: string) {
  return (await listarPadroes()).find((p) => p.id === id) ?? null;
}
async function gravar(lista: PadraoVideo[]) {
  await setSetting(CHAVE, lista.slice(0, 60));
}

/** Cria (ou atualiza) o padrão a partir de um vídeo pronto. Vídeo feito a partir de um padrão só soma o uso. */
export async function padraoDoProjeto(p: VideoProjeto): Promise<PadraoVideo | null> {
  const r = p.roteiro;
  if (!r || !p.resultado) return null;
  const lista = await listarPadroes();
  if (p.brief.padraoId) {
    const existente = lista.find((x) => x.id === p.brief.padraoId);
    if (existente) {
      existente.usos += 1;
      // com "mesmo personagem", o padrão continua o mesmo; só a capa acompanha o vídeo mais novo
      existente.capaChave = p.resultado.capaChave ?? existente.capaChave;
      existente.projetoId = p.id;
      await gravar(lista);
      return existente;
    }
  }
  if (lista.some((x) => x.projetoId === p.id)) return lista.find((x) => x.projetoId === p.id)!;
  const { tema: _t, fotosAnimar: _f, padraoId: _p, mesmoPersonagem: _m, ...brief } = p.brief;
  const anim = r.anim ? { elenco: r.anim.elenco, corPersonagem: r.anim.corPersonagem, episodio: r.anim.episodio, traco: (r.anim as { traco?: string }).traco } : undefined;
  const novo: PadraoVideo = {
    id: randomUUID(), nome: (r.titulo || p.titulo).slice(0, 80), criadoEm: new Date().toISOString(), userId: p.userId, projetoId: p.id,
    capaChave: p.resultado.capaChave, usos: 1, brief, personagens: r.personagens, estiloVisual: r.estiloVisual, anim,
  };
  await gravar([novo, ...lista]);
  return novo;
}

export async function renomearPadrao(id: string, nome: string) {
  const lista = await listarPadroes();
  const p = lista.find((x) => x.id === id);
  if (!p) return false;
  p.nome = nome.slice(0, 80);
  await gravar(lista);
  return true;
}
export async function excluirPadrao(id: string) {
  const lista = await listarPadroes();
  await gravar(lista.filter((x) => x.id !== id));
}
