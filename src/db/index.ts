import "server-only";
import { createDb } from "./client";

// Uma única conexão por processo (sobrevive ao hot reload em dev).
const g = globalThis as unknown as { __enovaDb?: ReturnType<typeof createDb> };

export const db = (g.__enovaDb ??= createDb(process.env.DATABASE_URL));

export * as t from "./schema";
