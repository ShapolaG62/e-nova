"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Archive, Minimize2 } from "lucide-react";
import { comprimirAction, zipAction, type Comprimido } from "@/app/actions/ferramentas";
import { tamanhoLegivel, tipoPorNome } from "@/lib/ferramentas/catalogo";
import { BotaoAcao, ListaResultados, Painel, Progresso, Segmentado, SeletorArquivos, useEnvio } from "./comum";

type Nivel = "leve" | "equilibrada" | "maxima";

export function Compressor() {
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [nivel, setNivel] = useState<Nivel>("equilibrada");
  const [ocupado, setOcupado] = useState<"comprimir" | "zip" | null>(null);
  const [prontos, setProntos] = useState<Comprimido[]>([]);
  const { enviar, progresso } = useEnvio();
  const soMidia = arquivos.length > 0 && arquivos.every((a) => tipoPorNome(a.name) !== "other");

  async function rodar(qual: "comprimir" | "zip") {
    setOcupado(qual);
    setProntos([]);
    try {
      const ids = await enviar(arquivos);
      const r = qual === "zip" ? await zipAction({ ids }) : await comprimirAction({ ids, nivel });
      if (!r.ok) return void toast.error(r.message);
      setProntos(Array.isArray(r.dados) ? r.dados : [r.dados]);
      setArquivos([]);
      toast.success(qual === "zip" ? "ZIP pronto!" : "Compressão pronta!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no envio.");
    } finally {
      setOcupado(null);
    }
  }

  const antes = prontos.reduce((t, p) => t + p.antes, 0);
  const depois = prontos.reduce((t, p) => t + p.tamanho, 0);

  return (
    <Painel titulo="Compressor" descricao="Deixe imagens, vídeos e áudios mais leves sem perda visível, ou junte qualquer arquivo num ZIP.">
      <SeletorArquivos multiplo arquivos={arquivos} onChange={(a) => { setArquivos(a); setProntos([]); }} dica="Até 20 arquivos de qualquer tipo." />
      <Segmentado<Nivel>
        rotulo="Nível de compressão"
        valor={nivel}
        onChange={setNivel}
        opcoes={[
          { v: "leve", rotulo: "Leve", dica: "qualidade máxima" },
          { v: "equilibrada", rotulo: "Equilibrada", dica: "recomendada" },
          { v: "maxima", rotulo: "Máxima", dica: "até 720p / 1920px" },
        ]}
      />
      {ocupado && <Progresso valor={progresso} rotulo={progresso !== null ? "Enviando…" : ocupado === "zip" ? "Compactando…" : "Comprimindo… vídeos podem levar alguns minutos."} />}
      <div className="grid gap-2 sm:flex">
        <BotaoAcao ocupado={ocupado === "comprimir"} disabled={!soMidia || !!ocupado} onClick={() => rodar("comprimir")} icone={<Minimize2 data-icon="inline-start" />}>
          Comprimir
        </BotaoAcao>
        <BotaoAcao variant="outline" ocupado={ocupado === "zip"} disabled={!arquivos.length || !!ocupado} onClick={() => rodar("zip")} icone={<Archive data-icon="inline-start" />}>
          Compactar em ZIP
        </BotaoAcao>
      </div>
      {arquivos.length > 0 && !soMidia && <p className="text-xs text-muted-foreground">Documentos e outros tipos só podem ir para o ZIP.</p>}
      {prontos.length > 0 && antes > 0 && (
        <p className="rounded-xl bg-signal/10 px-3 py-2 text-sm">
          {depois < antes
            ? <>Economia de <strong>{tamanhoLegivel(antes - depois)}</strong> ({Math.round((1 - depois / antes) * 100)}%): {tamanhoLegivel(antes)} → {tamanhoLegivel(depois)}</>
            : "Esses arquivos já estavam bem comprimidos; mantivemos o tamanho original."}
        </p>
      )}
      <ListaResultados arquivos={prontos} extra={(a, i) => (prontos[i]?.manteve ? " • já estava no tamanho mínimo" : prontos[i] && prontos[i].antes > a.tamanho ? ` • antes ${tamanhoLegivel(prontos[i].antes)}` : null)} />
    </Painel>
  );
}
