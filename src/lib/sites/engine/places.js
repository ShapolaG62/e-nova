// Busca no Google Maps (Places API New), classifica e dá nota de oportunidade.
import { telefoneBR } from './util.js';

const CAMPOS = [
  'places.id', 'places.displayName', 'places.formattedAddress', 'places.shortFormattedAddress',
  'places.nationalPhoneNumber', 'places.internationalPhoneNumber', 'places.websiteUri',
  'places.rating', 'places.userRatingCount', 'places.regularOpeningHours', 'places.photos',
  'places.primaryType', 'places.primaryTypeDisplayName', 'places.types', 'places.googleMapsUri',
  'places.reviews', 'places.location', 'places.businessStatus', 'places.addressComponents', 'nextPageToken',
].join(',');

const PAISES = {
  BR: { nome: 'Brasil', idioma: 'pt-BR', ddi: '55', moeda: 'BRL' },
  PT: { nome: 'Portugal', idioma: 'pt-PT', ddi: '351', moeda: 'EUR' },
  US: { nome: 'Estados Unidos', idioma: 'en', ddi: '1', moeda: 'USD' },
  ES: { nome: 'Espanha', idioma: 'es', ddi: '34', moeda: 'EUR' },
  MX: { nome: 'México', idioma: 'es', ddi: '52', moeda: 'MXN' },
  AR: { nome: 'Argentina', idioma: 'es', ddi: '54', moeda: 'ARS' },
  CL: { nome: 'Chile', idioma: 'es', ddi: '56', moeda: 'CLP' },
  CO: { nome: 'Colômbia', idioma: 'es', ddi: '57', moeda: 'COP' },
  PY: { nome: 'Paraguai', idioma: 'es', ddi: '595', moeda: 'PYG' },
  UY: { nome: 'Uruguai', idioma: 'es', ddi: '598', moeda: 'UYU' },
};

// Instagram/Facebook/link de WhatsApp cadastrado como "site" = na prática não tem site.
const SO_REDE = /(instagram\.com|facebook\.com|fb\.com|linktr\.ee|wa\.me|whatsapp\.com|tiktok\.com|ifood\.com|bio\.link|beacons\.ai|linkbio|taplink)/i;

function telefone(p, pais) {
  if (pais === 'BR') return telefoneBR(p.nationalPhoneNumber);
  const intl = String(p.internationalPhoneNumber || '').replace(/\D/g, '');
  return { digitos: intl, celular: !!intl, whatsapp: intl }; // fora do BR não dá para saber se é celular
}

// Nota de 0 a 100: quanto maior, mais esse negócio precisa (e pode pagar) um site.
function notaOportunidade(l) {
  let n = 0;
  if (l.situacaoSite === 'sem') n += 40;
  else if (l.situacaoSite === 'rede') n += 34;
  else n += 5;
  if (l.whatsapp) n += 15; else if (l.telefone) n += 6;
  const av = l.avaliacoes || 0;
  n += Math.min(22, Math.round(Math.log10(av + 1) * 10)); // negócio movimentado
  if ((l.nota || 0) >= 4.5) n += 10; else if ((l.nota || 0) >= 4) n += 6;
  if (l.fotos?.length >= 3) n += 5;
  if (l.instagram) n += 3;
  if (l.horarios?.length) n += 3;
  return Math.max(1, Math.min(100, n));
}

function extrair(p, pais) {
  const site = p.websiteUri || '';
  const tel = telefone(p, pais);
  const comp = p.addressComponents || [];
  const cidade = comp.find((c) => c.types?.includes('administrative_area_level_2'))?.longText || '';
  const uf = comp.find((c) => c.types?.includes('administrative_area_level_1'))?.shortText || '';
  const bairro = comp.find((c) => c.types?.includes('sublocality_level_1') || c.types?.includes('sublocality'))?.longText || '';
  const insta = /instagram\.com\/([^/?#]+)/i.exec(site)?.[1] || '';
  const l = {
    id: 'g_' + p.id,
    placeId: p.id,
    nome: p.displayName?.text || 'Empresa',
    endereco: p.formattedAddress || '',
    enderecoCurto: p.shortFormattedAddress || '',
    cidade, uf, bairro, pais,
    telefone: p.nationalPhoneNumber || p.internationalPhoneNumber || '',
    whatsapp: tel.whatsapp,
    celular: tel.celular,
    nota: p.rating || null,
    avaliacoes: p.userRatingCount || 0,
    horarios: p.regularOpeningHours?.weekdayDescriptions || [],
    fotos: (p.photos || []).slice(0, 10).map((f) => f.name),
    tipo: p.primaryType || '',
    tipos: p.types || [],
    tipoNome: p.primaryTypeDisplayName?.text || '',
    mapa: p.googleMapsUri || '',
    lat: p.location?.latitude, lng: p.location?.longitude,
    site: site && !SO_REDE.test(site) ? site : '',
    redeSocial: SO_REDE.test(site) ? site : '',
    instagram: insta ? '@' + insta : '',
    situacaoSite: !site ? 'sem' : SO_REDE.test(site) ? 'rede' : 'tem',
    reviews: (p.reviews || [])
      .filter((r) => (r.rating || 0) >= 4 && r.text?.text?.length > 25)
      .slice(0, 5)
      .map((r) => ({ nome: r.authorAttribution?.displayName || 'Cliente', nota: r.rating, texto: r.text.text.slice(0, 320) })),
    origem: 'google',
  };
  l.oportunidade = notaOportunidade(l);
  return l;
}

async function buscar({ termo, cidade, uf, pais = 'BR', quantidade = 10, chave, soSemSite = true }) {
  if (!chave) return demo({ termo, cidade, uf, pais, quantidade });
  const info = PAISES[pais] || PAISES.BR;
  const local = [cidade, uf, info.nome].filter(Boolean).join(', ');
  const achados = [];
  let analisadas = 0, comSite = 0, token;
  for (let pag = 0; pag < 3 && achados.length < quantidade; pag++) {
    const corpo = { textQuery: `${termo} em ${local}`, languageCode: info.idioma, regionCode: pais, pageSize: 20 };
    if (token) corpo.pageToken = token;
    const r = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': chave, 'X-Goog-FieldMask': CAMPOS },
      body: JSON.stringify(corpo),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      // status e corpo vão junto para google-erros.ts traduzir a causa
      const erro = new Error('Google: ' + (d.error?.message || r.status));
      erro.googleStatus = r.status;
      erro.googleCorpo = d;
      throw erro;
    }
    for (const p of d.places || []) {
      analisadas++;
      if (p.businessStatus && p.businessStatus !== 'OPERATIONAL') continue;
      const l = extrair(p, pais);
      if (l.situacaoSite === 'tem') { comSite++; if (soSemSite) continue; }
      achados.push(l);
      if (achados.length >= quantidade) break;
    }
    token = d.nextPageToken;
    if (!token) break;
  }
  achados.sort((a, b) => b.oportunidade - a.oportunidade);
  return { leads: achados, analisadas, comSite, semSite: achados.filter((l) => l.situacaoSite !== 'tem').length, demo: false };
}

// ---------- Um negócio só (para conferir um site já criado) ----------
const CAMPOS_UM = CAMPOS.split(',').filter((c) => c.startsWith('places.')).map((c) => c.slice(7)).join(',');
async function erroGoogle(r, d) {
  const erro = new Error('Google: ' + (d.error?.message || r.status));
  erro.googleStatus = r.status;
  erro.googleCorpo = d;
  return erro;
}
/** Pelo id do lugar (mais certeiro) ou, sem id, pelo nome + cidade (pega o primeiro resultado). */
async function umNegocio({ placeId, nome, cidade, uf, pais = 'BR', chave }) {
  const info = PAISES[pais] || PAISES.BR;
  if (placeId) {
    const r = await fetch('https://places.googleapis.com/v1/places/' + encodeURIComponent(placeId) + '?languageCode=' + info.idioma, {
      headers: { 'X-Goog-Api-Key': chave, 'X-Goog-FieldMask': CAMPOS_UM },
    });
    const d = await r.json().catch(() => ({}));
    if (r.ok) return extrair(d, pais);
    if (r.status !== 404) throw await erroGoogle(r, d);
  }
  const local = [cidade, uf, info.nome].filter(Boolean).join(', ');
  const r = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': chave, 'X-Goog-FieldMask': CAMPOS },
    body: JSON.stringify({ textQuery: nome + (local ? ' em ' + local : ''), languageCode: info.idioma, regionCode: pais, pageSize: 5 }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw await erroGoogle(r, d);
  const p = (d.places || [])[0];
  return p ? extrair(p, pais) : null;
}

// ---------- Modo demonstração (sem chave) ----------
const SUF = ['do Zé', 'Central', 'Bela Vista', 'Primavera', 'Prime', 'da Vila', 'Real', 'Express', 'Premium', 'Família', 'Nova Era', 'Point'];
const RUAS = ['Rua das Flores', 'Av. Brasil', 'Rua XV de Novembro', 'Rua São Paulo', 'Av. Getúlio Vargas', 'Rua Sete de Setembro'];
const DEPO = ['Atendimento excelente, todo mundo muito educado. Voltarei com certeza!', 'Preço justo e qualidade de verdade. Recomendo demais.', 'Fui indicado por um amigo e não me arrependi. Super caprichosos.', 'Melhor da região, sempre resolvem tudo rapidinho.', 'Lugar limpo, organizado e com profissionais que sabem o que fazem.'];
const NOMES = ['Mariana S.', 'Carlos R.', 'Juliana P.', 'Roberto A.', 'Fernanda L.', 'Lucas M.'];

function demo({ termo, cidade, uf, pais, quantidade }) {
  const base = String(termo || 'Empresa').replace(/^\w/, (c) => c.toUpperCase());
  const leads = [];
  for (let i = 0; i < quantidade; i++) {
    const cel = i % 4 !== 2;
    const d = cel ? `00 9${String(8100 + i * 37).slice(-4)}${String(1000 + i * 71).slice(-4)}` : `00 3${String(200 + i).slice(-3)}${String(4000 + i).slice(-4)}`;
    const dig = d.replace(/\D/g, '');
    const sit = i % 6 === 1 ? 'rede' : 'sem';
    const l = {
      id: `demo_${(termo + cidade).replace(/\W/g, '').toLowerCase()}_${Date.now().toString(36)}_${i}`,
      nome: `${base} ${SUF[i % SUF.length]}`,
      endereco: `${RUAS[i % RUAS.length]}, ${100 + i * 37} - Centro, ${cidade}${uf ? ' - ' + uf : ''}`,
      enderecoCurto: `${RUAS[i % RUAS.length]}, ${100 + i * 37}`,
      cidade, uf, bairro: 'Centro', pais,
      telefone: cel ? `(00) 9${dig.slice(3, 7)}-${dig.slice(7)}` : `(00) ${dig.slice(2, 6)}-${dig.slice(6)}`,
      whatsapp: cel ? '55' + dig : '', celular: cel,
      nota: Math.round((4 + ((i * 7) % 10) / 10) * 10) / 10,
      avaliacoes: 8 + ((i * 53) % 400),
      horarios: ['segunda-feira: 08:00–18:00', 'terça-feira: 08:00–18:00', 'quarta-feira: 08:00–18:00', 'quinta-feira: 08:00–18:00', 'sexta-feira: 08:00–18:00', 'sábado: 08:00–13:00', 'domingo: Fechado'],
      fotos: [], tipo: '', tipos: [], tipoNome: base,
      mapa: `https://www.google.com/maps/search/${encodeURIComponent(termo + ' ' + cidade)}`,
      site: '', redeSocial: sit === 'rede' ? 'https://instagram.com/exemplo' : '', instagram: sit === 'rede' ? '@exemplo' : '',
      situacaoSite: sit,
      reviews: [0, 1, 2].map((k) => ({ nome: NOMES[(i + k) % NOMES.length], nota: 5, texto: DEPO[(i + k) % DEPO.length] })),
      origem: 'demo', demo: true,
    };
    l.oportunidade = notaOportunidade(l);
    leads.push(l);
  }
  leads.sort((a, b) => b.oportunidade - a.oportunidade);
  return { leads, analisadas: quantidade * 2, comSite: quantidade, semSite: quantidade, demo: true };
}

export { buscar, umNegocio, notaOportunidade, PAISES };
