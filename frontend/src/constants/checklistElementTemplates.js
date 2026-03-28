/**
 * Por tipo de ambiente (room_type): elementos e texto de verificação (formato contínuo).
 * Templates de itens vazios por enquanto — a repor quando definidos.
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

/** @type {Record<string, Array<{ name: string, verificationText: string }>>} */
export const ROOM_ELEMENT_TEMPLATES = {
  area_externa_comum: [],
  sala_estar_jantar: [],
  cozinha: [],
  area_servico_lavanderia: [],
  banheiro_social_lavabo: [],
  quarto_suite: [],
  varanda_sacada: [],
  area_gourmet: [],
  garagem: [],
  cobertura_telhado: [],
};

/** Limpeza e Dimensões (incl. variantes) não usam Existe / Não existe. */
export function itemSkipsExistsToggle(itemName) {
  const n = String(itemName || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return n.startsWith('limpeza') || n.startsWith('dimensoes');
}

export function getElementsForRoomType(roomType) {
  return ROOM_ELEMENT_TEMPLATES[roomType] || [];
}

export function buildItemsFromRoomType(roomType, roomIdPrefix) {
  const elements = getElementsForRoomType(roomType);
  return elements.map((el, idx) => ({
    id: `${roomIdPrefix}_i_${idx}`,
    name: el.name,
    verification_text: el.verificationText,
    exists: itemSkipsExistsToggle(el.name) ? 'sim' : null,
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
