// Sobe Next (porta 3100) + worker juntos. Chamado pelo pglite-server em `npm run dev`.
import { spawn } from "node:child_process";

const procs = [
  ["next", [process.execPath, ["node_modules/next/dist/bin/next", "dev", "-p", "3100"]]],
  ["worker", [process.execPath, ["node_modules/tsx/dist/cli.mjs", "--conditions=react-server", "--env-file=.env.local", "scripts/worker.ts"]]],
].map(([name, [cmd, args]]) => {
  // Sem --watch no worker: reiniciar no meio mataria transcrições/renderizações longas.
  // WORKER_SINGLE=1: único worker, então ao subir ele recupera jobs que ficaram presos.
  const p = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, WORKER_SINGLE: "1" } });
  const tag = name === "worker" ? "\x1b[35m[worker]\x1b[0m " : "";
  const fwd = (out) => (chunk) => out.write(tag ? chunk.toString().replace(/^(?=.)/gm, tag) : chunk);
  p.stdout.on("data", fwd(process.stdout));
  p.stderr.on("data", fwd(process.stderr));
  p.on("exit", (code) => {
    console.log(`${name} saiu (código ${code})`);
    if (name === "next") shutdown(code ?? 0);
  });
  return p;
});

function shutdown(code = 0) {
  for (const p of procs) p.kill();
  process.exit(code);
}
process.on("SIGINT", () => shutdown());
process.on("SIGTERM", () => shutdown());
