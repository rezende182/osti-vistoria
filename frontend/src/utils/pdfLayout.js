/**
 * Layout comum dos PDFs. No motor embutido do jsPDF, Helvetica equivale visualmente a Arial.
 * Corpo 12 pt, entrelinha 1,5, justificado em drawBodyParagraphs; hierarquia de títulos conforme laudos de vistoria.
 */
export const PDF_FONT = 'helvetica';
export const PDF_BODY_PT = 12;
/** pt → mm (coordenadas jsPDF em mm) */
export const PDF_PT_TO_MM = 25.4 / 72;
/** Entrelinha 1,5 (corpo e medidas derivadas). */
export const PDF_LINE_HEIGHT_FACTOR = 1.5;
export const PDF_BODY_LINE_MM = PDF_BODY_PT * PDF_PT_TO_MM * PDF_LINE_HEIGHT_FACTOR;

/** Margens laterais (2 cm). */
export const PDF_PAGE_MARGIN_SIDE_MM = 20;
/** Zona superior / cabeçalho (2,7 cm). */
export const PDF_PAGE_MARGIN_TOP_MM = 27;
/** Zona inferior / rodapé (1,5 cm). */
export const PDF_PAGE_MARGIN_BOTTOM_MM = 15;

/** Margem lateral — alias para compatibilidade com `PDF_PAGE_MARGIN_MM`. */
export const PDF_PAGE_MARGIN_MM = PDF_PAGE_MARGIN_SIDE_MM;

/** Títulos de capítulo (1., 2., …): negrito 14 pt; antes 12 pt / depois 6 pt */
export const PDF_CHAPTER_TITLE_PT = 14;
export const PDF_CHAPTER_TITLE_BEFORE_MM = 12 * PDF_PT_TO_MM;
export const PDF_CHAPTER_TITLE_AFTER_MM = 6 * PDF_PT_TO_MM;
export const PDF_CHAPTER_LINE_MM = (PDF_CHAPTER_TITLE_PT / PDF_BODY_PT) * PDF_BODY_LINE_MM;

/** Subtítulos (ex.: 4.1 SALA): negrito 12 pt; antes 8 pt / depois 4 pt */
export const PDF_SUBSECTION_BEFORE_MM = 8 * PDF_PT_TO_MM;
export const PDF_SUBSECTION_AFTER_MM = 4 * PDF_PT_TO_MM;

/** Reserva mínima sob o título para não deixar título órfão no fim da página */
export const PDF_CHAPTER_KEEP_WITH_NEXT_MM = 36;
export const PDF_SUBSECTION_KEEP_WITH_NEXT_MM = 40;
/** Secção 6 (assinatura): bloco ~12+26+10+linhas+rodapé */
export const PDF_CHAPTER_KEEP_WITH_SIGNATURE_BLOCK_MM = 102;

/** Recuo uniforme para listas e blocos do checklist (a partir da margem esquerda) */
export const PDF_LIST_INDENT_MM = 5;
/** Espaço extra entre itens de lista/checklist (valor médio 4–6 pt) */
export const PDF_LIST_ITEM_EXTRA_GAP_MM = 5 * PDF_PT_TO_MM;

/** Recuo de primeira linha em parágrafos de corpo */
export const PDF_BODY_FIRST_LINE_INDENT_MM = 12.5;
/** Espaço vertical após cada parágrafo (6 pt) */
export const PDF_PARAGRAPH_GAP_MM = 6 * PDF_PT_TO_MM;
/** Zona segura inferior (rodapé). */
export const PDF_PAGE_BOTTOM_SAFE_MM = PDF_PAGE_MARGIN_BOTTOM_MM;
/** Margem superior ao continuar após quebra de página / início de conteúdo. */
export const PDF_PAGE_TOP_SAFE_MM = PDF_PAGE_MARGIN_TOP_MM;

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
 * Altura vertical (mm) que `drawBodyParagraphs` ocuparia para o mesmo texto e largura de coluna,
 * incluindo espaços entre parágrafos. Útil para reservar espaço antes de se conhecer o texto final
 * (ex.: parágrafo com número de folhas no encerramento).
 */
export function measureBodyParagraphsHeightMm(doc, text, contentWidth, options = {}) {
  if (!text || !String(text).trim()) return 0;
  const firstLineIndentMm = options.firstLineIndentMm ?? PDF_BODY_FIRST_LINE_INDENT_MM;
  const normalized = String(text)
    .replace(/\r\n/g, '\n')
    .replace(/\u00a0/g, ' ');
  const blocks = normalized
    .split(/\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  let h = 0;
  blocks.forEach((block, blockIdx) => {
    const paraLines = buildParagraphVisualLines(doc, block, contentWidth, firstLineIndentMm);
    h += paraLines.length * PDF_BODY_LINE_MM;
    if (blockIdx < blocks.length - 1) {
      h += PDF_PARAGRAPH_GAP_MM;
    }
  });
  return h;
}

/**
 * Rótulo em negrito na 1.ª linha («Descrição: ») com o texto a seguir na mesma linha; continuação
 * justificada na largura da coluna (Helvetica 12 pt = Arial no PDF).
 */
export function measureInlineLabelParagraphMm(doc, columnWidth, boldLabel, bodyText) {
  const normalized = String(bodyText ?? '')
    .replace(/\r\n/g, ' ')
    .replace(/\n/g, ' ')
    .trim();
  const filler = normalized || '\u2014';

  doc.setFontSize(PDF_BODY_PT);
  doc.setFont(PDF_FONT, 'bold');
  const label = /\s$/.test(boldLabel) ? boldLabel : `${boldLabel} `;
  const lw = doc.getTextWidth(label);
  doc.setFont(PDF_FONT, 'normal');

  const firstLineMaxW = Math.max(12, columnWidth - lw);
  const words = filler.split(/\s+/).filter(Boolean);
  const { rest } = takeFirstLineWords(doc, words, firstLineMaxW);
  let lineCount = 1;
  if (rest.length > 0) {
    const restStr = rest.join(' ');
    const paraLines = buildParagraphVisualLines(doc, restStr, columnWidth, 0);
    lineCount += paraLines.length;
  }
  return lineCount * PDF_BODY_LINE_MM;
}

export function drawInlineLabelParagraph(
  doc,
  xLeft,
  columnWidth,
  yStart,
  boldLabel,
  bodyText,
  pageOpts = {}
) {
  const opts = {
    bottomMarginMm: pageOpts.bottomMarginMm ?? PDF_PAGE_BOTTOM_SAFE_MM,
    topMarginMm: pageOpts.topMarginMm ?? PDF_PAGE_TOP_SAFE_MM,
  };
  const normalized = String(bodyText ?? '')
    .replace(/\r\n/g, ' ')
    .replace(/\n/g, ' ')
    .trim();
  const filler = normalized || '\u2014';

  doc.setFontSize(PDF_BODY_PT);
  doc.setTextColor(0, 0, 0);
  doc.setFont(PDF_FONT, 'bold');
  const label = /\s$/.test(boldLabel) ? boldLabel : `${boldLabel} `;
  const lw = doc.getTextWidth(label);
  doc.setFont(PDF_FONT, 'normal');

  const firstLineMaxW = Math.max(12, columnWidth - lw);
  const words = filler.split(/\s+/).filter(Boolean);
  const { line: firstBodyLine, rest } = takeFirstLineWords(doc, words, firstLineMaxW);

  let y = yStart;
  y = ensureVerticalSpace(doc, y, PDF_BODY_LINE_MM, opts);

  doc.setFont(PDF_FONT, 'bold');
  doc.text(label, xLeft, y);
  doc.setFont(PDF_FONT, 'normal');

  const firstWords = firstBodyLine.trim().split(/\s+/).filter(Boolean);
  const hasMore = rest.length > 0;
  if (firstWords.length > 1 && hasMore) {
    justifyLine(doc, firstWords, xLeft + lw, y, firstLineMaxW);
  } else if (firstWords.length) {
    doc.text(firstBodyLine, xLeft + lw, y);
  }

  y += PDF_BODY_LINE_MM;

  if (rest.length === 0) return y;

  const restStr = rest.join(' ');
  const paraLines = buildParagraphVisualLines(doc, restStr, columnWidth, 0);
  paraLines.forEach((pl, lineIdx) => {
    y = ensureVerticalSpace(doc, y, PDF_BODY_LINE_MM, opts);
    const x = xLeft + pl.xOffset;
    const wds = pl.text.trim().split(/\s+/).filter(Boolean);
    const isLast = lineIdx === paraLines.length - 1;
    if (wds.length > 1 && !isLast) {
      justifyLine(doc, wds, x, y, pl.maxW);
    } else {
      doc.text(pl.text, x, y);
    }
    y += PDF_BODY_LINE_MM;
  });

  return y;
}

/**
 * Bloco de texto estilo “card” do app: fundo claro, barra azul à esquerda, cantos arredondados.
 * Texto vazio exibe traço em itálico. Textos muito longos caem em parágrafos normais (sem card).
 */
export function drawLaudoFieldCard(doc, margin, contentWidth, yStart, text, checkNewPage) {
  const stripeW = 1.35;
  const padX = 4;
  const padY = 4;
  const radius = 2.5;
  const innerX = margin + stripeW + padX;
  const innerW = Math.max(40, contentWidth - stripeW - padX * 2);

  const raw = text == null ? '' : String(text).trim();
  const filler = raw || '\u2014';

  doc.setFont(PDF_FONT, 'normal');
  doc.setFontSize(PDF_BODY_PT);

  const normalized = filler.replace(/\r\n/g, '\n').replace(/\u00a0/g, ' ');
  const blocks = normalized
    .split(/\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  const measureInnerHeight = () => {
    let h = 0;
    blocks.forEach((block, blockIdx) => {
      const paraLines = buildParagraphVisualLines(
        doc,
        block,
        innerW,
        PDF_BODY_FIRST_LINE_INDENT_MM
      );
      h += paraLines.length * PDF_BODY_LINE_MM;
      if (blockIdx < blocks.length - 1) h += PDF_PARAGRAPH_GAP_MM;
    });
    return Math.max(11, h);
  };

  const innerH = measureInnerHeight();
  const cardH = padY * 2 + innerH;
  const maxCardMm = 118;

  if (cardH > maxCardMm) {
    checkNewPage(24);
    const toDraw = raw || '\u2014';
    return drawBodyParagraphs(doc, toDraw, margin, contentWidth, yStart, checkNewPage);
  }

  checkNewPage(cardH + 10);

  const pageOpts = defaultPageOpts();
  let yCard = yStart;
  const pageHeight = doc.internal.pageSize.getHeight();
  if (yCard + cardH > pageHeight - pageOpts.bottomMarginMm) {
    doc.addPage();
    yCard = pageOpts.topMarginMm;
  }

  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, yCard, contentWidth, cardH, radius, radius, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.12);
  doc.roundedRect(margin, yCard, contentWidth, cardH, radius, radius, 'S');
  doc.setFillColor(37, 99, 235);
  doc.rect(margin, yCard, stripeW, cardH, 'F');

  let ty = yCard + padY + 4;
  doc.setTextColor(51, 65, 85);
  if (!raw) doc.setFont(PDF_FONT, 'italic');

  blocks.forEach((block, blockIdx) => {
    const paraLines = buildParagraphVisualLines(
      doc,
      block,
      innerW,
      PDF_BODY_FIRST_LINE_INDENT_MM
    );
    paraLines.forEach((pl, lineIdx) => {
      ty = ensureVerticalSpace(doc, ty, PDF_BODY_LINE_MM, pageOpts);
      const x = innerX + pl.xOffset;
      const words = pl.text.trim().split(/\s+/).filter(Boolean);
      const isLast = lineIdx === paraLines.length - 1;
      if (words.length > 1 && !isLast) {
        justifyLine(doc, words, x, ty, pl.maxW);
      } else {
        doc.text(pl.text, x, ty);
      }
      ty += PDF_BODY_LINE_MM;
    });
    if (blockIdx < blocks.length - 1) {
      ty = ensureVerticalSpace(doc, ty, PDF_PARAGRAPH_GAP_MM, pageOpts);
      ty += PDF_PARAGRAPH_GAP_MM;
    }
  });

  doc.setFont(PDF_FONT, 'normal');
  doc.setTextColor(0, 0, 0);

  return yCard + cardH + PDF_PARAGRAPH_GAP_MM;
}

const defaultPageOpts = () => ({
  bottomMarginMm: PDF_PAGE_BOTTOM_SAFE_MM,
  topMarginMm: PDF_PAGE_TOP_SAFE_MM,
});

/**
 * Título de capítulo numerado: negrito 14 pt; espaço antes 12 pt e depois 6 pt (com quebra de página se necessário).
 * `options.minFollowingMm` — se não couber título + este espaço para o conteúdo seguinte, quebra antes do título.
 */
export function drawChapterTitle(doc, margin, contentWidth, yStart, title, options = {}) {
  const {
    minFollowingMm = PDF_CHAPTER_KEEP_WITH_NEXT_MM,
    ...pageOptsRest
  } = options;
  const po = { ...defaultPageOpts(), ...pageOptsRest };
  const bottomSafe = po.bottomMarginMm;
  const topReset = po.topMarginMm;
  const pageHeight = doc.internal.pageSize.getHeight();

  doc.setFont(PDF_FONT, 'bold');
  doc.setFontSize(PDF_CHAPTER_TITLE_PT);
  doc.setTextColor(0, 0, 0);
  const lines = doc.splitTextToSize(String(title), contentWidth);
  const lineH = PDF_CHAPTER_LINE_MM;
  const totalNeeded =
    PDF_CHAPTER_TITLE_BEFORE_MM + lines.length * lineH + PDF_CHAPTER_TITLE_AFTER_MM;

  let y = yStart;
  if (y + totalNeeded + minFollowingMm > pageHeight - bottomSafe) {
    doc.addPage();
    y = topReset;
  }
  y += PDF_CHAPTER_TITLE_BEFORE_MM;

  lines.forEach((ln) => {
    if (y + lineH > pageHeight - bottomSafe) {
      doc.addPage();
      y = topReset;
    }
    doc.text(ln, margin, y);
    y += lineH;
  });
  y += PDF_CHAPTER_TITLE_AFTER_MM;
  return y;
}

/**
 * Subtítulo de secção (ex.: nome do ambiente): negrito 12 pt; antes 8 pt / depois 4 pt.
 * `options.minFollowingMm` — mantém subtítulo junto ao início do conteúdo seguinte.
 */
export function drawSubsectionTitle(doc, margin, contentWidth, yStart, title, options = {}) {
  const {
    minFollowingMm = PDF_SUBSECTION_KEEP_WITH_NEXT_MM,
    ...pageOptsRest
  } = options;
  const po = { ...defaultPageOpts(), ...pageOptsRest };
  const bottomSafe = po.bottomMarginMm;
  const topReset = po.topMarginMm;
  const pageHeight = doc.internal.pageSize.getHeight();

  doc.setFont(PDF_FONT, 'bold');
  doc.setFontSize(PDF_BODY_PT);
  doc.setTextColor(0, 0, 0);
  const lines = doc.splitTextToSize(String(title), contentWidth);
  const lineH = PDF_BODY_LINE_MM;
  const totalNeeded =
    PDF_SUBSECTION_BEFORE_MM + lines.length * lineH + PDF_SUBSECTION_AFTER_MM;

  let y = yStart;
  if (y + totalNeeded + minFollowingMm > pageHeight - bottomSafe) {
    doc.addPage();
    y = topReset;
  }
  y += PDF_SUBSECTION_BEFORE_MM;

  lines.forEach((ln) => {
    if (y + lineH > pageHeight - bottomSafe) {
      doc.addPage();
      y = topReset;
    }
    doc.text(ln, margin, y);
    y += lineH;
  });
  y += PDF_SUBSECTION_AFTER_MM;
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
  doc.setFontSize(PDF_BODY_PT);
  const maxInner = contentWidth - padX * 2;
  const lines = doc.splitTextToSize(labelText, maxInner);
  const lineH = 6;
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
 * Classificação final em texto corrido: prefixo normal + rótulo em negrito (sem faixa colorida).
 */
export function drawClassificationFinalPlain(
  doc,
  margin,
  contentWidth,
  yPos,
  labelBold
) {
  const prefix = 'Classificação Final do Imóvel: ';
  const label = String(labelBold || '—').trim();
  doc.setFont(PDF_FONT, 'normal');
  doc.setFontSize(PDF_BODY_PT);
  doc.setTextColor(0, 0, 0);

  doc.setFont(PDF_FONT, 'normal');
  const wPrefix = doc.getTextWidth(prefix);
  doc.setFont(PDF_FONT, 'bold');
  const wLabel = doc.getTextWidth(label);
  doc.setFont(PDF_FONT, 'normal');

  if (wPrefix + wLabel <= contentWidth) {
    doc.text(prefix, margin, yPos);
    doc.setFont(PDF_FONT, 'bold');
    doc.text(label, margin + wPrefix, yPos);
    doc.setFont(PDF_FONT, 'normal');
    return yPos + PDF_BODY_LINE_MM + PDF_PARAGRAPH_GAP_MM;
  }

  doc.text(prefix, margin, yPos);
  yPos += PDF_BODY_LINE_MM;
  doc.setFont(PDF_FONT, 'bold');
  const lines = doc.splitTextToSize(label, contentWidth);
  lines.forEach((ln) => {
    doc.text(ln, margin, yPos);
    yPos += PDF_BODY_LINE_MM;
  });
  doc.setFont(PDF_FONT, 'normal');
  return yPos + PDF_PARAGRAPH_GAP_MM;
}

/**
 * Secção 5: data à direita (texto livre), espaço para assinatura, linha centralizada;
 * abaixo da linha: “Responsável Técnico: (nome)” e “CREA: (número)”, centralizados.
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

  const blockH = 12 + signatureAreaMm + 10 + PDF_BODY_LINE_MM * 6 + 24;
  let y = ensureVerticalSpace(doc, yPos, blockH, pageOpts);

  const texto = String(localTexto || '').trim();
  doc.setFont(PDF_FONT, 'bold');
  doc.setFontSize(PDF_BODY_PT);
  doc.setTextColor(0, 0, 0);
  if (texto) {
    doc.text(texto, pageWidth - margin, y, { align: 'right' });
  }
  y += texto ? 16 : 4;

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

  doc.setFont(PDF_FONT, 'normal');
  doc.setFontSize(PDF_BODY_PT);
  doc.setTextColor(0, 0, 0);

  const linhaRt = `Responsável Técnico: ${nomeVal}`;
  const rtLines = doc.splitTextToSize(linhaRt, contentWidth * 0.88);
  rtLines.forEach((line) => {
    doc.text(line, pageWidth / 2, y, { align: 'center' });
    y += PDF_BODY_LINE_MM;
  });

  y += 2;
  const linhaCrea = `CREA: ${creaVal}`;
  doc.text(linhaCrea, pageWidth / 2, y, { align: 'center' });
  y += PDF_BODY_LINE_MM;

  return y + 6;
}
