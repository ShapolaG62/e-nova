const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function semAcento(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function slugify(s) {
  return semAcento(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'site';
}

function hash(s) {
  let h = 2166136261;
  for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return h;
}

// Escolha determinística (mesma empresa = mesma escolha), com "semente" para variar.
function escolher(lista, semente) {
  return lista[hash(semente) % lista.length];
}

function primeiroNome(nome) {
  return String(nome || '').trim().split(/\s+/)[0] || '';
}

function iniciais(nome) {
  const p = String(nome || '').replace(/[^\p{L}\s]/gu, '').split(/\s+/).filter((w) => w.length > 2);
  return ((p[0]?.[0] || nome?.[0] || '') + (p[1]?.[0] || '')).toUpperCase();
}

// Telefone brasileiro → dígitos, celular? e número de WhatsApp (55 + DDD + número)
function telefoneBR(t) {
  let d = String(t || '').replace(/\D/g, '');
  if (d.startsWith('55') && d.length >= 12) d = d.slice(2);
  d = d.replace(/^0+/, '');
  const celular = d.length === 11 && d[2] === '9';
  return { digitos: d, celular, whatsapp: celular ? '55' + d : '' };
}

function formatarTelefone(d) {
  d = String(d || '').replace(/\D/g, '');
  if (d.startsWith('55') && d.length >= 12) d = d.slice(2);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return d;
}

export { esc, semAcento, slugify, hash, escolher, primeiroNome, iniciais, telefoneBR, formatarTelefone };
