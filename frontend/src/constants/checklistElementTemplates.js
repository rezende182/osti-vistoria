/**
 * Por tipo de ambiente (room_type): elementos e texto de verificação.
 */

/** Nome exibido ao adicionar ambiente (tabs / título base). */
export const ROOM_TYPE_LABELS = {
  area_externa_comum: 'ÁREA EXTERNA/COMUM',
  sala_estar_jantar: 'SALA/ESTAR/JANTAR',
  cozinha: 'COZINHA',
  area_servico_lavanderia: 'ÁREA DE SERVIÇO/LAVANDERIA',
  banheiro_social_lavabo: 'BANHEIRO SOCIAL/LAVABO',
  quarto_suite: 'QUARTO/SUITE',
  varanda_sacada: 'VARANDA/SACADA',
  area_gourmet: 'ÁREA GOURMET',
  garagem: 'GARAGEM',
  cobertura_telhado: 'COBERTURA/TELHADO',
};

function capitalizeFirst(text) {
  const t = (text || '').trim();
  if (!t) return '';
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Nome do elemento + texto dos itens verificados. */
function E(name, verificationText) {
  return {
    name: capitalizeFirst(name.trim()),
    verificationText: String(verificationText || '').trim(),
  };
}

/** Textos de verificação reutilizáveis por tipo de elemento. */
const V = {
  pisoAreaExterna:
    'Nivelamento geral, caimento adequado para drenagem, presença de peças soltas ou ocas, trincas, fissuras ou quebras, desgaste superficial ou acabamento inadequado e rejuntamento.',
  pisoCeramica:
    'Nivelamento, alinhamento, presença de peças ocas, trincas, fissuras ou quebras, desgaste superficial, acabamento e rejuntamento.',
  pisoContrapiso:
    'Nivelamento, regularidade da superfície, fissuras ou trincas, desagregação (farelamento), umidade, aderência/coesão, e condições para receber revestimento.',
  pisoAreaMolhada:
    'Nivelamento, caimento adequado em direção ao ralo, presença de peças ocas, trincas, fissuras ou quebras, desgaste superficial, acabamento, rejuntamento e acúmulo de água fora da área de escoamento.',
  ralosDrenagemExterna:
    'Funcionamento do escoamento, presença de obstruções, vedação, fixação das grelhas, posicionamento adequado, caimento do piso, retorno de odores, acúmulo de água (empoçamento) e acabamento ao redor.',
  ralos:
    'Funcionamento do escoamento, presença de obstruções, retorno de odores, acabamento ao redor e vedação.',
  murosFechamentos:
    'Fissuras e trincas, desalinhamento ou inclinação, condições da pintura (manchas, descascamento), presença de umidade ou infiltrações e integridade estrutural aparente.',
  fachada:
    'Fissuras e trincas, descolamento de revestimentos, falhas de pintura, manchas de umidade e acabamento geral.',
  portoesAcessos:
    'Funcionamento (abertura/fechamento), alinhamento, fixação das ferragens, estado de conservação e sistema de travamento.',
  calcadasAcessos:
    'Nivelamento, condição do piso, presença de trincas ou desníveis e segurança de circulação.',
  estruturaVigas:
    'Presença de fissuras ou trincas, desalinhamento, exposição de armadura, falhas de acabamento e sinais de infiltração.',
  limpeza: 'Condição geral de limpeza do ambiente.',
  dimensoes: 'Conferência das dimensões do ambiente.',
  instalacoesHidraulicas:
    'Pontos de água, torneiras, registros, sifões, tubulações aparentes, conexões, vedação, vazamentos, pressão da água, funcionamento geral e acabamento dos pontos.',
  rodapes: 'Fixação, alinhamento, acabamento, descolamento e integridade.',
  paredes:
    'Fissuras e trincas, ondulações ou empenamento, prumo, acabamento superficial e presença de umidade ou infiltrações.',
  pintura: 'Uniformidade, manchas, bolhas, descascamento e falhas de aplicação.',
  teto: 'Fissuras e trincas, manchas, sinais de infiltração, nivelamento e acabamento.',
  tomadasInterruptores:
    'Funcionamento, fixação, presença de espelhos, quantidade adequada, acionamento adequado e identificação.',
  iluminacao:
    'Funcionamento dos pontos de luz, fixação de luminárias, acionamento, distribuição/iluminação do ambiente, fiação aparente e acabamento.',
  quadroEnergia:
    'Fixação, identificação dos circuitos, organização interna, disjuntores, barramentos, fiação, aterramento, proteção (DR/DPS), tampa/fechamento, aquecimento anormal, sinais de sobrecarga, acessibilidade, segurança e acabamento geral.',
  esquadriaPorta:
    'Funcionamento (abertura e fechamento), alinhamento, fixação, vedação, ferragens (dobradiças, fechaduras), empenamento, folgas, acabamento e integridade geral.',
  esquadriaJanela:
    'Funcionamento (abertura e fechamento), alinhamento, fixação, vedação, ferragens (trilhos, roldanas, travas), vidros, acabamento e integridade geral.',
  vidro: 'Presença de trinca ou quebras, riscos e fixação.',
  peitoril: 'Nivelamento, fixação, acabamento e integridade.',
  soleiraBaguete: 'Nivelamento, fixação, acabamento e transição entre ambientes.',
  infraAC:
    'Presença de ponto elétrico, dreno, espaço para instalação, e acabamento dos pontos.',
  revestimentoAzulejo:
    'Fixação das peças, descolamento, alinhamento, rejuntamento, trincas ou fissuras e acabamento.',
  bancadas:
    'Nivelamento, fixação, presença de fissuras ou trincas, vedação e acabamento.',
  pia: 'Fixação, vedação, funcionamento do escoamento, presença de vazamentos e acabamento.',
  ventilacao: 'Condições de exaustão (ambientes fechados).',
  vasoSanitario:
    'Fixação, estabilidade, funcionamento da descarga, vedação na base, vazamentos e acabamento.',
  lavatorioCuba:
    'Fixação, nivelamento, vedação com a parede ou bancada, escoamento e presença de vazamentos.',
  boxBanho:
    'Vedação, fixação, funcionamento e presença de vazamentos para fora da área molhada.',
  escada:
    'Estrutura, fixação, degraus (nivelamento e uniformidade), piso/revestimento (desgaste e antiderrapante), espelhos, bordas/acabamento, corrimão (fixação e altura) e segurança de uso.',
  tanque:
    'Fixação, nivelamento, vedação, integridade e funcionamento do escoamento.',
  instalacaoMaquina:
    'Ponto de água, ponto de esgoto, tomada elétrica, posicionamento adequado e condições para instalação.',
  guardaCorpo:
    'Fixação, estabilidade, altura adequada, segurança geral, integridade dos materiais e acabamento.',
  churrasqueiraEstrutura:
    'Integridade aparente, revestimento, grelha e suportes, duto/chaminé (exaustão), bancada/apoio e limpeza geral.',
  instalacoesGas: 'Pontos de gás, vedação, segurança e posicionamento adequado.',
  piscina:
    'Estrutura, fixação, revestimento, bordas e acabamento, piso ao redor (nivelamento, caimento e antiderrapante), drenagem (ralos), casa de máquinas (bomba e filtro), sistema hidráulico, escadas/acessos, segurança, limpeza geral e dimensões.',
  moveis:
    'Estrutura, acabamento, ferragens, funcionamento, portas, gavetas e condições gerais.',
  eletrodomesticos: 'Estado geral e funcionamento.',
};

/**
 * Catálogo completo para «Adicionar item» (qualquer ambiente).
 * Itens já presentes no ambiente são filtrados por nome.
 * Ordem: geral → estrutura/circulação → pisos → fachadas/acessos → verticais → esquadrias → elétrica → água/gás → banho/lavanderia → lazer → mobiliário.
 */
export const MASTER_ITEM_CATALOG = [
  E('Limpeza', V.limpeza),
  E('Dimensões', V.dimensoes),
  E('Estrutura Aparente (Vigas e Pilares)', V.estruturaVigas),
  E('Escada', V.escada),
  E('Guarda-corpo', V.guardaCorpo),
  E('Piso (Cerâmica)', V.pisoCeramica),
  E('Piso (Contrapiso)', V.pisoContrapiso),
  E('Piso (Área Externa)', V.pisoAreaExterna),
  E('Piso (Área Molhada)', V.pisoAreaMolhada),
  E('Calçadas e Acessos', V.calcadasAcessos),
  E('Muros e Fechamentos', V.murosFechamentos),
  E('Fachada', V.fachada),
  E('Portões e Acessos', V.portoesAcessos),
  E('Ralos e Drenagem (Área Externa)', V.ralosDrenagemExterna),
  E('Ralos', V.ralos),
  E('Paredes', V.paredes),
  E('Pintura', V.pintura),
  E('Teto', V.teto),
  E('Rodapés', V.rodapes),
  E('Revestimento da Parede (Azulejo)', V.revestimentoAzulejo),
  E('Esquadria (Porta)', V.esquadriaPorta),
  E('Esquadria (Janela)', V.esquadriaJanela),
  E('Peitoril', V.peitoril),
  E('Soleira / Baguete', V.soleiraBaguete),
  E('Tomadas e Interruptores', V.tomadasInterruptores),
  E('Iluminação', V.iluminacao),
  E('Quadro de energia', V.quadroEnergia),
  E('Infraestrutura para Ar-Condicionado', V.infraAC),
  E('Instalações Hidráulicas', V.instalacoesHidraulicas),
  E('Instalações de Gás', V.instalacoesGas),
  E('Ventilação', V.ventilacao),
  E('Pia', V.pia),
  E('Bancadas', V.bancadas),
  E('Vaso Sanitário', V.vasoSanitario),
  E('Lavatório / Cuba', V.lavatorioCuba),
  E('Box / Área de Banho', V.boxBanho),
  E('Tanque', V.tanque),
  E('Instalação para Máquina de Lavar', V.instalacaoMaquina),
  E('Piscina', V.piscina),
  E('Churrasqueira (Estrutura)', V.churrasqueiraEstrutura),
  E('Móveis', V.moveis),
  E('Eletrodomésticos', V.eletrodomesticos),
];

/** @type {Record<string, Array<{ name: string, verificationText: string }>>} */
export const ROOM_ELEMENT_TEMPLATES = {
  sala_estar_jantar: [
    E('Piso (Cerâmica)', V.pisoCeramica),
    E('Rodapés', V.rodapes),
    E('Paredes', V.paredes),
    E('Pintura', V.pintura),
    E('Teto', V.teto),
    E('Tomadas e Interruptores', V.tomadasInterruptores),
    E('Iluminação', V.iluminacao),
    E('Quadro de energia', V.quadroEnergia),
    E('Esquadria (Porta)', V.esquadriaPorta),
    E('Esquadria (Janela)', V.esquadriaJanela),
    E('Peitoril', V.peitoril),
    E('Soleira / Baguete', V.soleiraBaguete),
    E('Limpeza', V.limpeza),
    E('Dimensões', V.dimensoes),
  ],

  quarto_suite: [
    E('Piso (Cerâmica)', V.pisoCeramica),
    E('Rodapés', V.rodapes),
    E('Paredes', V.paredes),
    E('Pintura', V.pintura),
    E('Teto', V.teto),
    E('Tomadas e Interruptores', V.tomadasInterruptores),
    E('Iluminação', V.iluminacao),
    E('Esquadria (Porta)', V.esquadriaPorta),
    E('Esquadria (Janela)', V.esquadriaJanela),
    E('Peitoril', V.peitoril),
    E('Soleira / Baguete', V.soleiraBaguete),
    E('Limpeza', V.limpeza),
    E('Dimensões', V.dimensoes),
  ],

  cozinha: [
    E('Piso (Área Molhada)', V.pisoAreaMolhada),
    E('Rodapés', V.rodapes),
    E('Paredes', V.paredes),
    E('Pintura', V.pintura),
    E('Teto', V.teto),
    E('Revestimento da Parede (Azulejo)', V.revestimentoAzulejo),
    E('Bancadas', V.bancadas),
    E('Pia', V.pia),
    E('Instalações Hidráulicas', V.instalacoesHidraulicas),
    E('Ralos', V.ralos),
    E('Tomadas e Interruptores', V.tomadasInterruptores),
    E('Iluminação', V.iluminacao),
    E('Esquadria (Janela)', V.esquadriaJanela),
    E('Limpeza', V.limpeza),
    E('Dimensões', V.dimensoes),
  ],

  banheiro_social_lavabo: [
    E('Piso (Área Molhada)', V.pisoAreaMolhada),
    E('Revestimento da Parede (Azulejo)', V.revestimentoAzulejo),
    E('Teto', V.teto),
    E('Ralos', V.ralos),
    E('Instalações Hidráulicas', V.instalacoesHidraulicas),
    E('Vaso Sanitário', V.vasoSanitario),
    E('Lavatório / Cuba', V.lavatorioCuba),
    E('Box / Área de Banho', V.boxBanho),
    E('Tomadas e Interruptores', V.tomadasInterruptores),
    E('Iluminação', V.iluminacao),
    E('Esquadria (Janela)', V.esquadriaJanela),
    E('Limpeza', V.limpeza),
    E('Dimensões', V.dimensoes),
  ],

  area_servico_lavanderia: [
    E('Piso (Área Molhada)', V.pisoAreaMolhada),
    E('Paredes', V.paredes),
    E('Teto', V.teto),
    E('Ralos', V.ralos),
    E('Instalações Hidráulicas', V.instalacoesHidraulicas),
    E('Tanque', V.tanque),
    E('Instalação para Máquina de Lavar', V.instalacaoMaquina),
    E('Tomadas e Interruptores', V.tomadasInterruptores),
    E('Iluminação', V.iluminacao),
    E('Esquadria (Janela)', V.esquadriaJanela),
    E('Limpeza', V.limpeza),
    E('Dimensões', V.dimensoes),
  ],

  varanda_sacada: [
    E('Piso (Área Externa)', V.pisoAreaExterna),
    E('Ralos', V.ralos),
    E('Guarda-corpo', V.guardaCorpo),
    E('Esquadria (Porta)', V.esquadriaPorta),
    E('Peitoril', V.peitoril),
    E('Paredes', V.paredes),
    E('Teto', V.teto),
    E('Iluminação', V.iluminacao),
    E('Limpeza', V.limpeza),
    E('Dimensões', V.dimensoes),
  ],

  area_gourmet: [
    E('Piso (Área Externa)', V.pisoAreaExterna),
    E('Revestimento da Parede (Azulejo)', V.revestimentoAzulejo),
    E('Bancadas', V.bancadas),
    E('Pia', V.pia),
    E('Instalações Hidráulicas', V.instalacoesHidraulicas),
    E('Ralos', V.ralos),
    E('Churrasqueira (Estrutura)', V.churrasqueiraEstrutura),
    E('Iluminação', V.iluminacao),
    E('Limpeza', V.limpeza),
    E('Dimensões', V.dimensoes),
  ],

  garagem: [
    E('Piso (Área Externa)', V.pisoAreaExterna),
    E('Paredes', V.paredes),
    E('Ralos e Drenagem (Área Externa)', V.ralosDrenagemExterna),
    E('Portões e Acessos', V.portoesAcessos),
    E('Estrutura Aparente (Vigas e Pilares)', V.estruturaVigas),
    E('Iluminação', V.iluminacao),
    E('Limpeza', V.limpeza),
    E('Dimensões', V.dimensoes),
  ],

  area_externa_comum: [
    E('Piso (Área Externa)', V.pisoAreaExterna),
    E('Ralos e Drenagem (Área Externa)', V.ralosDrenagemExterna),
    E('Muros e Fechamentos', V.murosFechamentos),
    E('Fachada', V.fachada),
    E('Calçadas e Acessos', V.calcadasAcessos),
    E('Instalações Hidráulicas', V.instalacoesHidraulicas),
    E('Limpeza', V.limpeza),
    E('Dimensões', V.dimensoes),
  ],

  cobertura_telhado: [],
};

export function getElementsForRoomType(roomType) {
  return ROOM_ELEMENT_TEMPLATES[roomType] || [];
}

/** Comparação de nomes de item (acentos, maiúsculas). */
export function normalizeChecklistItemName(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** Texto de verificação do catálogo mestre para um nome de item (ou null). */
export function getMasterCatalogEntryByName(itemName) {
  const n = normalizeChecklistItemName(itemName);
  return MASTER_ITEM_CATALOG.find((el) => normalizeChecklistItemName(el.name) === n) || null;
}

/** Itens do catálogo global ainda não adicionados ao ambiente (comparação por nome, sem acentos). */
export function getAvailableElementsToAdd(existingItemNames) {
  const used = new Set((existingItemNames || []).map(normalizeChecklistItemName));
  return MASTER_ITEM_CATALOG.filter((el) => !used.has(normalizeChecklistItemName(el.name)));
}

export function buildItemsFromRoomType(roomType, roomIdPrefix) {
  const elements = getElementsForRoomType(roomType);
  return elements.map((el, idx) => ({
    id: `${roomIdPrefix}_i_${idx}`,
    name: el.name,
    verification_text: el.verificationText,
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
  'varanda_sacada',
  'area_gourmet',
  'garagem',
  'cobertura_telhado',
];
