/**
 * Textos automáticos de conclusão (valores de API: aprovado | aprovado_com_ressalvas | reprovado).
 */
export const TEXTOS_CONCLUSAO = {
  aprovado: `Conclui-se que o imóvel vistoriado, na data da inspeção, não apresenta não conformidades aparentes, observando-se condições adequadas de uso, habitabilidade, segurança e desempenho, em consonância com as boas práticas construtivas e com os critérios técnicos aplicáveis.

A presente avaliação foi realizada por meio de inspeção predominantemente visual, sem a execução de ensaios destrutivos, testes específicos ou análises laboratoriais, restringindo-se às condições aparentes no momento da vistoria.
Destaca-se que a inexistência de manifestações patológicas aparentes não implica na garantia da ausência de vícios construtivos ocultos, os quais poderão se manifestar ao longo do tempo, em função do uso, das condições de exposição e/ou de características inerentes aos sistemas construtivos empregados.
Permanecem resguardadas, portanto, as responsabilidades legais dos agentes envolvidos na cadeia construtiva, nos termos da legislação vigente, especialmente no que se refere à qualidade, desempenho e durabilidade da edificação.`,

  aprovado_com_ressalvas: `Conclui-se que o imóvel vistoriado, na data da inspeção, apresenta não conformidades aparentes, as quais podem comprometer, ainda que parcialmente, as condições de uso, habitabilidade, segurança e desempenho da edificação, não estando plenamente em conformidade com as boas práticas construtivas e critérios técnicos aplicáveis.
A presente avaliação foi realizada por meio de inspeção predominantemente visual, sem a execução de ensaios destrutivos, testes específicos ou análises laboratoriais, restringindo-se às condições aparentes no momento da vistoria.
As não conformidades identificadas demandam a adoção de medidas corretivas, visando à adequação dos sistemas construtivos e à garantia do desempenho esperado ao longo da vida útil da edificação.
Ressalta-se que a inexistência de outras manifestações patológicas aparentes não implica na garantia da ausência de vícios construtivos ocultos, os quais poderão se manifestar posteriormente. Permanecem resguardadas, portanto, as responsabilidades legais dos agentes envolvidos, nos termos da legislação vigente.`,

  reprovado: `Conclui-se que o imóvel vistoriado, na data da inspeção, apresenta não conformidades de caráter crítico, com potencial de comprometer de forma significativa a segurança, a habitabilidade e o desempenho global da edificação, não atendendo aos critérios técnicos mínimos e às boas práticas construtivas.
A presente avaliação foi realizada por meio de inspeção predominantemente visual, sem a execução de ensaios destrutivos, testes específicos ou análises laboratoriais, restringindo-se às condições aparentes no momento da vistoria.
As anomalias identificadas requerem a adoção imediata de medidas corretivas, sob pena de agravamento das patologias existentes, redução da vida útil dos sistemas construtivos e possíveis riscos aos usuários.
Destaca-se que a análise não contempla a identificação de eventuais vícios ocultos, os quais poderão se manifestar ao longo do tempo. Permanecem resguardadas, portanto, as responsabilidades legais dos agentes envolvidos na cadeia construtiva, conforme legislação vigente.`,
};

/** Rótulos exibidos na UI e no PDF */
export const CLASSIFICACAO_FINAL_LABELS = {
  aprovado:
    'IMÓVEL CONFORME - Imóvel em condições adequadas, sem não conformidades.',
  aprovado_com_ressalvas:
    'IMÓVEL COM NÃO CONFORMIDADES - Imóvel com não conformidades, necessitando correções.',
  reprovado:
    'IMÓVEL NÃO CONFORME (CRÍTICO) - Imóvel com não conformidades graves, exigindo intervenção imediata.',
  outro: 'Outras conformidades',
};

/** Versões curtas para cartões e detalhe (abas do dashboard usam rótulos próprios) */
export const CLASSIFICACAO_BADGE_SHORT = {
  aprovado: 'CONFORME',
  aprovado_com_ressalvas: 'C/ NÃO CONF.',
  reprovado: 'NÃO CONFORME',
  outro: 'OUTRAS',
};

/** Textos automáticos legados (para detectar se a conclusão ainda é “padrão” e pode ser substituída) */
const LEGACY_TEXTOS_SNIPPETS = [
  'Dessa forma, o imóvel é considerado APROVADO',
  'APROVADO COM RESSALVAS',
  'o imóvel é considerado REPROVADO',
  'Foram identificadas não conformidades de natureza executiva',
  'O imóvel apresenta não conformidades de caráter relevante',
  'Conclui-se que o imóvel vistoriado, na data da inspeção, não apresenta não conformidades aparentes',
];

export function conclusaoPareceAutomatica(conclusao) {
  if (!conclusao || !String(conclusao).trim()) return true;
  const t = conclusao.trim();
  if (Object.values(TEXTOS_CONCLUSAO).some((txt) => txt.trim() === t)) return true;
  return LEGACY_TEXTOS_SNIPPETS.some((s) => t.includes(s));
}
