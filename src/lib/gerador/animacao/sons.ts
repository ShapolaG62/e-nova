import "server-only";
import path from "node:path";
import { ffmpeg } from "@/lib/clips/ffmpeg";
import type { Som } from "./tipos";

// Efeitos sonoros sintetizados pelo próprio FFmpeg (sem banco de sons, sem API, sem direitos autorais).
const RECEITAS: Record<Exclude<Som, "nenhum">, { expr: string; dur: number; filtro?: string }> = {
  impacto: { expr: "0.9*sin(2*PI*52*t)*exp(-5*t)+0.45*(random(0)*2-1)*exp(-22*t)", dur: 1.4, filtro: "lowpass=f=900" },
  coracao: { expr: "0.95*sin(2*PI*48*t)*(exp(-16*mod(t,0.85))+0.8*exp(-16*max(mod(t,0.85)-0.26,0))*gt(mod(t,0.85),0.26))", dur: 1.75, filtro: "lowpass=f=200" },
  passos: { expr: "(random(0)*2-1)*exp(-38*mod(t,0.36))*0.8", dur: 1.6, filtro: "lowpass=f=700,highpass=f=80" },
  porta: { expr: "0.45*sin(2*PI*(260+140*sin(2*PI*2.6*t))*t)*(1-exp(-6*t))*exp(-1.1*t)", dur: 1.9, filtro: "highpass=f=150" },
  vento: { expr: "(random(0)*2-1)*0.5*(0.6+0.4*sin(2*PI*0.4*t))", dur: 3, filtro: "lowpass=f=420,afade=t=in:d=0.6,afade=t=out:st=2.2:d=0.8" },
  ding: { expr: "0.6*sin(2*PI*1320*t)*exp(-4*t)+0.25*sin(2*PI*2640*t)*exp(-6*t)", dur: 1.5 },
  notificacao: { expr: "0.5*sin(2*PI*880*t)*lt(t,0.12)+0.5*sin(2*PI*1320*t)*gt(t,0.16)*lt(t,0.3)", dur: 0.5, filtro: "afade=t=out:st=0.3:d=0.2" },
  susto: { expr: "0.45*sin(2*PI*(700+2600*t)*t)*exp(-2.2*t)+0.5*(random(0)*2-1)*exp(-7*t)", dur: 1.3, filtro: "highpass=f=200" },
  latido: { expr: "0.7*sin(2*PI*(430-260*mod(t,0.42))*t)*exp(-12*mod(t,0.42))*lt(mod(t,0.42),0.2)", dur: 1, filtro: "lowpass=f=2500" },
};

/** Gera o arquivo do efeito na pasta de trabalho e devolve o caminho. */
export async function gerarSom(som: Exclude<Som, "nenhum">, dir: string): Promise<string> {
  const r = RECEITAS[som];
  const arq = path.join(dir, `sfx-${som}.wav`);
  await ffmpeg(["-f", "lavfi", "-i", `aevalsrc='${r.expr}':s=48000:d=${r.dur}`, ...(r.filtro ? ["-af", r.filtro] : []), "-ac", "2", arq]);
  return arq;
}

/** Clima de fundo grave e contínuo (o "zumbido" de terror/suspense), em volume baixo. */
export async function gerarAmbiente(dur: number, dir: string, clima: "tensao" | "leve"): Promise<string> {
  const arq = path.join(dir, "ambiente.wav");
  const expr = clima === "tensao"
    ? "0.10*sin(2*PI*55*t)+0.06*sin(2*PI*58.3*t)+0.05*sin(2*PI*110.4*t)*(0.5+0.5*sin(2*PI*0.07*t))+0.03*(random(0)*2-1)"
    : "0.05*sin(2*PI*220*t)*(0.5+0.5*sin(2*PI*0.25*t))+0.04*sin(2*PI*329.6*t)*(0.5+0.5*sin(2*PI*0.18*t))";
  await ffmpeg(["-f", "lavfi", "-i", `aevalsrc='${expr}':s=48000:d=${dur.toFixed(2)}`, "-af", `lowpass=f=${clima === "tensao" ? 500 : 2000},afade=t=in:d=1.5,afade=t=out:st=${Math.max(0, dur - 1.5).toFixed(2)}:d=1.5`, "-ac", "2", arq]);
  return arq;
}
