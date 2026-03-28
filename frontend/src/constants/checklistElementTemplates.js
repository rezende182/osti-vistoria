/**
 * Por tipo de ambiente (room_type): elementos e texto de verificação (formato contínuo).
 */

/** Nome exibido ao adicionar ambiente (tabs / título base). */
export const ROOM_TYPE_LABELS = {
  area_externa_comum: 'ÁREA EXTERNA/COMUM',
  sala_estar_jantar: 'SALA/ESTAR/JANTAR',
  cozinha: 'COZINHA',
  area_servico_lavanderia: 'ÁREA DE SERVIÇO/LAVANDERIA',
  banheiro_social_lavabo: 'BANHEIRO SOCIAL/LAVABO',
  quarto_suite: 'QUARTO/SUITE',
  escadas: 'ESCADAS',
  varanda_sacada: 'VARANDA/SACADA',
  area_gourmet_churrasqueira: 'ÁREA GOURMET/CHURRASQUEIRA',
  garagem: 'GARAGEM',
  piscina: 'PISCINA',
  cobertura_telhado: 'COBERTURA/TELHADO',
};

function capitalizeFirst(text) {
  const t = (text || '').trim();
  if (!t) return '';
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Nome do elemento + texto integral dos critérios (como definido no laudo). */
function E(name, verificationText) {
  return {
    name: capitalizeFirst(name),
    verificationText: capitalizeFirst(verificationText),
  };
}

/** @type {Record<string, Array<{ name: string, verificationText: string }>>} */
export const ROOM_ELEMENT_TEMPLATES = {
  area_externa_comum: [
    E(
      'Piso Externo',
      'Nivelamento geral, caimento adequado para drenagem, presença de peças soltas ou ocas, trincas, fissuras ou quebras, desgaste superficial ou acabamento inadequado e rejuntamento'
    ),
    E(
      'Ralos e Drenagem',
      'Funcionamento do escoamento, presença de obstruções, posicionamento adequado, acúmulo de água (empoçamento) e acabamento ao redor do ralo'
    ),
    E(
      'Muros e Fechamentos',
      'Fissuras e trincas, desalinhamento ou inclinação, condições da pintura (manchas, descascamento), presença de umidade ou infiltrações e integridade estrutural aparente'
    ),
    E(
      'Fachada',
      'Fissuras e trincas, descolamento de revestimentos, falhas de pintura, manchas de umidade e acabamento geral'
    ),
    E(
      'Portões e Acessos',
      'Funcionamento (abertura/fechamento), alinhamento, fixação das ferragens, estado de conservação e sistema de travamento'
    ),
    E(
      'Calçadas e Acessos',
      'Nivelamento, condição do piso, presença de trincas ou desníveis e segurança de circulação'
    ),
    E(
      'Instalações Elétricas Externas',
      'Pontos de energia (tomadas), iluminação externa (funcionamento), fixação de luminárias e acabamento das caixas elétricas'
    ),
    E(
      'Instalações Hidráulicas Externas',
      'Torneiras externas, pontos de água, vazamentos aparentes e funcionamento geral'
    ),
    E(
      'Estrutura Aparente (Vigas e Pilares)',
      'Presença de fissuras ou trincas, desalinhamento, exposição de armadura, falhas de acabamento e sinais de infiltração'
    ),
    E(
      'Ventilação e Condições Gerais',
      'Ventilação do ambiente e acúmulo de umidade'
    ),
    E('Limpeza', 'Condição geral de limpeza do ambiente'),
    E('Dimensões', 'Conferência das dimensões do ambiente'),
  ],

  sala_estar_jantar: [
    E(
      'Piso',
      'Nivelamento, alinhamento, presença de peças ocas, trincas, fissuras ou quebras, desgaste superficial, acabamento e rejuntamento'
    ),
    E(
      'Rodapés',
      'Fixação, alinhamento, acabamento, descolamento e integridade'
    ),
    E(
      'Paredes',
      'Fissuras e trincas, ondulações ou empenamento, prumo, acabamento superficial e presença de umidade ou infiltrações'
    ),
    E(
      'Pintura',
      'Uniformidade, manchas, bolhas, descascamento e falhas de aplicação'
    ),
    E(
      'Teto',
      'Fissuras e trincas, manchas, sinais de infiltração, nivelamento e acabamento'
    ),
    E(
      'Tomadas, Interruptores e Iluminação',
      'Funcionamento, fixação, presença de espelhos, quantidade adequada, funcionamento dos pontos de luz, fixação de luminárias e acabamento'
    ),
    E(
      'Esquadrias (Portas e Janelas)',
      'Funcionamento (abertura e fechamento), vedação, alinhamento, fixação e estado geral'
    ),
    E('Vidros', 'Presença de trinca ou quebras, riscos e fixação'),
    E(
      'Peitoril de Janelas',
      'Nivelamento, fixação, acabamento e integridade'
    ),
    E(
      'Soleiras / Baguetes',
      'Nivelamento, fixação, acabamento e transição entre ambientes'
    ),
    E(
      'Infraestrutura para Ar-Condicionado',
      'Presença de ponto elétrico, dreno, espaço para instalação, e acabamento dos pontos'
    ),
    E('Limpeza', 'Condição geral de limpeza do ambiente'),
    E('Dimensões', 'Conferência das dimensões do ambiente'),
  ],

  cozinha: [
    E(
      'Piso',
      'Nivelamento, caimento adequado, presença de peças ocas, trincas, fissuras ou quebras, desgaste superficial, acabamento e rejuntamento'
    ),
    E(
      'Revestimentos (Paredes)',
      'Fixação das peças, descolamento, alinhamento, rejuntamento, trincas ou fissuras e acabamento'
    ),
    E(
      'Bancadas',
      'Nivelamento, fixação, presença de fissuras ou trincas, acabamento, vedação junto à parede'
    ),
    E(
      'Pia',
      'Fixação, vedação, funcionamento do escoamento, presença de vazamentos e acabamento'
    ),
    E(
      'Sifão e Conexões',
      'Vedação, fixação, vazamentos e instalação adequada'
    ),
    E(
      'Torneiras',
      'Funcionamento, fixação, vazamentos, pressão da água'
    ),
    E(
      'Pontos Hidráulicos',
      'Funcionamento, vedação, identificação de vazamentos e pressão da água'
    ),
    E(
      'Ralos',
      'Funcionamento do escoamento, presença de obstruções, acabamento ao redor e vedação'
    ),
    E(
      'Tomadas, Interruptores e Iluminação',
      'Funcionamento, fixação, presença de espelhos, quantidade adequada para eletrodomésticos, funcionamento dos pontos de luz, fixação de luminárias e acabamento'
    ),
    E(
      'Esquadrias (Portas e Janelas)',
      'Funcionamento, vedação, alinhamento, fixação'
    ),
    E('Peitoril de Janelas', 'Nivelamento, fixação e acabamento'),
    E(
      'Soleiras / Baguetes',
      'Nivelamento, fixação, acabamento e transição de ambientes'
    ),
    E(
      'Ventilação',
      'Ventilação natural, ventilação forçada e circulação de ar'
    ),
    E('Limpeza', 'Condição geral de limpeza do ambiente'),
    E('Dimensões', 'Conferência das dimensões do ambiente'),
  ],

  banheiro_social_lavabo: [
    E(
      'Piso',
      'Nivelamento, caimento adequado em direção ao ralo, presença de peças ocas, trincas, fissuras ou quebras, desgaste superficial, acabamento, rejuntamento e acúmulo de água fora da área de escoamento'
    ),
    E(
      'Revestimentos (Paredes)',
      'Fixação das peças, descolamento, alinhamento, rejuntamento, trincas ou fissuras, acabamento, presença de umidade ou infiltrações'
    ),
    E(
      'Rodapés (quando aplicável)',
      'Fixação, alinhamento, acabamento e integridade'
    ),
    E(
      'Teto',
      'Fissuras e trincas, manchas, sinais de infiltração, mofo ou bolor e acabamento'
    ),
    E(
      'Vaso Sanitário',
      'Fixação, estabilidade, funcionamento da descarga, vedação na base, vazamentos e acabamento'
    ),
    E(
      'Lavatório / Cuba',
      'Fixação, nivelamento, vedação com a parede ou bancada, escoamento e presença de vazamentos'
    ),
    E(
      'Bancada',
      'Nivelamento, fixação, fissuras ou trincas, vedação com a parede e acabamento'
    ),
    E(
      'Torneiras',
      'Funcionamento, fixação, vazamentos e pressão da água'
    ),
    E(
      'Registros',
      'Funcionamento, vedação, facilidade de acionamento e vazamentos'
    ),
    E(
      'Sifão e Conexões',
      'Vedação, fixação, vazamentos e instalação adequada'
    ),
    E(
      'Ralos',
      'Funcionamento do escoamento, posicionamento adequado, presença de obstruções, vedação e acabamento ao redor'
    ),
    E(
      'Box / Área de Banho',
      'Vedação, fixação, funcionamento e presença de vazamentos para fora da área molhada'
    ),
    E(
      'Chuveiro',
      'Funcionamento, fixação, vazamentos e pressão da água'
    ),
    E(
      'Instalações Hidráulicas',
      'Funcionamento geral, pressão da água, vazamentos aparentes, distribuição adequada'
    ),
    E(
      'Instalações Elétricas',
      'Tomadas (funcionamento, fixação, espelhos), interruptores, iluminação e segurança (posicionamento adequado em área molhada)'
    ),
    E(
      'Esquadrias (Portas e Janelas)',
      'Funcionamento, vedação, alinhamento e fixação'
    ),
    E('Vidros', 'Trincas ou quebras, fixação e vedação'),
    E(
      'Ventilação',
      'Ventilação natural, ventilação forçada (exaustor), circulação de ar e eficiência na remoção de umidade'
    ),
    E('Limpeza', 'Condição geral de limpeza do ambiente'),
    E(
      'Dimensões e Conformidade',
      'Conferência das dimensões do ambiente e posicionamento adequado dos elementos (vaso, pia, box)'
    ),
  ],

  quarto_suite: [
    E(
      'Piso',
      'Nivelamento, alinhamento, presença de peças ocas, trincas, fissuras ou quebras, desgaste superficial, acabamento e rejuntamento'
    ),
    E(
      'Rodapés',
      'Fixação, alinhamento, acabamento, descolamento e integridade'
    ),
    E(
      'Paredes',
      'Fissuras e trincas, ondulações ou empenamento, prumo, acabamento superficial e presença de umidade ou infiltrações'
    ),
    E(
      'Pintura',
      'Uniformidade, manchas, bolhas, descascamento e falhas de aplicação'
    ),
    E(
      'Teto',
      'Fissuras e trincas, manchas, sinais de infiltração, nivelamento e acabamento'
    ),
    E(
      'Tomadas, Interruptores, Iluminação e Quadro de energia',
      'Funcionamento, fixação, presença de espelhos, quantidade adequada, funcionamento dos pontos de luz, fixação de luminárias, verificação do quadro de energia e acabamento'
    ),
    E(
      'Esquadrias (Portas e Janelas)',
      'Funcionamento (abertura e fechamento), vedação, alinhamento, fixação e estado geral'
    ),
    E(
      'Peitoril de Janelas',
      'Nivelamento, fixação, acabamento e integridade'
    ),
    E(
      'Soleiras / Baguetes',
      'Nivelamento, fixação, acabamento e transição entre ambientes'
    ),
    E(
      'Infraestrutura para Ar-Condicionado',
      'Presença de ponto elétrico, dreno, espaço para instalação e acabamento dos pontos'
    ),
    E(
      'Limpeza (Item Obrigatório)',
      'Condição geral de limpeza do ambiente'
    ),
    E('Dimensões', 'Conferência das dimensões do ambiente'),
  ],

  area_servico_lavanderia: [
    E(
      'Piso',
      'Nivelamento, caimento adequado em direção ao ralo, presença de peças ocas, trincas, fissuras ou quebras, desgaste superficial, acabamento, rejuntamento e acúmulo de água'
    ),
    E(
      'Revestimentos (Paredes)',
      'Fixação das peças, descolamento, alinhamento, rejuntamento, trincas ou fissuras, acabamento e presença de umidade ou infiltrações'
    ),
    E(
      'Tanque',
      'Fixação, nivelamento, vedação, integridade e funcionamento do escoamento'
    ),
    E(
      'Torneira do Tanque',
      'Funcionamento, fixação, vazamentos e pressão da água'
    ),
    E(
      'Pontos Hidráulicos',
      'Funcionamento, vedação, vazamentos aparentes e pressão da água'
    ),
    E(
      'Sifão',
      'Vedação, fixação, vazamentos e instalação adequada'
    ),
    E(
      'Ralos',
      'Funcionamento do escoamento, presença de obstruções, posicionamento adequado, vedação e acabamento ao redor'
    ),
    E(
      'Instalação para Máquina de Lavar',
      'Ponto de água, ponto de esgoto, tomada elétrica, posicionamento adequado e condições para instalação'
    ),
    E(
      'Tomadas, Interruptores e Iluminação',
      'Funcionamento, fixação, presença de espelhos, compatibilidade (110V/220V), acabamento, funcionamento dos pontos de luz e iluminação adequada do ambiente'
    ),
    E(
      'Esquadrias (Portas e Janelas)',
      'Funcionamento, vedação, alinhamento e fixação'
    ),
    E(
      'Ventilação',
      'Ventilação natural, ventilação forçada e eficiência na secagem do ambiente'
    ),
    E('Limpeza', 'Condição geral de limpeza do ambiente'),
    E('Dimensões', 'Conferência das dimensões do ambiente'),
  ],

  escadas: [
    E(
      'Degraus (Pisos) e Espelhos (Altura)',
      'Nivelamento, regularidade, presença de trincas, fissuras ou quebras, desgaste superficial, acabamento, revestimento (fixação, peças ocas, rejuntamento) e condições antiderrapantes'
    ),
    E(
      'Estrutura da Escada',
      'Integridade estrutural aparente, presença de fissuras ou trincas, estabilidade e desalinhamento'
    ),
    E(
      'Corrimão',
      'Presença, fixação, altura adequada, estabilidade, continuidade ao longo da escada e acabamento'
    ),
    E(
      'Guarda-corpo',
      'Fixação, altura adequada, segurança, integridade e acabamento'
    ),
    E(
      'Iluminação',
      'Iluminação adequada para circulação segura'
    ),
    E('Limpeza', 'Limpeza geral da escada'),
    E(
      'Dimensões e Conformidade',
      'Proporção adequada entre piso e espelho e compatibilidade com uso residencial'
    ),
  ],

  varanda_sacada: [
    E(
      'Piso',
      'Nivelamento, caimento adequado para escoamento, presença de peças ocas, trincas, fissuras ou quebras, desgaste superficial, acabamento, rejuntamento, acúmulo de água'
    ),
    E(
      'Ralos',
      'Funcionamento do escoamento, presença de obstruções, posicionamento adequado, vedação e acabamento ao redor'
    ),
    E(
      'Guarda-corpo',
      'Fixação, estabilidade, altura adequada, segurança geral, integridade dos materiais e acabamento'
    ),
    E(
      'Esquadrias (Porta de Acesso)',
      'Funcionamento (abertura e fechamento), vedação, alinhamento e fixação'
    ),
    E(
      'Vidros (quando houver)',
      'Trincas ou quebras, riscos, fixação e vedação'
    ),
    E(
      'Peitoril',
      'Nivelamento, fixação, acabamento e integridade'
    ),
    E(
      'Soleiras / Baguetes',
      'Nivelamento, fixação, acabamento e vedação na transição com ambiente interno'
    ),
    E(
      'Paredes',
      'Fissuras e trincas, pintura (falhas, descascamento), manchas de umidade, descolamento de revestimentos e acabamento geral'
    ),
    E(
      'Teto',
      'Fissuras e trincas, manchas, infiltrações e acabamento'
    ),
    E(
      'Instalações Elétricas',
      'Tomadas (funcionamento, fixação, espelhos), interruptores e iluminação'
    ),
    E('Limpeza', 'Condição geral de limpeza do ambiente'),
    E('Dimensões', 'Conferência das dimensões'),
  ],

  garagem: [
    E(
      'Piso',
      'Nivelamento, caimento adequado para drenagem, presença de trincas, fissuras ou quebras, desgaste superficial, acabamento e regularidade da superfície'
    ),
    E(
      'Ralos e Drenagem',
      'Funcionamento do escoamento, presença de obstruções, posicionamento adequado, acúmulo de água (empoçamento), vedação e acabamento ao redor'
    ),
    E(
      'Estrutura Aparente (Vigas e Pilares)',
      'Presença de fissuras ou trincas, desalinhamento, exposição de armadura, sinais de infiltração e integridade estrutural aparente'
    ),
    E(
      'Paredes',
      'Fissuras e trincas, manchas de umidade, pintura (falhas, descascamento) e acabamento'
    ),
    E(
      'Teto / Laje / Cobertura',
      'Fissuras e trincas, manchas, sinais de infiltração, presença de eflorescência e acabamento'
    ),
    E(
      'Portão',
      'Funcionamento (abertura e fechamento), alinhamento, fixação, estado das ferragens, sistema de travamento e automatização'
    ),
    E(
      'Instalações Elétricas',
      'Tomadas, interruptores, iluminação (funcionamento e distribuição), fixação de luminárias e acabamento das caixas elétricas'
    ),
    E(
      'Ventilação',
      'Condições de exaustão (ambientes fechados)'
    ),
    E(
      'Sinalização e Segurança',
      'Espaço de circulação, condições de manobra e segurança geral do ambiente'
    ),
    E('Limpeza', 'Condição geral de limpeza do ambiente'),
    E(
      'Dimensões e Conformidade',
      'Conferência das dimensões'
    ),
  ],

  area_gourmet_churrasqueira: [
    E(
      'Piso',
      'Nivelamento, caimento adequado para drenagem, presença de peças ocas (som cavo), trincas, fissuras ou quebras, desgaste superficial, acabamento e rejuntamento (falhas, ausência, deterioração)'
    ),
    E(
      'Revestimentos (Paredes)',
      'Fixação das peças, descolamento, alinhamento, rejuntamento, trincas ou fissuras, acabamento e presença de manchas'
    ),
    E(
      'Bancadas',
      'Nivelamento, fixação, presença de fissuras ou trincas, vedação junto à parede e acabamento'
    ),
    E(
      'Pia',
      'Fixação, vedação, funcionamento do escoamento, presença de vazamentos e acabamento'
    ),
    E(
      'Sifão e Conexões',
      'Vedação, fixação, vazamentos e instalação adequada'
    ),
    E(
      'Torneiras',
      'Funcionamento, fixação, vazamentos e pressão da água'
    ),
    E(
      'Pontos Hidráulicos',
      'Funcionamento, vedação, vazamentos aparentes e pressão da água'
    ),
    E(
      'Ralos',
      'Funcionamento do escoamento, presença de obstruções, posicionamento adequado, vedação e acabamento ao redor'
    ),
    E(
      'Churrasqueira (Estrutura)',
      'Integridade aparente e acabamento'
    ),
    E(
      'Duto de Exaustão / Chaminé',
      'Condição aparente'
    ),
    E(
      'Instalações Elétricas',
      'Tomadas (funcionamento, fixação, espelhos), interruptores, iluminação e fixação de luminárias'
    ),
    E(
      'Instalações de Gás',
      'Pontos de gás, vedação, segurança e posicionamento adequado'
    ),
    E(
      'Esquadrias (Portas e Janelas)',
      'Funcionamento, vedação, alinhamento e fixação'
    ),
    E('Vidros', 'Trincas ou quebras, fixação e vedação'),
    E(
      'Ventilação',
      'Ventilação natural, eficiência na exaustão de fumaça e circulação de ar'
    ),
    E(
      'Teto / Cobertura',
      'Fissuras e trincas, manchas, infiltrações e acabamento'
    ),
    E('Limpeza', 'Condição geral de limpeza do ambiente'),
    E('Dimensões', 'Conferência das dimensões'),
  ],

  piscina: [
    E('Revestimento', 'Falhas visuais'),
    E(
      'Bordas e Acabamentos',
      'Nivelamento, fixação, integridade, acabamento e segurança (bordas cortantes ou irregulares)'
    ),
    E(
      'Piso do Entorno',
      'Nivelamento, caimento adequado para drenagem, presença de peças ocas (som cavo), trincas, fissuras ou quebras, condição antiderrapante, rejuntamento e acúmulo de água'
    ),
    E(
      'Ralos e Drenagem',
      'Funcionamento do escoamento, presença de obstruções, posicionamento adequado e vedação'
    ),
    E(
      'Casa de Máquinas',
      'Condições gerais, organização, presença de vazamentos, fixação dos equipamentos e ventilação'
    ),
    E(
      'Bombas e Filtros',
      'Funcionamento, ruídos anormais, vazamentos e instalação adequada'
    ),
    E(
      'Instalações Elétricas',
      'Funcionamento dos equipamentos, segurança das instalações e proteção adequada'
    ),
    E(
      'Escadas / Acessos',
      'Fixação, estabilidade, segurança e integridade'
    ),
    E('Limpeza', 'Condição geral de limpeza'),
    E('Dimensões', 'Conferência das dimensões'),
  ],

  cobertura_telhado: [
    E(
      'Estrutura da Cobertura',
      'Alinhamento, fixação, integridade estrutural aparente e sinais de umidade ou deterioração'
    ),
    E(
      'Telhas',
      'Integridade (quebradas, trincadas ou danificadas), alinhamento, sobreposição adequada e presença de deslocamentos'
    ),
    E(
      'Rufos',
      'Fixação, vedação e presença de falhas'
    ),
    E(
      'Rufos, Calhas e Condutores Verticais',
      'Funcionamento do escoamento, fixação, vedação, presença de falhas, obstruções e direcionamento adequado de água'
    ),
    E(
      'Laje de Cobertura',
      'Fissuras ou trincas, acúmulo de água, caimento e sinais de infiltração'
    ),
    E(
      'Pingadeiras',
      'Funcionamento e posicionamento adequado'
    ),
    E(
      'Acesso à Cobertura',
      'Condições de acesso, segurança e facilidade de inspeção'
    ),
    E(
      'Dimensões e Conformidade',
      'Condições adequadas de escoamento'
    ),
  ],
};

export function getElementsForRoomType(roomType) {
  return ROOM_ELEMENT_TEMPLATES[roomType] || [];
}

export function buildItemsFromRoomType(roomType, roomIdPrefix) {
  const elements = getElementsForRoomType(roomType);
  return elements.map((el, idx) => ({
    id: `${roomIdPrefix}_i_${idx}`,
    name: el.name,
    verification_text: el.verificationText,
    additional_verifications: [],
    observations: '',
    photos: [],
  }));
}

/** Ordem na modal «Adicionar ambiente». */
export const ROOM_TYPE_ORDER = [
  'area_externa_comum',
  'sala_estar_jantar',
  'cozinha',
  'area_servico_lavanderia',
  'banheiro_social_lavabo',
  'quarto_suite',
  'escadas',
  'varanda_sacada',
  'area_gourmet_churrasqueira',
  'garagem',
  'piscina',
  'cobertura_telhado',
];
