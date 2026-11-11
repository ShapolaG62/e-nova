// Roteiros de abordagem: 5 mensagens de WhatsApp, roteiro de ligação e respostas a objeções.
import { setor as pegarSetor } from './setores.js';
import { escolher } from './util.js';

function contexto(lead, config) {
  const st = pegarSetor(lead.setor);
  return {
    st,
    eu: config.seuNome || '[seu nome]',
    euEmpresa: config.suaEmpresa ? ` da ${config.suaEmpresa}` : '',
    empresa: lead.nome,
    cidade: lead.cidade || 'sua cidade',
    nota: lead.nota ? String(lead.nota).replace('.', ',') : '',
    aval: lead.avaliacoes || 0,
    objetivo: config.objetivo || 'agendar uma conversa',
    rede: lead.situacaoSite === 'rede',
  };
}

function abordagemPadrao(lead, config, link) {
  const c = contexto(lead, config);
  const elogio = c.nota && c.aval ? `Vi que vocês têm nota ${c.nota} no Google com ${c.aval} avaliações, isso é muito bom!` : 'Vi o perfil de vocês no Google e gostei muito do trabalho.';
  return {
    resumo: { empresa: c.empresa, nicho: c.st.nome, cidade: c.cidade, objetivo: c.objetivo },
    mensagens: [
      { etapa: 'Abertura', dica: 'Quebre o gelo. Não fale de venda ainda.',
        texto: escolher([`Oi, tudo bem? Falo com o responsável por ${c.empresa}?`, `Olá! Tudo bem? Aqui é ${c.eu}. Esse é o WhatsApp de ${c.empresa}?`], c.empresa) },
      { etapa: 'Apresentação', dica: 'Diga quem você é em uma frase.',
        texto: `Prazer! Sou ${c.eu}${c.euEmpresa}, trabalho criando sites para ${c.st.nome.toLowerCase()} aqui em ${c.cidade}. ${elogio}` },
      { etapa: 'Diagnóstico', dica: 'Mostre o problema sem criticar.',
        texto: c.rede
          ? `Reparei que hoje quem procura vocês no Google cai direto no Instagram. Muita gente desiste ali, porque não acha serviços, preços e o botão para ${c.st.vocab.acao} de forma rápida.`
          : `Procurei ${c.empresa} no Google e não achei um site, só o cadastro no Maps. Quem pesquisa "${c.st.busca || c.st.nome} em ${c.cidade}" acaba indo para a concorrência que aparece com site.` },
      { etapa: 'Proposta de valor', dica: 'Fale de resultado, não de tecnologia.',
        texto: `Um site simples, rápido e com botão direto para o WhatsApp faz vocês aparecerem melhor no Google e passa mais confiança para quem ainda não conhece. ${link ? 'Inclusive já montei uma prévia para vocês verem como ficaria:\n' + link : 'Posso montar uma prévia gratuita para vocês verem como ficaria.'}` },
      { etapa: 'Fechamento', dica: 'Termine com uma pergunta fácil de responder.',
        texto: link ? 'O que achou? Se gostar, consigo deixar no ar ainda essa semana. Podemos conversar 5 minutinhos?' : 'Posso montar essa prévia e te mandar hoje ainda, sem compromisso?' },
    ],
  };
}

function mensagemEnvio(lead, config, link) {
  const c = contexto(lead, config);
  return `Olá! Tudo bem? Aqui é ${c.eu}. Vi que ${c.empresa} ainda não tem um site e montei uma prévia para vocês verem:\n${link}\n\nSe gostarem, deixo no ar com domínio próprio. Posso te explicar como funciona?`;
}

function ligacaoPadrao(lead, config) {
  const c = contexto(lead, config);
  return [
    { etapa: 'Abertura (10s)', fala: `Bom dia! Aqui é ${c.eu}. Falo com o responsável por ${c.empresa}?`, coach: 'Sorria ao falar: dá para ouvir. Fale o nome da empresa, isso prende a atenção.' },
    { etapa: 'Motivo da ligação', fala: `Estou ligando rapidinho porque pesquisei ${c.st.nome.toLowerCase()} em ${c.cidade} no Google e vi que vocês ainda não têm site.`, coach: 'Seja breve. Não peça "um minutinho"; vá direto ao motivo.' },
    { etapa: 'Pergunta de diagnóstico', fala: 'Hoje a maioria dos clientes chega até vocês como? Indicação, Instagram, Google?', coach: 'Deixe a pessoa falar. Anote a resposta: ela vai usar isso para decidir.' },
    { etapa: 'Proposta', fala: 'Eu monto um site com os serviços de vocês e um botão direto para o WhatsApp. Posso te mandar uma prévia pronta, sem compromisso?', coach: 'O "sem compromisso" reduz a resistência. A prévia vende por você.' },
    { etapa: 'Fechamento', fala: 'Qual o melhor WhatsApp para eu te mandar?', coach: 'Pergunta fechada e fácil. Se disser "manda aqui mesmo", confirme o número.' },
  ];
}

const OBJECOES = [
  { objecao: 'Não preciso, tenho Instagram.', resposta: 'O Instagram é ótimo para quem já te segue. O site é para quem ainda não te conhece e está pesquisando no Google agora. Um complementa o outro: o site até manda as pessoas para o seu Instagram.' },
  { objecao: 'Está caro.', resposta: 'Entendo. Pensa assim: se o site trouxer um cliente novo por mês, ele já se paga. E o valor é único, não é mensalidade de agência. Quer que eu te mostre as opções de pagamento?' },
  { objecao: 'Agora não é um bom momento.', resposta: 'Sem problema! A prévia já está pronta, então não toma tempo nenhum seu. Posso te chamar na semana que vem para você dar uma olhada com calma?' },
  { objecao: 'Vou pensar.', resposta: 'Claro! Pra te ajudar a pensar: o que mais pesa na sua decisão, o valor, o tempo ou se vai trazer cliente mesmo?' },
  { objecao: 'Já tive site e não deu resultado.', resposta: 'Isso é comum quando o site é lento ou não tem um caminho claro para o WhatsApp. Esse modelo é feito para converter: abre rápido no celular e cada botão leva para a conversa com você.' },
  { objecao: 'Meu sobrinho faz.', resposta: 'Que bom ter alguém de confiança! Se quiser, fica com a prévia como referência. E se ele não tiver tempo, eu consigo entregar essa semana.' },
];

export { abordagemPadrao, ligacaoPadrao, mensagemEnvio, OBJECOES, contexto };
