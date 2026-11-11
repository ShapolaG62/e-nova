// Utilidades do lado do navegador para as telas de Vendas (sem "server-only").
import { toast } from "sonner";

export function abrirWhats(numero: string | null | undefined, texto = "") {
  const n = String(numero ?? "").replace(/\D/g, "");
  window.open(`https://wa.me/${n}${texto ? `?text=${encodeURIComponent(texto)}` : ""}`, "_blank", "noopener");
}

export async function copiar(texto: string) {
  try {
    await navigator.clipboard.writeText(texto);
  } catch {
    const t = document.createElement("textarea");
    t.value = texto; document.body.append(t); t.select(); document.execCommand("copy"); t.remove();
  }
  toast.success("Copiado!");
}

export const iniciais = (n: string) =>
  String(n || "").replace(/[^\p{L}\s]/gu, "").split(/\s+/).filter((w) => w.length > 2).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "★";

export const fotoGoogleUrl = (ref: string, w = 160) => `/api/vendas/foto?n=${encodeURIComponent(ref)}&w=${w}`;

export const ETAPAS = [
  { id: "NOVO", nome: "Novos" },
  { id: "CONTATADO", nome: "Contatados" },
  { id: "NEGOCIANDO", nome: "Negociando" },
  { id: "FECHADO", nome: "Fechados" },
  { id: "PERDIDO", nome: "Perdidos" },
] as const;

export function tempoAtras(d: string | Date) {
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 60) return "agora";
  if (s < 3600) return `${Math.floor(s / 60)} min`;
  if (s < 86400) return `${Math.floor(s / 3600)} h`;
  return `${Math.floor(s / 86400)} d`;
}

/** Lê um arquivo de imagem e reduz para no máximo 1800px (JPEG), devolvendo data URL. */
export function imagemParaDataUrl(file: File): Promise<string> {
  return new Promise((ok, falha) => {
    const r = new FileReader();
    const img = new Image();
    r.onload = () => { img.src = String(r.result); };
    r.onerror = () => falha(new Error("Não consegui ler o arquivo."));
    img.onload = () => {
      const k = Math.min(1, 1800 / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      ok(c.toDataURL("image/jpeg", 0.86));
    };
    img.onerror = () => falha(new Error("Não consegui ler essa imagem."));
    r.readAsDataURL(file);
  });
}
