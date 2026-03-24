/**
 * Bloco figura para fotos do laudo (jsPDF): legenda acima, moldura 2:3, imagem com object-fit: contain.
 * Legenda com a mesma largura da moldura, centralizada; bloco centralizado na página.
 */
import {
  ensureVerticalSpace,
  PDF_PAGE_BOTTOM_SAFE_MM,
  PDF_PAGE_TOP_SAFE_MM,
} from './pdfLayout';

/** ~300px a 96 dpi → mm */
export const PDF_LAUDO_PHOTO_WIDTH_MM = 79.375;
/** Proporção retrato 10×15 (2:3): altura = largura × 3/2 */
export const PDF_LAUDO_PHOTO_HEIGHT_MM = (PDF_LAUDO_PHOTO_WIDTH_MM * 3) / 2;
export const PDF_LAUDO_PHOTO_CAPTION_PT = 10;
export const PDF_LAUDO_PHOTO_CAPTION_LINE_MM = 4.2;
/** Espaço entre legenda e moldura */
export const PDF_LAUDO_PHOTO_CAPTION_GAP_MM = 3;
/** Margem inferior entre blocos de fotos */
export const PDF_LAUDO_PHOTO_BLOCK_GAP_MM = 12;

/**
 * Largura útil do bloco figura: nunca maior que a foto padrão nem que a área entre margens.
 */
export function getLaudoPhotoBlockWidthMm(pageWidthMm, marginMm) {
  const inner = Math.max(20, pageWidthMm - 2 * marginMm);
  return Math.min(PDF_LAUDO_PHOTO_WIDTH_MM, inner);
}

/**
 * Quebra legenda para caber em maxWidthMm (inclui palavras muito longas / URLs sem espaços).
 * jsPDF.splitTextToSize por vezes não parte tokens longos o suficiente em algumas fontes.
 */
export function wrapCaptionLinesForPdf(doc, text, maxWidthMm) {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(PDF_LAUDO_PHOTO_CAPTION_PT);
  const normalized = String(text || '')
    .replace(/\r\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const cap = normalized || 'Foto';
  let lines = doc.splitTextToSize(cap, maxWidthMm);
  const out = [];
  const epsilon = 0.5;
  lines.forEach((line) => {
    let rest = line;
    while (rest.length > 0) {
      if (doc.getTextWidth(rest) <= maxWidthMm + epsilon) {
        out.push(rest);
        break;
      }
      let cut = rest.length;
      while (cut > 1 && doc.getTextWidth(rest.slice(0, cut)) > maxWidthMm + epsilon) {
        cut -= 1;
      }
      if (cut < 1) cut = 1;
      out.push(rest.slice(0, cut));
      rest = rest.slice(cut);
    }
  });
  if (out.length === 0) return ['Foto'];
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
 * Estima altura total do bloco (legenda + moldura + margem inferior) em mm.
 */
export function estimateLaudoPhotoBlockHeightMm(doc, caption, blockWidthMm) {
  const blockW = blockWidthMm ?? PDF_LAUDO_PHOTO_WIDTH_MM;
  const lines = wrapCaptionLinesForPdf(doc, caption, blockW);
  const captionH = lines.length * PDF_LAUDO_PHOTO_CAPTION_LINE_MM;
  const boxH = (blockW * 3) / 2;
  return (
    captionH +
    PDF_LAUDO_PHOTO_CAPTION_GAP_MM +
    boxH +
    PDF_LAUDO_PHOTO_BLOCK_GAP_MM
  );
}

/**
 * Desenha um bloco legenda + foto (moldura fixa 2:3, imagem centralizada com contain).
 * @returns {Promise<number>} novo Y após o bloco
 */
export async function drawLaudoPhotoFigure(doc, options) {
  const {
    pageWidth,
    yStart,
    caption,
    imageUrl,
    marginMm = 20,
    pageOpts: pageOptsIn = {},
  } = options;

  const pageOpts = {
    bottomMarginMm: pageOptsIn.bottomMarginMm ?? PDF_PAGE_BOTTOM_SAFE_MM,
    topMarginMm: pageOptsIn.topMarginMm ?? PDF_PAGE_TOP_SAFE_MM,
  };

  const blockW = getLaudoPhotoBlockWidthMm(pageWidth, marginMm);
  const boxH = (blockW * 3) / 2;
  const blockX = (pageWidth - blockW) / 2;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(PDF_LAUDO_PHOTO_CAPTION_PT);
  doc.setTextColor(0, 0, 0);

  const captionLines = wrapCaptionLinesForPdf(doc, caption, blockW);
  const captionBlockH = captionLines.length * PDF_LAUDO_PHOTO_CAPTION_LINE_MM;
  const totalH =
    captionBlockH +
    PDF_LAUDO_PHOTO_CAPTION_GAP_MM +
    boxH +
    PDF_LAUDO_PHOTO_BLOCK_GAP_MM;

  let y = ensureVerticalSpace(doc, yStart, totalH, pageOpts);

  let yLine = y;
  const captionCenterX = blockX + blockW / 2;
  captionLines.forEach((line) => {
    doc.text(line, captionCenterX, yLine, { align: 'center' });
    yLine += PDF_LAUDO_PHOTO_CAPTION_LINE_MM;
  });
  y = yLine + PDF_LAUDO_PHOTO_CAPTION_GAP_MM;

  const boxY = y;

  doc.setDrawColor(235, 235, 235);
  doc.setLineWidth(0.15);
  doc.rect(blockX, boxY, blockW, boxH, 'S');

  if (imageUrl) {
    try {
      const { w: iw, h: ih } = await getImageNaturalSize(imageUrl);
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
  }

  return boxY + boxH + PDF_LAUDO_PHOTO_BLOCK_GAP_MM;
}
