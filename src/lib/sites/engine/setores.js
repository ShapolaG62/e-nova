import { semAcento } from './util.js';
// Setores: definem vocabulário, cores sugeridas, serviços (que viram seções do site)
// e quais visuais combinam. Para criar um setor novo, copie um bloco.
//
// vocab.cliente  → como o negócio chama quem compra (cliente, paciente, aluno, tutor…)
// vocab.acao     → o que o visitante faz (agendar, pedir, solicitar um orçamento…)
// vocab.cta      → texto do botão principal

const S = (id, nome, icone, busca, tipos, cores, visuais, vocab, servicos) =>
  ({ id, nome, icone, busca, tipos, cores, visuais, vocab, servicos });

const V = (cliente, clientes, acao, cta, lugar) => ({ cliente, clientes, acao, cta, lugar });

const SETORES = [
  S('barbearia', 'Barbearia', '💈', 'barbearia', ['barber_shop'],
    [['Preto Carvão', '#141414'], ['Dourado', '#C9A227']], ['noite', 'brasa', 'aurora'],
    V('cliente', 'clientes', 'agendar seu horário', 'Agendar no WhatsApp', 'a barbearia'),
    [['Corte masculino', 'Do clássico ao degradê, com técnica e acabamento na régua.'], ['Barba', 'Toalha quente, navalha e alinhamento perfeito.'], ['Corte + barba', 'O combo completo para sair renovado.'], ['Pigmentação', 'Disfarça falhas e realça o desenho do corte e da barba.'], ['Sobrancelha', 'Limpeza e alinhamento discreto, natural.'], ['Corte infantil', 'Paciência e cuidado com os pequenos.'], ['Platinado e luzes', 'Descoloração com produtos que protegem o fio.'], ['Hidratação', 'Tratamento para cabelo e barba macios.']]),
  S('salao', 'Salão de beleza', '💇‍♀️', 'salão de beleza', ['hair_salon', 'beauty_salon', 'hair_care'],
    [['Rosa Orquídea', '#BE185D'], ['Nude', '#F3D9CF']], ['maison', 'serena', 'aurora'],
    V('cliente', 'clientes', 'agendar seu horário', 'Agendar no WhatsApp', 'o salão'),
    [['Corte feminino', 'Cortes que valorizam o seu rosto e o seu estilo.'], ['Coloração', 'Cor viva e duradoura com cuidado com o fio.'], ['Mechas e luzes', 'Iluminação natural, do morena iluminada ao loiro.'], ['Escova e penteado', 'Para o dia a dia ou para um evento especial.'], ['Tratamentos capilares', 'Hidratação, nutrição e reconstrução.'], ['Progressiva', 'Liso, alinhado e sem frizz por muito mais tempo.'], ['Maquiagem', 'Make para festas, noivas e ensaios.'], ['Manicure', 'Mãos e pés impecáveis.']]),
  S('estetica', 'Estética', '✨', 'clínica de estética', ['skin_care_clinic', 'beauty_salon', 'spa'],
    [['Champagne', '#B08D57'], ['Off-white', '#F7F2EC']], ['maison', 'atelier', 'serena', 'clinica'],
    V('cliente', 'clientes', 'agendar uma avaliação', 'Agendar avaliação', 'a clínica'),
    [['Limpeza de pele', 'Pele limpa, renovada e com viço.'], ['Drenagem linfática', 'Reduz inchaço e melhora a circulação.'], ['Massagem modeladora', 'Ajuda a definir e firmar o contorno do corpo.'], ['Depilação', 'Pele lisinha com técnicas que respeitam a sua pele.'], ['Design de sobrancelhas', 'Desenho que harmoniza com o seu rosto.'], ['Peeling', 'Renovação para manchas, poros e textura.'], ['Tratamento facial', 'Protocolos para cada tipo de pele.'], ['Radiofrequência', 'Firmeza e estímulo de colágeno.']]),
  S('unhas', 'Manicure e nail', '💅', 'manicure esmalteria', ['nail_salon'],
    [['Vinho', '#7F1D3B'], ['Rosé', '#F4C6D0']], ['maison', 'serena', 'aurora'],
    V('cliente', 'clientes', 'agendar seu horário', 'Agendar no WhatsApp', 'o studio'),
    [['Manicure e pedicure', 'Cutilagem caprichada e esmaltação perfeita.'], ['Alongamento em gel', 'Unhas resistentes e no formato que você quer.'], ['Fibra de vidro', 'Naturalidade com resistência.'], ['Esmaltação em gel', 'Brilho que dura semanas.'], ['Nail art', 'Desenhos e decorações exclusivos.'], ['Spa dos pés', 'Esfoliação, hidratação e relaxamento.']]),
  S('pizzaria', 'Pizzaria', '🍕', 'pizzaria', ['pizza_restaurant'],
    [['Vermelho Tomate', '#C2361F'], ['Creme', '#FFF4E0']], ['noite', 'brasa', 'sabor'],
    V('cliente', 'clientes', 'fazer seu pedido', 'Pedir no WhatsApp', 'a pizzaria'),
    [['Pizzas tradicionais', 'Os sabores clássicos com massa de longa fermentação.'], ['Pizzas especiais', 'Combinações da casa que viraram favoritas.'], ['Pizzas doces', 'Para fechar a noite com chave de ouro.'], ['Delivery', 'Chega quentinha na sua casa.'], ['Retirada no balcão', 'Peça antes e retire sem fila.'], ['Bebidas', 'Refrigerantes, sucos e cervejas geladas.'], ['Bordas recheadas', 'Catupiry, cheddar e chocolate.'], ['Combos', 'Pizza + bebida com preço especial.']]),
  S('hamburgueria', 'Hamburgueria', '🍔', 'hamburgueria', ['hamburger_restaurant'],
    [['Laranja Brasa', '#EA580C'], ['Preto', '#111111']], ['noite', 'vitrine', 'brasa', 'sabor'],
    V('cliente', 'clientes', 'fazer seu pedido', 'Pedir no WhatsApp', 'a hamburgueria'),
    [['Burgers artesanais', 'Blend da casa, pão selado e molhos próprios.'], ['Smash burgers', 'Crocante por fora, suculento por dentro.'], ['Porções', 'Batata, onion rings e mais para dividir.'], ['Combos', 'Burger + acompanhamento + bebida.'], ['Delivery', 'Do nosso chapa para a sua casa.'], ['Milkshakes', 'Cremosos e caprichados.']]),
  S('restaurante', 'Restaurante', '🍽️', 'restaurante', ['restaurant', 'brazilian_restaurant', 'meal_takeaway'],
    [['Terracota', '#B4532A'], ['Areia', '#F5EBDD']], ['noite', 'sabor', 'aurora'],
    V('cliente', 'clientes', 'fazer sua reserva ou pedido', 'Reservar no WhatsApp', 'o restaurante'),
    [['Almoço executivo', 'Prato completo, rápido e com preço justo.'], ['Pratos à la carte', 'Receitas da casa preparadas na hora.'], ['Self-service', 'Variedade todos os dias.'], ['Marmitas e delivery', 'Comida caseira onde você estiver.'], ['Eventos e encomendas', 'Para festas, reuniões e confraternizações.'], ['Sobremesas', 'Doces caseiros para fechar a refeição.']]),
  S('padaria', 'Padaria e confeitaria', '🥐', 'padaria', ['bakery', 'confectionery'],
    [['Caramelo', '#A0522D'], ['Trigo', '#F6E7C8']], ['maison', 'sabor', 'aurora'],
    V('cliente', 'clientes', 'fazer sua encomenda', 'Encomendar no WhatsApp', 'a padaria'),
    [['Pães artesanais', 'Fornadas fresquinhas o dia todo.'], ['Bolos e tortas', 'Para o café ou para festas.'], ['Salgados', 'Assados e fritos feitos na hora.'], ['Café da manhã', 'Para começar o dia bem.'], ['Encomendas para festas', 'Bolos, docinhos e salgados por encomenda.'], ['Frios e laticínios', 'Tudo para o seu lanche.']]),
  S('cafeteria', 'Cafeteria', '☕', 'cafeteria', ['cafe', 'coffee_shop'],
    [['Café', '#6B4226'], ['Leite', '#F4EDE4']], ['maison', 'sabor', 'serena'],
    V('cliente', 'clientes', 'fazer seu pedido', 'Falar no WhatsApp', 'a cafeteria'),
    [['Cafés especiais', 'Grãos selecionados e métodos de preparo variados.'], ['Brunch', 'Opções doces e salgadas para qualquer hora.'], ['Doces e bolos', 'Feitos aqui, todos os dias.'], ['Ambiente para trabalhar', 'Wi-Fi, tomadas e silêncio.'], ['Encomendas', 'Bolos e kits para presentear.'], ['Bebidas geladas', 'Frappés, sucos e chás.']]),
  S('acai', 'Açaí e sorveteria', '🍧', 'açaiteria sorveteria', ['ice_cream_shop'],
    [['Roxo Açaí', '#5B2A86'], ['Verde Folha', '#3FA34D']], ['horizonte', 'vitrine', 'sabor', 'patas'],
    V('cliente', 'clientes', 'fazer seu pedido', 'Pedir no WhatsApp', 'a loja'),
    [['Açaí no copo', 'Monte do seu jeito com dezenas de complementos.'], ['Sorvetes', 'Sabores cremosos e refrescantes.'], ['Milkshakes', 'Batidos na hora.'], ['Delivery', 'Geladinho na sua porta.'], ['Combos', 'Para dividir com a galera.'], ['Picolés', 'Opções de fruta e cremosos.']]),
  S('mecanica', 'Oficina mecânica', '🔧', 'oficina mecânica', ['car_repair'],
    [['Azul Aço', '#1E3A5F'], ['Amarelo Alerta', '#F5B301']], ['horizonte', 'oficio', 'brasa'],
    V('cliente', 'clientes', 'pedir um orçamento', 'Pedir orçamento', 'a oficina'),
    [['Mecânica geral', 'Motor, câmbio, embreagem e suspensão.'], ['Revisão preventiva', 'Checklist completo para evitar surpresas.'], ['Freios', 'Pastilhas, discos e fluido com segurança.'], ['Injeção eletrônica', 'Diagnóstico com scanner e reparo.'], ['Troca de óleo', 'Óleo e filtros certos para o seu motor.'], ['Ar-condicionado', 'Higienização, carga de gás e manutenção.'], ['Suspensão', 'Amortecedores, buchas e alinhamento.'], ['Elétrica automotiva', 'Bateria, alternador, partida e iluminação.']]),
  S('autoeletrica', 'Auto elétrica', '🔋', 'auto elétrica', ['car_repair'],
    [['Azul Elétrico', '#1D4ED8'], ['Grafite', '#1F2937']], ['horizonte', 'oficio', 'brasa'],
    V('cliente', 'clientes', 'pedir um orçamento', 'Pedir orçamento', 'a auto elétrica'),
    [['Baterias', 'Teste, carga e troca com garantia.'], ['Alternador e motor de partida', 'Reparo e substituição.'], ['Diagnóstico eletrônico', 'Scanner para achar o problema rápido.'], ['Iluminação', 'Faróis, lanternas e LEDs.'], ['Som e acessórios', 'Instalação caprichada.'], ['Travas e alarmes', 'Segurança para o seu veículo.']]),
  S('lavajato', 'Lava-jato e estética automotiva', '🚿', 'lava jato estética automotiva', ['car_wash'],
    [['Azul Água', '#0284C7'], ['Preto Brilho', '#0B0F14']], ['horizonte', 'brasa', 'oficio'],
    V('cliente', 'clientes', 'agendar sua lavagem', 'Agendar no WhatsApp', 'o lava-jato'),
    [['Lavagem completa', 'Por dentro e por fora, com produtos de qualidade.'], ['Polimento', 'Remove riscos leves e devolve o brilho.'], ['Higienização interna', 'Bancos, carpetes e teto limpos de verdade.'], ['Cristalização', 'Proteção e brilho duradouros.'], ['Lavagem de motor', 'Com segurança para a parte elétrica.'], ['Leva e traz', 'Buscamos e entregamos o seu carro.']]),
  S('dentista', 'Clínica odontológica', '🦷', 'dentista', ['dentist', 'dental_clinic'],
    [['Azul Clínico', '#2B7FD4'], ['Turquesa', '#5CCFD6']], ['integra', 'maison', 'aurora', 'clinica'],
    V('paciente', 'pacientes', 'agendar sua avaliação', 'Agendar avaliação', 'a clínica'),
    [['Clínica geral', 'Prevenção, limpeza e restaurações.'], ['Clareamento', 'Sorriso mais branco com segurança.'], ['Implantes', 'Devolvem a função e a estética do sorriso.'], ['Ortodontia', 'Aparelhos fixos e alinhadores.'], ['Lentes de contato dental', 'Sorriso harmônico e natural.'], ['Tratamento de canal', 'Sem dor, com tecnologia.'], ['Odontopediatria', 'Cuidado especial para as crianças.'], ['Próteses', 'Conforto e naturalidade.']]),
  S('clinica', 'Clínica médica', '🩺', 'clínica médica', ['doctor', 'medical_clinic', 'hospital'],
    [['Verde Saúde', '#0F766E'], ['Azul Céu', '#E0F2FE']], ['integra', 'maison', 'clinica', 'aurora'],
    V('paciente', 'pacientes', 'agendar sua consulta', 'Agendar consulta', 'a clínica'),
    [['Consultas', 'Atendimento atencioso e sem pressa.'], ['Exames', 'Resultados rápidos e confiáveis.'], ['Check-up', 'Avaliação completa da sua saúde.'], ['Pediatria', 'Cuidado para os pequenos.'], ['Ginecologia', 'Saúde da mulher em todas as fases.'], ['Cardiologia', 'Cuidado com o seu coração.']]),
  S('fisioterapia', 'Fisioterapia', '🦴', 'fisioterapia', ['physiotherapist'],
    [['Azul Petróleo', '#155E75'], ['Areia', '#EDE6DA']], ['integra', 'horizonte', 'clinica', 'aurora'],
    V('paciente', 'pacientes', 'agendar sua avaliação', 'Agendar avaliação', 'a clínica'),
    [['Ortopédica', 'Recuperação de lesões, dores e cirurgias.'], ['Pilates clínico', 'Fortalecimento com acompanhamento.'], ['RPG', 'Correção postural global.'], ['Fisioterapia esportiva', 'Volte a treinar com segurança.'], ['Acupuntura', 'Alívio de dores e tensões.'], ['Atendimento domiciliar', 'Fisioterapia no conforto da sua casa.']]),
  S('psicologia', 'Psicologia', '🧠', 'psicólogo', ['psychologist'],
    [['Verde Sálvia', '#5F7F6E'], ['Linho', '#F3EFE7']], ['integra', 'maison', 'serena', 'clinica'],
    V('paciente', 'pacientes', 'agendar sua primeira sessão', 'Agendar sessão', 'o consultório'),
    [['Psicoterapia individual', 'Um espaço seguro para cuidar de você.'], ['Terapia de casal', 'Diálogo e reconstrução da relação.'], ['Atendimento online', 'De onde você estiver.'], ['Ansiedade e estresse', 'Ferramentas para o dia a dia.'], ['Orientação de pais', 'Apoio na educação dos filhos.'], ['Avaliação psicológica', 'Laudos com responsabilidade.']]),
  S('nutricionista', 'Nutrição', '🥗', 'nutricionista', ['nutritionist'],
    [['Verde Folha', '#4D7C0F'], ['Pêssego', '#FDE7D3']], ['integra', 'maison', 'aurora', 'serena'],
    V('paciente', 'pacientes', 'agendar sua consulta', 'Agendar consulta', 'o consultório'),
    [['Emagrecimento', 'Plano alimentar sem terrorismo.'], ['Nutrição esportiva', 'Performance e ganho de massa.'], ['Reeducação alimentar', 'Hábitos que duram.'], ['Gestantes', 'Nutrição para mãe e bebê.'], ['Bioimpedância', 'Acompanhe a sua composição corporal.'], ['Consulta online', 'Acompanhamento de qualquer lugar.']]),
  S('petshop', 'Pet shop', '🐾', 'pet shop', ['pet_store', 'pet_care'],
    [['Laranja Fogo', '#F0603A'], ['Azul Pet', '#2B7FD4']], ['horizonte', 'patas', 'aurora'],
    V('tutor', 'tutores', 'agendar o banho', 'Agendar no WhatsApp', 'o pet shop'),
    [['Banho e tosa', 'Higiênica, na máquina ou na tesoura.'], ['Hotel', 'Hospedagem segura e cheia de carinho.'], ['Creche', 'Diversão e socialização durante o dia.'], ['Táxi pet', 'Buscamos e levamos o seu pet.'], ['Adestramento', 'Educação positiva e convivência.'], ['Ração e acessórios', 'As melhores marcas para cães e gatos.'], ['Hidratação de pelagem', 'Pelos macios e brilhantes.'], ['Spa pet', 'Banho de ofurô e aromaterapia.']]),
  S('veterinario', 'Clínica veterinária', '🐶', 'clínica veterinária', ['veterinary_care'],
    [['Verde Vet', '#16A34A'], ['Azul', '#1E40AF']], ['maison', 'patas', 'clinica'],
    V('tutor', 'tutores', 'agendar uma consulta', 'Agendar consulta', 'a clínica'),
    [['Consultas', 'Atendimento clínico para cães e gatos.'], ['Vacinas', 'Calendário completo e em dia.'], ['Exames', 'Laboratório e imagem.'], ['Cirurgias', 'Castração e procedimentos com segurança.'], ['Emergência', 'Atendimento quando o seu pet mais precisa.'], ['Internação', 'Acompanhamento 24h.']]),
  S('academia', 'Academia e personal', '🏋️', 'academia', ['gym', 'fitness_center'],
    [['Verde Energia', '#22C55E'], ['Preto', '#0A0A0A']], ['horizonte', 'pulso', 'brasa', 'oficio'],
    V('aluno', 'alunos', 'agendar sua aula experimental', 'Aula experimental grátis', 'a academia'),
    [['Musculação', 'Equipamentos completos e treino para o seu objetivo.'], ['Treino funcional', 'Força, mobilidade e condicionamento.'], ['Personal individual', 'Treino acompanhado do início ao fim.'], ['Avaliação física', 'Acompanhe a sua evolução com números.'], ['Aulas coletivas', 'Energia lá em cima em grupo.'], ['Acompanhamento online', 'Treino e ajustes à distância.']]),
  S('pilates', 'Pilates e yoga', '🧘', 'studio de pilates', ['yoga_studio'],
    [['Lavanda', '#7C6BB0'], ['Areia', '#F2ECE4']], ['maison', 'atelier', 'serena', 'aurora'],
    V('aluno', 'alunos', 'agendar sua aula experimental', 'Aula experimental', 'o studio'),
    [['Pilates em aparelhos', 'Turmas reduzidas e atenção individual.'], ['Pilates solo', 'Força e consciência corporal.'], ['Yoga', 'Equilíbrio entre corpo e mente.'], ['Alongamento', 'Mobilidade para o dia a dia.'], ['Pilates para gestantes', 'Movimento seguro na gravidez.'], ['Aulas particulares', 'No seu ritmo e horário.']]),
  S('advocacia', 'Advocacia', '⚖️', 'escritório de advocacia', ['lawyer'],
    [['Azul Marinho', '#14213D'], ['Dourado', '#B8962E']], ['noite', 'lex', 'clinica'],
    V('cliente', 'clientes', 'agendar uma consulta', 'Falar com um advogado', 'o escritório'),
    [['Direito trabalhista', 'Defesa dos seus direitos no trabalho.'], ['Direito de família', 'Divórcio, guarda, pensão e inventário.'], ['Direito previdenciário', 'Aposentadorias e benefícios do INSS.'], ['Direito do consumidor', 'Cobranças indevidas e danos.'], ['Direito civil', 'Contratos, cobranças e indenizações.'], ['Direito empresarial', 'Assessoria para o seu negócio.']]),
  S('contabilidade', 'Contabilidade', '📊', 'escritório de contabilidade', ['accounting'],
    [['Azul Corporativo', '#1E40AF'], ['Verde Lucro', '#10B981']], ['maison', 'lex', 'oficio'],
    V('cliente', 'clientes', 'falar com um contador', 'Falar com um contador', 'o escritório'),
    [['Abertura de empresa', 'CNPJ rápido e sem burocracia.'], ['MEI', 'Declaração, guias e desenquadramento.'], ['Contabilidade mensal', 'Impostos, folha e obrigações em dia.'], ['Imposto de Renda', 'Declaração sem malha fina.'], ['Planejamento tributário', 'Pague menos imposto, dentro da lei.'], ['Departamento pessoal', 'Admissões, folha e rescisões.']]),
  S('imobiliaria', 'Imobiliária', '🏠', 'imobiliária', ['real_estate_agency'],
    [['Verde Musgo', '#2F5D50'], ['Dourado', '#C8A24A']], ['maison', 'chave', 'lex'],
    V('cliente', 'clientes', 'encontrar seu imóvel', 'Falar com um corretor', 'a imobiliária'),
    [['Venda de imóveis', 'Casas, apartamentos e terrenos.'], ['Locação', 'Imóveis para alugar com segurança.'], ['Administração de aluguéis', 'Cuidamos de tudo para o proprietário.'], ['Avaliação de imóveis', 'Saiba quanto vale o seu imóvel.'], ['Financiamento', 'Ajudamos com a aprovação do crédito.'], ['Lançamentos', 'Imóveis na planta com condições especiais.']]),
  S('eletricista', 'Eletricista', '⚡', 'eletricista', ['electrician'],
    [['Amarelo Energia', '#FACC15'], ['Azul Noite', '#0F172A']], ['horizonte', 'oficio', 'brasa'],
    V('cliente', 'clientes', 'pedir um orçamento', 'Pedir orçamento', 'a empresa'),
    [['Instalações elétricas', 'Residenciais e comerciais, dentro da norma.'], ['Manutenção', 'Curto, disjuntor caindo e tomadas queimadas.'], ['Quadro de distribuição', 'Montagem e troca com segurança.'], ['Iluminação', 'Projetos e instalação de LEDs.'], ['Padrão de entrada', 'Ligação nova e aumento de carga.'], ['Atendimento emergencial', 'Quando você mais precisa.']]),
  S('encanador', 'Encanador e desentupidora', '🚰', 'encanador desentupidora', ['plumber'],
    [['Azul Hidráulico', '#0369A1'], ['Laranja', '#F97316']], ['horizonte', 'oficio', 'aurora'],
    V('cliente', 'clientes', 'pedir um orçamento', 'Chamar agora', 'a empresa'),
    [['Desentupimento', 'Pias, vasos, ralos e esgoto.'], ['Caça-vazamentos', 'Localização sem quebrar à toa.'], ['Instalações hidráulicas', 'Água fria, quente e esgoto.'], ['Limpeza de caixa d’água', 'Água limpa para a sua família.'], ['Conserto de descargas', 'Válvulas e caixas acopladas.'], ['Atendimento 24h', 'Emergências a qualquer hora.']]),
  S('reformas', 'Reformas e construção', '🧱', 'reformas construção', ['general_contractor', 'roofing_contractor'],
    [['Terracota', '#C2410C'], ['Cinza Concreto', '#374151']], ['horizonte', 'oficio', 'chave'],
    V('cliente', 'clientes', 'pedir um orçamento', 'Pedir orçamento', 'a empresa'),
    [['Reformas completas', 'Do projeto à entrega da chave.'], ['Pintura', 'Acabamento limpo e caprichado.'], ['Pisos e revestimentos', 'Assentamento com precisão.'], ['Drywall e gesso', 'Forros, paredes e sancas.'], ['Telhados', 'Reparo, troca e impermeabilização.'], ['Pequenos reparos', 'Aquele serviço que você vive adiando.']]),
  S('arcondicionado', 'Ar-condicionado e refrigeração', '❄️', 'instalação ar condicionado', ['hvac_contractor'],
    [['Azul Gelo', '#0EA5E9'], ['Azul Marinho', '#0C2D48']], ['horizonte', 'oficio', 'aurora'],
    V('cliente', 'clientes', 'pedir um orçamento', 'Pedir orçamento', 'a empresa'),
    [['Instalação', 'Split, multi-split e cassete.'], ['Manutenção preventiva', 'Limpeza e higienização completa.'], ['Conserto', 'Diagnóstico e reparo rápido.'], ['Carga de gás', 'Teste de vazamento e recarga.'], ['Contratos para empresas', 'Manutenção programada.'], ['Refrigeração comercial', 'Câmaras frias e balcões.']]),
  S('seguranca', 'Segurança eletrônica', '🛡️', 'segurança eletrônica câmeras', ['security_system_supplier'],
    [['Azul Segurança', '#1E3A8A'], ['Vermelho', '#DC2626']], ['noite', 'oficio', 'lex'],
    V('cliente', 'clientes', 'pedir um orçamento', 'Pedir orçamento', 'a empresa'),
    [['Câmeras de segurança', 'Monitoramento pelo celular.'], ['Alarmes', 'Proteção 24h para casa e empresa.'], ['Cerca elétrica', 'Instalação dentro das normas.'], ['Controle de acesso', 'Fechaduras digitais e interfones.'], ['Portões automáticos', 'Instalação e manutenção.'], ['Monitoramento', 'Central acompanhando o seu imóvel.']]),
  S('auto_escola', 'Autoescola', '🚗', 'autoescola', ['driving_school'],
    [['Amarelo', '#EAB308'], ['Azul', '#1D4ED8']], ['horizonte', 'aurora', 'oficio'],
    V('aluno', 'alunos', 'fazer sua matrícula', 'Fazer matrícula', 'a autoescola'),
    [['Primeira habilitação', 'Carro e moto, do teórico à prova.'], ['Aulas avulsas', 'Para quem já tem CNH e quer confiança.'], ['Mudança de categoria', 'Para dirigir caminhão, ônibus e mais.'], ['Reciclagem', 'Curso para recuperar a CNH.'], ['Simulador', 'Treino seguro antes de ir para a rua.'], ['Aulas para habilitados', 'Perca o medo de dirigir.']]),
  S('escola', 'Escola e cursos', '🎓', 'escola curso', ['school', 'language_school'],
    [['Azul Royal', '#2563EB'], ['Laranja', '#FB923C']], ['horizonte', 'aurora', 'patas'],
    V('aluno', 'alunos', 'fazer sua matrícula', 'Quero me matricular', 'a escola'),
    [['Educação infantil', 'Aprender brincando, com segurança.'], ['Ensino fundamental', 'Base sólida para o futuro.'], ['Reforço escolar', 'Acompanhamento individual.'], ['Cursos de idiomas', 'Inglês e espanhol para todas as idades.'], ['Cursos livres', 'Aprenda uma nova habilidade.'], ['Turmas reduzidas', 'Atenção de verdade para cada aluno.']]),
  S('fotografia', 'Fotografia e eventos', '📷', 'fotógrafo', ['photographer'],
    [['Preto', '#111111'], ['Âmbar', '#D97706']], ['noite', 'atelier', 'brasa', 'serena'],
    V('cliente', 'clientes', 'reservar sua data', 'Consultar data', 'o estúdio'),
    [['Casamentos', 'Cada detalhe do grande dia.'], ['Ensaios', 'Gestante, família, casal e individual.'], ['Aniversários e festas', 'Momentos que viram memória.'], ['Fotos corporativas', 'Retratos e eventos para empresas.'], ['Produtos', 'Fotos que vendem mais.'], ['Álbuns', 'Impressão de alta qualidade.']]),
  S('loja', 'Loja e comércio', '🛍️', 'loja', ['store', 'clothing_store', 'shoe_store'],
    [['Índigo', '#4338CA'], ['Coral', '#FB7185']], ['maison', 'vitrine', 'aurora', 'sabor'],
    V('cliente', 'clientes', 'falar com a gente', 'Comprar pelo WhatsApp', 'a loja'),
    [['Novidades toda semana', 'Peças e produtos novos sempre.'], ['Atendimento pelo WhatsApp', 'Tire dúvidas e compre sem sair de casa.'], ['Entrega na região', 'Receba rapidinho.'], ['Formas de pagamento', 'Pix, cartão e parcelamento.'], ['Trocas facilitadas', 'Sem dor de cabeça.'], ['Presentes', 'Embalagem especial.']]),
  S('outro', 'Outro ramo', '🏢', '', [],
    [['Índigo', '#4F46E5'], ['Ciano', '#06B6D4']], ['maison', 'aurora', 'oficio'],
    V('cliente', 'clientes', 'falar com a gente', 'Falar no WhatsApp', 'a empresa'),
    [['Atendimento próximo', 'Gente de verdade para te ajudar.'], ['Qualidade', 'Serviço bem feito do começo ao fim.'], ['Agilidade', 'Resolvemos rápido o que você precisa.'], ['Preço justo', 'Transparência em cada orçamento.'], ['Experiência', 'Anos atendendo a região.'], ['Garantia', 'Compromisso com o resultado.']]),
];

const POR_ID = Object.fromEntries(SETORES.map((s) => [s.id, s]));

function setor(id) { return POR_ID[id] || POR_ID.outro; }

// Lista para o painel (sem os textos longos)
function listaResumo() {
  return SETORES.map((s) => ({ id: s.id, nome: s.nome, icone: s.icone, busca: s.busca, cores: s.cores, servicos: s.servicos.map((x) => x[0]), visuais: s.visuais }));
}

// Descobre o setor a partir dos tipos do Google / nome da empresa
function detectarSetor(lead) {
  const tipos = [lead.tipo, ...(lead.tipos || [])].filter(Boolean);
  for (const s of SETORES) if (s.tipos.some((t) => tipos.includes(t))) return s.id;
  const txt = semAcento(`${lead.nome} ${lead.tipoNome || ''}`);
  for (const s of SETORES) {
    const chave = semAcento(s.busca.split(' ')[0]);
    if (chave && new RegExp(`(^|[^a-z])${chave}`).test(txt)) return s.id;
  }
  return 'outro';
}

export { SETORES, setor, listaResumo, detectarSetor };
