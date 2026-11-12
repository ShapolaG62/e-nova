"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  AudioLines, Check, Clapperboard, Copy, Download, Eraser, FileAudio, ImageIcon, Loader2, Mic, Music, PlugZap, Sparkles, Trash2, Upload, UserRound, Users, Video, Wand2, X,
} from "lucide-react";
import { CAPACIDADES, type Capacidade } from "@/lib/ia-hub/tipos";
import {
  criarTarefaAction, equipeEtapaAction, excluirTarefaAction, listarTarefasAction,
  type Critica, type EntradaTarefa, type EtapaAgente, type PapelAgente, type Plano, type Rascunho, type TarefaView, type VersaoFinal,
} from "@/app/actions/ia-hub";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { selectClass } from "@/components/field";
import { cn } from "@/lib/utils";
import { CadeiaTentativas, nomeItem, resumoRevezamento, type TentativaView } from "../ia-central/comum";

export type OpcoesCap = { itens: { id: string; nome: string; temChave: boolean }[]; pronta: boolean };

type Aba = { id: string; cap: Capacidade | "equipe"; nome: string; icon: React.ComponentType<{ className?: string }> };
const ABAS: Aba[] = [
  { id: "imagem", cap: "imagem", nome: "Imagem", icon: ImageIcon },
  { id: "editar-imagem", cap: "editar-imagem", nome: "Editar imagem", icon: Wand2 },
  { id: "video", cap: "video", nome: "Vídeo", icon: Video },
  { id: "avatar", cap: "avatar", nome: "Avatar", icon: UserRound },
  { id: "voz", cap: "voz", nome: "Voz", icon: Mic },
  { id: "transcricao", cap: "transcricao", nome: "Transcrição", icon: AudioLines },
  { id: "musica", cap: "musica", nome: "Música", icon: Music },
  { id: "limpar-audio", cap: "limpar-audio", nome: "Limpar áudio", icon: Eraser },
  { id: "edicao-video", cap: "edicao-video", nome: "Edição de vídeo", icon: Clapperboard },
  { id: "equipe", cap: "equipe", nome: "Equipe de agentes", icon: Users },
];

const MAX_UPLOAD = 5.5 * 1024 * 1024;
const ATIVA = (s: string) => s === "NA_FILA" || s === "RODANDO";
const quando = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export function Estudio({ abaInicial, opcoes, tarefasIniciais, podeConfigurar }: {
  abaInicial?: string;
  opcoes: Record<Capacidade, OpcoesCap>;
  tarefasIniciais: TarefaView[];
  podeConfigurar: boolean;
}) {
  const [aba, setAba] = useState(() => ABAS.find((a) => a.id === abaInicial)?.id ?? "imagem");
  const [tarefas, setTarefas] = useState(tarefasIniciais);
  const [agora, setAgora] = useState(0); // relógio só para avisar tarefa parada na fila
  const atual = ABAS.find((a) => a.id === aba)!;

  const trocar = (id: string) => {
    setAba(id);
  };

  // acompanha as tarefas em andamento (todas as abas) a cada 2,5 s
  const ativas = tarefas.some((t) => ATIVA(t.status));
  useEffect(() => {
    if (!ativas) return;
    const timer = setInterval(async () => {
      try {
        const novas = await listarTarefasAction(80);
        setTarefas(novas);
        setAgora(Date.now());
      } catch { /* tenta de novo no próximo ciclo */ }
    }, 2500);
    return () => clearInterval(timer);
  }, [ativas]);

  const recarregar = useCallback(async () => setTarefas(await listarTarefasAction(80)), []);

  return (
    <div className="grid gap-4">
      <nav aria-label="Ferramentas" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex w-max gap-1 rounded-xl bg-muted p-1">
          {ABAS.map((a) => {
            const emCurso = a.cap !== "equipe" && tarefas.some((t) => t.capacidade === a.cap && ATIVA(t.status));
            return (
              <li key={a.id}>
                <button
                  onClick={() => trocar(a.id)}
                  aria-current={aba === a.id ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm whitespace-nowrap transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                    aba === a.id ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <a.icon className="size-4" />
                  {a.nome}
                  {emCurso && <span className="size-1.5 animate-pulse rounded-full bg-signal" aria-label="em andamento" />}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {atual.cap === "equipe" ? (
        <EquipeAgentes pronta={opcoes.texto.pronta} podeConfigurar={podeConfigurar} />
      ) : (
        <Ferramenta
          key={atual.id}
          cap={atual.cap}
          nome={atual.nome}
          opcoes={opcoes[atual.cap]}
          podeConfigurar={podeConfigurar}
          tarefas={tarefas.filter((t) => t.capacidade === atual.cap)}
          agora={agora}
          onCriada={recarregar}
          onExcluida={(id) => setTarefas((ts) => ts.filter((t) => t.id !== id))}
        />
      )}
    </div>
  );
}

function SemProvedor({ cap, podeConfigurar }: { cap: Capacidade; podeConfigurar: boolean }) {
  const nome = CAPACIDADES.find((c) => c.id === cap)?.nome.toLowerCase();
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-dashed border-signal/50 bg-signal/5 p-4 sm:flex-row sm:items-center">
      <PlugZap className="size-5 shrink-0 text-signal" aria-hidden />
      <p className="flex-1 text-sm">
        <strong>Nenhuma IA de {nome} está conectada ainda.</strong>{" "}
        {podeConfigurar ? "Cole uma chave na Central de IA e ela entra na fila na hora. Você pode enviar mesmo assim para testar." : "Peça a um administrador para conectar uma chave na Central de IA."}
      </p>
      {podeConfigurar && (
        <Link href="/painel/ia-central" className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/80">
          Abrir a Central de IA
        </Link>
      )}
    </div>
  );
}

// ───────── Formulário + galeria de uma função ─────────
function Ferramenta({ cap, nome, opcoes, podeConfigurar, tarefas, agora, onCriada, onExcluida }: {
  agora: number;
  cap: Capacidade;
  nome: string;
  opcoes: OpcoesCap;
  podeConfigurar: boolean;
  tarefas: TarefaView[];
  onCriada: () => Promise<void>;
  onExcluida: (id: string) => void;
}) {
  const [pend, start] = useTransition();
  const [arquivo, setArquivo] = useState<File | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const aceita = cap === "editar-imagem" || cap === "video" ? "image/*" : cap === "transcricao" ? "audio/*,video/*" : "audio/*";
  const temUpload = ["editar-imagem", "video", "transcricao", "limpar-audio"].includes(cap);

  async function enviar(fd: FormData) {
    const s = (k: string) => String(fd.get(k) ?? "").trim() || undefined;
    const entrada: EntradaTarefa = {
      prompt: s("prompt"),
      proporcao: s("proporcao") as EntradaTarefa["proporcao"],
      duracao: s("duracao") ? Number(s("duracao")) : undefined,
      voz: s("voz"),
      idioma: s("idioma"),
      operacao: s("operacao") as EntradaTarefa["operacao"],
      template: s("template"),
      imagemUrl: cap === "editar-imagem" || cap === "video" ? s("url") : undefined,
      audioUrl: cap === "limpar-audio" || (cap === "transcricao" && !/\.(mp4|mov|webm|mkv)(\?|$)/i.test(s("url") ?? "")) ? s("url") : undefined,
      videoUrl: cap === "transcricao" && /\.(mp4|mov|webm|mkv)(\?|$)/i.test(s("url") ?? "") ? s("url") : undefined,
    };
    if (cap === "edicao-video" && s("dados")) {
      try {
        const d = JSON.parse(s("dados")!);
        if (!d || typeof d !== "object" || Array.isArray(d)) throw new Error();
        entrada.dados = d;
      } catch {
        toast.error("Os dados precisam ser um JSON de objeto, ex.: {\"titulo\": \"Promoção\"}");
        return;
      }
    }
    if (arquivo) {
      if (arquivo.size > MAX_UPLOAD) {
        toast.error("Arquivo grande demais (máx. 5,5 MB). Use um link.");
        return;
      }
      entrada.arquivoBase64 = await lerDataUrl(arquivo);
      entrada.arquivoNome = arquivo.name;
      entrada.arquivoMime = arquivo.type;
    }
    const r = await criarTarefaAction(cap, entrada, s("titulo"), s("preferir"));
    if (!r.ok) {
      toast.error(r.message ?? "Não deu para enviar.");
      return;
    }
    toast.success("Enviado. Acompanhe ao lado.");
    formRef.current?.reset();
    setArquivo(null);
    await onCriada();
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:items-start">
      <div className="grid gap-3">
        {!opcoes.pronta && <SemProvedor cap={cap} podeConfigurar={podeConfigurar} />}
        <form
          ref={formRef}
          action={(fd) => start(() => enviar(fd))}
          className="grid gap-3.5 rounded-2xl border bg-card p-4"
        >
          <h2 className="font-semibold">{nome}</h2>
          <Campos cap={cap} />

          {temUpload && (
            <div className="grid gap-1.5">
              <Label>{cap === "transcricao" ? "Áudio ou vídeo" : cap === "limpar-audio" ? "Áudio" : cap === "video" ? "Imagem inicial (opcional)" : "Imagem"}</Label>
              <label
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-lg border border-dashed px-3 py-3 text-sm transition-colors hover:bg-muted/60 focus-within:ring-3 focus-within:ring-ring/50",
                  arquivo && "border-signal/60 bg-signal/5",
                )}
              >
                {arquivo ? <FileAudio className="size-4 text-signal" /> : <Upload className="size-4 text-muted-foreground" />}
                <span className="min-w-0 flex-1 truncate">{arquivo ? `${arquivo.name} (${(arquivo.size / 1024 / 1024).toFixed(1)} MB)` : "Escolher arquivo (até 5,5 MB)"}</span>
                {arquivo && (
                  <button type="button" aria-label="Tirar arquivo" onClick={(e) => { e.preventDefault(); setArquivo(null); }} className="text-muted-foreground hover:text-foreground">
                    <X className="size-4" />
                  </button>
                )}
                <input type="file" accept={aceita} className="sr-only" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
              </label>
              <Input name="url" type="url" inputMode="url" placeholder="…ou cole um link https://" className="h-10 sm:h-9" disabled={!!arquivo} />
            </div>
          )}

          <div className="grid gap-1.5">
            <Label htmlFor="preferir">IA</Label>
            <select id="preferir" name="preferir" className={selectClass} defaultValue="">
              <option value="">Automática (melhor disponível)</option>
              {opcoes.itens.map((i) => (
                <option key={i.id} value={i.id} disabled={!i.temChave}>
                  {i.nome}{i.temChave ? "" : " — sem chave"}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">Se a escolhida falhar, a próxima da fila assume.</p>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="titulo">Nome para achar depois (opcional)</Label>
            <Input id="titulo" name="titulo" maxLength={120} className="h-10 sm:h-9" />
          </div>

          <Button type="submit" size="lg" className="h-10" disabled={pend}>
            {pend ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <Sparkles data-icon="inline-start" />}
            {pend ? "Enviando…" : textoBotao(cap)}
          </Button>
        </form>
      </div>

      <Galeria tarefas={tarefas} agora={agora} onExcluida={onExcluida} />
    </div>
  );
}

const textoBotao = (cap: Capacidade) =>
  ({ imagem: "Gerar imagem", "editar-imagem": "Editar imagem", video: "Gerar vídeo", avatar: "Gerar vídeo com avatar", voz: "Gerar narração", transcricao: "Transcrever", musica: "Gerar música", "limpar-audio": "Limpar áudio", "edicao-video": "Renderizar vídeo" } as Partial<Record<Capacidade, string>>)[cap] ?? "Gerar";

function lerDataUrl(f: File) {
  return new Promise<string>((ok, falha) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result));
    r.onerror = () => falha(r.error);
    r.readAsDataURL(f);
  });
}

function Proporcao({ padrao = "16:9" }: { padrao?: string }) {
  return (
    <fieldset className="grid gap-1.5">
      <legend className="mb-1.5 text-sm font-medium">Proporção</legend>
      <div className="grid grid-cols-3 gap-1.5">
        {[
          ["16:9", "Paisagem", "aspect-video w-7"],
          ["9:16", "Stories", "aspect-[9/16] h-7"],
          ["1:1", "Quadrado", "aspect-square w-5"],
        ].map(([v, r, forma]) => (
          <label key={v} className="flex cursor-pointer flex-col items-center gap-1 rounded-lg border p-2 text-xs has-checked:border-signal has-checked:bg-signal/5 has-focus-visible:ring-3 has-focus-visible:ring-ring/50">
            <input type="radio" name="proporcao" value={v} defaultChecked={v === padrao} className="sr-only" />
            <span className="flex h-7 items-center"><span className={cn("rounded-[3px] border-2 border-current opacity-60", forma)} /></span>
            <span className="font-medium">{v}</span>
            <span className="text-muted-foreground">{r}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function Campos({ cap }: { cap: Capacidade }) {
  const area = (rotulo: string, ph: string, obrig = true, linhas = 4) => (
    <div className="grid gap-1.5">
      <Label htmlFor="prompt">{rotulo}</Label>
      <Textarea id="prompt" name="prompt" rows={linhas} required={obrig} maxLength={8000} placeholder={ph} />
    </div>
  );
  switch (cap) {
    case "imagem":
      return <>{area("O que você quer ver", "Ex.: vitrine de padaria artesanal ao amanhecer, luz quente, pães dourados, foto realista")}<Proporcao padrao="1:1" /></>;
    case "editar-imagem":
      return (
        <>
          <div className="grid gap-1.5">
            <Label htmlFor="operacao">O que fazer</Label>
            <select id="operacao" name="operacao" className={selectClass} defaultValue="remover-fundo">
              <option value="remover-fundo">Remover o fundo</option>
              <option value="ampliar">Ampliar (mais resolução)</option>
              <option value="limpar">Apagar objetos / limpar</option>
            </select>
          </div>
          {area("Detalhes (opcional)", "Ex.: apagar o fio no canto direito", false, 2)}
        </>
      );
    case "video":
      return (
        <>
          {area("Descreva a cena", "Ex.: câmera lenta passando por uma mesa de café da manhã, vapor subindo da xícara")}
          <Proporcao padrao="9:16" />
          <div className="grid gap-1.5">
            <Label htmlFor="duracao">Duração</Label>
            <select id="duracao" name="duracao" className={selectClass} defaultValue="5">
              <option value="5">5 segundos</option>
              <option value="10">10 segundos</option>
            </select>
          </div>
        </>
      );
    case "avatar":
      return (
        <>
          {area("Roteiro que o apresentador vai falar", "Olá! Aqui na Padaria Pão Dourado…", true, 5)}
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1.5">
              <Label htmlFor="template">ID do avatar</Label>
              <Input id="template" name="template" placeholder="padrão do serviço" className="h-10 sm:h-9" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="voz">ID da voz</Label>
              <Input id="voz" name="voz" placeholder="padrão" className="h-10 sm:h-9" />
            </div>
          </div>
          <Proporcao padrao="9:16" />
        </>
      );
    case "voz":
      return (
        <>
          {area("Texto para narrar", "Ex.: Promoção de inauguração: na compra de dois cafés, o pão de queijo é por nossa conta!", true, 5)}
          <div className="grid gap-1.5">
            <Label htmlFor="voz">ID da voz (opcional)</Label>
            <Input id="voz" name="voz" placeholder="usa a voz padrão cadastrada" className="h-10 sm:h-9" />
          </div>
        </>
      );
    case "transcricao":
      return (
        <div className="grid gap-1.5">
          <Label htmlFor="idioma">Idioma falado</Label>
          <select id="idioma" name="idioma" className={selectClass} defaultValue="pt-BR">
            <option value="pt-BR">Português</option>
            <option value="en">Inglês</option>
            <option value="es">Espanhol</option>
          </select>
        </div>
      );
    case "musica":
      return (
        <>
          {area("Estilo da música", "Ex.: bossa nova leve, violão e piano, clima de café, sem voz")}
          <div className="grid gap-1.5">
            <Label htmlFor="duracao">Duração (segundos)</Label>
            <Input id="duracao" name="duracao" type="number" min={5} max={180} defaultValue={30} className="h-10 sm:h-9" />
          </div>
        </>
      );
    case "limpar-audio":
      return <p className="text-sm text-muted-foreground">Envie a gravação: a IA tira o ruído de fundo e deixa a voz em destaque.</p>;
    case "edicao-video":
      return (
        <>
          <div className="grid gap-1.5">
            <Label htmlFor="template">ID do template</Label>
            <Input id="template" name="template" placeholder="ID do template no Shotstack/Creatomate" className="h-10 font-mono text-xs sm:h-9" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="dados">Dados do template (JSON)</Label>
            <Textarea id="dados" name="dados" rows={6} className="font-mono text-xs" placeholder={'{\n  "titulo": "Promoção de inverno",\n  "preco": "R$ 19,90"\n}'} />
            <p className="text-xs text-muted-foreground">Cada chave substitui um campo do template.</p>
          </div>
        </>
      );
    default:
      return area("Pedido", "");
  }
}

// ───────── Galeria ─────────
function Galeria({ tarefas, agora, onExcluida }: { tarefas: TarefaView[]; agora: number; onExcluida: (id: string) => void }) {
  if (!tarefas.length) {
    return (
      <div className="grid place-items-center rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground lg:min-h-80">
        <div className="grid max-w-xs gap-1">
          <Sparkles className="mx-auto size-6 text-signal" aria-hidden />
          <p className="font-medium text-foreground">Nada criado aqui ainda.</p>
          <p>Preencha ao lado e envie. O resultado aparece aqui, com quem fez e se alguma IA precisou ser trocada.</p>
        </div>
      </div>
    );
  }
  return (
    <section aria-label="Criados recentemente" className="grid gap-3 sm:grid-cols-2">
      {tarefas.map((t) => (
        <CartaoTarefa key={t.id} t={t} agora={agora} onExcluida={onExcluida} />
      ))}
    </section>
  );
}

const fmtTempo = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

function CartaoTarefa({ t, agora, onExcluida }: { t: TarefaView; agora: number; onExcluida: (id: string) => void }) {
  const [pend, start] = useTransition();
  const ativa = ATIVA(t.status);
  const arquivos = t.resultado?.arquivos ?? [];
  const tentativas = (t.resultado?.tentativas ?? []) as TentativaView[];
  const usado = t.resultado?.usado?.item;
  const largo = t.resultado?.texto && !arquivos.length;
  const parada = t.status === "NA_FILA" && agora - new Date(t.criadoEm).getTime() > 90_000;

  return (
    <article className={cn("flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-card", largo && "sm:col-span-2")} aria-busy={ativa}>
      {ativa && (
        <div className="grid gap-2 p-4">
          <div className="relative grid aspect-video place-items-center overflow-hidden rounded-lg bg-muted">
            <div className="absolute inset-y-0 left-0 bg-signal/10 transition-[width] duration-700" style={{ width: `${Math.max(4, t.progresso)}%` }} />
            <div className="relative grid justify-items-center gap-1 text-center">
              <Loader2 className="size-5 animate-spin text-signal" aria-hidden />
              <p className="text-sm font-medium">{t.status === "NA_FILA" ? "Na fila…" : t.etapa ?? "Trabalhando…"}</p>
              <p className="num text-xs text-muted-foreground">{t.progresso}%</p>
              {t.status === "NA_FILA" && parada && <p className="max-w-60 text-xs text-muted-foreground">Ainda não começou. O serviço de segundo plano pode estar parado: se continuar assim, reinicie o sistema.</p>}
            </div>
          </div>
        </div>
      )}

      {t.status === "PRONTA" && arquivos.length > 0 && (
        <div className="grid gap-2 bg-muted/40 p-2">
          {arquivos.map((a, i) => {
            const src = `/api/ia/tarefas/${t.id}/arquivo/${i}`;
            // eslint-disable-next-line @next/next/no-img-element -- arquivo privado servido pela rota da tarefa
            if (a.mime.startsWith("image/")) return <img key={i} src={src} alt={t.titulo ?? "Imagem gerada"} className="max-h-80 w-full rounded-lg object-contain" loading="lazy" />;
            if (a.mime.startsWith("video/")) return <video key={i} src={src} controls playsInline preload="metadata" className="max-h-96 w-full rounded-lg bg-black" />;
            if (a.mime.startsWith("audio/")) return <audio key={i} src={src} controls preload="metadata" className="w-full" />;
            return <a key={i} href={`${src}?baixar=1`} className="text-sm text-signal underline">Baixar arquivo {i + 1}</a>;
          })}
        </div>
      )}

      <div className="grid gap-2 p-4">
        <div className="flex items-start gap-2">
          <p className="min-w-0 flex-1 text-sm font-medium break-words">{t.titulo ?? "Sem título"}</p>
          <StatusTarefa status={t.status} />
        </div>
        <p className="text-xs text-muted-foreground">
          <time dateTime={t.criadoEm}>{quando.format(new Date(t.criadoEm))}</time>
          {t.status === "PRONTA" && usado && <> · feito por <strong className="text-foreground">{nomeItem(usado)}</strong></>}
          {t.preferir && t.status !== "PRONTA" && <> · pedido para {nomeItem(t.preferir)}</>}
        </p>

        {t.status === "PRONTA" && t.resultado?.texto && <Transcricao texto={t.resultado.texto} segmentos={t.resultado.segmentos} />}

        {tentativas.length > 1 && t.status === "PRONTA" && (
          <div className="grid gap-1">
            <p className="text-xs text-muted-foreground">{resumoRevezamento(tentativas)}</p>
            <CadeiaTentativas tentativas={tentativas} compacta />
          </div>
        )}

        {t.status === "FALHOU" && (
          <div className="grid gap-2 rounded-lg bg-destructive/8 p-2.5 text-xs">
            <p className="font-medium text-destructive">
              {tentativas.length ? "Nenhuma IA conseguiu fazer isso agora." : "Nenhuma IA conectada para esta função."}
            </p>
            {tentativas.length > 0 ? <CadeiaTentativas tentativas={tentativas} /> : <p className="text-muted-foreground">Conecte uma chave na Central de IA e envie de novo.</p>}
            {t.erro && (
              <details className="text-muted-foreground">
                <summary className="cursor-pointer select-none">Detalhes do erro</summary>
                <p className="mt-1 break-words">{t.erro}</p>
              </details>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {t.status === "PRONTA" && arquivos.map((a, i) => (
            <a key={i} href={`/api/ia/tarefas/${t.id}/arquivo/${i}?baixar=1`} className="inline-flex h-7 items-center gap-1 rounded-md border px-2 text-xs font-medium hover:bg-muted">
              <Download className="size-3.5" /> Baixar{arquivos.length > 1 ? ` ${i + 1}` : ""}
            </a>
          ))}
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto text-muted-foreground"
            disabled={pend}
            onClick={() =>
              confirm("Excluir este item e os arquivos dele?") &&
              start(async () => {
                const r = await excluirTarefaAction(t.id);
                if (r.ok) onExcluida(t.id);
                else toast.error(r.message ?? "Não deu para excluir.");
              })
            }
          >
            <Trash2 data-icon="inline-start" /> Excluir
          </Button>
        </div>
      </div>
    </article>
  );
}

function StatusTarefa({ status }: { status: string }) {
  if (status === "PRONTA") return <Badge className="bg-emerald-600/12 text-emerald-800 dark:text-emerald-300">Pronto</Badge>;
  if (status === "FALHOU") return <Badge variant="destructive">Falhou</Badge>;
  if (status === "RODANDO") return <Badge className="bg-signal/15 text-signal">Fazendo</Badge>;
  return <Badge variant="secondary">Na fila</Badge>;
}

function BotaoCopiar({ texto, rotulo = "Copiar" }: { texto: string; rotulo?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <Button
      size="xs"
      variant="outline"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(texto);
          setOk(true);
          setTimeout(() => setOk(false), 1500);
        } catch {
          toast.error("Não deu para copiar.");
        }
      }}
    >
      {ok ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />} {ok ? "Copiado" : rotulo}
    </Button>
  );
}

function Transcricao({ texto, segmentos }: { texto: string; segmentos?: { inicio: number; fim: number; texto: string }[] }) {
  const [comTempos, setComTempos] = useState(false);
  const temSeg = !!segmentos?.length;
  const comoTexto = temSeg && comTempos ? segmentos!.map((s) => `[${fmtTempo(s.inicio)}] ${s.texto.trim()}`).join("\n") : texto;
  return (
    <div className="grid gap-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <BotaoCopiar texto={comoTexto} rotulo="Copiar texto" />
        {temSeg && (
          <Button size="xs" variant="ghost" aria-pressed={comTempos} onClick={() => setComTempos((v) => !v)}>
            {comTempos ? "Ver texto corrido" : "Ver com tempos"}
          </Button>
        )}
      </div>
      {temSeg && comTempos ? (
        <ol className="max-h-72 overflow-auto rounded-lg bg-muted/50 p-2.5 text-sm">
          {segmentos!.map((s, i) => (
            <li key={i} className="grid grid-cols-[3rem_1fr] gap-2 py-0.5">
              <span className="num text-xs text-muted-foreground">{fmtTempo(s.inicio)}</span>
              <span className="min-w-0 break-words">{s.texto.trim()}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="max-h-72 overflow-auto rounded-lg bg-muted/50 p-2.5 text-sm break-words whitespace-pre-wrap">{texto || "(nenhuma fala reconhecida)"}</p>
      )}
    </div>
  );
}

// ───────── Equipe de agentes ─────────
const PAPEIS: { papel: PapelAgente; nome: string; faz: string }[] = [
  { papel: "gerente", nome: "Gerente", faz: "planeja o trabalho" },
  { papel: "redator", nome: "Redator", faz: "escreve o rascunho" },
  { papel: "revisor", nome: "Revisor", faz: "critica e dá nota" },
  { papel: "final", nome: "Redator", faz: "revisa e entrega a versão final" },
];

function EquipeAgentes({ pronta, podeConfigurar }: { pronta: boolean; podeConfigurar: boolean }) {
  const [etapas, setEtapas] = useState<EtapaAgente[]>([]);
  const [rodando, setRodando] = useState<PapelAgente | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [inicio, setInicio] = useState(0);
  const [agora, setAgora] = useState(0);
  const cancelado = useRef(false);

  useEffect(() => {
    if (!rodando) return;
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [rodando]);
  useEffect(() => () => { cancelado.current = true; }, []);

  async function rodar(fd: FormData) {
    const entrada = { objetivo: String(fd.get("objetivo") ?? ""), contexto: String(fd.get("contexto") ?? "") || undefined };
    cancelado.current = false;
    setEtapas([]);
    setErro(null);
    setAgora(Date.now());
    const ant: { plano?: Plano; rascunho?: Rascunho; critica?: Critica } = {};
    for (const { papel } of PAPEIS) {
      if (cancelado.current) break;
      setRodando(papel);
      setInicio(Date.now());
      const r = await equipeEtapaAction(papel, entrada, ant);
      if (!r.ok || !r.etapa) {
        setErro(r.message ?? "A equipe parou no meio. Tente de novo.");
        break;
      }
      const e = r.etapa;
      if (e.papel === "gerente") ant.plano = e.dados;
      if (e.papel === "redator") ant.rascunho = e.dados;
      if (e.papel === "revisor") ant.critica = e.dados;
      setEtapas((xs) => [...xs, e]);
    }
    setRodando(null);
  }

  const de = <P extends PapelAgente>(p: P) => etapas.find((e) => e.papel === p) as Extract<EtapaAgente, { papel: P }> | undefined;
  const plano = de("gerente"), rascunho = de("redator"), critica = de("revisor"), final = de("final");

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:items-start">
      <div className="grid gap-3">
        {!pronta && (
          <div className="rounded-2xl border border-dashed border-signal/50 bg-signal/5 p-4 text-sm">
            Nenhuma IA de texto está pronta. Ligue a IA local (Ollama){podeConfigurar && <> ou conecte uma chave na <Link href="/painel/ia-central" className="font-medium text-signal underline">Central de IA</Link></>}.
          </div>
        )}
        <form onSubmit={(ev) => { ev.preventDefault(); if (!rodando) void rodar(new FormData(ev.currentTarget)); }} className="grid gap-3.5 rounded-2xl border bg-card p-4">
          <div>
            <h2 className="font-semibold">Equipe de agentes</h2>
            <p className="text-sm text-muted-foreground">Um gerente planeja, o redator escreve, o revisor critica e o redator entrega a versão final.</p>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="objetivo">O que a equipe deve produzir</Label>
            <Textarea id="objetivo" name="objetivo" rows={3} required minLength={5} maxLength={2000} placeholder="Ex.: texto da página “Sobre nós” de uma pizzaria familiar no Recife, com 3 parágrafos" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="contexto">Contexto (opcional)</Label>
            <Textarea id="contexto" name="contexto" rows={4} maxLength={6000} placeholder="Informações do negócio, diferenciais, tom de voz, o que evitar…" />
          </div>
          <Button type="submit" size="lg" className="h-10" disabled={!!rodando}>
            {rodando ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <Users data-icon="inline-start" />}
            {rodando ? "A equipe está trabalhando…" : "Pôr a equipe para trabalhar"}
          </Button>
          <p className="text-xs text-muted-foreground">Usa as IAs de texto da Central. Na IA local cada etapa pode levar alguns minutos.</p>
        </form>
      </div>

      <section aria-label="Trabalho da equipe" aria-live="polite" className="grid gap-3">
        {!etapas.length && !rodando && !erro ? (
          <div className="grid place-items-center rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground lg:min-h-80">
            <p className="max-w-xs">Descreva o pedido e a equipe mostra aqui cada passo: o plano, o rascunho, a crítica e a versão final.</p>
          </div>
        ) : (
          <ol className="grid gap-3">
            {PAPEIS.map(({ papel, nome, faz }, i) => {
              const feito = etapas.find((e) => e.papel === papel);
              const agoraRodando = rodando === papel;
              if (!feito && !agoraRodando) {
                return (
                  <li key={papel} className="flex items-center gap-3 rounded-2xl border border-dashed px-4 py-3 text-sm text-muted-foreground">
                    <span className="num flex size-7 items-center justify-center rounded-full border text-xs">{i + 1}</span>
                    {nome} {faz}
                  </li>
                );
              }
              return (
                <li key={papel} className={cn("rounded-2xl border bg-card", agoraRodando && "border-signal/50")}>
                  <header className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
                    <span className={cn("num flex size-7 items-center justify-center rounded-full text-xs font-semibold", feito ? "bg-signal text-white" : "border border-signal text-signal")}>{i + 1}</span>
                    <span className="font-medium">{nome}</span>
                    <span className="text-sm text-muted-foreground">{faz}</span>
                    <span className="num ml-auto text-xs text-muted-foreground">
                      {feito ? `${(feito.ms / 1000).toFixed(1)} s` : <><Loader2 className="mr-1 inline size-3 animate-spin" />{Math.max(0, Math.round((agora - inicio) / 1000))} s</>}
                    </span>
                  </header>
                  <div className="p-4 text-sm">
                    {!feito ? (
                      <p className="text-muted-foreground">Trabalhando…</p>
                    ) : feito.papel === "gerente" ? (
                      <VerPlano p={feito.dados} />
                    ) : feito.papel === "revisor" ? (
                      <VerCritica c={feito.dados} />
                    ) : (
                      <VerTexto r={feito.dados} />
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
        {erro && <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{erro}</p>}
        {final && plano && rascunho && critica && (
          <p className="text-xs text-muted-foreground">Nota do revisor no rascunho: {critica.dados.nota}/10. Tempo total: {Math.round((plano.ms + rascunho.ms + critica.ms + final.ms) / 1000)} s.</p>
        )}
      </section>
    </div>
  );
}

function VerPlano({ p }: { p: Plano }) {
  const comoTexto = `Objetivo: ${p.resumo}\nPúblico: ${p.publico}\nTom: ${p.tom}\n\nPassos:\n${p.passos.map((x, i) => `${i + 1}. ${x}`).join("\n")}\n\nCritérios:\n${p.criterios.map((x) => `- ${x}`).join("\n")}`;
  return (
    <div className="grid gap-2.5">
      <p>{p.resumo}</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        <dt className="text-muted-foreground">Público</dt><dd>{p.publico}</dd>
        <dt className="text-muted-foreground">Tom</dt><dd>{p.tom}</dd>
      </dl>
      <ol className="list-decimal pl-5 text-sm">{p.passos.map((x, i) => <li key={i}>{x}</li>)}</ol>
      <p className="text-xs text-muted-foreground">Critérios: {p.criterios.join("; ")}</p>
      <div><BotaoCopiar texto={comoTexto} rotulo="Copiar plano" /></div>
    </div>
  );
}

function VerCritica({ c }: { c: Critica }) {
  const comoTexto = `Nota: ${c.nota}/10\n\nPontos fortes:\n${c.pontosFortes.map((x) => `- ${x}`).join("\n")}\n\nProblemas:\n${c.problemas.map((x) => `- ${x}`).join("\n")}\n\nSugestões:\n${c.sugestoes.map((x) => `- ${x}`).join("\n")}`;
  const bloco = (titulo: string, itens: string[], cor: string) =>
    itens.length > 0 && (
      <div>
        <p className={cn("text-xs font-medium", cor)}>{titulo}</p>
        <ul className="list-disc pl-5">{itens.map((x, i) => <li key={i}>{x}</li>)}</ul>
      </div>
    );
  return (
    <div className="grid gap-2.5">
      <p className="num text-2xl font-semibold">{c.nota}<span className="text-sm font-normal text-muted-foreground">/10</span></p>
      {bloco("Pontos fortes", c.pontosFortes, "text-emerald-700 dark:text-emerald-400")}
      {bloco("Problemas", c.problemas, "text-destructive")}
      {bloco("Sugestões", c.sugestoes, "text-muted-foreground")}
      <div><BotaoCopiar texto={comoTexto} rotulo="Copiar revisão" /></div>
    </div>
  );
}

function VerTexto({ r }: { r: Rascunho | VersaoFinal }) {
  const mudancas = "mudancas" in r ? r.mudancas : [];
  return (
    <div className="grid gap-2.5">
      <h3 className="text-base font-semibold">{r.titulo}</h3>
      <p className="max-w-prose whitespace-pre-wrap">{r.texto}</p>
      {mudancas.length > 0 && <p className="text-xs text-muted-foreground">Mudou: {mudancas.join("; ")}</p>}
      <div className="flex gap-1.5">
        <BotaoCopiar texto={`${r.titulo}\n\n${r.texto}`} rotulo="Copiar texto" />
      </div>
    </div>
  );
}
