/**
 * Layout comum dos PDFs (Helvetica ≈ Arial no PDF embutido).
 * Corpo 12 pt; entre linhas ~1,5 (≈ 7,5 mm com fonte 12).
 * drawBodyParagraphs: textos corridos (conclusão, legais, observações) — não usar em títulos/tabelas.
 */
export const PDF_FONT = 'helvetica';
export const PDF_BODY_PT = 12;
export const PDF_BODY_LINE_MM = 7.5;
/** Recuo de primeira linha (~1,25 cm) em parágrafos de corpo */
export const PDF_BODY_FIRST_LINE_INDENT_MM = 12.5;
/** Espaço vertical entre parágrafos */
export const PDF_PARAGRAPH_GAP_MM = 8;
/** ~60px — zona segura para não invadir o rodapé (jsPDF em mm) */
export const PDF_PAGE_BOTTOM_SAFE_MM = 20;
/** ~60px — margem superior ao continuar após quebra de página */
export const PDF_PAGE_TOP_SAFE_MM = 20;

/**
 * Garante espaço vertical; se não couber, nova página e y reiniciado.
 */
export function ensureVerticalSpace(doc, y, spaceNeededMm, options = {}) {
  const pageHeight = doc.internal.pageSize.getHeight();
  const bottomSafe = options.bottomMarginMm ?? PDF_PAGE_BOTTOM_SAFE_MM;
  const topReset = options.topMarginMm ?? PDF_PAGE_TOP_SAFE_MM;
  if (y + spaceNeededMm > pageHeight - bottomSafe) {
    doc.addPage();
    return topReset;
  }
  return y;
}

function justifyLine(doc, words, x, y, maxWidth) {
  if (words.length === 0) return;
  if (words.length === 1) {
    doc.text(words[0], x, y);
    return;
  }
  let textW = 0;
  words.forEach((w) => {
    textW += doc.getTextWidth(w);
  });
  const gaps = words.length - 1;
  const spaceW = doc.getTextWidth(' ');
  const totalNatural = textW + gaps * spaceW;
  const extra = maxWidth - totalNatural;
  const addPerGap = gaps > 0 ? extra / gaps : 0;
  let cx = x;
  words.forEach((w, i) => {
    doc.text(w, cx, y);
    cx += doc.getTextWidth(w);
    if (i < gaps) {
      cx += spaceW + addPerGap;
    }
  });
}

/** Primeira linha do parágrafo com largura reduzida (recuo); demais palavras voltam à margem. */
function takeFirstLineWords(doc, words, maxW) {
  let line = '';
  let i = 0;
  while (i < words.length) {
    const test = line ? `${line} ${words[i]}` : words[i];
    if (doc.getTextWidth(test) <= maxW) {
      line = test;
      i++;
    } else {
      if (!line) {
        line = words[i];
        i++;
      }
      break;
    }
  }
  return { line, rest: words.slice(i) };
}

function buildParagraphVisualLines(doc, block, contentWidth, indentMm) {
  const trimmed = block.trim();
  if (!trimmed) return [];
  const words = trimmed.split(/\s+/).filter(Boolean);
  const firstMaxW = contentWidth - indentMm;
  const { line: L1, rest } = takeFirstLineWords(doc, words, firstMaxW);
  const lines = [{ text: L1, xOffset: indentMm, maxW: firstMaxW }];
  if (rest.length === 0) return lines;
  const restStr = rest.join(' ');
  const more = doc.splitTextToSize(restStr, contentWidth);
  more.forEach((ln) => lines.push({ text: ln, xOffset: 0, maxW: contentWidth }));
  return lines;
}

/**
 * Parágrafos de corpo: 12 pt, justificado, recuo 1ª linha, \\n = novo parágrafo.
 * Paginação interna: reserva inferior/superior (~60px em mm) para não invadir o rodapé.
 * `checkNewPage` é ignorado (mantido só por compatibilidade com chamadas antigas).
 */
export function drawBodyParagraphs(doc, text, margin, contentWidth, yStart, checkNewPage, options = {}) {
  if (!text || !String(text).trim()) return yStart;

  const firstLineIndentMm = options.firstLineIndentMm ?? PDF_BODY_FIRST_LINE_INDENT_MM;
  const pageOpts = {
    bottomMarginMm: options.bottomMarginMm ?? PDF_PAGE_BOTTOM_SAFE_MM,
    topMarginMm: options.topMarginMm ?? PDF_PAGE_TOP_SAFE_MM,
  };

  doc.setFont(PDF_FONT, 'normal');
  doc.setFontSize(PDF_BODY_PT);
  doc.setTextColor(0, 0, 0);

  const normalized = String(text)
    .replace(/\r\n/g, '\n')
    .replace(/\u00a0/g, ' ');
  const blocks = normalized
    .split(/\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  let y = yStart;

  blocks.forEach((block, blockIdx) => {
    const paraLines = buildParagraphVisualLines(doc, block, contentWidth, firstLineIndentMm);
    paraLines.forEach((pl, lineIdx) => {
      y = ensureVerticalSpace(doc, y, PDF_BODY_LINE_MM, pageOpts);
      const x = margin + pl.xOffset;
      const words = pl.text.trim().split(/\s+/).filter(Boolean);
      const isLast = lineIdx === paraLines.length - 1;
      if (words.length > 1 && !isLast) {
        justifyLine(doc, words, x, y, pl.maxW);
      } else {
        doc.text(pl.text, x, y);
      }
      y += PDF_BODY_LINE_MM;
    });
    if (blockIdx < blocks.length - 1) {
      y = ensureVerticalSpace(doc, y, PDF_PARAGRAPH_GAP_MM, pageOpts);
      y += PDF_PARAGRAPH_GAP_MM;
    }
  });

  return y;
}

/**
 * Faixa de classificação: fundo ajustado ao texto + padding lateral.
 */
export function drawClassificationBadge(
  doc,
  labelText,
  margin,
  contentWidth,
  yPos,
  bgColor,
  textDarkOnYellow
) {
  const padX = 4;
  const padY = 3.5;
  doc.setFont(PDF_FONT, 'bold');
  doc.setFontSize(10);
  const maxInner = contentWidth - padX * 2;
  const lines = doc.splitTextToSize(labelText, maxInner);
  const lineH = 5;
  let maxLineW = 0;
  lines.forEach((line) => {
    maxLineW = Math.max(maxLineW, doc.getTextWidth(line));
  });
  const boxW = Math.min(contentWidth, maxLineW + padX * 2);
  const boxX = margin + (contentWidth - boxW) / 2;
  const boxH = padY * 2 + lines.length * lineH;

  doc.setFillColor(...bgColor);
  doc.roundedRect(boxX, yPos, boxW, boxH, 2, 2, 'F');

  let ty = yPos + padY + 3.5;
  lines.forEach((line) => {
    if (textDarkOnYellow) {
      doc.setTextColor(0, 0, 0);
    } else {
      doc.setTextColor(255, 255, 255);
    }
    doc.text(line, boxX + boxW / 2, ty, { align: 'center' });
    ty += lineH;
  });
  doc.setTextColor(0, 0, 0);

  return yPos + boxH + 8;
}

/**
 * Secção 5: data à direita (texto livre), espaço para assinatura, linha centralizada, nome e CREA centralizados.
 */
export function drawResponsavelAssinaturaSection(
  doc,
  margin,
  pageWidth,
  contentWidth,
  yPos,
  checkNewPage,
  options = {}
) {
  const {
    localTexto = '',
    responsavel = '',
    crea = '',
    signatureAreaMm = 26,
  } = options;

  const pageOpts = {
    bottomMarginMm: options.bottomMarginMm ?? PDF_PAGE_BOTTOM_SAFE_MM,
    topMarginMm: options.topMarginMm ?? PDF_PAGE_TOP_SAFE_MM,
  };

  const blockH = 12 + signatureAreaMm + 10 + PDF_BODY_LINE_MM * 5 + 20;
  let y = ensureVerticalSpace(doc, yPos, blockH, pageOpts);

  const texto = String(localTexto || '').trim();
  doc.setFont(PDF_FONT, 'normal');
  doc.setFontSize(PDF_BODY_PT);
  doc.setTextColor(0, 0, 0);
  if (texto) {
    doc.text(texto, pageWidth - margin, y, { align: 'right' });
  }
  y += texto ? 12 : 4;

  y += signatureAreaMm;

  const lineW = Math.min(110, contentWidth);
  const lineX = margin + (contentWidth - lineW) / 2;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.line(lineX, y, lineX + lineW, y);
  y += 10;

  const nome = String(responsavel || '').trim();
  const creaStr = String(crea || '').trim();
  const nomeVal = nome && nome !== '-' ? nome : '—';
  const creaVal = creaStr && creaStr !== '-' ? creaStr : '—';

  let cy = y;
  doc.setFont(PDF_FONT, 'bold');
  doc.text('RESPONSÁVEL TÉCNICO:', pageWidth / 2, cy, { align: 'center' });
  cy += PDF_BODY_LINE_MM;

  doc.setFont(PDF_FONT, 'normal');
  const nameLines = doc.splitTextToSize(nomeVal, contentWidth * 0.88);
  nameLines.forEach((line) => {
    doc.text(line, pageWidth / 2, cy, { align: 'center' });
    cy += PDF_BODY_LINE_MM;
  });

  cy += 2;
  doc.setFont(PDF_FONT, 'bold');
  doc.text('CREA:', pageWidth / 2, cy, { align: 'center' });
  cy += PDF_BODY_LINE_MM;
  doc.setFont(PDF_FONT, 'normal');
  doc.text(creaVal, pageWidth / 2, cy, { align: 'center' });
  cy += PDF_BODY_LINE_MM;

  return cy + 6;
}
