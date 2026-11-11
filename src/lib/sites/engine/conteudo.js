// Monta o "documento" do site: dados do negócio + blocos com textos.
// Sem IA usa textos prontos por setor e tom de voz; com Gemini, reescreve tudo sob medida.
import { setor as pegarSetor } from './setores.js';
import { escolher } from './util.js';
const novoIdCurto = () => Math.random().toString(36).slice(2, 8);

const TONS = {
  profissional: 'Profissional e sóbrio',
  acolhedor: 'Acolhedor e próximo',
  direto: 'Direto e objetivo',
  premium: 'Sofisticado e premium',
};

// Títulos do topo por tom. {lugar} = "a barbearia", {cidade}, {nome}
const TITULOS = {
  profissional: [['Qualidade e confiança em {cidade}', ['confiança']], ['O cuidado que você procura, perto de você', ['cuidado']], ['Referência em {setor} em {cidade}', ['Referência']]],
  acolhedor: [['Aqui você é recebido como em casa', ['em casa']], ['Feito com carinho para você', ['carinho']], ['O seu lugar favorito em {cidade}', ['favorito']]],
  direto: [['Resolva hoje. Sem enrolação.', ['hoje']], ['Rápido, bem feito e com preço justo', ['bem feito']], ['Chame no WhatsApp e resolva agora', ['agora']]],
  premium: [['Excelência em cada detalhe', ['Excelência']], ['Uma experiência à altura do seu padrão', ['experiência']], ['O padrão mais alto de {cidade}', ['mais alto']]],
};

const SUBS = {
  profissional: 'Atendimento sério, profissionais experientes e o compromisso de entregar o que foi combinado. {Acao} pelo WhatsApp.',
  acolhedor: 'Atendimento de gente que gosta do que faz, num ambiente onde você se sente bem. Vem {acao} com a gente.',
  direto: 'Sem fila, sem burocracia e sem surpresa no preço. Mande uma mensagem e {acao} em minutos.',
  premium: 'Técnica apurada, atenção individual e um atendimento pensado para quem não abre mão de qualidade.',
};

const DIFERENCIAIS = [
  ['Atendimento de verdade', 'Você fala com quem entende, sem robô e sem enrolação.'],
  ['Pontualidade', 'Respeitamos o seu tempo: horário marcado é horário cumprido.'],
  ['Preço transparente', 'Você sabe o valor antes de começar. Nada de surpresa.'],
  ['Experiência', 'Anos de prática e {clientes} que voltam e indicam.'],
  ['Qualidade comprovada', 'Nota {nota} no Google com {avaliacoes} avaliações.'],
  ['Fácil de falar', 'Respondemos rápido pelo WhatsApp, inclusive para tirar dúvidas.'],
];

const PASSOS = [
  ['Chame no WhatsApp', 'Conte o que você precisa. A gente responde rapidinho.'],
  ['{AcaoCurta}', 'Combinamos o melhor dia e horário para você.'],
  ['Pronto!', 'Você é atendido com todo o cuidado e sai satisfeito.'],
];

const FAQ = [
  ['Como faço para {acao}?', 'É só clicar no botão de WhatsApp aqui no site e mandar uma mensagem. Respondemos rapidinho.'],
  ['Qual o horário de atendimento?', '{horario}'],
  ['Onde vocês ficam?', 'Estamos em {endereco}. No fim da página tem o mapa com o caminho.'],
  ['Quais formas de pagamento vocês aceitam?', 'Aceitamos Pix, cartões de débito e crédito e dinheiro.'],
  ['Preciso marcar com antecedência?', 'Recomendamos chamar antes para garantir o melhor horário para você.'],
];

const DEPO_EXEMPLO = [
  ['Ana P.', 'Atendimento impecável do começo ao fim. Me senti muito bem cuidada e já indiquei para a família.'],
  ['Ricardo M.', 'Profissionais de verdade. Pontuais, caprichosos e com preço justo. Recomendo de olhos fechados.'],
  ['Juliana S.', 'Melhor experiência que tive na região. Ambiente ótimo e resultado acima do esperado.'],
];

function trocar(txt, v) {
  return String(txt).replace(/\{(\w+)\}/g, (_, k) => (v[k] !== undefined ? v[k] : `{${k}}`));
}

function horarioTexto(horarios) {
  if (!horarios?.length) return 'Chame no WhatsApp para confirmar o horário de hoje.';
  return horarios.map((h) => h.replace('-feira', '')).join(' · ');
}

const bloco = (tipo, dados) => ({ id: tipo + '_' + novoIdCurto(), tipo, visivel: true, dados });

function textosBase(neg, st, op) {
  const tom = TONS[op.tom] ? op.tom : 'profissional';
  const sem = neg.nome + neg.cidade;
  const v = {
    nome: neg.nome, cidade: neg.cidade || 'sua cidade', setor: st.nome.toLowerCase(), lugar: st.vocab.lugar,
    cliente: st.vocab.cliente, clientes: st.vocab.clientes, acao: st.vocab.acao,
    Acao: st.vocab.acao.replace(/^\w/, (c) => c.toUpperCase()),
    AcaoCurta: st.vocab.acao.split(' ')[0].replace(/^\w/, (c) => c.toUpperCase()),
    nota: neg.nota ? String(neg.nota).replace('.', ',') : '5,0', avaliacoes: neg.avaliacoes || 'dezenas de',
    endereco: neg.endereco || neg.cidade || 'nossa região', horario: horarioTexto(neg.horarios),
  };
  const [tit, dest] = escolher(TITULOS[tom], sem);
  const servSel = st.servicos.filter(([n]) => !op.servicos || op.servicos.includes(n));
  const extras = (op.servicos || []).filter((n) => !st.servicos.some(([s]) => s === n)).map((n) => [n, 'Fale com a gente pelo WhatsApp para saber mais.']);
  const servicos = [...servSel, ...extras].slice(0, 9);
  const temNota = neg.nota && neg.avaliacoes;
  const reviews = neg.reviews?.length ? neg.reviews : null;

  const blocos = [
    bloco('topo', {
      linhaCima: `${st.nome} em ${v.cidade}`,
      titulo: trocar(tit, v), destaques: dest,
      subtitulo: trocar(SUBS[tom], v),
      botao: st.vocab.cta, botao2: 'Ver serviços',
      provas: [temNota ? `★ ${v.nota} no Google` : 'Atendimento pelo WhatsApp', temNota ? `${neg.avaliacoes} avaliações` : 'Resposta rápida', neg.bairro || v.cidade].filter(Boolean),
    }),
    bloco('numeros', {
      itens: [
        { valor: temNota ? v.nota : '5,0', rotulo: 'nota no Google', exemplo: !temNota },
        { valor: temNota ? `${neg.avaliacoes}+` : '300+', rotulo: `${st.vocab.clientes} avaliaram`, exemplo: !temNota },
        { valor: String(servicos.length), rotulo: 'serviços', exemplo: false },
        { valor: '100%', rotulo: 'atendimento no WhatsApp', exemplo: false },
      ],
    }),
    bloco('servicos', {
      etiqueta: 'O que fazemos', titulo: 'Nossos serviços', destaques: ['serviços'],
      intro: `Tudo o que você precisa em ${st.vocab.lugar}, com a qualidade que você merece.`,
      itens: servicos.map(([titulo, texto]) => ({ titulo, texto })),
    }),
    bloco('diferenciais', {
      etiqueta: 'Por que aqui', titulo: `Por que escolher ${st.vocab.lugar === 'a empresa' ? 'a gente' : st.vocab.lugar}`, destaques: ['escolher'],
      intro: `O que faz ${st.vocab.clientes} voltarem e indicarem.`,
      itens: DIFERENCIAIS.filter((d, i) => temNota || i !== 4).slice(0, 4).map(([t, x]) => ({ titulo: trocar(t, v), texto: trocar(x, v) })),
    }),
    bloco('passos', {
      etiqueta: 'Como funciona', titulo: 'Simples assim', destaques: ['Simples'],
      itens: PASSOS.map(([t, x]) => ({ titulo: trocar(t, v), texto: trocar(x, v) })),
    }),
    bloco('galeria', { etiqueta: 'Nosso espaço', titulo: `Conheça ${st.vocab.lugar}`, destaques: ['Conheça'], fotos: [] }),
    bloco('historia', {
      etiqueta: 'Nossa história', titulo: `Sobre ${neg.nome}`, destaques: [],
      texto: `${neg.nome} nasceu com um objetivo simples: oferecer em ${v.cidade} um atendimento de verdade, com qualidade e preço justo. Cada ${st.vocab.cliente} é tratado com atenção, e é por isso que tanta gente volta e indica.\n\nAqui você encontra profissionais que gostam do que fazem e um time pronto para te ajudar. Venha conhecer.`,
    }),
    bloco('depoimentos', {
      etiqueta: 'Depoimentos', titulo: `O que dizem nossos ${st.vocab.clientes}`, destaques: [st.vocab.clientes],
      itens: reviews ? reviews.slice(0, 3).map((r) => ({ nome: r.nome, texto: r.texto, nota: r.nota || 5 })) : DEPO_EXEMPLO.map(([nome, texto]) => ({ nome, texto, nota: 5, exemplo: true })),
    }),
    bloco('faq', {
      etiqueta: 'Dúvidas', titulo: 'Perguntas frequentes', destaques: [],
      itens: FAQ.map(([p, r]) => ({ pergunta: trocar(p, v), resposta: trocar(r, v) })),
    }),
    bloco('cta', {
      titulo: `Vamos ${st.vocab.acao.split(' ')[0]}?`, destaques: [],
      texto: 'Mande uma mensagem agora e seja atendido rapidinho.',
      botao: st.vocab.cta,
    }),
    bloco('contato', { etiqueta: 'Contato', titulo: 'Onde estamos', destaques: [], texto: 'Venha nos visitar ou chame no WhatsApp.' }),
  ];
  return blocos;
}

function montarDocumento(neg, opcoes = {}) {
  const st = pegarSetor(opcoes.setor || neg.setor);
  const cores = opcoes.cores?.length ? opcoes.cores : st.cores.map((c) => c[1]);
  return {
    versao: 1,
    layout: opcoes.layout || st.visuais[0],
    tema: opcoes.tema || 'auto',
    cores: { primaria: cores[0], secundaria: cores[1] || cores[0] },
    setor: st.id,
    tom: opcoes.tom || 'profissional',
    negocio: {
      nome: neg.nome, cidade: neg.cidade || '', uf: neg.uf || '', bairro: neg.bairro || '', endereco: neg.endereco || '',
      telefone: neg.telefone || '', whatsapp: neg.whatsapp || '', instagram: neg.instagram || '',
      horarios: neg.horarios || [], nota: neg.nota || null, avaliacoes: neg.avaliacoes || 0,
      mapa: neg.mapa || '', lat: neg.lat, lng: neg.lng,
    },
    fotos: { capa: opcoes.fotos?.[0] || '', lista: opcoes.fotos || [] },
    animacoes: { entrada: true, contadores: true, progresso: true, parallax: false, flutuante: true },
    blocos: textosBase(neg, st, opcoes),
  };
}

export { montarDocumento, TONS, bloco };
