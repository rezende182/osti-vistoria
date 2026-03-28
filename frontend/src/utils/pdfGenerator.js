import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { TEXTOS_CONCLUSAO } from '../constants/inspectionClassificacao';
import {
  drawBodyParagraphs,
  drawLaudoFieldCard,
  drawResponsavelAssinaturaSection,
  drawChapterTitle,
  drawSubsectionTitle,
  PDF_FONT,
  PDF_BODY_PT,
  PDF_BODY_LINE_MM,
  PDF_PAGE_BOTTOM_SAFE_MM,
  PDF_CHAPTER_TITLE_PT,
  PDF_CHAPTER_LINE_MM,
  PDF_LIST_INDENT_MM,
  PDF_LIST_ITEM_EXTRA_GAP_MM,
  PDF_PARAGRAPH_GAP_MM,
  PDF_CHAPTER_KEEP_WITH_NEXT_MM,
  PDF_CHAPTER_KEEP_WITH_SIGNATURE_BLOCK_MM,
  PDF_PT_TO_MM,
} from './pdfLayout';
import { formatPdfAssinaturaDataLine } from './pdfAssinaturaFormat';
import { METODOLOGIA_PLACEHOLDER_REG_NC } from '../constants/laudoEntregaTextos';

/** Cabeçalho: logo à esquerda; só o título à direita, centrado na coluna de texto */
const PDF_HEADER_LOGO_MAX_W_MM = 52;
const PDF_HEADER_LOGO_MAX_H_MM = 16;
const PDF_HEADER_LOGO_GAP_MM = 4;
const PDF_HEADER_TITLE_PT = 17;

const PDF_HEADER_TITLE_MAIN = 'LAUDO DE INSPEÇÃO TÉCNICA';

/** Dimensões naturais da imagem (browser) para calcular largura proporcional sem distorção */
function getDataUrlImageDimensions(dataUrl) {
  return new Promise((resolve) => {
    if (typeof Image === 'undefined') {
      resolve({ width: 1, height: 1 });
      return;
    }
    const img = new Image();
    img.onload = () =>
      resolve({
        width: img.naturalWidth || 1,
        height: img.naturalHeight || 1,
      });
    img.onerror = () => resolve({ width: 1, height: 1 });
    img.src = dataUrl;
  });
}

/**
 * Encaixa o logótipo numa caixa (maxW × maxH mm) mantendo proporção.
 */
function fitLogoSizeMm(naturalW, naturalH, maxW, maxH) {
  if (!naturalW || !naturalH) {
    return { w: maxW * 0.6, h: maxH };
  }
  const aspect = naturalW / naturalH;
  let w = maxH * aspect;
  let h = maxH;
  if (w > maxW) {
    w = maxW;
    h = w / aspect;
  }
  return { w, h };
}

/** Endereço, cidade e UF para a secção 3. Introdução (identificação da vistoria). */
function formatPdfIntroLocalizacao(inspection) {
  const e = (inspection.endereco || '').trim();
  const cidadeUf = pdfCidadeUfTexto(inspection.cidade, inspection.uf);
  if (e && cidadeUf) return `${e}, ${cidadeUf}`;
  if (e) return e;
  return cidadeUf || '-';
}

const PDF_IDENT_LABEL_FILL = [245, 245, 245];

/** Tabela 1 mais compacta para caber melhor na primeira página. */
const PDF_IDENT_TABLE_PT = 9;
const PDF_IDENT_TABLE_CELL_PAD = 1.6;

function pdfIdentLabelCell(text) {
  return {
    content: text,
    styles: { fontStyle: 'bold', fillColor: PDF_IDENT_LABEL_FILL },
  };
}

/** Linha de identificação em largura total: rótulo | valor (colSpan 3). */
function pdfIdentRowFull(label, value, required = true) {
  const v = value == null ? '' : String(value).trim();
  const display = required ? v || '—' : v;
  if (!required && !display) return null;
  return [pdfIdentLabelCell(label), { content: display, colSpan: 3 }];
}

function pdfTrim(v) {
  return v == null ? '' : String(v).trim();
}

/** UF só com a sigla (ex.: SP), sem o nome do estado após "—". */
function pdfUfSomenteSigla(uf) {
  const s = pdfTrim(uf);
  if (!s) return '';
  const antesTraco = s.split(/\s*[—–-]\s*/)[0].trim();
  const m = antesTraco.match(/^([A-Za-z]{2})$/);
  if (m) return m[1].toUpperCase();
  const dois = antesTraco.slice(0, 2);
  if (/^[A-Za-z]{2}$/.test(dois)) return dois.toUpperCase();
  return antesTraco;
}

/** Ex.: "Praia Grande, SP" (cidade + sigla da UF). */
function pdfCidadeUfTexto(cidade, uf) {
  const c = pdfTrim(cidade);
  const u = pdfUfSomenteSigla(uf);
  if (c && u) return `${c}, ${u}`;
  if (c) return c;
  if (u) return u;
  return '';
}

function pdfEmpreendimentoConstrutoraTexto(empreendimento, construtora) {
  const e = pdfTrim(empreendimento);
  const k = pdfTrim(construtora);
  if (e && k) return `${e} / ${k}`;
  return e || k || '';
}

/** Apartamento | Casa Térrea | Sobrado (uma linha no laudo). */
function pdfTipoImovelUnificado(inspection) {
  const cat = inspection.imovel_categoria;
  const tip = inspection.imovel_tipologia;
  if (cat === 'apartamento') return 'Apartamento';
  if (cat === 'casa') {
    if (tip === 'sobrado') return 'Sobrado';
    if (tip === 'terreo') return 'Casa Térrea';
    return '';
  }
  if (tip === 'sobrado') return 'Sobrado';
  if (tip === 'terreo') return 'Casa Térrea';
  return '';
}

/** Versão compacta para a tabela 1 (primeira página). */
function pdfIdentSectionRowCompact(title) {
  return [
    {
      content: title,
      colSpan: 4,
      styles: {
        fontStyle: 'bold',
        fontSize: PDF_IDENT_TABLE_PT + 0.75,
        fillColor: [226, 232, 240],
        textColor: [51, 65, 85],
        cellPadding: { top: 2.2, bottom: 2.2, left: 3, right: 3 },
      },
    },
  ];
}

/** Horário de início e de término na mesma linha (duas colunas rótulo/valor). */
function pdfIdentRowHorarios(horarioInicio, horarioTermino) {
  const hi = horarioInicio == null ? '' : String(horarioInicio).trim();
  const ht = horarioTermino == null ? '' : String(horarioTermino).trim();
  return [
    pdfIdentLabelCell('Horário de início'),
    { content: hi || '—' },
    pdfIdentLabelCell('Horário de término'),
    { content: ht || '—' },
  ];
}

/** Corpo da tabela 1 — fluxo Entrega de Imóvel com `imovel_categoria` usa blocos alinhados ao formulário. */
function buildIdentificacaoTableBody(inspection) {
  const fluxo = String(inspection.tipo_vistoria_fluxo || '').trim();
  const cat = inspection.imovel_categoria;
  const entregaForm =
    fluxo === 'apartamento' && (cat === 'apartamento' || cat === 'casa');

  if (entregaForm) {
    const rows = [];

    rows.push(pdfIdentSectionRowCompact('Identificação do Responsável Técnico'));
    rows.push(pdfIdentRowFull('Responsável Técnico', inspection.responsavel_tecnico, true));
    rows.push(pdfIdentRowFull('CREA / CAU', inspection.crea, true));
    const rtDoc = pdfIdentRowFull('CPF / CNPJ', inspection.responsavel_cpf_cnpj, false);
    if (rtDoc) rows.push(rtDoc);

    rows.push(pdfIdentSectionRowCompact('Identificação do contratante'));
    rows.push(pdfIdentRowFull('Contratante', inspection.cliente, true));
    const cDoc = pdfIdentRowFull('CPF / CNPJ', inspection.contratante_cpf_cnpj, false);
    if (cDoc) rows.push(cDoc);

    rows.push(pdfIdentSectionRowCompact('Dados do Imóvel'));
    rows.push(
      pdfIdentRowFull('Tipo do Imóvel', pdfTipoImovelUnificado(inspection), true)
    );
    rows.push(pdfIdentRowFull('Endereço', inspection.endereco, true));
    if (cat === 'apartamento') {
      const unRow = pdfIdentRowFull('Apartamento / Bloco', inspection.unidade, false);
      if (unRow) rows.push(unRow);
    }
    const cidUf = pdfCidadeUfTexto(inspection.cidade, inspection.uf);
    rows.push(pdfIdentRowFull('Cidade', cidUf || '—', true));
    const empCons = pdfIdentRowFull(
      'Empreendimento/Construtora',
      pdfEmpreendimentoConstrutoraTexto(inspection.empreendimento, inspection.construtora),
      false
    );
    if (empCons) rows.push(empCons);
    const tipo = inspection.tipo_imovel;
    const tipoStr =
      tipo === 'novo'
        ? 'Novo'
        : tipo === 'usado'
          ? 'Usado'
          : tipo === 'reformado'
            ? 'Reformado'
            : '';
    const trTipo = pdfIdentRowFull('Condição do imóvel', tipoStr, false);
    if (trTipo) rows.push(trTipo);
    const en = inspection.energia_disponivel;
    const enStr = en === 'sim' ? 'Sim' : en === 'nao' ? 'Não' : '';
    const trEn = pdfIdentRowFull('Energia disponível', enStr, false);
    if (trEn) rows.push(trEn);

    rows.push(pdfIdentSectionRowCompact('Identificação da vistoria'));
    rows.push(pdfIdentRowFull('Data da vistoria', formatDate(inspection.data), true));
    const rcRow = pdfIdentRowFull(
      'Responsável da Construtora',
      inspection.responsavel_construtora,
      false
    );
    if (rcRow) rows.push(rcRow);
    rows.push(pdfIdentRowHorarios(inspection.horario_inicio, inspection.horario_termino));
    return rows.filter(Boolean);
  }

  const rows = [];

  rows.push(pdfIdentSectionRowCompact('Contratante e imóvel'));
  rows.push(pdfIdentRowFull('Cliente', inspection.cliente, true));
  rows.push(pdfIdentRowFull('Endereço', inspection.endereco, true));

  const cidUfG = pdfCidadeUfTexto(inspection.cidade, inspection.uf);
  rows.push(pdfIdentRowFull('Cidade', cidUfG || '—', true));

  if (fluxo === 'apartamento') {
    const apt = pdfIdentRowFull('Entrega de Imóvel', inspection.unidade, false);
    if (apt) rows.push(apt);
  }

  const empConsG = pdfIdentRowFull(
    'Empreendimento/Construtora',
    pdfEmpreendimentoConstrutoraTexto(inspection.empreendimento, inspection.construtora),
    false
  );
  if (empConsG) rows.push(empConsG);

  const tipoLinhaG = pdfTipoImovelUnificado(inspection);
  const tipoRowG = pdfIdentRowFull('Tipo do Imóvel', tipoLinhaG, false);
  if (tipoRowG) rows.push(tipoRowG);

  rows.push(pdfIdentSectionRowCompact('Responsável técnico'));
  const rtDoc = pdfIdentRowFull('CPF / CNPJ', inspection.responsavel_cpf_cnpj, false);
  if (rtDoc) rows.push(rtDoc);
  rows.push(pdfIdentRowFull('Responsável Técnico', inspection.responsavel_tecnico, true));
  rows.push(pdfIdentRowFull('CREA / CAU', inspection.crea, true));

  rows.push(pdfIdentSectionRowCompact('Identificação da vistoria'));
  rows.push(pdfIdentRowFull('Data', formatDate(inspection.data), true));

  rows.push(pdfIdentRowHorarios(inspection.horario_inicio, inspection.horario_termino));

  const tipo = inspection.tipo_imovel;
  const tipoStr =
    tipo === 'novo'
      ? 'Novo'
      : tipo === 'usado'
        ? 'Usado'
        : tipo === 'reformado'
          ? 'Reformado'
          : '';
  const trTipo = pdfIdentRowFull('Condição do imóvel', tipoStr, false);
  if (trTipo) rows.push(trTipo);

  const en = inspection.energia_disponivel;
  const enStr = en === 'sim' ? 'Sim' : en === 'nao' ? 'Não' : '';
  const trEn = pdfIdentRowFull('Energia disponível', enStr, false);
  if (trEn) rows.push(trEn);

  return rows.filter(Boolean);
}

/** Texto fixo da secção 3. INTRODUÇÃO com dados da identificação. */
function buildPdfIntroducaoText(inspection) {
  const loc = formatPdfIntroLocalizacao(inspection);
  const fluxo = String(inspection.tipo_vistoria_fluxo || '').trim();
  const apt = (inspection.unidade || '').trim();
  const empConsIntro = pdfEmpreendimentoConstrutoraTexto(
    inspection.empreendimento,
    inspection.construtora
  );

  let complemento = '';
  if (
    fluxo === 'apartamento' &&
    inspection.imovel_categoria === 'apartamento' &&
    apt
  ) {
    complemento += `, apartamento / bloco: ${apt}`;
  }
  if (empConsIntro) {
    complemento += `, empreendimento/construtora: ${empConsIntro}`;
  }

  return [
    `O presente laudo técnico, referente ao imóvel localizado no endereço: ${loc}${complemento}, tem como objetivo registrar os resultados da vistoria técnica realizada, avaliando as condições construtivas, acabamentos, instalações prediais e demais elementos relevantes para a utilização segura e adequada do bem.`,
    'A inspeção foi conduzida de acordo com normas técnicas aplicáveis e procedimentos de engenharia reconhecidos, buscando identificar eventuais irregularidades, vícios aparentes ou não conformidades que possam comprometer o uso, segurança ou desempenho do imóvel.',
    'Este documento constitui registro formal da condição do imóvel no momento da entrega, fornecendo suporte técnico para o recebimento e eventual acionamento de garantias junto à construtora, quando necessário.',
  ].join('\n\n');
}

/** Fluxo Entrega de Imóvel com blocos Objetivo / Relato / Metodologia no laudo. */
function isEntregaImovelLaudoExtended(inspection) {
  const f = String(inspection.tipo_vistoria_fluxo || '').trim();
  const c = inspection.imovel_categoria;
  return f === 'apartamento' && (c === 'apartamento' || c === 'casa');
}

function finalizeLaudoMetodologiaPdf(inspection, registroNaoConformidadesItemNum) {
  const raw = pdfTrim(inspection.laudo_metodologia);
  if (!raw) return '';
  const esc = METODOLOGIA_PLACEHOLDER_REG_NC.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(esc, 'gi');
  return raw.replace(re, `item ${registroNaoConformidadesItemNum}`);
}

// Texto legal padrão
const LEGAL_TEXT =
  'A vistoria foi realizada nas condições disponíveis no momento da inspeção, podendo limitações como ausência de energia, água, gás, iluminação ou acesso restringir a execução de testes.\n\n' +
  'Eventuais falhas não identificadas e manifestadas posteriormente caracterizam-se como vícios não aparentes à época da vistoria, devendo ser tratadas conforme garantias aplicáveis.';

function getJsPdfFormatFromDataUrl(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') return 'JPEG';
  const head = dataUrl.slice(0, 48).toLowerCase();
  if (head.includes('image/png')) return 'PNG';
  return 'JPEG';
}

/** Rodapé esquerdo do laudo. */
function buildPdfFooterLeftLine() {
  return 'Laudo de Inspeção Técnica - Relatório de Vistoria';
}

// Formatar data
const formatDate = (dateString) => {
  if (!dateString) return '-';
  const parts = dateString.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateString;
};

/** Prefixo `Foto N. ` (negrito no PDF) + corpo da legenda (normal). */
function buildPdfPhotoCaptionParts(caption, photoNumber) {
  const n =
    photoNumber != null && photoNumber !== '' && !Number.isNaN(Number(photoNumber))
      ? String(photoNumber)
      : '?';
  let body = String(caption || '').trim();
  body = body.replace(/^Foto\s*\d+\s*[.:]?\s*/i, '').trim();
  return { prefix: `Foto ${n}. `, body };
}

/**
 * Desenha legenda: só `Foto N.` em negrito; resto em normal; quebra à largura da imagem.
 * Alinhado à esquerda com a foto (imgX).
 * Retorna Y do topo da foto: imediatamente abaixo da última baseline (sem linha em branco extra).
 */
function drawPdfPhotoCaptionBoldPrefix(doc, imgX, imgWidth, yStart, parts) {
  const lh = PDF_BODY_LINE_MM;
  /** Espaço entre a última linha da legenda e o topo da imagem */
  const belowBaselineMm = 1;
  let y = yStart;
  let lastBaseline = yStart;

  doc.setFontSize(PDF_BODY_PT);
  doc.setTextColor(0, 0, 0);

  const { prefix, body } = parts;
  const bodyTrim = body.trim();

  doc.setFont(PDF_FONT, 'bold');
  const prefixW = doc.getTextWidth(prefix);

  if (!bodyTrim) {
    doc.text(prefix, imgX, y);
    return y + belowBaselineMm;
  }

  doc.setFont(PDF_FONT, 'normal');
  const words = bodyTrim.split(/\s+/).filter(Boolean);
  let availFirst = imgWidth - prefixW;

  if (availFirst < 8) {
    doc.setFont(PDF_FONT, 'bold');
    doc.text(prefix, imgX, y);
    lastBaseline = y;
    y += lh;
    const restLines = wrapPdfCaptionToImageWidth(doc, bodyTrim, imgWidth);
    doc.setFont(PDF_FONT, 'normal');
    restLines.forEach((ln) => {
      doc.text(ln, imgX, y);
      lastBaseline = y;
      y += lh;
    });
    return lastBaseline + belowBaselineMm;
  }

  let firstChunk = '';
  let wi = 0;
  for (; wi < words.length; wi++) {
    const test = firstChunk ? `${firstChunk} ${words[wi]}` : words[wi];
    if (doc.getTextWidth(test) <= availFirst + 0.5) {
      firstChunk = test;
    } else {
      break;
    }
  }

  if (!firstChunk) {
    const w0 = words[0];
    if (w0 && doc.getTextWidth(w0) > availFirst) {
      doc.setFont(PDF_FONT, 'bold');
      doc.text(prefix, imgX, y);
      lastBaseline = y;
      y += lh;
      const restLines = wrapPdfCaptionToImageWidth(doc, bodyTrim, imgWidth);
      doc.setFont(PDF_FONT, 'normal');
      restLines.forEach((ln) => {
        doc.text(ln, imgX, y);
        lastBaseline = y;
        y += lh;
      });
      return lastBaseline + belowBaselineMm;
    }
    firstChunk = w0;
    wi = 1;
  }

  doc.setFont(PDF_FONT, 'bold');
  doc.text(prefix, imgX, y);
  doc.setFont(PDF_FONT, 'normal');
  doc.text(firstChunk, imgX + prefixW, y);
  lastBaseline = y;
  y += lh;

  const restText = words.slice(wi).join(' ').trim();
  if (restText) {
    const restLines = wrapPdfCaptionToImageWidth(doc, restText, imgWidth);
    restLines.forEach((ln) => {
      doc.text(ln, imgX, y);
      lastBaseline = y;
      y += lh;
    });
  }

  return lastBaseline + belowBaselineMm;
}

/**
 * Quebra legenda à largura da imagem (mm); força partição em tokens muito longos.
 */
function wrapPdfCaptionToImageWidth(doc, text, maxWidthMm) {
  doc.setFont(PDF_FONT, 'normal');
  doc.setFontSize(PDF_BODY_PT);
  const maxW = Math.max(20, maxWidthMm);
  let parts = doc.splitTextToSize(String(text), maxW);
  const out = [];
  const epsilon = 0.5;
  parts.forEach((line) => {
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
  return out.length ? out : [String(text)];
}

// Gerar PDF
export const generateInspectionPDF = async (inspection, forPreview = false) => {
  if (!inspection) {
    throw new Error('Dados da vistoria não disponíveis');
  }

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  const listX = margin + PDF_LIST_INDENT_MM;
  let yPos = margin;

  // Verificar nova página
  const checkNewPage = (neededSpace = 30) => {
    if (yPos + neededSpace > pageHeight - PDF_PAGE_BOTTOM_SAFE_MM) {
      doc.addPage();
      yPos = margin;
      return true;
    }
    return false;
  };

  // ============================================================
  // PÁGINA 1: CABEÇALHO — com logo: logo | só "LAUDO DE INSPEÇÃO TÉCNICA" (centrado na coluna à direita)
  // ============================================================

  const customLogo = inspection.pdf_logo_data_url;
  const hasCustomLogo =
    customLogo &&
    typeof customLogo === 'string' &&
    customLogo.startsWith('data:image/');

  const cx = pageWidth / 2;
  const titleLineH = PDF_HEADER_TITLE_PT * PDF_PT_TO_MM * 1.25;

  if (hasCustomLogo) {
    const { width: iw, height: ih } = await getDataUrlImageDimensions(customLogo);
    const { w: logoW, h: logoH } = fitLogoSizeMm(
      iw,
      ih,
      PDF_HEADER_LOGO_MAX_W_MM,
      PDF_HEADER_LOGO_MAX_H_MM
    );

    const logoFormat = getJsPdfFormatFromDataUrl(customLogo);
    const textColLeft = margin + logoW + PDF_HEADER_LOGO_GAP_MM;
    const textColWidth = Math.max(40, pageWidth - margin - textColLeft);
    const textColCenterX = textColLeft + textColWidth / 2;

    doc.setFont(PDF_FONT, 'bold');
    doc.setFontSize(PDF_HEADER_TITLE_PT);
    const titleLines = doc.splitTextToSize(PDF_HEADER_TITLE_MAIN, textColWidth);

    const textBlockH = titleLines.length * titleLineH;
    const rowH = Math.max(logoH, textBlockH);
    const logoY = yPos + (rowH - logoH) / 2;

    try {
      doc.addImage(customLogo, logoFormat, margin, logoY, logoW, logoH);
    } catch (e) {
      console.log('Erro ao adicionar logo ao PDF:', e);
    }

    const textTop = yPos + (rowH - textBlockH) / 2;
    let ty = textTop + titleLineH * 0.75;

    doc.setFont(PDF_FONT, 'bold');
    doc.setFontSize(PDF_HEADER_TITLE_PT);
    doc.setTextColor(0, 0, 0);
    titleLines.forEach((ln) => {
      doc.text(ln, textColCenterX, ty, { align: 'center' });
      ty += titleLineH;
    });

    yPos = yPos + rowH + 7;
  } else {
    doc.setFont(PDF_FONT, 'bold');
    doc.setFontSize(PDF_HEADER_TITLE_PT);
    doc.setTextColor(0, 0, 0);
    const titleLines = doc.splitTextToSize(PDF_HEADER_TITLE_MAIN, contentWidth);
    let ty = yPos + 6;
    titleLines.forEach((ln) => {
      doc.text(ln, cx, ty, { align: 'center' });
      ty += titleLineH;
    });
    yPos = ty + 7;
  }

  // ============================================================
  // 1. IDENTIFICAÇÃO DA VISTORIA TÉCNICA
  // ============================================================
  yPos = drawChapterTitle(
    doc,
    margin,
    contentWidth,
    yPos,
    '1. IDENTIFICAÇÃO DA VISTORIA TÉCNICA',
    { minFollowingMm: 28 }
  );

  const identificacaoData = buildIdentificacaoTableBody(inspection);

  const identLabelColW = 46;
  const identValuePairW = Math.max(22, (contentWidth - identLabelColW * 2) / 2);

  autoTable(doc, {
    startY: yPos,
    body: identificacaoData,
    theme: 'grid',
    styles: {
      font: PDF_FONT,
      fontSize: PDF_IDENT_TABLE_PT,
      cellPadding: PDF_IDENT_TABLE_CELL_PAD,
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0],
      lineWidth: 0.15,
    },
    columnStyles: {
      0: {
        fontStyle: 'bold',
        cellWidth: identLabelColW,
        fillColor: PDF_IDENT_LABEL_FILL,
      },
      1: { cellWidth: identValuePairW },
      2: {
        fontStyle: 'bold',
        cellWidth: identLabelColW,
        fillColor: PDF_IDENT_LABEL_FILL,
      },
      3: { cellWidth: identValuePairW },
    },
    margin: { left: margin, right: margin },
  });

  yPos = doc.lastAutoTable.finalY + 10;

  // ============================================================
  // 2. DOCUMENTOS RECEBIDOS E ANALISADOS (fluxo sem laudo estendido: só se houver itens)
  // ============================================================
  const docsList = Array.isArray(inspection.documentos_recebidos)
    ? inspection.documentos_recebidos.filter((d) => pdfTrim(d))
    : [];
  const entregaLaudoExtOnP1 = isEntregaImovelLaudoExtended(inspection);
  if (!entregaLaudoExtOnP1 && docsList.length > 0) {
    yPos = drawChapterTitle(
      doc,
      margin,
      contentWidth,
      yPos,
      '2. DOCUMENTOS RECEBIDOS E ANALISADOS',
      { minFollowingMm: 28 }
    );

    doc.setFont(PDF_FONT, 'normal');
    doc.setFontSize(PDF_BODY_PT);

    docsList.forEach((docItem, index) => {
      doc.text(`${index + 1}. ${docItem}`, listX, yPos);
      yPos += PDF_BODY_LINE_MM;
      if (index < docsList.length - 1) {
        yPos += PDF_LIST_ITEM_EXTRA_GAP_MM;
      }
    });
  }

  // Primeira página: só cabeçalho + secções 1 e 2. O restante começa na página seguinte.
  doc.addPage();
  yPos = margin;

  const entregaLaudoExt = isEntregaImovelLaudoExtended(inspection);
  const checklistChapterNum = entregaLaudoExt ? 6 : 4;
  const conclusaoChapterNum = entregaLaudoExt ? 7 : 5;
  const assinaturaChapterNum = entregaLaudoExt ? 8 : 6;
  const legalChapterNum = entregaLaudoExt ? 9 : 7;

  if (entregaLaudoExt) {
    const metaText = finalizeLaudoMetodologiaPdf(inspection, checklistChapterNum);
    const objT = pdfTrim(inspection.laudo_objetivo);

    yPos = drawChapterTitle(doc, margin, contentWidth, yPos, '3. OBJETIVO', {
      minFollowingMm: 36,
    });
    yPos = drawLaudoFieldCard(doc, margin, contentWidth, yPos, objT, checkNewPage);

    checkNewPage(36);
    yPos = drawChapterTitle(
      doc,
      margin,
      contentWidth,
      yPos,
      '4. DOCUMENTOS RECEBIDOS E ANALISADOS',
      { minFollowingMm: 28 }
    );
    doc.setFont(PDF_FONT, 'normal');
    doc.setFontSize(PDF_BODY_PT);
    doc.setTextColor(0, 0, 0);
    if (docsList.length > 0) {
      docsList.forEach((docItem, index) => {
        doc.text(`${index + 1}. ${docItem}`, listX, yPos);
        yPos += PDF_BODY_LINE_MM;
        if (index < docsList.length - 1) {
          yPos += PDF_LIST_ITEM_EXTRA_GAP_MM;
        }
      });
    } else {
      yPos = drawBodyParagraphs(
        doc,
        'Nenhum documento foi disponibilizado pela construtora nesta vistoria.',
        margin,
        contentWidth,
        yPos,
        checkNewPage
      );
    }

    checkNewPage(40);
    yPos = drawChapterTitle(doc, margin, contentWidth, yPos, '5. METODOLOGIA', {
      minFollowingMm: 36,
    });
    yPos = drawLaudoFieldCard(doc, margin, contentWidth, yPos, metaText, checkNewPage);

    checkNewPage(52);
    yPos = drawChapterTitle(
      doc,
      margin,
      contentWidth,
      yPos,
      `${checklistChapterNum}. VERIFICAÇÃO DOS AMBIENTES`,
      { minFollowingMm: 52 }
    );
  } else {
    // ============================================================
    // 3. INTRODUÇÃO
    // ============================================================
    yPos = drawChapterTitle(
      doc,
      margin,
      contentWidth,
      yPos,
      '3. INTRODUÇÃO',
      { minFollowingMm: 45 }
    );

    doc.setFont(PDF_FONT, 'normal');
    doc.setFontSize(PDF_BODY_PT);
    doc.setTextColor(0, 0, 0);
    yPos = drawBodyParagraphs(
      doc,
      buildPdfIntroducaoText(inspection),
      margin,
      contentWidth,
      yPos,
      checkNewPage
    );

    // ============================================================
    // 4. VERIFICAÇÃO DOS AMBIENTES (após introdução; fluxo sem bloco Metodologia separado)
    // ============================================================
    yPos = drawChapterTitle(
      doc,
      margin,
      contentWidth,
      yPos,
      `${checklistChapterNum}. VERIFICAÇÃO DOS AMBIENTES`,
      { minFollowingMm: 52 }
    );
  }

  if (inspection.rooms_checklist && inspection.rooms_checklist.length > 0) {
    let roomNumber = 1;

    for (const room of inspection.rooms_checklist) {
      // Itens no laudo: exclui "Não existe" (não entra no PDF)
      const itensNoPdf = (room.items || []).filter(
        (item) => item && item.name
      );

      if (itensNoPdf.length === 0) {
        continue;
      }

      checkNewPage(26);

      yPos = drawSubsectionTitle(
        doc,
        margin,
        contentWidth,
        yPos,
        `${checklistChapterNum}.${roomNumber} ${room.room_name.toUpperCase()}`
      );

      for (const item of itensNoPdf) {
        // Espaço mínimo para faixa + condição (~30 mm); fotos quebram depois
        checkNewPage(30);

        // FAIXA CINZA com nome do item (#CDCDCC)
        doc.setFillColor(205, 205, 204);
        doc.rect(margin, yPos - 4, contentWidth, 10, 'F');
        
        doc.setFont(PDF_FONT, 'bold');
        doc.setFontSize(PDF_BODY_PT);
        doc.setTextColor(0, 0, 0);
        doc.text(item.name, listX, yPos + 2);
        yPos += 12;

        const checklistTextWidth = contentWidth - PDF_LIST_INDENT_MM;

        let mainVerify = (item.verification_text || '').trim();
        if (!mainVerify && Array.isArray(item.verification_points) && item.verification_points.length) {
          mainVerify = item.verification_points
            .filter((vp) => vp && !vp.excluded)
            .map((vp) => (vp.text || '').trim())
            .filter(Boolean)
            .join(', ');
        }
        if (mainVerify) {
          doc.setFont(PDF_FONT, 'bold');
          doc.setFontSize(PDF_BODY_PT);
          doc.setTextColor(0, 0, 0);
          doc.text('Elementos e verificações:', listX, yPos);
          yPos += PDF_BODY_LINE_MM;
          doc.setFont(PDF_FONT, 'normal');
          yPos = drawBodyParagraphs(
            doc,
            mainVerify,
            listX,
            checklistTextWidth,
            yPos,
            checkNewPage
          );
          yPos += PDF_LIST_ITEM_EXTRA_GAP_MM;
        }

        // Fotos: legenda `Foto N: …` com quebra na largura da imagem; sem cabeçalho "Fotos:"
        const photos = item.photos || [];
        if (photos.length > 0) {
          /* 15 cm largura × 10 cm altura (paisagem) */
          const imgWidth = 150;
          const imgHeight = 100;

          for (const photo of photos) {
            /* 1,5 mm face ao conteúdo acima; topo da foto colado à legenda (ver drawPdfPhotoCaptionBoldPrefix) */
            const gapAboveCaption = 1.5;
            yPos += gapAboveCaption;

            const imgX = (pageWidth - imgWidth) / 2;
            const parts = buildPdfPhotoCaptionParts(photo.caption, photo.number);
            const approxLines = wrapPdfCaptionToImageWidth(
              doc,
              `${parts.prefix}${parts.body}`,
              imgWidth
            ).length;
            const captionBlockH = approxLines * PDF_BODY_LINE_MM + 1;
            checkNewPage(captionBlockH + imgHeight + 14);

            yPos = drawPdfPhotoCaptionBoldPrefix(
              doc,
              imgX,
              imgWidth,
              yPos,
              parts
            );

            if (photo.url) {
              try {
                doc.addImage(photo.url, 'JPEG', imgX, yPos, imgWidth, imgHeight);
                yPos += imgHeight + 8;
              } catch (e) {
                console.error('Erro ao adicionar imagem:', e);
                doc.setFont(PDF_FONT, 'italic');
                doc.text('[Imagem não disponível]', pageWidth / 2, yPos, {
                  align: 'center',
                });
                yPos += 8;
              }
            }
          }
        }

        yPos += PDF_LIST_ITEM_EXTRA_GAP_MM;
      }

      yPos += PDF_LIST_ITEM_EXTRA_GAP_MM * 2;
      roomNumber++;
    }
  } else {
    doc.setFont(PDF_FONT, 'italic');
    doc.setFontSize(PDF_BODY_PT);
    doc.text('Nenhum ambiente foi adicionado ao checklist.', listX, yPos);
    yPos += PDF_BODY_LINE_MM;
  }

  // ============================================================
  // 5. CONCLUSÃO (espaço antes do título = 12 pt via drawChapterTitle; corpo = drawBodyParagraphs)
  // ============================================================
  checkNewPage(40);
  yPos = drawChapterTitle(
    doc,
    margin,
    contentWidth,
    yPos,
    `${conclusaoChapterNum}. CONCLUSÃO`,
    {
      minFollowingMm: 52,
    }
  );

  doc.setFont(PDF_FONT, 'normal');
  doc.setFontSize(PDF_BODY_PT);

  const cf = inspection.classificacao_final;
  const conclusaoTrim = (inspection.conclusao || '').trim();

  const textoConclusao =
    cf === 'outro'
      ? (conclusaoTrim ? inspection.conclusao : null)
      : inspection.conclusao ||
        (cf ? TEXTOS_CONCLUSAO[cf] : null);

  if (textoConclusao) {
    yPos += PDF_PARAGRAPH_GAP_MM;
    yPos = drawBodyParagraphs(
      doc,
      textoConclusao,
      margin,
      contentWidth,
      yPos,
      checkNewPage
    );
  }

  yPos += PDF_PARAGRAPH_GAP_MM;

  // ============================================================
  // 6. RESPONSÁVEL TÉCNICO / ASSINATURA
  // ============================================================
  checkNewPage(36);
  yPos = drawChapterTitle(
    doc,
    margin,
    contentWidth,
    yPos,
    `${assinaturaChapterNum}. RESPONSÁVEL TÉCNICO / ASSINATURA`,
    { minFollowingMm: PDF_CHAPTER_KEEP_WITH_SIGNATURE_BLOCK_MM }
  );

  const responsavel = inspection.responsavel_final || inspection.responsavel_tecnico || '-';
  const crea = inspection.crea_final || inspection.crea || '-';
  /** Data por extenso na assinatura: emissão do laudo (finalização), não a data da identificação. */
  const localAssinatura = formatPdfAssinaturaDataLine(
    inspection.cidade,
    inspection.uf,
    inspection.data_final || inspection.data
  );

  yPos = drawResponsavelAssinaturaSection(
    doc,
    margin,
    pageWidth,
    contentWidth,
    yPos,
    checkNewPage,
    {
      localTexto: localAssinatura,
      responsavel,
      crea,
      signatureAreaMm: 26,
    }
  );

  // ============================================================
  // 7. CONSIDERAÇÕES FINAIS E ASPECTOS LEGAIS
  // ============================================================
  checkNewPage(28);
  yPos = drawChapterTitle(
    doc,
    margin,
    contentWidth,
    yPos,
    `${legalChapterNum}. CONSIDERAÇÕES FINAIS E ASPECTOS LEGAIS`,
    { minFollowingMm: 42 }
  );

  yPos = drawBodyParagraphs(
    doc,
    LEGAL_TEXT,
    margin,
    contentWidth,
    yPos,
    checkNewPage
  );

  // ============================================================
  // RODAPÉ em todas as páginas
  // ============================================================
  const footerLeftText = buildPdfFooterLeftLine();
  const totalPages = doc.internal.getNumberOfPages();
  const footerBottomY = pageHeight - 10;
  const footerLineStep = PDF_BODY_LINE_MM * 0.72;

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(PDF_BODY_PT);
    doc.setFont(PDF_FONT, 'normal');
    doc.setTextColor(100, 100, 100);
    const footerLines = doc.splitTextToSize(footerLeftText, contentWidth - 2);
    let fy = footerBottomY - (footerLines.length - 1) * footerLineStep;
    footerLines.forEach((ln) => {
      doc.text(ln, margin, fy);
      fy += footerLineStep;
    });
    doc.text(`Página ${i} de ${totalPages}`, pageWidth - margin, footerBottomY, {
      align: 'right',
    });
  }

  // Gerar arquivo
  const clienteName = (inspection.cliente || 'Relatorio').replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
  const dataArquivo = inspection.data_final || inspection.data;
  const dataFormatada = formatDate(dataArquivo).replace(/\//g, '-');
  const fileName = `Vistoria_${clienteName}_${dataFormatada}.pdf`;

  if (forPreview) {
    const pdfBlob = doc.output('blob');
    return { blob: pdfBlob, fileName };
  } else {
    const pdfBlob = doc.output('blob');
    const blobUrl = URL.createObjectURL(pdfBlob);
    
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = fileName;
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    }, 100);
    
    return true;
  }
};

export default generateInspectionPDF;
