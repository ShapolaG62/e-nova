import "server-only";
import { randomBytes } from "node:crypto";
import os from "node:os";
import { sign, verifySignature } from "@/lib/crypto";
import { deleteObject, getObjectBuffer, putFile, putObject } from "@/lib/storage";
import { mimeDe, nomeSeguro, novoId } from "./arquivos";

/**
 * "Transferir para o celular": uma mesa de arquivos temporária, aberta por link com token assinado
 * (o celular não precisa fazer login). Os arquivos ficam no storage em ferramentas/celular/<sessão>/.
 */
export const VALIDADE_SESSAO_S = 2 * 3600;
export const MAX_ARQUIVOS = 60;
const SESSAO_RE = /^[a-f0-9]{32}$/;

export type ItemMesa = { id: string; nome: string; tamanho: number; origem: "pc" | "celular"; em: string };

export function criarSessao() {
  const sessao = randomBytes(16).toString("hex");
  const exp = Math.floor(Date.now() / 1000) + VALIDADE_SESSAO_S;
  return { sessao, exp, token: `${sessao}.${exp}.${sign(`celular:${sessao}:${exp}`)}` };
}

export function conferirToken(token: string | null): { sessao: string; exp: number } | null {
  const [sessao, exp, sig] = String(token ?? "").split(".");
  if (!sessao || !exp || !sig || !SESSAO_RE.test(sessao) || !/^\d+$/.test(exp)) return null;
  if (Number(exp) < Date.now() / 1000) return null;
  if (!verifySignature(`celular:${sessao}:${exp}`, sig)) return null;
  return { sessao, exp: Number(exp) };
}

const chaveLista = (sessao: string) => `ferramentas/celular/${sessao}/lista.json`;

export async function lerMesa(sessao: string): Promise<ItemMesa[]> {
  try {
    return JSON.parse((await getObjectBuffer(chaveLista(sessao))).toString()) as ItemMesa[];
  } catch {
    return [];
  }
}

// uma alteração por vez na lista de cada sessão (vários envios ao mesmo tempo)
const filas = new Map<string, Promise<unknown>>();
function emFila<T>(sessao: string, fn: () => Promise<T>): Promise<T> {
  const anterior = filas.get(sessao) ?? Promise.resolve();
  const atual = anterior.catch(() => {}).then(fn);
  filas.set(sessao, atual);
  void atual.finally(() => {
    if (filas.get(sessao) === atual) filas.delete(sessao);
  }).catch(() => {});
  return atual;
}

export async function adicionarNaMesa(sessao: string, caminho: string, nome: string, origem: ItemMesa["origem"]) {
  const atual = await lerMesa(sessao);
  if (atual.length >= MAX_ARQUIVOS) throw new Error(`Limite de ${MAX_ARQUIVOS} arquivos por sessão. Comece uma nova.`);
  const id = novoId();
  const seguro = nomeSeguro(nome);
  const tamanho = await putFile(`ferramentas/celular/${sessao}/${id}/${seguro}`, caminho, mimeDe(seguro));
  return emFila(sessao, async () => {
    const lista = await lerMesa(sessao);
    const item: ItemMesa = { id, nome: seguro, tamanho, origem, em: new Date().toISOString() };
    lista.push(item);
    await putObject(chaveLista(sessao), JSON.stringify(lista), "application/json");
    return item;
  });
}

export async function itemDaMesa(sessao: string, id: string) {
  const item = (await lerMesa(sessao)).find((i) => i.id === id);
  return item ? { ...item, key: `ferramentas/celular/${sessao}/${item.id}/${item.nome}` } : null;
}

export async function removerDaMesa(sessao: string, id: string) {
  return emFila(sessao, async () => {
    const lista = await lerMesa(sessao);
    const item = lista.find((i) => i.id === id);
    if (!item) return;
    await deleteObject(`ferramentas/celular/${sessao}/${item.id}/${item.nome}`).catch(() => {});
    await putObject(chaveLista(sessao), JSON.stringify(lista.filter((i) => i.id !== id)), "application/json");
  });
}

/** IP do computador na rede local (Wi-Fi/cabo), ignorando adaptadores virtuais. */
export function ipLocal(): string | null {
  const ruim = /virtual|vmware|hyper-v|vethernet|virtualbox|loopback|parsec|zerotier|tailscale|wsl|docker|bluetooth/i;
  const cands: string[] = [];
  for (const [nome, lista] of Object.entries(os.networkInterfaces())) {
    if (ruim.test(nome)) continue;
    for (const a of lista ?? []) if (a.family === "IPv4" && !a.internal) cands.push(a.address);
  }
  return cands.find((c) => c.startsWith("192.168.")) ?? cands.find((c) => c.startsWith("10.")) ?? cands.find((c) => /^172\.(1[6-9]|2\d|3[01])\./.test(c)) ?? cands[0] ?? null;
}

/** Página simples (HTML puro) que o celular abre: lista, baixa e envia arquivos. */
export function paginaCelular(token: string, exp: number) {
  const dados = JSON.stringify({ token, exp }).replace(/</g, "\\u003c");
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>E-Nova • Transferir arquivos</title><style>
:root{color-scheme:light dark;--bg:#f6f6f8;--card:#fff;--fg:#17171c;--mut:#6b6f7a;--acc:#5b5bd6;--line:#e3e4ea}
@media (prefers-color-scheme:dark){:root{--bg:#0f1014;--card:#1a1c22;--fg:#f2f3f5;--mut:#9aa0ab;--line:#2a2d36;--acc:#8b8bf0}}
*{box-sizing:border-box}html,body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.45 -apple-system,Segoe UI,Roboto,sans-serif}
body{padding:20px 16px 48px;max-width:560px;margin:auto}h1{font-size:21px;margin:0 0 4px}p.sub{color:var(--mut);margin:0 0 18px;font-size:14px}
h2{font-size:15px;margin:24px 0 10px;color:var(--mut);font-weight:600;text-transform:uppercase;letter-spacing:.04em}
.btn{display:block;width:100%;min-height:52px;padding:14px;border:0;border-radius:14px;background:var(--acc);color:#fff;font-size:16px;font-weight:600;cursor:pointer}
.item{display:flex;align-items:center;gap:12px;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:12px 14px;margin-bottom:10px;text-decoration:none;color:var(--fg);min-height:56px}
.item b{flex:1;min-width:0;overflow-wrap:anywhere;font-weight:600;font-size:15px}.item small{color:var(--mut);white-space:nowrap}
.tag{font-size:11px;border-radius:99px;padding:2px 8px;background:var(--line);color:var(--mut)}
.bar{height:6px;border-radius:3px;background:var(--line);overflow:hidden;margin-top:8px}.bar i{display:block;height:100%;background:var(--acc);width:0;transition:width .2s}
.vazio{color:var(--mut);text-align:center;padding:24px 0;font-size:14px}.aviso{color:var(--mut);font-size:13px;margin-top:22px;text-align:center}
</style></head><body>
<h1>Transferir arquivos</h1><p class="sub">Envie do celular para o E-Nova ou baixe o que foi mandado do computador.</p>
<input type="file" id="f" multiple hidden><button class="btn" id="b">Enviar arquivos do celular</button>
<div id="env"></div><h2>Arquivos na mesa</h2><div id="l"><div class="vazio">Carregando…</div></div>
<p class="aviso" id="exp"></p>
<script>
const D=${dados};const BASE=location.pathname;const q=(o)=>BASE+'?'+new URLSearchParams(Object.assign({t:D.token},o));
const esc=s=>String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const fmt=b=>b>1e9?(b/1e9).toFixed(1).replace('.',',')+' GB':b>1e6?(b/1e6).toFixed(1).replace('.',',')+' MB':Math.max(1,Math.round(b/1e3))+' KB';
const l=document.getElementById('l'),env=document.getElementById('env'),f=document.getElementById('f');
document.getElementById('exp').textContent='Este link vale até '+new Date(D.exp*1000).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})+'.';
async function lista(){try{const r=await fetch(q({acao:'lista'}),{cache:'no-store'});if(r.status===410||r.status===403){l.innerHTML='<div class="vazio">Este link expirou. Gere um novo QR Code no computador.</div>';return false;}
const j=await r.json();l.innerHTML=j.itens.length?j.itens.slice().reverse().map(x=>'<a class="item" href="'+esc(q({acao:'baixar',id:x.id}))+'" download="'+esc(x.nome)+'"><b>'+esc(x.nome)+'</b><span class="tag">'+(x.origem==='pc'?'do computador':'do celular')+'</span><small>'+fmt(x.tamanho)+'</small></a>').join(''):'<div class="vazio">Nenhum arquivo ainda.</div>';}catch(e){l.innerHTML='<div class="vazio">Sem conexão com o E-Nova.</div>';}return true;}
document.getElementById('b').onclick=()=>f.click();
f.onchange=async()=>{for(const file of f.files){const row=document.createElement('div');row.className='item';row.style.display='block';
row.innerHTML='<b>'+esc(file.name)+'</b> <small>'+fmt(file.size)+'</small><div class="bar"><i></i></div>';env.prepend(row);const bar=row.querySelector('i');
await new Promise(res=>{const x=new XMLHttpRequest();x.open('PUT',q({nome:file.name,origem:'celular'}));
x.upload.onprogress=e=>{if(e.lengthComputable)bar.style.width=(e.loaded/e.total*100)+'%'};
x.onload=()=>{let msg='Enviado ✓';if(x.status>=300){try{msg=JSON.parse(x.responseText).erro||'Falhou'}catch(_){msg='Falhou'}}else bar.style.width='100%';row.querySelector('small').textContent=msg;res()};
x.onerror=()=>{row.querySelector('small').textContent='Falhou';res()};x.send(file);});lista();}f.value='';};
lista();const iv=setInterval(async()=>{if(!(await lista()))clearInterval(iv)},3000);
</script></body></html>`;
}
