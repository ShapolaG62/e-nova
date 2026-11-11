"use client";

import { useState } from "react";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { converterAction } from "@/app/actions/ferramentas";
import { FORMATOS_SAIDA, tipoPorNome } from "@/lib/ferramentas/catalogo";
import { cn } from "@/lib/utils";
import { BotaoAcao, ListaResultados, Painel, Progresso, SeletorArquivos, useEnvio, type ArquivoPronto } from "./comum";

const ROTULO: Record<string, string> = { mp3: "MP3", mp4: "MP4", gif: "GIF animado", pdf: "PDF", ico: "Ícone (ICO)", m4a: "M4A" };

export function Conversor() {
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [formato, setFormato] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [prontos, setProntos] = useState<ArquivoPronto[]>([]);
  const { enviar, progresso } = useEnvio();

  const tipos = [...new Set(arquivos.map((a) => tipoPorNome(a.name)))];
  const desconhecido = tipos.includes("other");
  // só os formatos que servem para todos os arquivos escolhidos
  const opcoes = !arquivos.length || desconhecido
    ? []
    : tipos.map((t) => FORMATOS_SAIDA[t as keyof typeof FORMATOS_SAIDA] as readonly string[]).reduce((acc, l) => acc.filter((f) => l.includes(f)));
  const escolhido = opcoes.includes(formato) ? formato : "";

  async function converter() {
    if (!escolhido) return toast.error("Escolha o formato de saída.");
    setOcupado(true);
    setProntos([]);
    try {
      const ids = await enviar(arquivos);
      const r = await converterAction({ ids, formato: escolhido });
      if (!r.ok) return void toast.error(r.message);
      setProntos(r.dados);
      setArquivos([]);
      toast.success("Conversão pronta!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no envio.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Painel titulo="Conversor" descricao="Converta vídeos, áudios e imagens para outro formato. Quando dá, o vídeo nem é recodificado (fica pronto bem rápido).">
      <SeletorArquivos multiplo aceita="video/*,audio/*,image/*,.mkv,.heic,.avif" arquivos={arquivos} onChange={(a) => { setArquivos(a); setProntos([]); }} dica="Até 20 arquivos. Imagens podem virar um PDF só." />
      {desconhecido && <p className="text-sm text-destructive">Algum arquivo não é vídeo, áudio nem imagem. Para ele, use o Compressor (ZIP).</p>}
      {opcoes.length > 0 && (
        <fieldset className="grid gap-1.5">
          <legend className="mb-1.5 text-sm font-medium">Converter para</legend>
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
            {opcoes.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFormato(f)}
                aria-pressed={escolhido === f}
                className={cn("min-h-11 rounded-lg border px-2 text-sm uppercase sm:min-h-9", escolhido === f ? "border-signal bg-signal/10 font-semibold" : "hover:bg-muted")}
              >
                {ROTULO[f] ?? f}
              </button>
            ))}
          </div>
          {escolhido && ["mp3", "wav", "m4a"].includes(escolhido) && tipos.includes("video") && <p className="text-xs text-muted-foreground">Vai tirar só o áudio do vídeo.</p>}
        </fieldset>
      )}
      {ocupado && <Progresso valor={progresso} rotulo={progresso !== null ? "Enviando…" : "Convertendo… vídeos longos podem levar alguns minutos."} />}
      <div>
        <BotaoAcao ocupado={ocupado} disabled={!arquivos.length || !escolhido} onClick={converter} icone={<RefreshCw data-icon="inline-start" />}>
          {ocupado ? "Convertendo…" : "Converter"}
        </BotaoAcao>
      </div>
      <ListaResultados arquivos={prontos} />
    </Painel>
  );
}
