"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Download, QrCode } from "lucide-react";
import { qrAction } from "@/app/actions/ferramentas";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { selectClass } from "@/components/field";
import { BotaoAcao, Painel, Segmentado, SeletorArquivos } from "./comum";

type Tipo = "link" | "texto" | "wifi" | "whatsapp";

const escWifi = (s: string) => s.replace(/([\\;,:"])/g, "\\$1");

export function GeradorQr() {
  const [tipo, setTipo] = useState<Tipo>("link");
  const [link, setLink] = useState("");
  const [texto, setTexto] = useState("");
  const [rede, setRede] = useState("");
  const [senha, setSenha] = useState("");
  const [seguranca, setSeguranca] = useState("WPA");
  const [oculta, setOculta] = useState(false);
  const [fone, setFone] = useState("");
  const [msg, setMsg] = useState("");
  const [escuro, setEscuro] = useState("#000000");
  const [claro, setClaro] = useState("#ffffff");
  const [tamanho, setTamanho] = useState("1024");
  const [logo, setLogo] = useState<File[]>([]);
  const [ocupado, setOcupado] = useState(false);
  const [qr, setQr] = useState<{ png: string; svg: string | null } | null>(null);

  function conteudo(): string {
    if (tipo === "link") {
      const l = link.trim();
      return l && !/^[a-z]+:/i.test(l) ? `https://${l}` : l;
    }
    if (tipo === "texto") return texto;
    if (tipo === "wifi") return rede ? `WIFI:T:${seguranca === "nopass" ? "nopass" : seguranca};S:${escWifi(rede)};${seguranca === "nopass" ? "" : `P:${escWifi(senha)};`}${oculta ? "H:true;" : ""};` : "";
    const num = fone.replace(/\D/g, "");
    if (!num) return "";
    const completo = num.length <= 11 ? `55${num}` : num;
    return `https://wa.me/${completo}${msg.trim() ? `?text=${encodeURIComponent(msg.trim())}` : ""}`;
  }

  async function gerar(e: React.FormEvent) {
    e.preventDefault();
    const c = conteudo();
    if (!c) return toast.error("Preencha os campos primeiro.");
    setOcupado(true);
    try {
      const fd = new FormData();
      fd.set("texto", c);
      fd.set("escuro", escuro);
      fd.set("claro", claro);
      fd.set("tamanho", tamanho);
      if (logo[0]) fd.set("logo", logo[0]);
      const r = await qrAction(fd);
      if (!r.ok) return void toast.error(r.message);
      setQr(r.dados);
    } finally {
      setOcupado(false);
    }
  }

  function baixarSvg() {
    if (!qr?.svg) return;
    const url = URL.createObjectURL(new Blob([qr.svg], { type: "image/svg+xml" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "qrcode.svg";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  return (
    <Painel titulo="QR Code" descricao="QR Codes permanentes (não dependem de nenhum site e nunca expiram), com cores e logo no meio.">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
        <form onSubmit={gerar} className="grid gap-3.5">
          <Segmentado<Tipo> rotulo="Tipo" valor={tipo} onChange={setTipo} colunas={4} opcoes={[{ v: "link", rotulo: "Link" }, { v: "texto", rotulo: "Texto" }, { v: "wifi", rotulo: "Wi-Fi" }, { v: "whatsapp", rotulo: "WhatsApp" }]} />
          {tipo === "link" && (
            <div className="grid gap-1.5">
              <Label htmlFor="qr-link">Endereço</Label>
              <Input id="qr-link" inputMode="url" placeholder="https://seusite.com.br" value={link} onChange={(e) => setLink(e.target.value)} className="h-11 sm:h-9" />
            </div>
          )}
          {tipo === "texto" && (
            <div className="grid gap-1.5">
              <Label htmlFor="qr-texto">Texto</Label>
              <Textarea id="qr-texto" rows={4} maxLength={1500} value={texto} onChange={(e) => setTexto(e.target.value)} />
            </div>
          )}
          {tipo === "wifi" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="qr-rede">Nome da rede</Label>
                <Input id="qr-rede" value={rede} onChange={(e) => setRede(e.target.value)} className="h-11 sm:h-9" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="qr-senha">Senha</Label>
                <Input id="qr-senha" value={senha} onChange={(e) => setSenha(e.target.value)} disabled={seguranca === "nopass"} autoComplete="off" className="h-11 sm:h-9" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="qr-seg">Segurança</Label>
                <select id="qr-seg" className={selectClass} value={seguranca} onChange={(e) => setSeguranca(e.target.value)}>
                  <option value="WPA">WPA/WPA2/WPA3</option>
                  <option value="WEP">WEP</option>
                  <option value="nopass">Sem senha</option>
                </select>
              </div>
              <label className="flex min-h-11 cursor-pointer items-center gap-2 self-end text-sm">
                <input type="checkbox" checked={oculta} onChange={(e) => setOculta(e.target.checked)} className="size-5 accent-signal" /> Rede oculta
              </label>
            </div>
          )}
          {tipo === "whatsapp" && (
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="qr-fone">Número com DDD</Label>
                <Input id="qr-fone" type="tel" inputMode="tel" placeholder="(11) 98888-7777" value={fone} onChange={(e) => setFone(e.target.value)} className="h-11 sm:h-9" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="qr-msg">Mensagem pronta (opcional)</Label>
                <Textarea id="qr-msg" rows={2} maxLength={500} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Olá! Vi o cartaz e quero saber mais." />
              </div>
            </div>
          )}
          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="qr-escuro">Cor</Label>
              <input id="qr-escuro" type="color" value={escuro} onChange={(e) => setEscuro(e.target.value)} className="h-11 w-full cursor-pointer rounded-lg border bg-transparent p-1 sm:h-9" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="qr-claro">Fundo</Label>
              <input id="qr-claro" type="color" value={claro} onChange={(e) => setClaro(e.target.value)} className="h-11 w-full cursor-pointer rounded-lg border bg-transparent p-1 sm:h-9" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="qr-tam">Tamanho</Label>
              <select id="qr-tam" className={selectClass} value={tamanho} onChange={(e) => setTamanho(e.target.value)}>
                <option value="512">512 px</option>
                <option value="1024">1024 px</option>
                <option value="2048">2048 px</option>
              </select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <span className="text-sm font-medium">Logo no meio (opcional)</span>
            <SeletorArquivos aceita="image/png,image/jpeg,image/webp,image/svg+xml" arquivos={logo} onChange={setLogo} rotulo="Escolher logo" dica="PNG com fundo transparente fica melhor (até 3 MB)." />
          </div>
          <div>
            <BotaoAcao type="submit" ocupado={ocupado} icone={<QrCode data-icon="inline-start" />}>{ocupado ? "Gerando…" : "Gerar QR Code"}</BotaoAcao>
          </div>
        </form>

        <div className="grid gap-2">
          {qr ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr.png} alt="QR Code gerado" className="mx-auto aspect-square w-full max-w-72 rounded-xl border bg-white" />
              <a href={qr.png} download="qrcode.png" className="inline-flex h-11 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/80 sm:h-9">
                <Download className="size-4" /> Baixar PNG
              </a>
              {qr.svg && (
                <button type="button" onClick={baixarSvg} className="inline-flex h-11 items-center justify-center gap-1.5 rounded-lg border px-3 text-sm font-medium hover:bg-muted sm:h-9">
                  <Download className="size-4" /> Baixar SVG (vetor)
                </button>
              )}
              <p className="text-xs text-muted-foreground">Teste com a câmera do celular antes de imprimir. Cores claras demais podem não ser lidas.</p>
            </>
          ) : (
            <div className="flex aspect-square w-full max-w-72 items-center justify-center justify-self-center rounded-xl border border-dashed text-sm text-muted-foreground">
              A prévia aparece aqui
            </div>
          )}
        </div>
      </div>
    </Painel>
  );
}
