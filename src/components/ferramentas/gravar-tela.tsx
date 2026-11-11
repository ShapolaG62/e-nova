"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { Circle, Download, Film, MonitorUp, Square } from "lucide-react";
import { gravacaoParaMp4Action } from "@/app/actions/ferramentas";
import { Button } from "@/components/ui/button";
import { tamanhoLegivel } from "@/lib/ferramentas/catalogo";
import { BotaoAcao, enviarArquivo, ListaResultados, Painel, Progresso, type ArquivoPronto } from "./comum";

const relogio = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
const suporta = () => typeof navigator !== "undefined" && !!navigator.mediaDevices?.getDisplayMedia && typeof MediaRecorder !== "undefined";
const nada = () => () => {};

export function GravarTela() {
  const temSuporte = useSyncExternalStore(nada, suporta, () => true);
  const [comSom, setComSom] = useState(true);
  const [gravando, setGravando] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const [gravacao, setGravacao] = useState<{ blob: Blob; url: string } | null>(null);
  const [convertendo, setConvertendo] = useState(false);
  const [progresso, setProgresso] = useState<number | null>(null);
  const [prontos, setProntos] = useState<ArquivoPronto[]>([]);
  const gravador = useRef<MediaRecorder | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
    if (gravador.current?.state === "recording") gravador.current.stop();
  }, []);
  useEffect(() => () => { if (gravacao) URL.revokeObjectURL(gravacao.url); }, [gravacao]);

  async function iniciar() {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: comSom });
    } catch {
      return toast.message("Gravação cancelada.");
    }
    const tipo = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"].find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
    const rec = new MediaRecorder(stream, tipo ? { mimeType: tipo, videoBitsPerSecond: 6_000_000 } : undefined);
    const pedacos: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size && pedacos.push(e.data);
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      if (timer.current) clearInterval(timer.current);
      setGravando(false);
      const blob = new Blob(pedacos, { type: "video/webm" });
      if (blob.size) setGravacao({ blob, url: URL.createObjectURL(blob) });
    };
    // "Parar de compartilhar" na barra do navegador também encerra
    stream.getVideoTracks()[0]?.addEventListener("ended", () => rec.state === "recording" && rec.stop());
    rec.start(1000);
    gravador.current = rec;
    setGravacao(null);
    setProntos([]);
    setSegundos(0);
    setGravando(true);
    timer.current = setInterval(() => setSegundos((s) => s + 1), 1000);
  }

  async function paraMp4() {
    if (!gravacao) return;
    setConvertendo(true);
    try {
      const arquivo = new File([gravacao.blob], `gravacao-${Date.now()}.webm`, { type: "video/webm" });
      const up = await enviarArquivo(arquivo, setProgresso);
      setProgresso(null);
      const r = await gravacaoParaMp4Action(up.id);
      if (!r.ok) return void toast.error(r.message);
      setProntos([r.dados]);
      toast.success("MP4 pronto!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no envio.");
    } finally {
      setProgresso(null);
      setConvertendo(false);
    }
  }

  if (!temSuporte) {
    return (
      <Painel titulo="Gravar tela" descricao="Grave a tela, uma janela ou uma aba direto no navegador.">
        <p className="rounded-xl bg-muted px-4 py-3 text-sm">Este navegador não deixa gravar a tela. No celular, use o gravador de tela do próprio aparelho; no computador, abra o E-Nova no Chrome, Edge ou Firefox.</p>
      </Painel>
    );
  }

  return (
    <Painel titulo="Gravar tela" descricao="Grave a tela inteira, uma janela ou uma aba direto no navegador. Nada é enviado até você pedir o MP4.">
      {!gravando ? (
        <div className="grid gap-3">
          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" checked={comSom} onChange={(e) => setComSom(e.target.checked)} className="size-5 accent-signal" />
            Gravar o som do computador ou da aba (quando o navegador permitir)
          </label>
          <div>
            <BotaoAcao onClick={iniciar} icone={<MonitorUp data-icon="inline-start" />}>Escolher o que gravar</BotaoAcao>
          </div>
          <p className="text-xs text-muted-foreground">O microfone não é gravado (o painel bloqueia o acesso ao microfone por segurança).</p>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-3">
          <Circle className="size-4 animate-pulse fill-destructive text-destructive" aria-hidden />
          <span className="font-mono text-lg tabular-nums" aria-live="off">{relogio(segundos)}</span>
          <span className="text-sm text-muted-foreground">Gravando…</span>
          <Button variant="destructive" size="lg" className="ml-auto h-11 sm:h-9" onClick={() => gravador.current?.stop()}>
            <Square data-icon="inline-start" /> Parar
          </Button>
        </div>
      )}

      {gravacao && (
        <div className="grid gap-3">
          <video src={gravacao.url} controls playsInline className="max-h-[50vh] w-full rounded-xl bg-black" />
          <p className="text-sm text-muted-foreground">Gravação de {relogio(segundos)} • {tamanhoLegivel(gravacao.blob.size)}</p>
          {convertendo && <Progresso valor={progresso} rotulo={progresso !== null ? "Enviando…" : "Convertendo para MP4…"} />}
          <div className="grid gap-2 sm:flex">
            <a href={gravacao.url} download={`gravacao-${new Date().toISOString().slice(0, 16).replace(/[T:]/g, "-")}.webm`} className="inline-flex h-11 items-center justify-center gap-1.5 rounded-lg border px-3 text-sm font-medium hover:bg-muted sm:h-9">
              <Download className="size-4" /> Baixar WebM
            </a>
            <BotaoAcao ocupado={convertendo} onClick={paraMp4} icone={<Film data-icon="inline-start" />}>Converter para MP4</BotaoAcao>
          </div>
          <ListaResultados arquivos={prontos} />
        </div>
      )}
    </Painel>
  );
}
