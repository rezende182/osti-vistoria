/**
 * Orientações de inspeção por item (nome exibido no checklist).
 * Chaves normalizadas para casar variações de hífen, maiúsculas e rótulos parecidos.
 */
export function normalizeItemNameKey(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[–—−]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

const B = (lines) => lines;

const ORIENTATION_DEFS = [
  {
    keys: ['teto'],
    title: 'Teto',
    bullets: B([
      'Verifique marcas de fôrma, fissuras, trincas e ondulações',
      'Observe manchas, diferenças de tonalidade e falhas de pintura',
      'Se houver forro, verifique manchas ou deformações',
      'Use lanterna para identificar irregularidades',
      'Atenção: manchas amareladas podem indicar infiltração',
    ]),
  },
  {
    keys: ['paredes'],
    title: 'Paredes',
    bullets: B([
      'Verifique prumo, fissuras, trincas e ondulações',
      'Observe bolhas, manchas e descascamento de pintura',
      'Confira encontros com teto, piso e esquadrias',
      'Avalie uniformidade do acabamento',
    ]),
  },
  {
    keys: [
      'esquadrias - janela',
      'esquadrias – janela',
      'esquadria - janela',
    ],
    title: 'Esquadrias – Janela',
    bullets: B([
      'Teste abertura e fechamento',
      'Verifique vedação contra vento e água',
      'Observe alinhamento e funcionamento das travas',
      'Confira ruídos ou folgas',
    ]),
  },
  {
    keys: ['peitoril da janela', 'peitoril de janela'],
    title: 'Peitoril de Janela',
    bullets: B([
      'Verifique caimento para área externa',
      'Observe fissuras e acabamento',
      'Confira vedação nas laterais',
      'Avalie escoamento de água',
    ]),
  },
  {
    keys: ['esquadrias - porta', 'esquadrias – porta', 'esquadria - porta'],
    title: 'Esquadrias – Porta',
    bullets: B([
      'Teste abertura, fechamento e travamento',
      'Verifique alinhamento e folgas',
      'Observe batentes e dobradiças',
      'Confira maçaneta e fechadura',
    ]),
  },
  {
    keys: [
      'soleiras / baguetes',
      'soleiras',
      'soleira',
      'soleira/baguete',
      'soleiras / baguete',
    ],
    title: 'Soleiras / Baguetes',
    bullets: B([
      'Verifique nivelamento e encaixe com piso',
      'Observe fissuras e falhas de fixação',
      'Confira acabamento nas extremidades',
      'Avalie transição entre ambientes',
    ]),
  },
  {
    keys: ['pintura'],
    title: 'Pintura',
    bullets: B([
      'Verifique uniformidade de cor e textura',
      'Observe manchas, falhas e retoques aparentes',
      'Confira cantos, recortes e encontros',
      'Avalie descascamentos',
    ]),
  },
  {
    keys: [
      'piso (contrapiso / cerâmica)',
      'piso cerâmico',
      'piso (contrapiso/cerâmica)',
      'piso',
      'piso e azulejo cerâmico',
    ],
    title: 'Piso',
    bullets: B([
      'Verifique nivelamento e caimento',
      'Teste peças ocas ou soltas',
      'Observe rejuntes e alinhamento',
      'Confira cortes e acabamento',
    ]),
  },
  {
    keys: ['rodapé'],
    title: 'Rodapé',
    bullets: B([
      'Verifique alinhamento e fixação',
      'Observe falhas de acabamento',
      'Confira encontros com paredes e pisos',
      'Avalie continuidade',
    ]),
  },
  {
    keys: ['tomadas, interruptores e iluminação'],
    title: 'Tomadas, interruptores e iluminação',
    bullets: B([
      'Teste funcionamento elétrico',
      'Verifique fixação e alinhamento',
      'Observe espelhos e acabamento',
      'Teste acionamento das luzes',
    ]),
  },
  {
    keys: ['quadro de energia'],
    title: 'Quadro de energia',
    bullets: B([
      'Verifique identificação dos circuitos',
      'Observe organização interna',
      'Teste fechamento da tampa',
      'Confira segurança e acessibilidade',
    ]),
  },
  {
    keys: ['ponto de ar-condicionado'],
    title: 'Ponto de ar-condicionado',
    bullets: B([
      'Verifique tubulação e dreno',
      'Observe vedação e acabamento',
      'Confira posição e altura',
      'Avalie preparo para instalação',
    ]),
  },
  {
    keys: ['limpeza'],
    title: 'Limpeza',
    bullets: B([
      'Verifique resíduos de obra',
      'Observe poeira, entulho e sujeira geral',
      'Confira estado de entrega do ambiente',
      'Avalie necessidade de limpeza final',
    ]),
  },
  {
    keys: ['dimensões'],
    title: 'Dimensões',
    bullets: B([
      'Verifique medidas em relação ao projeto',
      'Observe alinhamentos e esquadros',
      'Confira possíveis divergências dimensionais',
      'Avalie regularidade dos ambientes',
    ]),
  },
  {
    keys: [
      'revestimento da parede (azulejo)',
      'revestimento da parede (azulejo)',
    ],
    title: 'Revestimento da Parede (azulejo)',
    bullets: B([
      'Verifique peças ocas ou soltas',
      'Observe alinhamento e paginação',
      'Confira rejuntes e cortes',
      'Avalie acabamento geral',
    ]),
  },
  {
    keys: ['pia e bancada'],
    title: 'Pia e Bancada',
    bullets: B([
      'Verifique fixação e nivelamento',
      'Observe vedação com silicone',
      'Teste escoamento da água',
      'Confira acabamento das bordas',
    ]),
  },
  {
    keys: ['louças e metais'],
    title: 'Louças e Metais',
    bullets: B([
      'Verifique fixação e estabilidade',
      'Teste funcionamento de torneiras e registros',
      'Observe riscos ou danos',
      'Confira acabamento geral',
    ]),
  },
  {
    keys: ['instalações hidráulicas'],
    title: 'Instalações Hidráulicas',
    bullets: B([
      'Verifique vazamentos aparentes',
      'Teste pressão e funcionamento',
      'Observe conexões e registros',
      'Avalie pontos de consumo',
    ]),
  },
  {
    keys: ['instalação de gás'],
    title: 'Instalação de Gás',
    bullets: B([
      'Verifique ponto e registro',
      'Observe vedação e identificação',
      'Confira posicionamento técnico',
      'Avalie segurança aparente',
    ]),
  },
  {
    keys: ['ralo'],
    title: 'Ralo',
    bullets: B([
      'Verifique escoamento da água',
      'Observe caimento do piso',
      'Confira odores ou retorno',
      'Avalie acabamento',
    ]),
  },
  {
    keys: ['ventilação forçada'],
    title: 'Ventilação Forçada',
    bullets: B([
      'Verifique funcionamento do sistema',
      'Observe ruído e fluxo de ar',
      'Teste acionamento',
      'Confira grelhas',
    ]),
  },
  {
    keys: ['interfone'],
    title: 'Interfone',
    bullets: B([
      'Teste comunicação e áudio',
      'Verifique funcionamento geral',
      'Observe fixação e acabamento',
      'Confira chamada interna',
    ]),
  },
  {
    keys: ['box de banho'],
    title: 'Box de banho',
    bullets: B([
      'Verifique abertura e fechamento',
      'Observe vedação de água',
      'Confira alinhamento e vidro',
      'Teste roldanas',
    ]),
  },
  {
    keys: ['guarda-corpo', 'guarda corpo'],
    title: 'Guarda-corpo',
    bullets: B([
      'Verifique fixação e estabilidade',
      'Observe altura e segurança',
      'Teste firmeza estrutural',
      'Confira acabamento',
    ]),
  },
];

const LOOKUP = new Map();
ORIENTATION_DEFS.forEach((def) => {
  def.keys.forEach((k) => {
    LOOKUP.set(normalizeItemNameKey(k), { title: def.title, bullets: def.bullets });
  });
});

const DEFAULT_BULLETS = B([
  'Verifique o estado geral do item em relação ao projeto e às normas aplicáveis',
  'Observe riscos, folgas, vazamentos ou falhas de acabamento',
  'Registre fotos e observações quando identificar não conformidades',
]);

/**
 * @returns {{ title: string, bullets: string[] }}
 */
export function getOrientationForItemName(itemName) {
  const n = normalizeItemNameKey(itemName);
  if (LOOKUP.has(n)) return LOOKUP.get(n);
  for (const [key, val] of LOOKUP) {
    if (n.includes(key) || key.includes(n)) return val;
  }
  return { title: itemName, bullets: DEFAULT_BULLETS };
}
