// Processo de background: monitores, backups, publicações e sync de avaliações.
// Uso: npm run worker   (em produção, rode como serviço separado do site)
import { startWorker } from "../src/lib/worker";

const ac = new AbortController();
for (const sig of ["SIGINT", "SIGTERM"] as const) process.on(sig, () => ac.abort());

startWorker({ concurrency: Number(process.env.WORKER_CONCURRENCY ?? 4), signal: ac.signal })
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
