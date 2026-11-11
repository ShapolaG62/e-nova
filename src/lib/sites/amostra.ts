// Negócio de exemplo para pré-visualizar os visuais (tela "Visuais")
export const NEGOCIO_AMOSTRA = {
  nome: "Studio Prime", cidade: "Campinas", uf: "SP", bairro: "Cambuí",
  endereco: "Rua José Paulino, 1200 - Cambuí, Campinas - SP", telefone: "(19) 99876-5432", whatsapp: "5519998765432",
  instagram: "@studioprime", nota: 4.8, avaliacoes: 213,
  horarios: ["segunda-feira: 08:00–19:00", "terça-feira: 08:00–19:00", "quarta-feira: 08:00–19:00", "quinta-feira: 08:00–19:00", "sexta-feira: 08:00–19:00", "sábado: 08:00–14:00", "domingo: Fechado"],
  reviews: [
    { nome: "Marina Costa", nota: 5, texto: "Atendimento impecável, ambiente lindo e um resultado que superou o que eu esperava. Já virei cliente fiel." },
    { nome: "Rafael Lima", nota: 5, texto: "Pontuais, educados e caprichosos. Dá para ver que gostam do que fazem." },
    { nome: "Patrícia Souza", nota: 4, texto: "Fui pela indicação de uma amiga e não me arrependi. Preço justo e muita atenção." },
  ],
};
export const FOTOS_AMOSTRA = [1, 2, 3, 4, 5, 6].map((i) => `https://picsum.photos/seed/enova${i}/1400/1000`);
export const SETOR_POR_LAYOUT: Record<string, string> = { aurora: "dentista", brasa: "barbearia", clinica: "fisioterapia", serena: "salao", oficio: "mecanica", patas: "petshop", sabor: "restaurante", lex: "advocacia", chave: "imobiliaria" };
