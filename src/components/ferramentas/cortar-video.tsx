"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Eye, EyeOff, RotateCcw, Scissors, SplitSquareHorizontal } from "lucide-react";
import { cortarVideoAction } from "@/app/actions/ferramentas";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BotaoAcao, ListaResultados, Painel, Progresso, Segmentado, SeletorArquivos, useEnvio, type ArquivoPronto } from "./comum";

const tempo = (s: number) => {
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return `${m}:${r.toFixed(1).padStart(4, "0").replace(".", ",")}`;
};

export function CortarVideo() {
  const [arquivos, setArquivos] = useState<File[]>([]);
  const arquivo = arquivos[0] ?? null;
  const url = useMemo(() => (arquivo ? URL.createObjectURL(arquivo) : null), [arquivo]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  const video = useRef<HTMLVideoElement>(null);
  const [duracao, setDuracao] = useState(0);
  const [agora, setAgora] = useState(0);
  const [cortes, setCortes] = useState<number[]>([]); // pontos de divisão
  const [fora, setFora] = useState<Set<number>>(new Set()); // índices dos pedaços tirados
  const [modo, setModo] = useState<"rapido" | "exato">("rapido");
  const [semSom, setSemSom] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [pronto, setPronto] = useState<ArquivoPronto[]>([]);
  const { enviar, progresso } = useEnvio();

  const pontos = [0, ...cortes, duracao];
  const pedacos = pontos.slice(0, -1).map((ini, i) => ({ ini, fim: pontos[i + 1], i, fica: !fora.has(i) }));
  const ficam = pedacos.filter((p) => p.fica);
  const totalFica = ficam.reduce((t, p) => t + (p.fim - p.ini), 0);

  function trocarArquivo(a: File[]) {
    setArquivos(a);
    setCortes([]);
    setFora(new Set());
    setDuracao(0);
    setPronto([]);
  }

  function dividir() {
    const t = Math.round(agora * 10) / 10;
    if (t <= 0.2 || t >= duracao - 0.2 || cortes.some((c) => Math.abs(c - t) < 0.2)) return toast.message("Mova o vídeo para outro ponto antes de dividir.");
    // o pedaço dividido mantém o estado nos dois lados
    const idx = pedacos.findIndex((p) => t > p.ini && t < p.fim);
    const novoFora = new Set<number>();
    for (const i of fora) {
      if (i < idx) novoFora.add(i);
      else if (i === idx) { novoFora.add(i); novoFora.add(i + 1); }
      else novoFora.add(i + 1);
    }
    setCortes([...cortes, t].sort((a, b) => a - b));
    setFora(novoFora);
  }

  function alternar(i: number) {
    const n = new Set(fora);
    if (n.has(i)) n.delete(i);
    else n.add(i);
    setFora(n);
  }

  // prévia: pula os pedaços tirados
  function aoTocar() {
    const v = video.current;
    if (!v) return;
    setAgora(v.currentTime);
    const p = pedacos.find((x) => v.currentTime >= x.ini && v.currentTime < x.fim);
    if (p && !p.fica && !v.paused) {
      const proximo = pedacos.find((x) => x.ini >= p.fim && x.fica);
      if (proximo) v.currentTime = proximo.ini;
      else v.pause();
    }
  }

  async function cortar() {
    if (!arquivo || !ficam.length) return;
    // junta pedaços vizinhos que ficam
    const trechos: [number, number][] = [];
    for (const p of ficam) {
      const ult = trechos.at(-1);
      if (ult && Math.abs(ult[1] - p.ini) < 0.01) ult[1] = p.fim;
      else trechos.push([p.ini, p.fim]);
    }
    setOcupado(true);
    setPronto([]);
    try {
      const [id] = await enviar([arquivo]);
      const r = await cortarVideoAction({ id, trechos, exato: modo === "exato", semSom });
      if (!r.ok) return void toast.error(r.message);
      setPronto([r.dados]);
      toast.success("Vídeo cortado!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no envio.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Painel titulo="Cortar vídeo" descricao="Divida o vídeo em pedaços e tire os que não quer. O resto é juntado sozinho.">
      {!arquivo ? (
        <SeletorArquivos aceita="video/*,.mkv" arquivos={arquivos} onChange={trocarArquivo} rotulo="Toque para escolher o vídeo" />
      ) : (
        <div className="grid gap-3">
          <video
            ref={video}
            src={url ?? undefined}
            controls
            playsInline
            preload="metadata"
            onLoadedMetadata={(e) => setDuracao(e.currentTarget.duration || 0)}
            onTimeUpdate={aoTocar}
            onSeeked={(e) => setAgora(e.currentTarget.currentTime)}
            className="max-h-[50vh] w-full rounded-xl bg-black"
          />
          {duracao > 0 && (
            <>
              {/* linha do tempo: verde fica, riscado sai */}
              <div className="relative flex h-10 w-full overflow-hidden rounded-lg border" aria-label="Linha do tempo">
                {pedacos.map((p) => (
                  <button
                    key={p.i}
                    type="button"
                    onClick={() => alternar(p.i)}
                    style={{ width: `${((p.fim - p.ini) / duracao) * 100}%` }}
                    className={cn("h-full border-r last:border-r-0 text-[0.65rem] transition-colors", p.fica ? "bg-signal/25 hover:bg-signal/35" : "bg-[repeating-linear-gradient(45deg,var(--muted),var(--muted)_6px,transparent_6px,transparent_12px)] text-muted-foreground")}
                    aria-label={`Pedaço ${p.i + 1}: ${p.fica ? "fica" : "sai"}`}
                  />
                ))}
                <span className="pointer-events-none absolute inset-y-0 w-0.5 bg-foreground" style={{ left: `${(agora / duracao) * 100}%` }} />
              </div>
              <div className="grid grid-cols-2 gap-2 sm:flex">
                <Button type="button" variant="outline" className="h-11 sm:h-8" onClick={dividir}>
                  <SplitSquareHorizontal data-icon="inline-start" /> Dividir em {tempo(agora)}
                </Button>
                <Button type="button" variant="ghost" className="h-11 sm:h-8" onClick={() => { setCortes([]); setFora(new Set()); }}>
                  <RotateCcw data-icon="inline-start" /> Recomeçar
                </Button>
              </div>
              <ul className="grid gap-1.5">
                {pedacos.map((p) => (
                  <li key={p.i} className={cn("flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm", !p.fica && "opacity-60")}>
                    <button type="button" className="min-w-0 flex-1 text-left tabular-nums" onClick={() => { if (video.current) video.current.currentTime = p.ini; }}>
                      <span className="font-medium">Pedaço {p.i + 1}</span> <span className="text-muted-foreground">{tempo(p.ini)} → {tempo(p.fim)}</span>
                    </button>
                    <Button type="button" size="sm" variant={p.fica ? "secondary" : "outline"} className="h-9 sm:h-7" onClick={() => alternar(p.i)}>
                      {p.fica ? <Eye data-icon="inline-start" /> : <EyeOff data-icon="inline-start" />}
                      {p.fica ? "Fica" : "Sai"}
                    </Button>
                  </li>
                ))}
              </ul>
              <p className="text-sm text-muted-foreground">Vídeo final: <strong className="text-foreground">{tempo(totalFica)}</strong> de {tempo(duracao)}.</p>
            </>
          )}
          <Segmentado<"rapido" | "exato">
            rotulo="Como cortar"
            valor={modo}
            onChange={setModo}
            colunas={2}
            opcoes={[
              { v: "rapido", rotulo: "Rápido", dica: "sem recodificar; corta no quadro-chave" },
              { v: "exato", rotulo: "Exato", dica: "no quadro certo; demora mais" },
            ]}
          />
          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" checked={semSom} onChange={(e) => setSemSom(e.target.checked)} className="size-5 accent-signal" />
            Tirar o som do vídeo
          </label>
          {ocupado && <Progresso valor={progresso} rotulo={progresso !== null ? "Enviando o vídeo…" : "Cortando…"} />}
          <div className="grid gap-2 sm:flex">
            <BotaoAcao ocupado={ocupado} disabled={!ficam.length || !duracao} onClick={cortar} icone={<Scissors data-icon="inline-start" />}>
              {ocupado ? "Cortando…" : "Cortar e juntar"}
            </BotaoAcao>
            <Button type="button" variant="ghost" className="h-11 sm:h-9" onClick={() => trocarArquivo([])} disabled={ocupado}>
              Escolher outro vídeo
            </Button>
          </div>
          <ListaResultados arquivos={pronto} />
        </div>
      )}
    </Painel>
  );
}
