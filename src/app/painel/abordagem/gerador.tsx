"use client";

import { useState } from "react";
import Link from "next/link";
import { Copy, Loader2, MessageCircle, Phone, ShieldQuestion, Shuffle, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { abordagemAction, ligacaoAction, registrarContatoAction } from "@/app/actions/vendas";
import { copiar } from "@/lib/sites/client-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { selectClass } from "@/components/field";
import { ListaObjecoes, MensagensWhats, RoteiroLigacao, SeloIA, type Abordagem, type Fala, type Objecao } from "@/components/vendas/roteiros";

type LeadOpcao = { id: string; nome: string; setor: string; cidade: string; whatsapp: string };

export function GeradorAbordagem({
  leads,
  setores,
  objecoes,
  provedorIA,
  leadInicial,
}: {
  leads: LeadOpcao[];
  setores: { id: string; nome: string; icone: string }[];
  objecoes: Objecao[];
  provedorIA: string;
  leadInicial: string;
}) {
  const inicial = leads.find((l) => l.id === leadInicial);
  const [leadId, setLeadId] = useState(inicial?.id ?? "");
  const [nome, setNome] = useState(inicial?.nome ?? "");
  const [setor, setSetor] = useState(inicial?.setor ?? setores[0]?.id ?? "outro");
  const [cidade, setCidade] = useState(inicial?.cidade ?? "");
  // IA local (Ollama) é lenta: começa desligada; Gemini/Claude começam ligados
  const [comIA, setComIA] = useState(provedorIA !== "IA local");
  const [gerando, setGerando] = useState(false);
  const [outra, setOutra] = useState(false);
  const [saida, setSaida] = useState<{ ab: Abordagem; lig: Fala[]; leadId: string; whatsapp: string } | null>(null);

  const entrada = () =>
    leadId
      ? { prospectId: leadId, setor, ia: comIA }
      : { lead: { nome: nome.trim() || "o negócio", cidade: cidade.trim(), setor, situacaoSite: "sem" }, setor, ia: comIA };

  const gerar = async (e: React.FormEvent) => {
    e.preventDefault();
    setGerando(true);
    try {
      const corpo = entrada();
      const [ab, lig] = await Promise.all([abordagemAction(corpo), ligacaoAction(corpo)]);
      setSaida({ ab: ab as Abordagem, lig: lig as Fala[], leadId, whatsapp: leads.find((l) => l.id === leadId)?.whatsapp ?? "" });
    } catch {
      toast.error("Não consegui gerar o roteiro agora. Tente de novo.");
    } finally {
      setGerando(false);
    }
  };

  return (
    <div className="grid gap-5">
      <form onSubmit={gerar} className="grid gap-4 rounded-2xl border bg-card p-4 sm:grid-cols-3 sm:p-5">
        <div className="grid gap-1.5 sm:col-span-3">
          <Label htmlFor="ab-lead">Contato do funil</Label>
          <select
            id="ab-lead"
            value={leadId}
            className={selectClass}
            onChange={(e) => {
              setLeadId(e.target.value);
              const l = leads.find((x) => x.id === e.target.value);
              if (l) {
                setNome(l.nome);
                setCidade(l.cidade);
                setSetor(setores.some((s) => s.id === l.setor) ? l.setor : (setores.find((s) => s.id === "outro")?.id ?? setor));
              }
            }}
          >
            <option value="">— ou preencha abaixo —</option>
            {leads.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nome}
                {l.cidade ? ` · ${l.cidade}` : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="ab-nome">Nome do negócio</Label>
          <Input id="ab-nome" value={nome} disabled={!!leadId} onChange={(e) => setNome(e.target.value)} className="h-10 sm:h-9" placeholder="Ex.: Barbearia do Zé" maxLength={200} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="ab-setor">Ramo</Label>
          <select id="ab-setor" value={setor} onChange={(e) => setSetor(e.target.value)} className={selectClass}>
            {setores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.icone} {s.nome}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="ab-cidade">Cidade</Label>
          <Input id="ab-cidade" value={cidade} disabled={!!leadId} onChange={(e) => setCidade(e.target.value)} className="h-10 sm:h-9" maxLength={120} />
        </div>
        <div className="flex flex-col gap-3 sm:col-span-3 sm:flex-row sm:items-center">
          <Button type="submit" className="h-10 px-4 font-semibold" disabled={gerando}>
            {gerando ? <Loader2 className="animate-spin" /> : <Sparkles />}
            {gerando ? "Escrevendo…" : "Gerar roteiro"}
          </Button>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={comIA} onCheckedChange={setComIA} />
            Escrever com IA ({provedorIA})
          </label>
          <p className="text-xs text-muted-foreground sm:ml-auto sm:max-w-xs sm:text-right">
            {comIA ? "Textos sob medida. Se a IA não responder, entram os modelos prontos." : "Modelos prontos: instantâneo e sem gastar IA."}
          </p>
        </div>
      </form>

      {saida && (
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
          <section className="grid gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="flex items-center gap-1.5 text-lg font-bold">
                <MessageCircle className="size-5 text-emerald-600" /> WhatsApp
              </h2>
              <SeloIA ia={saida.ab.ia} aviso={saida.ab.aviso} />
              <Button variant="outline" size="sm" className="ml-auto" onClick={() => copiar(saida.ab.mensagens.map((m) => m.texto).join("\n\n"))}>
                <Copy /> Copiar tudo
              </Button>
            </div>
            {saida.ab.aviso && <p className="rounded-lg bg-amber-50 p-2.5 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200">{saida.ab.aviso}</p>}
            <MensagensWhats
              mensagens={saida.ab.mensagens}
              whatsapp={saida.whatsapp}
              aoEnviar={async (texto) => {
                if (!saida.leadId) return;
                const r = await registrarContatoAction(saida.leadId, texto);
                if (r.ok) toast.success("Marcado como contatado no funil ✓");
                else toast.error(r.message);
              }}
            />
            {saida.leadId && (
              <Link href={`/painel/funil?lead=${saida.leadId}`} className="text-sm font-medium text-primary hover:underline">
                Abrir a ficha no funil →
              </Link>
            )}
          </section>
          <section className="grid gap-3">
            <div className="flex items-center gap-2">
              <h2 className="flex items-center gap-1.5 text-lg font-bold">
                <Phone className="size-5 text-primary" /> Ligação
              </h2>
              <Button
                variant="outline"
                size="sm"
                className="ml-auto"
                disabled={outra}
                onClick={async () => {
                  setOutra(true);
                  try {
                    const lig = (await ligacaoAction(entrada())) as Fala[];
                    setSaida((s) => (s ? { ...s, lig } : s));
                  } catch {
                    toast.error("Não consegui gerar outra versão.");
                  }
                  setOutra(false);
                }}
              >
                {outra ? <Loader2 className="animate-spin" /> : <Shuffle />} Outra versão
              </Button>
            </div>
            <RoteiroLigacao roteiro={saida.lig} />
            <h2 className="mt-2 flex items-center gap-1.5 text-lg font-bold">
              <ShieldQuestion className="size-5 text-primary" /> Objeções comuns
            </h2>
            <ListaObjecoes objecoes={objecoes} modo="sanfona" />
          </section>
        </div>
      )}
    </div>
  );
}
