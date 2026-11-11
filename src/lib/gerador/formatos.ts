// Formatos de vídeo que o Gerador sabe fazer só com imagem/vídeo gerado + narração.
// A estrutura vai para o diretor de IA como ponto de partida (ele adapta ao tema).
// Arquivo sem "server-only": a tela também usa a lista.

export type Formato = {
  id: string;
  nome: string;
  descricao: string;
  estrutura: string;
  cenaSeg: [number, number]; // duração típica de cada cena (mín, máx)
};

export const FORMATOS: Formato[] = [
  {
    id: "voce-decide",
    nome: "“Você decide” (história interativa)",
    descricao: "Suspense em episódios que termina com o público escolhendo A ou B nos comentários.",
    estrutura: "Abre com uma pergunta direta ao espectador ou com o resultado da votação anterior (“Vocês escolheram… e ela venceu”) → situação estranha descrita com detalhes concretos e sensoriais, frases curtíssimas no presente → a tensão sobe em degraus (um som, uma luz, uma mensagem, uma regra) → uma “regra” ou pista que o público pode usar → o perigo chega perto → corte no pior momento → duas opções claras e opostas, A e B → “Comente A ou B: a mais votada decide o próximo episódio”.",
    cenaSeg: [2.5, 5],
  },
  {
    id: "explicativo",
    nome: "Explicativo narrado",
    descricao: "Explica uma ideia, um serviço ou um “como funciona” em poucos passos.",
    estrutura: "Gancho com a pergunta ou o problema → contexto em uma frase → 2 a 4 passos, cada um com uma imagem que mostra o passo → resumo que fecha a ideia → chamada para ação.",
    cenaSeg: [3, 6],
  },
  {
    id: "ranking",
    nome: "Ranking / lista",
    descricao: "“5 erros que…”, “3 lugares para…”: itens numerados, do menos ao mais forte.",
    estrutura: "Gancho que promete a lista → itens em contagem regressiva, cada um com número na tela e imagem própria → o item mais forte por último → chamada para ação.",
    cenaSeg: [3, 5],
  },
  {
    id: "historia",
    nome: "História curta",
    descricao: "Mini-história narrada com começo, virada e final.",
    estrutura: "Abre no momento de tensão → apresenta o personagem e o que ele quer → obstáculo → virada → desfecho que responde ao gancho. Mesmo personagem e mesmo lugar em todas as cenas.",
    cenaSeg: [3, 6],
  },
  {
    id: "produto",
    nome: "Anúncio de produto ou serviço",
    descricao: "Apresenta um produto/serviço local com benefício claro e chamada.",
    estrutura: "Gancho com a dor ou o desejo do cliente → o produto aparecendo como solução → 2 ou 3 benefícios concretos, cada um com uma imagem → prova (resultado, detalhe, bastidor) → oferta e chamada para ação.",
    cenaSeg: [2.5, 5],
  },
  {
    id: "dicas",
    nome: "Dicas rápidas",
    descricao: "Dicas práticas e diretas para o público do cliente.",
    estrutura: "Gancho com o benefício (“faça isso e…”) → dicas curtas, uma por cena, com texto na tela → dica bônus ou resumo → chamada para seguir/salvar.",
    cenaSeg: [3, 5],
  },
  {
    id: "curiosidade",
    nome: "Curiosidade / “você sabia?”",
    descricao: "Um fato surpreendente explicado em sequência de revelações.",
    estrutura: "Gancho com o fato mais surpreendente → por que isso acontece, em revelações curtas → a consequência para quem assiste → fecho com uma frase marcante.",
    cenaSeg: [3, 6],
  },
];

export const formato = (id: string) => FORMATOS.find((f) => f.id === id) ?? FORMATOS[0];

export const DIMENSOES: Record<"9:16" | "16:9" | "1:1", [number, number]> = {
  "9:16": [1080, 1920],
  "16:9": [1920, 1080],
  "1:1": [1080, 1080],
};
