// Aplica as migrações SQL de ./drizzle no banco configurado (PGlite ou Postgres remoto).
// Uso: npm run db:migrate   (com o servidor de dev PARADO quando usar PGlite)
import { migrate as migratePg } from "drizzle-orm/node-postgres/migrator";
import { createDb } from "../src/db/client";

async function main() {
  const db = createDb(process.env.DATABASE_URL);
  await migratePg(db, { migrationsFolder: "./drizzle" });
  console.log("✓ Migrações aplicadas");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
