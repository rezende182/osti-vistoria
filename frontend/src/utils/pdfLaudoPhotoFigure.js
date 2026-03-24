/**
 * Bloco figura (laudo de engenharia, jsPDF): área fixa 10×15 cm (2:3) para todas as imagens;
 * legenda “Foto N. …” logo abaixo da foto, mesmo alinhamento e largura. Bloco indivisível entre páginas.
 */
import {
  ensureVerticalSpace,
  PDF_PAGE_BOTTOM_SAFE_MM,
  PDF_PAGE_TOP_SAFE_MM,
} from './pdfLayout';

/** Largura padrão da foto 10 cm */
export const PDF_LAUDO_PHOTO_WIDTH_MM = 100;
/** Altura padrão da foto 15 cm (formato 10×15) */
export const PDF_LAUDO_PHOTO_HEIGHT_MM = 150;

export const PDF_LAUDO_PHOTO_CAPTION_PT = 10;
export const PDF_LAUDO_PHOTO_CAPTION_LINE_MM = 4.2;
/** Espaço entre a base da foto e a legenda (mínimo, “colado” ao registo visual) */
export const PDF_LAUDO_PHOTO_CAPTION_GAP_MM = 2;
/** Margem inferior entre blocos de fotos */
export const PDF_LAUDO_PHOTO_BLOCK_GAP_MM = 12;
/** Colchão na reserva de página (métricas de fonte / arredondamento) */
export const PDF_LAUDO_PHOTO_ATOMIC_PAD_MM = 1.5;

/**
 * Largura do bloco (moldura): 10 cm ou menos se a área útil entre margens for menor.
 */
export function getLaudoPhotoBlockWidthMm(pageWidthMm, marginMm) {
  const inner = Math.max(20, pageWidthMm - 2 * marginMm);
  return Math.min(PDF_LAUDO_PHOTO_WIDTH_MM, inner);
}

/** Altura da moldura mantendo proporção 10×15 (15/10 = 1,5). */
export function getLaudoPhotoBoxHeightMm(blockWidthMm) {
  return (blockWidthMm / PDF_LAUDO_PHOTO_WIDTH_MM) * PDF_LAUDO_PHOTO_HEIGHT_MM;
}

/** Largura útil da legenda = largura da moldura (sem overflow lateral). */
export function getLaudoCaptionMaxWidthMm(blockWidthMm) {
  return Math.max(10, blockWidthMm);
}

/**
 * Legenda do bloco: `Foto N. descrição` (sem “Foto:”).
 * Remove prefixo duplicado tipo “Foto 3.” vindo do checklist.
 */
export function buildLaudoPhotoBlockLabel(caption, photoNumber) {
  const n =
    photoNumber != null && photoNumber !== '' && !Number.isNaN(Number(photoNumber))
      ? String(photoNumber)
      : '?';
  let rest = String(caption || '').trim();
  rest = rest.replace(/^Foto\s*\d+\.\s*/i, '').trim();
  if (rest) return `Foto ${n}. ${rest}`;
  return `Foto ${n}.`;
}

/**
 * Quebra texto para caber em maxWidthMm (inclui tokens longos / URLs).
 * `fontStyle`: 'normal' | 'bold' — deve coincidir com o usado ao desenhar.
 */
export function wrapCaptionLinesForPdf(doc, text, maxWidthMm, fontStyle = 'normal') {
  const maxW = Math.max(4, maxWidthMm);
  doc.setFont('helvetica', fontStyle);
  doc.setFontSize(PDF_LAUDO_PHOTO_CAPTION_PT);
  const normalized = String(text || '')
    .replace(/\r\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const cap = normalized || 'Foto';
  let lines = doc.splitTextToSize(cap, maxW);
  const out = [];
  const epsilon = 0.5;
  lines.forEach((line) => {
    let rest = line;
    while (rest.length > 0) {
      if (doc.getTextWidth(rest) <= maxW + epsilon) {
        out.push(rest);
        break;
      }
      let cut = rest.length;
      while (cut > 1 && doc.getTextWidth(rest.slice(0, cut)) > maxW + epsilon) {
        cut -= 1;
      }
      if (cut < 1) cut = 1;
      out.push(rest.slice(0, cut));
      rest = rest.slice(cut);
    }
  });
  if (out.length === 0) return ['Foto 1.'];
  return out;
}

function guessImageFormat(url) {
  const s = String(url || '').toLowerCase();
  if (s.startsWith('data:image/png')) return 'PNG';
  if (s.startsWith('data:image/webp')) return 'WEBP';
  return 'JPEG';
}

/** Fallback quando jsPDF não embute o formato (ex.: alguns WEBP). */
function rasterizeImageToJpegDataUrl(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', 0.92));
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => reject(new Error('raster'));
    img.src = url;
  });
}

/**
 * Dimensões naturais da imagem (browser).
 * @param {string} url — URL ou data URL
 */
export function getImageNaturalSize(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () =>
      resolve({ w: img.naturalWidth || img.width, h: img.naturalHeight || img.height });
    img.onerror = () => reject(new Error('Imagem não carregada'));
    img.src = url;
  });
}

/**
 * Estima altura total: área 10×15 + legenda + margens.
 */
export function estimateLaudoPhotoBlockHeightMm(doc, blockLabel, blockWidthMm) {
  const blockW = blockWidthMm ?? PDF_LAUDO_PHOTO_WIDTH_MM;
  const capW = getLaudoCaptionMaxWidthMm(blockW);
  const lines = wrapCaptionLinesForPdf(doc, blockLabel, capW, 'normal');
  const captionH = lines.length * PDF_LAUDO_PHOTO_CAPTION_LINE_MM;
  const boxH = getLaudoPhotoBoxHeightMm(blockW);
  return (
    boxH +
    PDF_LAUDO_PHOTO_CAPTION_GAP_MM +
    captionH +
    PDF_LAUDO_PHOTO_BLOCK_GAP_MM +
    PDF_LAUDO_PHOTO_ATOMIC_PAD_MM
  );
}

/**
 * Desenha bloco indivisível: área padrão 10×15 cm (todas iguais) + legenda imediatamente abaixo.
 * @returns {Promise<number>} novo Y após o bloco
 */
export async function drawLaudoPhotoFigure(doc, options) {
  const {
    pageWidth,
    yStart,
    caption,
    photoNumber,
    blockLabel: blockLabelOverride,
    imageUrl,
    marginMm = 20,
    pageOpts: pageOptsIn = {},
  } = options;

  const pageOpts = {
    bottomMarginMm: pageOptsIn.bottomMarginMm ?? PDF_PAGE_BOTTOM_SAFE_MM,
    topMarginMm: pageOptsIn.topMarginMm ?? PDF_PAGE_TOP_SAFE_MM,
  };

  const blockW = getLaudoPhotoBlockWidthMm(pageWidth, marginMm);
  const boxH = getLaudoPhotoBoxHeightMm(blockW);
  const blockX = (pageWidth - blockW) / 2;
  const captionMaxW = getLaudoCaptionMaxWidthMm(blockW);
  const blockLabel =
    blockLabelOverride ??
    buildLaudoPhotoBlockLabel(caption, photoNumber);

  let iw = 0;
  let ih = 0;
  if (imageUrl) {
    try {
      const dim = await getImageNaturalSize(imageUrl);
      iw = dim.w;
      ih = dim.h;
    } catch {
      iw = 0;
      ih = 0;
    }
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(PDF_LAUDO_PHOTO_CAPTION_PT);
  doc.setTextColor(0, 0, 0);

  const captionLines = wrapCaptionLinesForPdf(doc, blockLabel, captionMaxW, 'normal');
  const captionBlockH = captionLines.length * PDF_LAUDO_PHOTO_CAPTION_LINE_MM;
  const totalH =
    boxH +
    PDF_LAUDO_PHOTO_CAPTION_GAP_MM +
    captionBlockH +
    PDF_LAUDO_PHOTO_BLOCK_GAP_MM +
    PDF_LAUDO_PHOTO_ATOMIC_PAD_MM;

  let y = ensureVerticalSpace(doc, yStart, totalH, pageOpts);

  const centerX = blockX + blockW / 2;
  const boxY = y;

  /* Área padrão idêntica em todo o laudo; fundo neutro (papel de registo fotográfico). */
  doc.setFillColor(248, 248, 248);
  doc.rect(blockX, boxY, blockW, boxH, 'F');

  if (imageUrl) {
    try {
      if (iw > 0 && ih > 0) {
        const scale = Math.min(blockW / iw, boxH / ih);
        const dw = iw * scale;
        const dh = ih * scale;
        const ix = blockX + (blockW - dw) / 2;
        const iy = boxY + (boxH - dh) / 2;
        const fmt = guessImageFormat(imageUrl);
        try {
          doc.addImage(imageUrl, fmt, ix, iy, dw, dh);
        } catch {
          const jpegUrl = await rasterizeImageToJpegDataUrl(imageUrl);
          doc.addImage(jpegUrl, 'JPEG', ix, iy, dw, dh);
        }
      } else {
        throw new Error('dimensões inválidas');
      }
    } catch (e) {
      console.error('Erro ao inserir foto no PDF:', e);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(120, 120, 120);
      doc.text(
        '[Imagem não disponível]',
        blockX + blockW / 2,
        boxY + boxH / 2,
        { align: 'center' }
      );
      doc.setTextColor(0, 0, 0);
    }
  } else {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(140, 140, 140);
    doc.text('[Sem imagem]', centerX, boxY + boxH / 2, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(PDF_LAUDO_PHOTO_CAPTION_PT);
  doc.setTextColor(0, 0, 0);

  let yCaption = boxY + boxH + PDF_LAUDO_PHOTO_CAPTION_GAP_MM;
  captionLines.forEach((line) => {
    doc.text(line, centerX, yCaption, { align: 'center' });
    yCaption += PDF_LAUDO_PHOTO_CAPTION_LINE_MM;
  });

  return yCaption + PDF_LAUDO_PHOTO_BLOCK_GAP_MM;
}
