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

// FreeLLMAPI (IAs grátis): sobe junto se a pasta existir e a porta 3001 estiver livre.
// Pasta padrão: Desktop\.Agente  Editor Automatico\freellmapi-main\freellmapi-main (ou FREELLMAPI_DIR).
import { existsSync } from "node:fs";
import net from "node:net";
import path from "node:path";
const pastaFree = process.env.FREELLMAPI_DIR ?? path.resolve("..", "..", "freellmapi-main", "freellmapi-main");
const portaOcupada = await new Promise((ok) => {
  const s = net.connect(3001, "127.0.0.1", () => { s.end(); ok(true); });
  s.on("error", () => ok(false));
});
if (!portaOcupada && existsSync(path.join(pastaFree, "server", "dist", "index.js")) && existsSync(path.join(pastaFree, ".env"))) {
  const p = spawn(process.execPath, ["--env-file=.env", "server/dist/index.js"], { cwd: pastaFree, stdio: ["ignore", "pipe", "pipe"] });
  const tag = "\x1b[36m[freellmapi]\x1b[0m ";
  // só mostra as linhas importantes (o servidor é falante); nunca imprime chaves
  const fwd = (chunk) => chunk.toString().split(/\r?\n/).filter((l) => /running|error|erro|fail/i.test(l)).forEach((l) => console.log(tag + l));
  p.stdout.on("data", fwd);
  p.stderr.on("data", fwd);
  procs.push(p);
} else if (!portaOcupada) {
  console.log("\x1b[36m[freellmapi]\x1b[0m não encontrada em " + pastaFree + " (as IAs grátis da FreeLLMAPI ficam desligadas)");
}

function shutdown(code = 0) {
  for (const p of procs) p.kill();
  process.exit(code);
}
process.on("SIGINT", () => shutdown());
process.on("SIGTERM", () => shutdown());
