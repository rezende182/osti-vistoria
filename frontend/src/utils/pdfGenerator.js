import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  TEXTOS_CONCLUSAO,
  CLASSIFICACAO_FINAL_LABELS,
} from '../constants/inspectionClassificacao';
import {
  drawBodyParagraphs,
  drawClassificationFinalPlain,
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
import {
  applyDynamicMetodologiaIntro,
  METODOLOGIA_PLACEHOLDER_REG_NC,
  substituirPlaceholderHorarioTerminoRelato,
} from '../constants/laudoEntregaTextos';

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

/** Título de subsecção na tabela de identificação (linha única em 4 colunas). */
function pdfIdentSectionRow(title) {
  return [
    {
      content: title,
      colSpan: 4,
      styles: {
        fontStyle: 'bold',
        fontSize: PDF_BODY_PT + 0.5,
        fillColor: [226, 232, 240],
        textColor: [51, 65, 85],
        cellPadding: { top: 4.5, bottom: 4.5, left: 4, right: 4 },
      },
    },
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

    rows.push(pdfIdentSectionRow('Identificação do Responsável Técnico'));
    rows.push(pdfIdentRowFull('Responsável Técnico', inspection.responsavel_tecnico, true));
    rows.push(pdfIdentRowFull('CREA / CAU', inspection.crea, true));
    const rtDoc = pdfIdentRowFull('CPF / CNPJ', inspection.responsavel_cpf_cnpj, false);
    if (rtDoc) rows.push(rtDoc);

    rows.push(pdfIdentSectionRow('Identificação do contratante'));
    rows.push(pdfIdentRowFull('Contratante', inspection.cliente, true));
    const cDoc = pdfIdentRowFull('CPF / CNPJ', inspection.contratante_cpf_cnpj, false);
    if (cDoc) rows.push(cDoc);

    rows.push(pdfIdentSectionRow('Dados do Imóvel'));
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

    return rows.filter(Boolean);
  }

  const rows = [];

  rows.push(pdfIdentSectionRow('Contratante e imóvel'));
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

  rows.push(pdfIdentSectionRow('Responsável técnico'));
  const rtDoc = pdfIdentRowFull('CPF / CNPJ', inspection.responsavel_cpf_cnpj, false);
  if (rtDoc) rows.push(rtDoc);
  rows.push(pdfIdentRowFull('Responsável Técnico', inspection.responsavel_tecnico, true));
  rows.push(pdfIdentRowFull('CREA / CAU', inspection.crea, true));

  rows.push(pdfIdentSectionRow('Identificação da vistoria'));
  rows.push(pdfIdentRowFull('Data', formatDate(inspection.data), true));

  rows.push(pdfIdentRowFull('Horário de início', inspection.horario_inicio, true));

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

function composeLaudoRelatoVistoriaPdf(inspection) {
  const parts = [];
  const main = pdfTrim(inspection.laudo_relato_vistoria);
  if (main) {
    parts.push(
      substituirPlaceholderHorarioTerminoRelato(main, inspection.horario_termino)
    );
  }
  const a1 = pdfTrim(inspection.laudo_relato_adendo_descricao);
  if (a1) parts.push(a1);
  const a2 = pdfTrim(inspection.laudo_relato_adendo_retrabalho);
  if (a2) parts.push(a2);
  const a3 = pdfTrim(inspection.laudo_relato_adendo_impedimento);
  if (a3) parts.push(a3);
  return parts.join('\n\n');
}

function finalizeLaudoMetodologiaPdf(inspection, registroNaoConformidadesItemNum) {
  const adjusted = applyDynamicMetodologiaIntro(
    inspection.laudo_metodologia,
    inspection.documentos_recebidos
  );
  const esc = METODOLOGIA_PLACEHOLDER_REG_NC.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(esc, 'gi');
  return adjusted.replace(re, `item ${registroNaoConformidadesItemNum}`);
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

    yPos = yPos + rowH + 10;
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
    yPos = ty + 10;
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
    { minFollowingMm: Math.max(PDF_CHAPTER_KEEP_WITH_NEXT_MM, 48) }
  );

  const identificacaoData = buildIdentificacaoTableBody(inspection);

  const identLabelColW = 50;
  const identValuePairW = Math.max(24, (contentWidth - identLabelColW * 2) / 2);

  autoTable(doc, {
    startY: yPos,
    body: identificacaoData,
    theme: 'grid',
    styles: {
      font: PDF_FONT,
      fontSize: PDF_BODY_PT,
      cellPadding: 3,
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
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
  // 2. DOCUMENTOS RECEBIDOS E ANALISADOS (só se houver itens no app)
  // ============================================================
  const docsList = Array.isArray(inspection.documentos_recebidos)
    ? inspection.documentos_recebidos.filter((d) => pdfTrim(d))
    : [];
  if (docsList.length > 0) {
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
    if (objT) {
      yPos = drawChapterTitle(doc, margin, contentWidth, yPos, '3. OBJETIVO', {
        minFollowingMm: 45,
      });
      doc.setFont(PDF_FONT, 'normal');
      doc.setFontSize(PDF_BODY_PT);
      doc.setTextColor(0, 0, 0);
      yPos = drawBodyParagraphs(
        doc,
        objT,
        margin,
        contentWidth,
        yPos,
        checkNewPage
      );
    }

    const relatoT = composeLaudoRelatoVistoriaPdf(inspection);
    if (relatoT) {
      checkNewPage(40);
      yPos = drawChapterTitle(
        doc,
        margin,
        contentWidth,
        yPos,
        '4. RELATO DA VISTORIA',
        { minFollowingMm: 45 }
      );
      doc.setFont(PDF_FONT, 'normal');
      doc.setFontSize(PDF_BODY_PT);
      doc.setTextColor(0, 0, 0);
      yPos = drawBodyParagraphs(
        doc,
        relatoT,
        margin,
        contentWidth,
        yPos,
        checkNewPage
      );
    }

    if (pdfTrim(metaText)) {
      checkNewPage(40);
      yPos = drawChapterTitle(doc, margin, contentWidth, yPos, '5. METODOLOGIA', {
        minFollowingMm: 45,
      });
      doc.setFont(PDF_FONT, 'normal');
      doc.setFontSize(PDF_BODY_PT);
      doc.setTextColor(0, 0, 0);
      yPos = drawBodyParagraphs(
        doc,
        metaText,
        margin,
        contentWidth,
        yPos,
        checkNewPage
      );
    }

    checkNewPage(52);
    yPos = drawChapterTitle(
      doc,
      margin,
      contentWidth,
      yPos,
      `${checklistChapterNum}. INSPEÇÃO TÉCNICA E CHECKLIST DE VERIFICAÇÃO`,
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
    // 4. INSPEÇÃO TÉCNICA E CHECKLIST DE VERIFICAÇÃO
    // ============================================================
    yPos = drawChapterTitle(
      doc,
      margin,
      contentWidth,
      yPos,
      `${checklistChapterNum}. INSPEÇÃO TÉCNICA E CHECKLIST DE VERIFICAÇÃO`,
      { minFollowingMm: 52 }
    );
  }

  if (inspection.rooms_checklist && inspection.rooms_checklist.length > 0) {
    let roomNumber = 1;

    for (const room of inspection.rooms_checklist) {
      // Itens no laudo: todos exceto legado "não existe" (removidos na app)
      const itensNoPdf = (room.items || []).filter(
        (item) => item && item.exists !== 'nao'
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

      doc.setFont(PDF_FONT, 'normal');
      doc.setFontSize(PDF_BODY_PT);
      doc.text('Itens verificados:', listX, yPos);
      yPos += PDF_BODY_LINE_MM + PDF_LIST_ITEM_EXTRA_GAP_MM;

      for (const item of itensNoPdf) {
        // Espaço mínimo para faixa + condição (~30 mm); observações/fotos quebram depois
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

        const obsTrim = (item.observations || '').trim();
        const hasCondition =
          item.condition === 'aprovado' || item.condition === 'reprovado';
        /** Observação preenchida sem Aprovado/Reprovado (fluxo do checklist). */
        const somenteObservacao = !hasCondition && obsTrim;

        if (somenteObservacao) {
          yPos = drawBodyParagraphs(
            doc,
            obsTrim,
            listX,
            checklistTextWidth,
            yPos,
            checkNewPage
          );
          yPos += PDF_LIST_ITEM_EXTRA_GAP_MM;
        } else {
          const condLabel = 'Condição: ';
          doc.setFont(PDF_FONT, 'normal');
          doc.setFontSize(PDF_BODY_PT);
          doc.setTextColor(0, 0, 0);
          doc.text(condLabel, listX, yPos);
          const condLabelW = doc.getTextWidth(condLabel);

          doc.setFont(PDF_FONT, 'bold');
          if (item.condition === 'aprovado') {
            doc.setTextColor(34, 139, 34); // Verde
            doc.text('APROVADO', listX + condLabelW, yPos);
          } else if (item.condition === 'reprovado') {
            doc.setTextColor(178, 34, 34); // Vermelho
            doc.text('REPROVADO', listX + condLabelW, yPos);
          } else {
            doc.setTextColor(0, 0, 0);
            doc.text('-', listX + condLabelW, yPos);
          }
          doc.setTextColor(0, 0, 0);
          yPos += PDF_BODY_LINE_MM;

          doc.setFont(PDF_FONT, 'normal');
          doc.setFontSize(PDF_BODY_PT);

          if (item.condition === 'aprovado') {
            const obsLab = 'Observações: ';
            doc.text(obsLab, listX, yPos);
            const obsLabW = doc.getTextWidth(obsLab);
            doc.setFont(PDF_FONT, 'italic');
            doc.text(
              'Item em conformidade, sem irregularidades aparentes.',
              listX + obsLabW,
              yPos
            );
            yPos += PDF_BODY_LINE_MM + PDF_LIST_ITEM_EXTRA_GAP_MM;
          } else if (item.condition === 'reprovado') {
            doc.text('Observações:', listX, yPos);
            yPos += PDF_BODY_LINE_MM;

            if (obsTrim) {
              yPos = drawBodyParagraphs(
                doc,
                obsTrim,
                listX,
                checklistTextWidth,
                yPos,
                checkNewPage
              );
            }
            yPos += PDF_LIST_ITEM_EXTRA_GAP_MM;
          }
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
    doc.text('Nenhum cômodo foi adicionado ao checklist.', listX, yPos);
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
  const rotuloEscolhaTrim = (inspection.classificacao_escolha_rotulo || '').trim();
  const outroSomente =
    cf === 'outro' && !!inspection.outro_somente_conclusao;
  /** Outra classificação: sem bloco se “só conclusão” ou sem rótulo personalizado preenchido */
  const hideClassificacaoBlock =
    cf === 'outro' && (outroSomente || !rotuloEscolhaTrim);

  if (!hideClassificacaoBlock && cf) {
    const labelText =
      cf === 'outro'
        ? rotuloEscolhaTrim
        : CLASSIFICACAO_FINAL_LABELS[cf] || 'PENDENTE';
    yPos = drawClassificationFinalPlain(
      doc,
      margin,
      contentWidth,
      yPos,
      labelText
    );
  }

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
