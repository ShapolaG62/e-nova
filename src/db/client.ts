import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export type Db = NodePgDatabase<typeof schema>;

/**
 * Sempre Postgres via node-postgres — o mesmo caminho em dev e produção.
 * Dev local: `npm run dev` sobe um Postgres embutido (PGlite) na porta 5433.
 * Produção: DATABASE_URL do Neon/Supabase/RDS.
 */
export function createDb(url = process.env.DATABASE_URL): Db {
  if (!url || !/^postgres(ql)?:\/\//.test(url)) {
    throw new Error("DATABASE_URL ausente ou inválida (esperado postgres://…). Veja .env.example.");
  }
  const local = /@(127\.0\.0\.1|localhost):5433\//.test(url);
  const pool = new Pool({
    connectionString: url,
    max: local ? 5 : 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
  pool.on("error", (err) => console.error("[db] erro em conexão ociosa", err));
  return drizzle(pool, { schema });
}
