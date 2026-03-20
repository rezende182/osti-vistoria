/**
 * Linha à direita na secção de assinatura: "Cidade - UF, DD de mês de AAAA"
 * (data ISO yyyy-mm-dd da identificação da vistoria).
 */
export function formatPdfAssinaturaDataLine(cidade, uf, dataIso) {
  const c = String(cidade || '').trim();
  const u = String(uf || '').trim().toUpperCase();
  const meses = [
    'janeiro',
    'fevereiro',
    'março',
    'abril',
    'maio',
    'junho',
    'julho',
    'agosto',
    'setembro',
    'outubro',
    'novembro',
    'dezembro',
  ];
  let textoData = '';
  if (dataIso) {
    const parts = String(dataIso).split('-').filter(Boolean);
    if (parts.length >= 3) {
      const yi = parseInt(parts[0], 10);
      const mi = parseInt(parts[1], 10);
      const di = parseInt(parts[2], 10);
      if (yi && mi && di && mi >= 1 && mi <= 12) {
        textoData = `${di} de ${meses[mi - 1]} de ${yi}`;
      }
    }
  }

  const localPart =
    c && u ? `${c} - ${u}` : c || u || '';

  if (!textoData && !localPart) return '';
  if (!textoData) return localPart;
  if (!localPart) return textoData;
  return `${localPart}, ${textoData}`;
}
