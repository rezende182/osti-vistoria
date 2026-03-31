/** Textos alternáveis no app — fluxo Entrega (objetivo e metodologia). */

export const LAUDO_OBJETIVO_PRESETS = [
  'Avaliar se o imóvel atende às condições de conformidade quanto ao uso, habitabilidade e desempenho, com base nas condições aparentes observadas durante a vistoria.',
  'O presente laudo tem por objetivo avaliar a conformidade do imóvel vistoriado, com base nas condições aparentes verificadas no momento da inspeção, quanto aos aspectos de uso, habitabilidade, segurança e desempenho, bem como identificar eventuais não conformidades construtivas.',
  'O presente laudo tem por objetivo verificar a conformidade do imóvel vistoriado, considerando as condições aparentes identificadas durante a inspeção, no que se refere aos requisitos de uso, habitabilidade, segurança e desempenho, além de apontar possíveis não conformidades construtivas.',
  'Avaliar se o imóvel apresenta condições adequadas de uso, habitabilidade e desempenho, considerando as condições aparentes verificadas no momento da inspeção.',
];

export const METODOLOGIA_PLACEHOLDER_REG_NC = '[REGISTRO FOTOGRÁFICO]';

export const LAUDO_METODOLOGIA_PRESETS = [
  [
    'A elaboração do presente laudo baseou-se na realização de inspeção técnica de recebimento do imóvel, conduzida por meio de vistoria in loco, de caráter predominantemente visual, com foco na análise das condições aparentes dos sistemas construtivos.',
    'Foram verificados os elementos construtivos, acabamentos, instalações e componentes da edificação, considerando aspectos de uso, habitabilidade, segurança e desempenho, conforme critérios técnicos e boas práticas da engenharia.',
    'Durante a vistoria, procedeu-se à análise das condições aparentes, com a identificação, quando existente, de anomalias e não conformidades, devidamente descritas e registradas por meio de documentação fotográfica.',
    'Não foram realizados ensaios destrutivos ou testes específicos, restringindo-se a avaliação às condições visíveis no momento da inspeção.',
  ].join('\n'),
  [
    'O presente laudo foi elaborado a partir de inspeção técnica realizada no imóvel, por meio de vistoria in loco, com abordagem predominantemente visual, visando à verificação das condições aparentes dos sistemas construtivos.',
    'A análise abrangeu os elementos construtivos, acabamentos e instalações, considerando critérios relacionados ao uso, habitabilidade, segurança e desempenho, com base nas boas práticas da engenharia.',
    'As condições observadas foram registradas tecnicamente, sendo eventuais anomalias e não conformidades identificadas, quando constatadas, descritas e documentadas, por meio de registro fotográfico.',
    'A avaliação limitou-se às condições aparentes, não incluindo ensaios ou intervenções invasivas.',
  ].join('\n'),
  [
    'A metodologia adotada consistiu na realização de inspeção técnica visual do imóvel, efetuada in loco, com o objetivo de avaliar as condições aparentes dos sistemas construtivos no momento da vistoria.',
    'Foram analisados os elementos construtivos, acabamentos e instalações, considerando parâmetros de uso, segurança, habitabilidade e desempenho, conforme critérios técnicos aplicáveis.',
    'Durante a inspeção, foram observadas as condições aparentes do imóvel, com a identificação, quando existente, de eventuais não conformidades, devidamente descritas, por meio de registros fotográficos.',
    'Não foram realizados ensaios destrutivos ou análises complementares, restringindo-se a avaliação às condições visíveis.',
  ].join('\n'),
  [
    'A metodologia empregada consistiu na realização de vistoria técnica no imóvel, conduzida de forma presencial e com abordagem visual, visando à avaliação das condições aparentes no momento da inspeção.',
    'Foram avaliados os sistemas construtivos, acabamentos e instalações, considerando critérios técnicos relacionados ao uso, segurança e desempenho.',
    'Durante a vistoria, foram analisadas as condições aparentes, sendo eventuais não conformidades, quando existentes, devidamente descritas e registradas, por meio de documentação fotográfica.',
    'A avaliação restringiu-se às condições visíveis, não incluindo procedimentos invasivos ou ensaios técnicos.',
  ].join('\n'),
];

/** Próximo preset de objetivo a partir do texto atual (ciclo). */
export function nextObjetivoPreset(currentText) {
  const presets = LAUDO_OBJETIVO_PRESETS;
  if (!presets.length) return '';
  const t = String(currentText || '').trim();
  const idx = presets.findIndex((p) => p.trim() === t);
  const next = idx >= 0 ? (idx + 1) % presets.length : 0;
  return presets[next];
}

/** Próximo preset de metodologia a partir do texto atual (ciclo). */
export function nextMetodologiaPreset(currentText) {
  const presets = LAUDO_METODOLOGIA_PRESETS;
  if (!presets.length) return '';
  const t = String(currentText || '').trim();
  const idx = presets.findIndex((p) => p.trim() === t);
  const next = idx >= 0 ? (idx + 1) % presets.length : 0;
  return presets[next];
}
