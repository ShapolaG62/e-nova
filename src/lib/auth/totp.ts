import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { generateSecret, generateURI, verifySync } from "otplib";

/** 2FA por app autenticador (TOTP, compatível com Google Authenticator/Authy). */
export const newTotpSecret = () => generateSecret();

export const totpUri = (secret: string, email: string) => generateURI({ issuer: "E-Nova", label: email, secret });

export function verifyTotp(secret: string, code: string) {
  const token = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(token)) return false;
  // Aceita 30 s de diferença de relógio para cada lado
  return verifySync({ secret, token, epochTolerance: 30 }).valid;
}

/** 10 códigos de recuperação de uso único (guardamos só o hash). */
export function newRecoveryCodes() {
  const plain = Array.from({ length: 10 }, () => {
    const s = randomBytes(5).toString("hex").toUpperCase();
    return `${s.slice(0, 5)}-${s.slice(5)}`;
  });
  return { plain, hashed: plain.map(hashCode) };
}

export const hashCode = (c: string) => createHash("sha256").update(c.replace(/[\s-]/g, "").toUpperCase()).digest("hex");

/** Confere um código de recuperação; devolve a lista sem ele (uso único) ou null. */
export function consumeRecoveryCode(hashes: string[], code: string): string[] | null {
  const h = Buffer.from(hashCode(code));
  const idx = hashes.findIndex((x) => x.length === h.length && timingSafeEqual(Buffer.from(x), h));
  return idx === -1 ? null : hashes.filter((_, i) => i !== idx);
}
