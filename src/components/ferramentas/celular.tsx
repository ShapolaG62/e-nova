"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Copy, Download, Laptop, QrCode, Smartphone, Trash2, Upload } from "lucide-react";
import { iniciarCelularAction, removerDoCelularAction, type SessaoCelular } from "@/app/actions/ferramentas";
import { Button } from "@/components/ui/button";
import { tamanhoLegivel } from "@/lib/ferramentas/catalogo";
import { BotaoAcao, copiar, enviarArquivo, Painel, Progresso, SeletorArquivos, useArmazenado } from "./comum";

type Item = { id: string; nome: string; tamanho: number; origem: "pc" | "celular"; em: string };
const hora = (s: number) => new Date(s * 1000).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

export function Celular() {
  const [bruto, setBruto] = useArmazenado("enova.ferramentas.celular");
  const sessao = useMemo<SessaoCelular | null>(() => {
    try {
      const s = JSON.parse(bruto ?? "null") as SessaoCelular | null;
      return s?.token && Array.isArray(s.enderecos) && s.enderecos.length ? s : null; // link vencido: a lista responde 410 e a sessão é limpa
    } catch {
      return null;
    }
  }, [bruto]);
  const [qual, setQual] = useState(0);
  const [itens, setItens] = useState<Item[]>([]);
  const [iniciando, setIniciando] = useState(false);
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [progresso, setProgresso] = useState<number | null>(null);
  const [enviando, setEnviando] = useState(false);

  const base = sessao ? `/api/ferramentas/celular?t=${encodeURIComponent(sessao.token)}` : "";

  // acompanha a mesa a cada 3 s enquanto a sessão estiver aberta
  useEffect(() => {
    if (!base) return;
    let vivo = true;
    const ler = async () => {
      try {
        const r = await fetch(`${base}&acao=lista`, { cache: "no-store" });
        if (r.status === 410) {
          if (vivo) setBruto(null);
          return;
        }
        const j = (await r.json()) as { itens: Item[] };
        if (vivo) setItens(j.itens);
      } catch {
        /* tenta de novo no próximo ciclo */
      }
    };
    void ler();
    const t = setInterval(ler, 3000);
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, [base, setBruto]);

  async function iniciar() {
    setIniciando(true);
    try {
      const r = await iniciarCelularAction();
      if (!r.ok) return void toast.error(r.message);
      setBruto(JSON.stringify(r.dados));
      setQual(0);
      setItens([]);
    } finally {
      setIniciando(false);
    }
  }

  async function enviarDoPc() {
    if (!sessao) return;
    setEnviando(true);
    try {
      for (const [i, a] of arquivos.entries()) {
        await enviarArquivo(a, (f) => setProgresso((i + f) / arquivos.length), `${base}&origem=pc&nome=${encodeURIComponent(a.name)}`);
      }
      setArquivos([]);
      toast.success("Enviado! Já aparece no celular.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no envio.");
    } finally {
      setProgresso(null);
      setEnviando(false);
    }
  }

  async function remover(id: string) {
    if (!sessao) return;
    const r = await removerDoCelularAction(sessao.token, id);
    if (!r.ok) return void toast.error(r.message);
    setItens((l) => l.filter((x) => x.id !== id));
  }

  if (!sessao) {
    return (
      <Painel titulo="Transferir para o celular" descricao="Passe arquivos entre o computador e o celular sem cabo: o celular lê um QR Code e abre uma página para enviar e baixar.">
        <ul className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
          <li className="rounded-xl bg-muted/60 p-3"><strong className="text-foreground">1.</strong> Gere o QR Code aqui.</li>
          <li className="rounded-xl bg-muted/60 p-3"><strong className="text-foreground">2.</strong> Aponte a câmera do celular (iPhone ou Android).</li>
          <li className="rounded-xl bg-muted/60 p-3"><strong className="text-foreground">3.</strong> Envie ou baixe arquivos. O link expira em 2 horas.</li>
        </ul>
        <div>
          <BotaoAcao ocupado={iniciando} onClick={iniciar} icone={<QrCode data-icon="inline-start" />}>Gerar QR Code</BotaoAcao>
        </div>
      </Painel>
    );
  }

  const end = sessao.enderecos[qual] ?? sessao.enderecos[0];

  return (
    <Painel
      titulo="Transferir para o celular"
      descricao={`Aponte a câmera do celular para o QR Code. O link vale até ${hora(sessao.exp)}.`}
      acao={<Button variant="ghost" size="sm" className="h-9" onClick={() => setBruto(null)}>Encerrar</Button>}
    >
      {sessao.aviso && <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{sessao.aviso}</p>}
      <div className="grid gap-5 md:grid-cols-[260px_minmax(0,1fr)] md:items-start">
        <div className="grid justify-items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={end.qr} alt="QR Code para abrir no celular" className="aspect-square w-full max-w-64 rounded-xl border bg-white p-2" />
          {sessao.enderecos.length > 1 && (
            <div className="grid w-full gap-1">
              {sessao.enderecos.map((e, i) => (
                <button key={e.url} type="button" onClick={() => setQual(i)} aria-pressed={qual === i} className={`min-h-10 rounded-lg border px-2 text-xs ${qual === i ? "border-signal bg-signal/10 font-medium" : "hover:bg-muted"}`}>
                  {e.rotulo}
                </button>
              ))}
            </div>
          )}
          <Button variant="outline" className="h-11 w-full sm:h-8" onClick={() => copiar(end.url, "Link copiado")}>
            <Copy data-icon="inline-start" /> Copiar link
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            {end.rotulo.startsWith("Rede local") ? "O celular precisa estar no mesmo Wi-Fi deste computador." : end.rotulo}
          </p>
        </div>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <p className="flex items-center gap-1.5 text-sm font-medium"><Laptop className="size-4" /> Mandar do computador para o celular</p>
            <SeletorArquivos multiplo arquivos={arquivos} onChange={setArquivos} />
            {enviando && <Progresso valor={progresso} rotulo="Enviando…" />}
            {arquivos.length > 0 && (
              <div>
                <BotaoAcao ocupado={enviando} onClick={enviarDoPc} icone={<Upload data-icon="inline-start" />}>Enviar para o celular</BotaoAcao>
              </div>
            )}
          </div>

          <div className="grid gap-2">
            <p className="flex items-center gap-1.5 text-sm font-medium"><Smartphone className="size-4" /> Arquivos na mesa</p>
            {!itens.length ? (
              <p className="rounded-xl border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">Nada ainda. O que o celular enviar aparece aqui sozinho.</p>
            ) : (
              <ul className="grid gap-1.5">
                {[...itens].reverse().map((it) => (
                  <li key={it.id} className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm">
                    {it.origem === "pc" ? <Laptop className="size-4 shrink-0 text-muted-foreground" aria-label="Do computador" /> : <Smartphone className="size-4 shrink-0 text-signal" aria-label="Do celular" />}
                    <span className="min-w-0 flex-1 truncate">{it.nome}</span>
                    <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">{tamanhoLegivel(it.tamanho)}</span>
                    <a href={`${base}&acao=baixar&id=${it.id}`} download={it.nome} className="flex size-10 shrink-0 items-center justify-center rounded-md hover:bg-muted sm:size-8" aria-label={`Baixar ${it.nome}`}>
                      <Download className="size-4" />
                    </a>
                    <button type="button" onClick={() => remover(it.id)} className="flex size-10 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-destructive sm:size-8" aria-label={`Apagar ${it.nome}`}>
                      <Trash2 className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </Painel>
  );
}
