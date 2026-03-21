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
      'Inspecionar toda a superfície sob diferentes ângulos de visão',
      'Utilizar lanterna em posição lateral para evidenciar ondulações e fissuras',
      'Verificar manchas, trincas, desníveis e falhas de pintura',
      'Caso exista forro, avaliar fixação, deformações e uniformidade',
    ]),
  },
  {
    keys: ['paredes'],
    title: 'Paredes',
    bullets: B([
      'Verificar prumo com régua de 2 m ou avaliação visual com luz lateral',
      'Inspecionar fissuras, trincas, bolhas e descascamento',
      'Avaliar encontros com teto, piso e esquadrias',
      'Observar uniformidade do acabamento',
    ]),
  },
  {
    keys: [
      'esquadrias - janela',
      'esquadrias – janela',
      'esquadria - janela',
      'esquadria – janela',
    ],
    title: 'Esquadrias – Janela',
    bullets: B([
      'Testar abertura e fechamento em ciclos completos',
      'Verificar vedação contra vento e água',
      'Avaliar alinhamento, folgas e travamento',
      'Observar ruídos, atrito ou dificuldade de operação',
    ]),
  },
  {
    keys: [
      'esquadrias - porta',
      'esquadrias – porta',
      'esquadria - porta',
      'esquadria – porta',
    ],
    title: 'Esquadrias – Porta',
    bullets: B([
      'Testar abertura e fechamento contínuo',
      'Verificar alinhamento com batente e piso',
      'Avaliar funcionamento de dobradiças e fechaduras',
      'Observar folgas, empenamentos e ruídos',
    ]),
  },
  {
    keys: ['peitoril da janela', 'peitoril de janela'],
    title: 'Peitoril de Janela',
    bullets: B([
      'Verificar caimento para área externa',
      'Inspecionar fissuras, trincas e acabamento',
      'Avaliar vedação lateral',
      'Observar escoamento de água',
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
      'Verificar nivelamento e transição entre ambientes',
      'Inspecionar fixação e possíveis descolamentos',
      'Avaliar acabamento nas bordas',
      'Observar encaixe com revestimentos',
    ]),
  },
  {
    keys: ['pintura'],
    title: 'Pintura',
    bullets: B([
      'Inspecionar sob luz lateral (natural ou lanterna)',
      'Avaliar uniformidade de cor e textura',
      'Verificar manchas, retoques e descascamentos',
      'Observar cantos e recortes',
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
      'Caminhar sobre toda a área para identificar sons ocos',
      'Verificar nivelamento e caimento',
      'Inspecionar rejuntes, alinhamento e peças soltas',
      'Observar cortes e acabamento junto às paredes',
    ]),
  },
  {
    keys: ['rodapé'],
    title: 'Rodapé',
    bullets: B([
      'Verificar alinhamento e fixação contínua',
      'Inspecionar descolamentos e falhas de acabamento',
      'Avaliar encontros com piso e parede',
      'Observar uniformidade',
    ]),
  },
  {
    keys: ['tomadas, interruptores e iluminação'],
    title: 'Tomadas, interruptores e iluminação',
    bullets: B([
      'Testar funcionamento de todos os pontos',
      'Verificar fixação e acabamento dos espelhos',
      'Avaliar acionamento de iluminação',
      'Observar falhas ou mau contato',
    ]),
  },
  {
    keys: ['quadro de energia'],
    title: 'Quadro de energia',
    bullets: B([
      'Verificar identificação dos circuitos',
      'Inspecionar organização interna dos cabos',
      'Testar abertura e fechamento da tampa',
      'Avaliar segurança e acessibilidade',
    ]),
  },
  {
    keys: ['ponto de ar-condicionado'],
    title: 'Ponto de ar-condicionado',
    bullets: B([
      'Verificar tubulação e dreno',
      'Inspecionar vedação e acabamento do ponto',
      'Avaliar posição e altura de instalação',
      'Observar preparo para uso',
    ]),
  },
  {
    keys: ['limpeza'],
    title: 'Limpeza',
    bullets: B([
      'Inspecionar todos os ambientes em diferentes níveis (piso, bancadas e cantos)',
      'Verificar resíduos de obra, poeira e entulho',
      'Avaliar áreas ocultas e atrás de portas',
      'Conferir condição geral de entrega',
    ]),
  },
  {
    keys: ['dimensões'],
    title: 'Dimensões',
    bullets: B([
      'Medir ambientes com trena ou laser',
      'Comparar com projeto arquitetônico',
      'Verificar esquadros e alinhamentos',
      'Identificar divergências dimensionais',
    ]),
  },
  {
    keys: ['revestimento da parede (azulejo)'],
    title: 'Revestimento da Parede (azulejo)',
    bullets: B([
      'Verificar peças ocas ou soltas',
      'Inspecionar alinhamento e paginação',
      'Avaliar rejuntes e cortes',
      'Observar acabamento geral',
    ]),
  },
  {
    keys: ['pia e bancada'],
    title: 'Pia e Bancada',
    bullets: B([
      'Verificar fixação e nivelamento',
      'Testar escoamento de água',
      'Inspecionar vedação com silicone',
      'Avaliar acabamento das bordas',
    ]),
  },
  {
    keys: ['louças e metais'],
    title: 'Louças e Metais',
    bullets: B([
      'Testar funcionamento de torneiras e registros',
      'Verificar fixação e estabilidade',
      'Inspecionar riscos ou danos',
      'Avaliar acabamento geral',
    ]),
  },
  {
    keys: ['instalações hidráulicas'],
    title: 'Instalações Hidráulicas',
    bullets: B([
      'Manter fluxo de água por alguns minutos',
      'Verificar vazamentos aparentes e lentos',
      'Inspecionar conexões com lanterna',
      'Testar pressão e escoamento',
    ]),
  },
  {
    keys: ['instalação de gás'],
    title: 'Instalação de Gás',
    bullets: B([
      'Verificar registros e conexões visuais',
      'Inspecionar vedação e sinalização',
      'Avaliar posicionamento técnico',
      'Observar segurança aparente',
    ]),
  },
  {
    keys: ['ralo'],
    title: 'Ralo',
    bullets: B([
      'Testar escoamento com volume de água',
      'Verificar caimento do piso',
      'Inspecionar retorno de odores',
      'Avaliar acabamento',
    ]),
  },
  {
    keys: ['ventilação forçada'],
    title: 'Ventilação Forçada',
    bullets: B([
      'Testar funcionamento do sistema',
      'Verificar fluxo de ar com papel leve',
      'Avaliar ruídos e vibração',
      'Inspecionar grelhas',
    ]),
  },
  {
    keys: ['interfone'],
    title: 'Interfone',
    bullets: B([
      'Testar comunicação e áudio',
      'Verificar funcionamento geral',
      'Avaliar fixação e acabamento',
      'Inspecionar qualidade de chamada',
    ]),
  },
  {
    keys: ['box de banho'],
    title: 'Box de banho',
    bullets: B([
      'Testar abertura e fechamento',
      'Verificar vedação de água',
      'Inspecionar roldanas e trilhos',
      'Avaliar alinhamento e vidro',
    ]),
  },
  {
    keys: ['guarda-corpo', 'guarda corpo'],
    title: 'Guarda-corpo',
    bullets: B([
      'Aplicar leve pressão para testar estabilidade',
      'Verificar fixação estrutural',
      'Avaliar altura e segurança',
      'Inspecionar acabamento geral',
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
