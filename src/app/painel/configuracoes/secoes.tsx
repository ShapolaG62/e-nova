"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CircleCheck, Loader2, RefreshCw, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErroGooglePainel, FormChaveGoogle, GuiaChaveGoogle, type EstadoGoogle } from "@/components/google-conexao";
import { removerGoogleAction, salvarEmpresaAction, salvarUrlSitesAction, testarGoogleAction } from "@/app/actions/configuracoes";
import type { ErroGoogle } from "@/lib/sites/google-erros";

function Campo({ id, label, hint, children }: { id: string; label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="grid content-start gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Seção Google Maps: testar a chave salva, trocar ou remover. */
export function GoogleSecao({ estado, final, erroSalvo, daVariavel }: { estado: EstadoGoogle; final: string; erroSalvo: string | null; daVariavel: boolean }) {
  const router = useRouter();
  const [testando, startTeste] = useTransition();
  const [removendo, startRemover] = useTransition();
  const [erro, setErro] = useState<ErroGoogle | null>(null);
  const [trocar, setTrocar] = useState(false);

  const testar = () =>
    startTeste(async () => {
      const r = await testarGoogleAction();
      if (r.ok) {
        setErro(null);
        toast.success("O Google respondeu: conexão funcionando");
      } else if (r.google) setErro(r.google);
      else toast.error(r.message);
      router.refresh();
    });

  const remover = () => {
    if (!confirm("Remover a chave do Google? A Prospecção volta ao modo demonstração.")) return;
    startRemover(async () => {
      const r = await removerGoogleAction();
      if (!r.ok) return void toast.error(r.message);
      setErro(null);
      toast.success("Chave removida");
      router.refresh();
    });
  };

  if (estado === "sem-chave" || trocar) {
    return (
      <div className="grid gap-4">
        {estado === "sem-chave" && (
          <p className="text-sm text-muted-foreground">
            Sem a chave, a Prospecção mostra empresas fictícias para você treinar. Com ela, a busca traz empresas reais do Google Maps.
          </p>
        )}
        <FormChaveGoogle onConectado={() => setTrocar(false)} rotulo={trocar ? "Nova chave" : "Chave da API do Google"} />
        {trocar && (
          <Button variant="ghost" size="sm" className="w-fit" onClick={() => setTrocar(false)}>
            Cancelar troca
          </Button>
        )}
        <GuiaChaveGoogle aberto={estado === "sem-chave"} />
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl bg-muted/50 px-4 py-3 text-sm">
        <span>
          Chave atual: <code className="rounded bg-background px-1.5 py-0.5 font-mono text-xs">••••{final}</code>
        </span>
        {daVariavel && <span className="text-muted-foreground">vem da variável GOOGLE_PLACES_KEY do servidor</span>}
        {estado === "ok" && (
          <span className="inline-flex items-center gap-1.5 text-success">
            <CircleCheck className="size-4" /> O Google aceitou a chave no último teste
          </span>
        )}
        {estado === "nao-testada" && <span className="text-muted-foreground">Ainda não testada. Toque em “Testar conexão”.</span>}
      </div>
      {erro ? <ErroGooglePainel erro={erro} /> : estado === "erro" && erroSalvo && (
        <p className="rounded-xl border border-destructive/30 bg-destructive/[0.06] px-4 py-3 text-sm">
          <b>Último teste falhou:</b> {erroSalvo}. Toque em “Testar conexão” para ver como resolver.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button onClick={testar} disabled={testando} className="h-10 sm:h-9">
          {testando ? <Loader2 className="animate-spin" /> : <RefreshCw />} {testando ? "Testando…" : "Testar conexão"}
        </Button>
        <Button variant="outline" onClick={() => setTrocar(true)} className="h-10 sm:h-9">
          Trocar chave
        </Button>
        {!daVariavel && (
          <Button variant="ghost" onClick={remover} disabled={removendo} className="h-10 text-destructive hover:text-destructive sm:h-9">
            {removendo ? <Loader2 className="animate-spin" /> : <Trash2 />} Remover
          </Button>
        )}
      </div>
    </div>
  );
}

type Empresa = { seuNome: string; suaEmpresa: string; metaDiaria: number; objetivo: string };

export function EmpresaSecao({ inicial }: { inicial: Empresa }) {
  const router = useRouter();
  const [v, setV] = useState(inicial);
  const [pendente, start] = useTransition();
  const mudou = JSON.stringify(v) !== JSON.stringify(inicial);
  const set = <K extends keyof Empresa>(k: K, val: Empresa[K]) => setV((x) => ({ ...x, [k]: val }));

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await salvarEmpresaAction(v);
          if (!r.ok) return void toast.error(r.message);
          toast.success("Dados da empresa salvos");
          router.refresh();
        });
      }}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Campo id="seuNome" label="Seu nome" hint="Aparece nas mensagens de abordagem.">
          <Input id="seuNome" value={v.seuNome} onChange={(e) => set("seuNome", e.target.value)} maxLength={80} placeholder="ex.: Gabriel" className="h-10 sm:h-9" />
        </Campo>
        <Campo id="suaEmpresa" label="Sua empresa (opcional)">
          <Input id="suaEmpresa" value={v.suaEmpresa} onChange={(e) => set("suaEmpresa", e.target.value)} maxLength={80} placeholder="ex.: E-Nova Sites" className="h-10 sm:h-9" />
        </Campo>
        <Campo id="metaDiaria" label="Meta de contatos por dia" hint="Usada no Funil para mostrar seu progresso do dia.">
          <Input
            id="metaDiaria"
            type="number"
            min={1}
            max={500}
            inputMode="numeric"
            value={v.metaDiaria}
            onChange={(e) => set("metaDiaria", Number(e.target.value))}
            className="h-10 sm:h-9"
          />
        </Campo>
        <Campo id="objetivo" label="Objetivo da abordagem" hint="ex.: agendar uma conversa, mostrar o site pronto.">
          <Input id="objetivo" value={v.objetivo} onChange={(e) => set("objetivo", e.target.value)} maxLength={120} className="h-10 sm:h-9" />
        </Campo>
      </div>
      <div>
        <Button type="submit" disabled={pendente || !mudou} className="h-10 sm:h-9">
          {pendente ? <Loader2 className="animate-spin" /> : <Save />} {pendente ? "Salvando…" : "Salvar dados"}
        </Button>
      </div>
    </form>
  );
}

export function UrlSitesSecao({ inicial, appUrl }: { inicial: string; appUrl: string }) {
  const router = useRouter();
  const [url, setUrl] = useState(inicial);
  const [pendente, start] = useTransition();
  const base = (url.trim() || appUrl).replace(/\/+$/, "");
  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await salvarUrlSitesAction(url);
          if (!r.ok) return void toast.error(r.message);
          toast.success("Endereço dos sites salvo");
          router.refresh();
        });
      }}
    >
      <div className="grid gap-2 text-sm text-muted-foreground">
        <p>
          Quando você publica um site, o link enviado ao cliente fica assim:{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs break-all text-foreground">{base}/s/nome-do-negocio</code>
        </p>
        <p>
          Para o cliente abrir no celular, esse endereço precisa estar acessível pela internet. Se o E-Nova roda só no seu computador, aponte um domínio para ele e informe abaixo.
          Em branco, usamos o endereço do sistema (<span className="text-foreground">{appUrl}</span>).
        </p>
      </div>
      <Campo id="urlSites" label="Endereço público dos sites (opcional)">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id="urlSites"
            type="url"
            inputMode="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            maxLength={200}
            placeholder="https://sites.minhaempresa.com.br"
            className="h-10 sm:h-9"
          />
          <Button type="submit" disabled={pendente || url === inicial} className="h-10 shrink-0 sm:h-9">
            {pendente ? <Loader2 className="animate-spin" /> : <Save />} Salvar endereço
          </Button>
        </div>
      </Campo>
    </form>
  );
}
