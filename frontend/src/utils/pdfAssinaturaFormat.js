/**
 * Linha à direita na secção de assinatura: "Cidade, DD de mês de AAAA"
 * (data ISO yyyy-mm-dd da realização do laudo).
 */
export function formatPdfAssinaturaDataLine(cidade, dataIso) {
  const c = String(cidade || '').trim();
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
  if (!dataIso) return c;
  const parts = String(dataIso).split('-').filter(Boolean);
  if (parts.length < 3) return c;
  const yi = parseInt(parts[0], 10);
  const mi = parseInt(parts[1], 10);
  const di = parseInt(parts[2], 10);
  if (!yi || !mi || !di || mi < 1 || mi > 12) return c;
  const textoData = `${di} de ${meses[mi - 1]} de ${yi}`;
  if (!c) return textoData;
  return `${c}, ${textoData}`;
}
