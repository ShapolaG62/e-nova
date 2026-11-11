"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeftRight, Bot, Copy, Eraser, Languages, Loader2, PlugZap, Send } from "lucide-react";
import { chatAction, traduzirAction } from "@/app/actions/ferramentas";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { selectClass } from "@/components/field";
import { cn } from "@/lib/utils";
import { BotaoAcao, copiar, Painel } from "./comum";

export function SemIaTexto({ podeConfigurar }: { podeConfigurar: boolean }) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-dashed border-signal/50 bg-signal/5 p-4 sm:flex-row sm:items-center">
      <PlugZap className="size-5 shrink-0 text-signal" aria-hidden />
      <p className="flex-1 text-sm">
        <strong>Nenhuma IA de texto está conectada.</strong>{" "}
        {podeConfigurar ? "Cole uma chave na Central de IA (Gemini e Groq têm plano grátis) e esta ferramenta passa a funcionar." : "Peça a um administrador para conectar uma IA de texto na Central de IA."}
      </p>
      {podeConfigurar && (
        <Link href="/painel/ia-central" className="inline-flex h-11 shrink-0 items-center justify-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/80 sm:h-9">
          Abrir a Central de IA
        </Link>
      )}
    </div>
  );
}

const IDIOMAS = ["português do Brasil", "inglês", "espanhol", "francês", "italiano", "alemão", "japonês", "chinês (simplificado)", "coreano", "russo", "árabe", "holandês", "português de Portugal"];

export function Tradutor({ iaPronta, podeConfigurar }: { iaPronta: boolean; podeConfigurar: boolean }) {
  const [texto, setTexto] = useState("");
  const [destino, setDestino] = useState("inglês");
  const [saida, setSaida] = useState<{ texto: string; ia: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function traduzir(e?: React.FormEvent) {
    e?.preventDefault();
    if (!texto.trim()) return;
    setOcupado(true);
    try {
      const r = await traduzirAction({ texto, destino });
      if (!r.ok) return void toast.error(r.message);
      setSaida(r.dados);
    } finally {
      setOcupado(false);
    }
  }

  function inverter() {
    if (!saida) return;
    setTexto(saida.texto);
    setSaida(null);
    setDestino(destino === "português do Brasil" ? "inglês" : "português do Brasil");
  }

  return (
    <Painel titulo="Tradutor" descricao="Traduza textos mantendo o tom e a formatação. O idioma de origem é detectado sozinho e a Central de IA escolhe quem traduz.">
      {!iaPronta && <SemIaTexto podeConfigurar={podeConfigurar} />}
      <form onSubmit={traduzir} className="grid gap-3 lg:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="trad-texto">Texto</Label>
          <Textarea
            id="trad-texto"
            rows={8}
            maxLength={12000}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) void traduzir(); }}
            placeholder="Cole ou digite o texto aqui…"
            className="min-h-40"
          />
          <p className="text-right text-xs text-muted-foreground tabular-nums">{texto.length.toLocaleString("pt-BR")} / 12.000</p>
        </div>
        <div className="grid content-start gap-1.5">
          <Label htmlFor="trad-destino">Traduzir para</Label>
          <select id="trad-destino" className={selectClass} value={destino} onChange={(e) => setDestino(e.target.value)}>
            {IDIOMAS.map((i) => <option key={i} value={i}>{i[0].toUpperCase() + i.slice(1)}</option>)}
          </select>
          <div className={cn("mt-1 min-h-40 rounded-lg border bg-muted/40 p-3 text-sm whitespace-pre-wrap", !saida && "text-muted-foreground")} aria-live="polite">
            {ocupado ? <span className="inline-flex items-center gap-2"><Loader2 className="size-4 animate-spin" /> Traduzindo…</span> : saida ? saida.texto : "A tradução aparece aqui."}
          </div>
          {saida && (
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" className="h-11 sm:h-8" onClick={() => copiar(saida.texto, "Tradução copiada")}><Copy data-icon="inline-start" /> Copiar</Button>
              <Button type="button" variant="ghost" className="h-11 sm:h-8" onClick={inverter}><ArrowLeftRight data-icon="inline-start" /> Inverter</Button>
              <span className="ml-auto text-xs text-muted-foreground">por {saida.ia}</span>
            </div>
          )}
        </div>
        <div className="lg:col-span-2">
          <BotaoAcao type="submit" ocupado={ocupado} disabled={!texto.trim()} icone={<Languages data-icon="inline-start" />}>{ocupado ? "Traduzindo…" : "Traduzir"}</BotaoAcao>
        </div>
      </form>
    </Painel>
  );
}

type Msg = { papel: "usuario" | "ia"; texto: string; ia?: string };

export function ChatIa({ iaPronta, podeConfigurar }: { iaPronta: boolean; podeConfigurar: boolean }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [texto, setTexto] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const fim = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fim.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [msgs, ocupado]);

  async function enviar(e?: React.FormEvent) {
    e?.preventDefault();
    const t = texto.trim();
    if (!t || ocupado) return;
    const novas: Msg[] = [...msgs, { papel: "usuario", texto: t }];
    setMsgs(novas);
    setTexto("");
    setOcupado(true);
    try {
      const r = await chatAction({ mensagens: novas.slice(-40).map(({ papel, texto: x }) => ({ papel, texto: x })) });
      if (!r.ok) {
        toast.error(r.message);
        setMsgs(msgs);
        setTexto(t);
        return;
      }
      setMsgs([...novas, { papel: "ia", texto: r.dados.texto, ia: r.dados.ia }]);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Painel
      titulo="Chat com IA"
      descricao="Converse com a IA de texto da Central (ela troca sozinha se uma falhar). A conversa não fica salva: some ao sair da página."
      acao={msgs.length > 0 ? <Button variant="ghost" size="sm" className="h-9" onClick={() => setMsgs([])} disabled={ocupado}><Eraser data-icon="inline-start" /> Nova conversa</Button> : undefined}
    >
      {!iaPronta && <SemIaTexto podeConfigurar={podeConfigurar} />}
      <div className="grid max-h-[60vh] min-h-56 gap-3 overflow-y-auto rounded-xl border bg-muted/30 p-3" aria-live="polite">
        {!msgs.length && (
          <div className="grid place-content-center gap-2 py-8 text-center text-sm text-muted-foreground">
            <Bot className="mx-auto size-8" aria-hidden />
            <p>Pergunte qualquer coisa. Ex.: “Escreva 3 legendas para um post de padaria”.</p>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={cn("flex", m.papel === "usuario" ? "justify-end" : "justify-start")}>
            <div className={cn("group max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap [overflow-wrap:anywhere]", m.papel === "usuario" ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md border bg-card")}>
              {m.texto}
              {m.papel === "ia" && (
                <div className="mt-1.5 flex items-center gap-2 text-[0.7rem] text-muted-foreground">
                  <span>{m.ia}</span>
                  <button type="button" onClick={() => copiar(m.texto, "Resposta copiada")} className="ml-auto inline-flex h-7 items-center gap-1 rounded px-1.5 hover:bg-muted">
                    <Copy className="size-3" /> Copiar
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        {ocupado && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Pensando…</div>}
        <div ref={fim} />
      </div>
      <form onSubmit={enviar} className="flex items-end gap-2">
        <Textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void enviar(); } }}
          rows={2}
          maxLength={12000}
          placeholder="Escreva sua mensagem… (Enter envia, Shift+Enter pula linha)"
          aria-label="Mensagem"
          className="min-h-12 min-w-0 flex-1 resize-none"
        />
        <Button type="submit" size="icon-lg" className="size-12 shrink-0 sm:size-10" disabled={!texto.trim() || ocupado} aria-label="Enviar">
          {ocupado ? <Loader2 className="animate-spin" /> : <Send />}
        </Button>
      </form>
    </Painel>
  );
}
