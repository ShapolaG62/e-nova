import "server-only";
import QRCode from "qrcode";
import sharp from "sharp";

/** QR Code permanente (não depende de site encurtador), com logo opcional no meio. */
export async function gerarQr({ texto, escuro = "#000000", claro = "#ffffff", logo, tamanho = 1024, margem = 2 }: {
  texto: string;
  escuro?: string;
  claro?: string;
  logo?: Buffer | null;
  tamanho?: number;
  margem?: number;
}) {
  if (!texto) throw new Error("Digite o texto ou link.");
  const opts = { errorCorrectionLevel: logo ? "H" : "M", margin: margem, width: tamanho, color: { dark: escuro, light: claro } } as const;
  let png: Buffer;
  try {
    png = await QRCode.toBuffer(texto, opts);
  } catch {
    throw new Error("Texto longo demais para caber num QR Code.");
  }
  if (logo) {
    const s = Math.round(tamanho * 0.22);
    const pad = Math.round(s * 0.12);
    let logoBuf: Buffer;
    try {
      logoBuf = await sharp(logo, { limitInputPixels: 50_000_000 }).resize(s - pad * 2, s - pad * 2, { fit: "contain", background: claro }).png().toBuffer();
    } catch {
      throw new Error("Não consegui ler a imagem do logo. Use PNG, JPG ou WEBP.");
    }
    const placa = await sharp({ create: { width: s, height: s, channels: 4, background: claro } }).composite([{ input: logoBuf, top: pad, left: pad }]).png().toBuffer();
    png = await sharp(png).composite([{ input: placa, gravity: "center" }]).png().toBuffer();
  }
  const svg = logo ? null : await QRCode.toString(texto, { ...opts, type: "svg" });
  return { png: `data:image/png;base64,${png.toString("base64")}`, svg };
}
