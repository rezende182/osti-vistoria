/**
 * Layout comum dos PDFs (Helvetica ≈ Arial no PDF embutido).
 * Corpo 12 pt; entre linhas ~1,5× altura do corpo + 1,5 mm.
 */
export const PDF_FONT = 'helvetica';
export const PDF_BODY_PT = 12;
export const PDF_BODY_LINE_MM = 7.5;

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

/**
 * Parágrafos de corpo: 12 pt, linhas justificadas (última linha do bloco alinhada à esquerda).
 */
export function drawBodyParagraphs(doc, text, margin, contentWidth, yStart, checkNewPage) {
  if (!text || !String(text).trim()) return yStart;

  doc.setFont(PDF_FONT, 'normal');
  doc.setFontSize(PDF_BODY_PT);
  doc.setTextColor(0, 0, 0);

  const blocks = String(text).split(/\n\n+/).filter((b) => b.trim());
  let y = yStart;

  for (const block of blocks) {
    const lines = doc.splitTextToSize(block.trim(), contentWidth);
    lines.forEach((line, lineIdx) => {
      checkNewPage(PDF_BODY_LINE_MM + 1);
      const words = line.trim().split(/\s+/).filter(Boolean);
      const isLast = lineIdx === lines.length - 1;
      if (words.length > 1 && !isLast) {
        justifyLine(doc, words, margin, y, contentWidth);
      } else {
        doc.text(line, margin, y);
      }
      y += PDF_BODY_LINE_MM;
    });
    y += 4;
  }

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
 * ASSINATURA: + área vazia para assinatura digital.
 */
export function drawSignatureBlock(
  doc,
  margin,
  contentWidth,
  yPos,
  reservedHeightMm,
  checkNewPage
) {
  checkNewPage(reservedHeightMm + 24);
  doc.setFont(PDF_FONT, 'bold');
  doc.setFontSize(PDF_BODY_PT);
  doc.setTextColor(0, 0, 0);
  doc.text('ASSINATURA:', margin, yPos);
  const y = yPos + 8;
  doc.setDrawColor(210, 210, 210);
  doc.setLineWidth(0.35);
  doc.rect(margin, y, contentWidth, reservedHeightMm);
  return y + reservedHeightMm + 12;
}
