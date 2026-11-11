"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, CircleAlert, Cloud, Cpu, Loader2, Mic, Play, RefreshCw, Square, Trash2, Upload } from "lucide-react";
import { apagarVozAction, criarVozAction, reclonarVozAction, testarVozAction } from "@/app/actions/vozes";
import { enviarArquivo } from "@/components/ferramentas/comum";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type VozView = { id: string; nome: string; status: string; duracao: number; cartesia: boolean; erro: string | null; criadaEm: string };

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export function MinhaVoz({ textoLeitura, textoConsentimento, temCartesia, temLocal, podeConfigurar, vozes }: {
  textoLeitura: string; textoConsentimento: string; temCartesia: boolean; temLocal: boolean; podeConfigurar: boolean; vozes: VozView[];
}) {
  const router = useRouter();
  const [modo, setModo] = useState<"gravar" | "enviar">("gravar");
  const [nome, setNome] = useState("Minha voz");
  const [aceito, setAceito] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const [nivel, setNivel] = useState(0);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [previa, setPrevia] = useState<string | null>(null);
  const [enviando, setEnviando] = useState<string | null>(null);
  const gravador = useRef<MediaRecorder | null>(null);
  const pedacos = useRef<Blob[]>([]);
  const relogio = useRef<ReturnType<typeof setInterval> | null>(null);
  const analisador = useRef<{ ctx: AudioContext; raf: number } | null>(null);

  useEffect(() => () => { if (relogio.current) clearInterval(relogio.current); if (analisador.current) { cancelAnimationFrame(analisador.current.raf); void analisador.current.ctx.close(); } }, []);

  function definirArquivo(f: File | null) {
    setArquivo(f);
    setPrevia((p) => { if (p) URL.revokeObjectURL(p); return f ? URL.createObjectURL(f) : null; });
  }

  async function iniciar() {
    if (!navigator.mediaDevices?.getUserMedia) return void toast.error("Este navegador não grava áudio. Use o Chrome ou envie um arquivo.");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } });
    } catch {
      return void toast.error("O microfone foi bloqueado. Libere o microfone para este site no cadeado da barra de endereço.");
    }
    definirArquivo(null);
    pedacos.current = [];
    const tipo = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((x) => MediaRecorder.isTypeSupported(x)) ?? "";
    const rec = new MediaRecorder(stream, tipo ? { mimeType: tipo } : undefined);
    rec.ondataavailable = (e) => e.data.size && pedacos.current.push(e.data);
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(pedacos.current, { type: rec.mimeType || "audio/webm" });
      definirArquivo(new File([blob], `gravacao.${blob.type.includes("mp4") ? "m4a" : "webm"}`, { type: blob.type }));
    };
    rec.start(500);
    gravador.current = rec;
    setGravando(true);
    setSegundos(0);
    relogio.current = setInterval(() => setSegundos((s) => { if (s + 1 >= 90) parar(); return s + 1; }), 1000);
    // medidor de volume: ajuda a ver se o microfone está captando
    const ctx = new AudioContext();
    const fonte = ctx.createMediaStreamSource(stream);
    const an = ctx.createAnalyser();
    an.fftSize = 512;
    fonte.connect(an);
    const dados = new Uint8Array(an.fftSize);
    const loop = () => {
      an.getByteTimeDomainData(dados);
      let pico = 0;
      for (const v of dados) pico = Math.max(pico, Math.abs(v - 128));
      setNivel(Math.min(1, pico / 90));
      analisador.current = { ctx, raf: requestAnimationFrame(loop) };
    };
    loop();
  }

  function parar() {
    gravador.current?.state === "recording" && gravador.current.stop();
    if (relogio.current) clearInterval(relogio.current);
    if (analisador.current) { cancelAnimationFrame(analisador.current.raf); void analisador.current.ctx.close(); analisador.current = null; }
    setGravando(false);
    setNivel(0);
  }

  async function criar() {
    if (!arquivo) return;
    try {
      setEnviando("Enviando o áudio…");
      const up = await enviarArquivo(arquivo);
      setEnviando(temCartesia ? "Limpando o áudio e clonando a voz…" : "Limpando o áudio…");
      const r = await criarVozAction({ nome, enviadoId: up.id, consentimento: aceito as true });
      (r.ok ? toast.success : toast.error)(r.message ?? "Pronto.");
      if (r.ok) { definirArquivo(null); setAceito(false); router.refresh(); }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no envio.");
    } finally {
      setEnviando(null);
    }
  }

  const avisoDuracao = modo === "gravar" && segundos > 0 && !gravando && segundos < 20;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
      <section aria-labelledby="nova-voz" className="grid content-start gap-4 rounded-xl border bg-card p-4 sm:p-5">
        <h2 id="nova-voz" className="text-xl">Criar uma voz</h2>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className={cn("inline-flex items-center gap-1.5 rounded-md border px-2 py-1", temCartesia ? "border-emerald-600/40 text-emerald-700 dark:text-emerald-300" : "text-muted-foreground")}>
            <Cloud className="size-3.5" /> Cartesia {temCartesia ? "conectada" : "sem chave"}
          </span>
          <span className={cn("inline-flex items-center gap-1.5 rounded-md border px-2 py-1", temLocal ? "border-emerald-600/40 text-emerald-700 dark:text-emerald-300" : "text-muted-foreground")}>
            <Cpu className="size-3.5" /> Computador {temLocal ? "instalado" : "não instalado"}
          </span>
          {!temCartesia && podeConfigurar && <Link href="/painel/ia-central" className="inline-flex items-center px-1 text-primary underline">Colar a chave da Cartesia</Link>}
        </div>

        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Nome da voz</span>
          <Input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={60} className="h-11 sm:h-10" />
        </label>

        <div className="inline-flex w-fit rounded-md border p-0.5" role="group" aria-label="Como enviar a voz">
          {([["gravar", "Gravar agora", Mic], ["enviar", "Enviar arquivo", Upload]] as const).map(([v, r, I]) => (
            <button key={v} type="button" aria-pressed={modo === v} onClick={() => { setModo(v); definirArquivo(null); }}
              className={cn("inline-flex min-h-10 items-center gap-1.5 rounded px-3 text-sm", modo === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
              <I className="size-4" /> {r}
            </button>
          ))}
        </div>

        {modo === "gravar" ? (
          <div className="grid gap-3">
            <div className="rounded-lg border-l-2 border-primary bg-muted/40 p-3 text-[0.95rem] leading-relaxed whitespace-pre-line">{textoLeitura}</div>
            <p className="text-xs text-muted-foreground">Leia com calma, no seu jeito normal de falar, num lugar silencioso e sem música. 30 a 60 segundos é o ideal.</p>
            <div className="flex flex-wrap items-center gap-3">
              {gravando ? (
                <Button type="button" variant="destructive" className="h-12 px-5" onClick={parar}><Square /> Parar ({mmss(segundos)})</Button>
              ) : (
                <Button type="button" className="h-12 px-5" onClick={iniciar} disabled={!!enviando}><Mic /> {arquivo ? "Gravar de novo" : "Começar a gravar"}</Button>
              )}
              {gravando && (
                <div className="flex h-3 w-36 overflow-hidden rounded-full bg-muted" aria-label="Volume do microfone">
                  <span className="bg-primary transition-[width] duration-75" style={{ width: `${Math.round(nivel * 100)}%` }} />
                </div>
              )}
            </div>
            {avisoDuracao && <p className="flex items-center gap-1.5 text-xs text-amber-600"><CircleAlert className="size-3.5" /> Ficou curto ({segundos} s). Com 30 s ou mais a voz fica bem mais parecida.</p>}
          </div>
        ) : (
          <label className="grid cursor-pointer place-items-center gap-2 rounded-lg border border-dashed p-6 text-center text-sm hover:border-primary/60">
            <Upload className="size-6 text-muted-foreground" />
            <span>{arquivo ? arquivo.name : "Escolha um áudio ou vídeo com a sua voz (10 s a 60 s, só você falando)"}</span>
            <input type="file" accept="audio/*,video/*" className="sr-only" onChange={(e) => definirArquivo(e.target.files?.[0] ?? null)} />
          </label>
        )}

        {previa && <audio src={previa} controls className="w-full" aria-label="Ouvir a gravação" />}

        <label className="flex items-start gap-2.5 rounded-lg bg-muted/60 p-3 text-sm">
          <input type="checkbox" checked={aceito} onChange={(e) => setAceito(e.target.checked)} className="mt-0.5 size-4 shrink-0 accent-[var(--primary)]" />
          <span>{textoConsentimento}</span>
        </label>

        <Button type="button" className="h-11 sm:w-fit" disabled={!arquivo || !aceito || !nome.trim() || gravando || !!enviando} onClick={criar}>
          {enviando ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} {enviando ?? "Criar minha voz"}
        </Button>
        {!temCartesia && !temLocal && <p className="text-xs text-amber-600">Para a voz funcionar, cole a chave da Cartesia na Central de IA ou instale o modelo do computador.</p>}
      </section>

      <section aria-labelledby="lista-vozes" className="grid content-start gap-3">
        <h2 id="lista-vozes" className="text-xl">Vozes criadas</h2>
        {vozes.length === 0 && <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Nenhuma voz ainda. Grave a sua ao lado.</p>}
        <ul className="grid gap-3">{vozes.map((v) => <CartaoVoz key={v.id} v={v} temLocal={temLocal} temCartesia={temCartesia} />)}</ul>
      </section>
    </div>
  );
}

function CartaoVoz({ v, temLocal, temCartesia }: { v: VozView; temLocal: boolean; temCartesia: boolean }) {
  const router = useRouter();
  const [texto, setTexto] = useState("Olá! Esta é a minha voz criada no E-Nova. Ficou parecida?");
  const [audio, setAudio] = useState<{ src: string; usado?: string } | null>(null);
  const [pend, start] = useTransition();
  const [qual, setQual] = useState<string | null>(null);
  const testar = (motor: "auto" | "cartesia" | "local") => {
    setQual(motor);
    start(async () => {
      const r = await testarVozAction(v.id, texto, motor);
      setQual(null);
      if (!r.ok || !r.audio) return void toast.error(r.message ?? "Não deu para gerar.");
      setAudio({ src: r.audio, usado: r.usado });
    });
  };
  return (
    <li className="grid gap-3 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold">{v.nome}</p>
          <p className="text-xs text-muted-foreground">{Math.round(v.duracao)} s de amostra · {new Date(v.criadaEm).toLocaleDateString("pt-BR")}</p>
        </div>
        <div className="flex flex-wrap gap-1.5 text-xs">
          <span className={cn("inline-flex items-center gap-1 rounded border px-1.5 py-0.5", v.cartesia ? "border-emerald-600/40 text-emerald-700 dark:text-emerald-300" : "text-muted-foreground")}><Cloud className="size-3" /> Cartesia {v.cartesia ? "✓" : "—"}</span>
          <span className={cn("inline-flex items-center gap-1 rounded border px-1.5 py-0.5", temLocal ? "border-emerald-600/40 text-emerald-700 dark:text-emerald-300" : "text-muted-foreground")}><Cpu className="size-3" /> Computador {temLocal ? "✓" : "—"}</span>
        </div>
      </div>
      {!v.cartesia && v.erro && <p className="text-xs text-muted-foreground">{v.erro}</p>}
      <textarea value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={400} rows={2} aria-label="Texto para testar"
        className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:text-sm" />
      <div className="flex flex-wrap gap-1.5">
        <Button size="sm" className="h-9" disabled={pend} onClick={() => testar("auto")}>{qual === "auto" ? <Loader2 className="animate-spin" /> : <Play />} Ouvir</Button>
        {v.cartesia && <Button size="sm" variant="outline" className="h-9" disabled={pend} onClick={() => testar("cartesia")}>{qual === "cartesia" ? <Loader2 className="animate-spin" /> : <Cloud />} Só Cartesia</Button>}
        {temLocal && <Button size="sm" variant="outline" className="h-9" disabled={pend} onClick={() => testar("local")} title="A 1ª vez carrega o modelo (pode levar 1–2 min)">{qual === "local" ? <Loader2 className="animate-spin" /> : <Cpu />} Só computador</Button>}
        {!v.cartesia && temCartesia && <Button size="sm" variant="outline" className="h-9" disabled={pend} onClick={() => start(async () => { const r = await reclonarVozAction(v.id); (r.ok ? toast.success : toast.error)(r.message ?? ""); router.refresh(); })}><RefreshCw /> Clonar na Cartesia</Button>}
        <Button size="sm" variant="ghost" className="ml-auto h-9 text-destructive" disabled={pend} onClick={() => confirm(`Apagar a voz "${v.nome}"? Ela também some da Cartesia.`) && start(async () => { const r = await apagarVozAction(v.id); (r.ok ? toast.success : toast.error)(r.message ?? ""); router.refresh(); })}>
          <Trash2 /> Apagar
        </Button>
      </div>
      {qual === "local" && <p className="text-xs text-muted-foreground">Gerando no seu computador… a primeira vez carrega o modelo e pode levar 1–2 minutos.</p>}
      {audio && (
        <div className="grid gap-1">
          <audio src={audio.src} controls autoPlay className="w-full" />
          {audio.usado && <p className="text-xs text-muted-foreground">Gerado por: {audio.usado}</p>}
        </div>
      )}
    </li>
  );
}
