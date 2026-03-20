/**
 * Textos automáticos de conclusão (valores de API: aprovado | aprovado_com_ressalvas | reprovado).
 */
export const TEXTOS_CONCLUSAO = {
  aprovado: `O imóvel vistoriado encontra-se em conformidade com as condições esperadas para recebimento, não sendo identificadas anomalias ou vícios construtivos aparentes que comprometam seu uso, segurança ou desempenho.

Os sistemas, elementos construtivos e acabamentos avaliados apresentam funcionamento adequado, estando aptos para utilização imediata.

Dessa forma, o imóvel é considerado em conformidade técnica, podendo ser recebido sem ressalvas.`,

  aprovado_com_ressalvas: `Foram identificadas não conformidades de natureza executiva, as quais, embora não comprometam a habitabilidade imediata do imóvel, configuram desvios em relação aos padrões construtivos e de acabamento esperados. Recomenda-se a devida regularização por parte da construtora, em conformidade com os prazos de garantia e normativas técnicas vigentes.`,

  reprovado: `O imóvel apresenta não conformidades de caráter relevante, configurando desvios significativos em relação aos padrões construtivos, requisitos de desempenho e condições de segurança e habitabilidade.

Tais inconformidades comprometem o uso adequado da unidade, podendo implicar riscos ao usuário e/ou prejuízos à sua funcionalidade. Diante do exposto, não se recomenda a aceitação do imóvel na presente condição, devendo a construtora proceder com a devida regularização das anomalias identificadas, em conformidade com as exigências técnicas, normativas vigentes e obrigações contratuais.`,
};

/** Rótulos exibidos na UI e no PDF */
export const CLASSIFICACAO_FINAL_LABELS = {
  aprovado: 'APTO AO RECEBIMENTO',
  aprovado_com_ressalvas: 'RECEBIMENTO CONDICIONADO',
  reprovado: 'REPROVADO',
};

/** Versões curtas para cartões e detalhe (abas do dashboard usam rótulos próprios) */
export const CLASSIFICACAO_BADGE_SHORT = {
  aprovado: 'APTO',
  aprovado_com_ressalvas: 'CONDICIONADO',
  reprovado: 'REPROVADO',
};

/** Textos automáticos legados (para detectar se a conclusão ainda é “padrão” e pode ser substituída) */
const LEGACY_TEXTOS_SNIPPETS = [
  'Dessa forma, o imóvel é considerado APROVADO',
  'APROVADO COM RESSALVAS',
  'o imóvel é considerado REPROVADO',
  'Foram identificadas não conformidades de natureza executiva',
  'O imóvel apresenta não conformidades de caráter relevante',
];

export function conclusaoPareceAutomatica(conclusao) {
  if (!conclusao || !String(conclusao).trim()) return true;
  const t = conclusao.trim();
  if (Object.values(TEXTOS_CONCLUSAO).some((txt) => txt.trim() === t)) return true;
  return LEGACY_TEXTOS_SNIPPETS.some((s) => t.includes(s));
}
