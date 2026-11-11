// Fachada tipada do motor de sites (os módulos em ./engine são JS puro, sem dependências).
import * as R from "./engine/render.js";
import * as C from "./engine/conteudo.js";
import * as S from "./engine/setores.js";
import * as A from "./engine/abordagem.js";
import * as Pl from "./engine/places.js";
import * as Z from "./engine/zip.js";
import * as U from "./engine/util.js";

/* eslint-disable @typescript-eslint/no-explicit-any */
export type SiteBlock = { id: string; tipo: string; visivel?: boolean; dados: Record<string, any> };
export type SiteDoc = {
  versao: number;
  layout: string;
  tema: string;
  cores: { primaria: string; secundaria: string };
  setor: string;
  tom: string;
  negocio: Record<string, any>;
  fotos: { capa: string; lista: string[] };
  animacoes: Record<string, boolean>;
  blocos: SiteBlock[];
  textosIA?: boolean;
};
export type Setor = {
  id: string; nome: string; icone: string; busca: string; tipos: string[];
  cores: [string, string][]; visuais: string[];
  vocab: { cliente: string; clientes: string; acao: string; cta: string; lugar: string };
  servicos: [string, string][];
};
export type LayoutInfo = { id: string; nome: string; descricao: string; escuro: boolean; setores: string[] };
export type Mensagem = { etapa: string; dica?: string; texto: string };
export type Abordagem = { resumo: { empresa: string; nicho: string; cidade: string; objetivo: string }; mensagens: Mensagem[]; ia?: boolean; aviso?: string };
export type FalaLigacao = { etapa: string; fala: string; coach: string };

export const renderSite = (doc: SiteDoc, opts: { midia?: (u: string) => string; editor?: boolean; beacon?: string; rodapeCredito?: string } = {}): string => (R as any).render(doc, opts);
export const listaLayouts = (): LayoutInfo[] => (R as any).listaLayouts();
export const LAYOUT_IDS = (): string[] => Object.keys((R as any).LAYOUTS);
export const TEMAS: Record<string, string> = (R as any).TEMAS;

export const montarDocumento = (neg: Record<string, any>, opcoes: { setor?: string; servicos?: string[]; cores?: string[]; tom?: string; fotos?: string[]; layout?: string }): SiteDoc => (C as any).montarDocumento(neg, opcoes);
export const novoBloco = (tipo: string, dados: Record<string, any>): SiteBlock => (C as any).bloco(tipo, dados);
export const TONS: Record<string, string> = (C as any).TONS;

export const SETORES: Setor[] = (S as any).SETORES;
export const setor = (id?: string | null): Setor => (S as any).setor(id);
export const detectarSetor = (lead: Record<string, any>): string => (S as any).detectarSetor(lead);
export const listaSetores = () => (S as any).listaResumo() as { id: string; nome: string; icone: string; busca: string; cores: [string, string][]; servicos: string[]; visuais: string[] }[];

export const abordagemPadrao = (lead: Record<string, any>, config: Record<string, any>, link: string): Abordagem => (A as any).abordagemPadrao(lead, config, link);
export const ligacaoPadrao = (lead: Record<string, any>, config: Record<string, any>): FalaLigacao[] => (A as any).ligacaoPadrao(lead, config);
export const mensagemEnvio = (lead: Record<string, any>, config: Record<string, any>, link: string): string => (A as any).mensagemEnvio(lead, config, link);
export const OBJECOES: { objecao: string; resposta: string }[] = (A as any).OBJECOES;

export type LeadBusca = Record<string, any> & { id: string; placeId?: string; nome: string; oportunidade: number; situacaoSite: "sem" | "rede" | "tem"; fotos: string[] };
export const buscarPlaces = (o: { termo: string; cidade: string; uf?: string; pais?: string; quantidade: number; chave?: string; soSemSite?: boolean }): Promise<{ leads: LeadBusca[]; analisadas: number; comSite: number; semSite: number; demo: boolean }> => (Pl as any).buscar(o);
export const notaOportunidade = (l: Record<string, any>): number => (Pl as any).notaOportunidade(l);
export const PAISES: Record<string, { nome: string; idioma: string; ddi: string; moeda: string }> = (Pl as any).PAISES;

export const zipArquivos = (arquivos: { nome: string; dados: Buffer | string }[]): Buffer => (Z as any).zip(arquivos);
export const slugSite = (s: string): string => (U as any).slugify(s);
export const telefoneBR = (t: string): { digitos: string; celular: boolean; whatsapp: string } => (U as any).telefoneBR(t);
