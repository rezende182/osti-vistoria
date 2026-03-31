import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { TEXTOS_CONCLUSAO } from '../constants/inspectionClassificacao';
import {
  drawBodyParagraphs,
  drawInlineLabelParagraph,
  drawResponsavelAssinaturaSection,
  drawChapterTitle,
  drawSubsectionTitle,
  measureBodyParagraphsHeightMm,
  measureInlineLabelParagraphMm,
  PDF_FONT,
  PDF_BODY_PT,
  PDF_BODY_LINE_MM,
  PDF_PAGE_BOTTOM_SAFE_MM,
  PDF_PAGE_TOP_SAFE_MM,
  PDF_CHAPTER_TITLE_PT,
  PDF_CHAPTER_TITLE_BEFORE_MM,
  PDF_CHAPTER_LINE_MM,
  PDF_LIST_INDENT_MM,
  PDF_LIST_ITEM_EXTRA_GAP_MM,
  PDF_PARAGRAPH_GAP_MM,
  PDF_CHAPTER_KEEP_WITH_NEXT_MM,
  PDF_CHAPTER_KEEP_WITH_SIGNATURE_BLOCK_MM,
  PDF_PT_TO_MM,
  PDF_PAGE_MARGIN_MM,
  PDF_LINE_HEIGHT_FACTOR,
} from './pdfLayout';
import { formatPdfAssinaturaDataLine } from './pdfAssinaturaFormat';
import { METODOLOGIA_PLACEHOLDER_REG_NC } from '../constants/laudoEntregaTextos';
import { resolveVerificationTextForLaudo } from '../constants/checklistElementTemplates';

/** Garante `;` entre itens com marcador e `.` no último de cada lista (ambiente). */
function punctuatePdfChecklistItemBlock(block, isLastInList) {
  const end = isLastInList ? '.' : ';';
  let s = String(block).replace(/\s+$/, '');
  s = s.replace(/\s*[.;]\s*$/, '');
  return s + end;
}

const PDF_ESPECIFICACOES_INTRO =
  'Este laudo técnico de vistoria foi elaborado com base na verificação das condições aparentes da edificação, considerando o atendimento às boas práticas construtivas e às diretrizes das seguintes normas técnicas e documentos:';

const PDF_ESPECIFICACOES_NORMAS = [
  'ABNT NBR 13752:1996 – Perícias de engenharia na construção civil',
  'ABNT NBR 16747 – Inspeção predial',
  'ABNT NBR 15575 – Desempenho de edificações habitacionais',
];

const PDF_ESPECIFICACOES_SEM_DOCS =
  'Não foi disponibilizado qualquer documento técnico por parte da construtora até a data da vistoria.';

const PDF_REGISTRO_FOTOGRAFICO_INTRO =
  'Descrição dos problemas evidenciados durante a vistoria, com respectivos registros fotográficos do estado em que o imóvel se encontra e seus vícios aparentes:';

const PDF_REGISTRO_SEM_FOTOS_TEXTO =
  'Registra-se que não foi realizado registro fotográfico, uma vez que não foram constatadas não conformidades aparentes no imóvel no momento da vistoria, não havendo, portanto, elementos que justificassem tal procedimento.';

/** Texto fixo antes do checklist do capítulo «Verificação dos ambientes». */
const PDF_VERIFICACAO_AMBIENTES_INTRO =
  'Apresentam-se, a seguir, os elementos e sistemas construtivos verificados em cada ambiente do imóvel, com base em inspeção visual realizada no momento da vistoria.\n\nOs critérios de verificação adotados encontram-se discriminados por ambiente, servindo como referência para os registros técnicos constantes neste laudo.';

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

/** Logo na capa com largura fixa (altura proporcional). */
function fitLogoWidthFixedMm(naturalW, naturalH, targetW) {
  if (!naturalW || !naturalH) {
    return { w: targetW, h: targetW * 0.35 };
  }
  const aspect = naturalW / naturalH;
  return { w: targetW, h: targetW / aspect };
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

/** Tabela de identificação: Helvetica/Arial 12 pt (corpo do laudo). */
const PDF_IDENT_TABLE_PT = 12;
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

/** Área no laudo: número + « m² » (ex.: 90 m²). Evita duplicar a unidade. */
function formatPdfImovelAreaM2(areaTexto) {
  const raw = pdfTrim(areaTexto);
  if (!raw) return '';
  const semUnidade = raw.replace(/\s*m[²2]\s*$/i, '').trim();
  if (!semUnidade) return '';
  return `${semUnidade} m²`;
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

/** Capa do laudo: ex. "PRAIA GRANDE - SP". */
function pdfCidadeUfCapaHyphenUpper(cidade, uf) {
  const c = pdfTrim(cidade).toUpperCase();
  const u = pdfUfSomenteSigla(uf).toUpperCase();
  if (c && u) return `${c} - ${u}`;
  if (c) return c;
  if (u) return u;
  return '';
}

/** Data da capa / assinatura em DD/MM/AAAA (ISO yyyy-mm-dd). */
function formatPdfLaudoCoverDateDdMmYyyy(iso) {
  const s = pdfTrim(iso);
  if (!s) return '';
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  const parts = s.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return s;
}

function pdfEmpreendimentoConstrutoraTexto(empreendimento, construtora) {
  const e = pdfTrim(empreendimento);
  const k = pdfTrim(construtora);
  if (e && k) return `${e} / ${k}`;
  return e || k || '';
}

/** Célula da tabela de identificação: `empreendimento/construtora` numa linha (ex.: orleans/jacinto). */
function pdfEmpreendimentoConstrutoraCellValue(inspection) {
  const e = pdfTrim(inspection.empreendimento);
  const k = pdfTrim(inspection.construtora);
  if (e && k) return `${e}/${k}`;
  return e || k || '';
}

/** Mesma linha que horários: Empreendimento | valor · Construtora | valor */
function pdfIdentRowEmpreendimentoConstrutora(empreendimento, construtora) {
  const e = pdfTrim(empreendimento);
  const k = pdfTrim(construtora);
  if (!e && !k) return null;
  return [
    pdfIdentLabelCell('Empreendimento'),
    { content: e || '—' },
    pdfIdentLabelCell('Construtora'),
    { content: k || '—' },
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

/** Mesmo texto do botão «Itens verificados» no app (inclui resolução pelo catálogo / tipo de ambiente). */
function getItemVerificationBody(item, roomType) {
  return resolveVerificationTextForLaudo(item, roomType);
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

/** Tipo do imóvel e área na mesma linha (quatro colunas). */
function pdfIdentRowTipoImovelEArea(tipoTexto, areaTexto) {
  const t = pdfTrim(tipoTexto);
  const a = pdfTrim(areaTexto);
  if (!t && !a) return null;
  return [
    pdfIdentLabelCell('Tipo do imóvel'),
    { content: t || '—' },
    pdfIdentLabelCell('Área do imóvel'),
    { content: a || '—' },
  ];
}

/** Versão compacta para a tabela 1 (primeira página). */
function pdfIdentSectionRowCompact(title) {
  return [
    {
      content: title,
      colSpan: 4,
      styles: {
        fontStyle: 'bold',
        fontSize: PDF_IDENT_TABLE_PT,
        fillColor: [226, 232, 240],
        textColor: [51, 65, 85],
        cellPadding: { top: 2.2, bottom: 2.2, left: 3, right: 3 },
      },
    },
  ];
}

/** Nome do RT no laudo com prefixo «Eng.» (evita duplicar se já existir). */
function formatPdfResponsavelTecnicoNome(name) {
  const n = pdfTrim(name);
  if (!n) return '\u2014';
  if (/^Eng\.?\s/i.test(n)) return n;
  return `Eng. ${n}`;
}

/** Condição do imóvel (Novo / Usado / Reformado) para o PDF. */
function pdfCondicaoImovelTexto(inspection) {
  const tipo = inspection.tipo_imovel;
  if (tipo === 'novo') return 'Novo';
  if (tipo === 'usado') return 'Usado';
  if (tipo === 'reformado') return 'Reformado';
  return '';
}

/**
 * Corpo da tabela «Identificação da vistoria técnica» — mesma ordem em todos os fluxos;
 * campos opcionais só entram no PDF se preenchidos (exceto obrigatórios, que usam traço se vazio).
 */
function buildIdentificacaoTableBody(inspection) {
  const fluxo = String(inspection.tipo_vistoria_fluxo || '').trim();
  const cat = inspection.imovel_categoria;
  const entregaForm =
    fluxo === 'apartamento' && (cat === 'apartamento' || cat === 'casa');

  const rows = [];

  rows.push(pdfIdentSectionRowCompact('Identificação do Responsável Técnico'));
  rows.push(
    pdfIdentRowFull(
      'Responsável Técnico',
      formatPdfResponsavelTecnicoNome(inspection.responsavel_tecnico),
      true
    )
  );
  rows.push(pdfIdentRowFull('CREA', inspection.crea, true));
  rows.push(pdfIdentRowFull('CPF', inspection.responsavel_cpf_cnpj, true));

  rows.push(pdfIdentSectionRowCompact('Identificação do contratante'));
  rows.push(pdfIdentRowFull('Contratante', inspection.cliente, true));
  rows.push(pdfIdentRowFull('CPF/CNPJ', inspection.contratante_cpf_cnpj, true));

  rows.push(pdfIdentSectionRowCompact('Dados do imóvel'));
  const tipoLinha = pdfTipoImovelUnificado(inspection);
  const tipoAreaRow = pdfIdentRowTipoImovelEArea(
    tipoLinha,
    formatPdfImovelAreaM2(inspection.imovel_area)
  );
  if (tipoAreaRow) rows.push(tipoAreaRow);

  rows.push(pdfIdentRowFull('Endereço', inspection.endereco, true));
  rows.push(
    pdfIdentRowFull(
      'Cidade/UF',
      pdfCidadeUfCapaHyphenUpper(inspection.cidade, inspection.uf) || '—',
      true
    )
  );

  if (entregaForm && cat === 'apartamento') {
    const unRow = pdfIdentRowFull('Apartamento / Bloco', inspection.unidade, false);
    if (unRow) rows.push(unRow);
  } else if (fluxo === 'apartamento') {
    const apt = pdfIdentRowFull('Apartamento / Bloco', inspection.unidade, false);
    if (apt) rows.push(apt);
  }

  const empRow = pdfIdentRowEmpreendimentoConstrutora(
    inspection.empreendimento,
    inspection.construtora
  );
  if (empRow) rows.push(empRow);

  const condStr = pdfCondicaoImovelTexto(inspection);
  const trCond = pdfIdentRowFull('Condição do imóvel', condStr, false);
  if (trCond) rows.push(trCond);

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
  const replacement = `item ${registroNaoConformidadesItemNum}`;
  const placeholders = [
    METODOLOGIA_PLACEHOLDER_REG_NC,
    '[REGISTRO DE NÃO CONFORMIDADES]',
  ];
  let out = raw;
  for (const ph of placeholders) {
    const esc = ph.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(esc, 'gi'), replacement);
  }
  return out;
}

function getJsPdfFormatFromDataUrl(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') return 'JPEG';
  const head = dataUrl.slice(0, 48).toLowerCase();
  if (head.includes('image/png')) return 'PNG';
  return 'JPEG';
}

/** Capa A4: margens 2 cm; Helvetica = Arial no motor PDF. */
const PDF_COVER_MARGIN_MM = 20;
const PDF_COVER_LOGO_W_MM = 70;
const PDF_COVER_GAP_BELOW_LOGO_MM = 28;
const PDF_COVER_TITLE_MAIN_PT = 24;
/** Espaço reduzido entre título e bloco «Assunto / Contratante / …». */
const PDF_COVER_GAP_AFTER_TITLE_MM = 8;
const PDF_COVER_INFO_PT = 12;
const PDF_COVER_INFO_LINE_FACTOR = 1.3;
const PDF_COVER_TRACKING_PT = 0.35;
/** Reserva no rodapé para cidade + data (acima da margem inferior). */
const PDF_COVER_BOTTOM_BLOCK_MM = 22;

/**
 * Endereço na capa: logradouro, Apartamento/Bloco se houver, Cidade - UF.
 */
function buildPdfCoverEnderecoCompleto(inspection) {
  const parts = [];
  const e = pdfTrim(inspection.endereco);
  if (e) parts.push(e);
  const u = pdfTrim(inspection.unidade);
  if (u) parts.push(`Apartamento/Bloco: ${u}`);
  const loc = pdfCidadeUfCapaHyphenUpper(inspection.cidade, inspection.uf);
  if (loc) parts.push(loc);
  const inner = parts.length ? parts.join(', ') : '\u2014';
  return `Endereço: ${inner}`;
}

/**
 * Primeira página: logo → título → assunto/contratante/endereço/RT; rodapé: Cidade - UF e data.
 */
async function drawPdfCoverPage(doc, inspection, pageWidth, pageHeight) {
  const cx = pageWidth / 2;
  const textMaxW = pageWidth - 2 * PDF_COVER_MARGIN_MM;
  const logoUrl = inspection.pdf_logo_data_url;
  const hasLogo =
    logoUrl && typeof logoUrl === 'string' && logoUrl.startsWith('data:image/');

  const infoLineH = PDF_COVER_INFO_PT * PDF_PT_TO_MM * PDF_COVER_INFO_LINE_FACTOR;
  const cidadeRodape = pdfCidadeUfCapaHyphenUpper(inspection.cidade, inspection.uf);
  const dataRodape = formatPdfLaudoCoverDateDdMmYyyy(
    inspection.data_final || inspection.data
  );

  const yDataRodape = pageHeight - PDF_COVER_MARGIN_MM - 2;
  const yCidadeRodape = yDataRodape - infoLineH * 1.05;
  const yMaxCorpo = yCidadeRodape - PDF_COVER_BOTTOM_BLOCK_MM;

  let y = PDF_COVER_MARGIN_MM;

  if (hasLogo) {
    try {
      const { width: iw, height: ih } = await getDataUrlImageDimensions(logoUrl);
      const { w: lw, h: lh } = fitLogoWidthFixedMm(iw, ih, PDF_COVER_LOGO_W_MM);
      doc.addImage(
        logoUrl,
        getJsPdfFormatFromDataUrl(logoUrl),
        cx - lw / 2,
        y,
        lw,
        lh
      );
      y += lh + PDF_COVER_GAP_BELOW_LOGO_MM;
    } catch (e) {
      console.log('Capa: não foi possível incluir o logo.', e);
      y += PDF_COVER_GAP_BELOW_LOGO_MM;
    }
  } else {
    y += 12;
  }

  doc.setTextColor(0, 0, 0);
  const mainLineH = PDF_COVER_TITLE_MAIN_PT * PDF_PT_TO_MM * PDF_LINE_HEIGHT_FACTOR;
  doc.setFont(PDF_FONT, 'bold');
  doc.setFontSize(PDF_COVER_TITLE_MAIN_PT);
  if (typeof doc.setCharSpace === 'function') {
    doc.setCharSpace(PDF_COVER_TRACKING_PT);
  }
  const mainLines = doc.splitTextToSize('LAUDO DE VISTORIA TÉCNICA', textMaxW);
  y += mainLineH * 0.85;
  mainLines.forEach((ln) => {
    doc.text(ln, cx, y, { align: 'center' });
    y += mainLineH;
  });
  if (typeof doc.setCharSpace === 'function') {
    doc.setCharSpace(0);
  }

  y += PDF_COVER_GAP_AFTER_TITLE_MM;

  doc.setFont(PDF_FONT, 'normal');
  doc.setFontSize(PDF_COVER_INFO_PT);

  const creaTxt = pdfTrim(inspection.crea) || '\u2014';
  const linhasInfo = [
    'Assunto: Vistoria Técnica para Recebimento de Imóvel',
    `Contratante: ${pdfTrim(inspection.cliente) || '\u2014'}`,
    buildPdfCoverEnderecoCompleto(inspection),
    `Responsável Técnico: ${formatPdfResponsavelTecnicoNome(
      inspection.responsavel_tecnico
    )} — CREA ${creaTxt}`,
  ];

  for (const texto of linhasInfo) {
    const partes = doc.splitTextToSize(texto, textMaxW);
    for (const ln of partes) {
      if (y > yMaxCorpo) break;
      doc.text(ln, cx, y, { align: 'center' });
      y += infoLineH;
    }
    if (y > yMaxCorpo) break;
  }

  doc.setFont(PDF_FONT, 'normal');
  doc.setFontSize(PDF_COVER_INFO_PT);
  doc.setTextColor(0, 0, 0);
  if (cidadeRodape) {
    doc.text(cidadeRodape, cx, yCidadeRodape, { align: 'center' });
  }
  if (dataRodape) {
    doc.text(dataRodape, cx, yDataRodape, { align: 'center' });
  }
}

/** Rodapé esquerdo do laudo. */
function buildPdfFooterLeftLine() {
  return 'Laudo de Vistoria Técnica';
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
 * Retorna Y imediatamente abaixo do bloco da legenda.
 */
function drawPdfPhotoCaptionBoldPrefix(doc, imgX, imgWidth, yStart, parts) {
  const lh = PDF_BODY_LINE_MM;
  /** Margem após a última linha da legenda */
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

/** Legenda «Foto NN.»: Arial/Helvetica 10 pt, entrelinha 1,5. */
const PDF_NC_CAPTION_PT = 10;
const PDF_NC_CAPTION_LINE_MM = PDF_NC_CAPTION_PT * PDF_PT_TO_MM * PDF_LINE_HEIGHT_FACTOR;

function parseRegistroCaptionPrefixBody(caption, photoNumber) {
  const raw = pdfTrim(caption);
  if (!raw) return null;
  const m = raw.match(/^(Foto|Imagem)\s*(\d+)\s*\.\s*(.*)$/i);
  let prefix;
  let body;
  if (m) {
    const num = String(parseInt(m[2], 10)).padStart(2, '0');
    prefix = `Foto ${num}.`;
    body = pdfTrim(m[3]);
  } else {
    const n =
      photoNumber != null && photoNumber !== '' && !Number.isNaN(Number(photoNumber))
        ? Number(photoNumber)
        : 1;
    prefix = `Foto ${String(n).padStart(2, '0')}.`;
    body = raw;
  }
  return { prefix, body };
}

/** Conta linhas da legenda centrada na largura da foto (10 pt): «Foto NN.» + texto, sem travessão. */
function countRegistroCaptionLines(doc, maxW, prefix, body) {
  doc.setFontSize(PDF_NC_CAPTION_PT);
  if (!body) return 1;
  doc.setFont(PDF_FONT, 'bold');
  const pw = doc.getTextWidth(prefix);
  doc.setFont(PDF_FONT, 'normal');
  const gapW = doc.getTextWidth(' ');
  const wFirst = Math.max(8, maxW - pw - gapW);
  const firstLine = doc.splitTextToSize(body, wFirst)[0];
  let rest = body;
  const p = rest.indexOf(firstLine);
  if (p >= 0) rest = rest.slice(p + firstLine.length).trim();
  else rest = '';
  if (!rest) return 1;
  const restLines = doc.splitTextToSize(rest, maxW);
  return 1 + restLines.length;
}

function measureRegistroCaptionHeightFromApp(doc, picW, captionText, photoNumber) {
  const parsed = parseRegistroCaptionPrefixBody(captionText, photoNumber);
  if (!parsed) return 0;
  const maxW = Math.max(20, picW);
  const nLines = countRegistroCaptionLines(doc, maxW, parsed.prefix, parsed.body);
  doc.setFontSize(PDF_BODY_PT);
  return nLines * PDF_NC_CAPTION_LINE_MM + 0.35;
}

/**
 * Legenda centrada com a foto: **Foto NN.** (negrito) + espaço + texto (normal), sem « - ».
 */
function drawPdfRegistroFotoCaptionFromApp(
  doc,
  picX,
  picW,
  yStart,
  captionText,
  photoNumber
) {
  const parsed = parseRegistroCaptionPrefixBody(captionText, photoNumber);
  if (!parsed) return yStart;
  const { prefix, body } = parsed;
  const maxW = Math.max(20, picW);
  const cx = picX + picW / 2;
  const lh = PDF_NC_CAPTION_LINE_MM;

  doc.setFontSize(PDF_NC_CAPTION_PT);
  doc.setTextColor(0, 0, 0);
  let y = yStart + lh * 0.85;

  doc.setFont(PDF_FONT, 'bold');
  const pw = doc.getTextWidth(prefix);
  doc.setFont(PDF_FONT, 'normal');
  const gapW = doc.getTextWidth(' ');
  const wFirst = Math.max(8, maxW - pw - gapW);

  if (!body) {
    doc.setFont(PDF_FONT, 'bold');
    doc.text(prefix, cx, y, { align: 'center' });
    doc.setFont(PDF_FONT, 'normal');
    doc.setFontSize(PDF_BODY_PT);
    return y + lh * 0.2;
  }

  const line0 = doc.splitTextToSize(body, wFirst)[0];
  doc.setFont(PDF_FONT, 'normal');
  const tw0 = doc.getTextWidth(line0);
  const totalW = pw + gapW + tw0;
  let xStart = cx - totalW / 2;

  doc.setFont(PDF_FONT, 'bold');
  doc.text(prefix, xStart, y);
  doc.setFont(PDF_FONT, 'normal');
  doc.text(line0, xStart + pw + gapW, y);

  let rest = body;
  const p = rest.indexOf(line0);
  if (p >= 0) rest = rest.slice(p + line0.length).trim();
  else rest = '';

  if (rest) {
    doc.splitTextToSize(rest, maxW).forEach((ln) => {
      y += lh;
      doc.text(ln, cx, y, { align: 'center', maxWidth: maxW });
    });
  }

  doc.setFontSize(PDF_BODY_PT);
  return y + lh * 0.2;
}

const PDF_NC_PROBLEMATICA_LABEL = 'PROBLEMÁTICA:';
const PDF_NC_LOCALIZACAO_LABEL = 'LOCALIZAÇÃO:';
/** Espaço entre o fim da legenda e o bloco «Localização» / «Problemática». */
const PDF_NC_AFTER_PHOTO_GAP_MM = 6;

/** «LOCALIZAÇÃO:» e «PROBLEMÁTICA:» em sequência, sem espaço extra entre os dois blocos. */
function measureLocProbCombinedMm(doc, contentWidth, pad, localizacaoText, ncBody, lineH) {
  const innerW = Math.max(20, contentWidth - 2 * pad);
  doc.setFont(PDF_FONT, 'normal');
  doc.setFontSize(PDF_BODY_PT);
  const hLoc = measureInlineLabelParagraphMm(
    doc,
    innerW,
    PDF_NC_LOCALIZACAO_LABEL,
    localizacaoText
  );
  const hProb = measureInlineLabelParagraphMm(doc, innerW, PDF_NC_PROBLEMATICA_LABEL, ncBody);
  return pad + hLoc + hProb + pad;
}

function drawPdfLocProbCombined(
  doc,
  tableX,
  yTop,
  contentWidth,
  pad,
  localizacaoText,
  ncBody,
  lineH
) {
  const innerX = tableX + pad;
  const innerW = Math.max(20, contentWidth - 2 * pad);
  const y0 = yTop + pad + lineH * 0.85;
  let y = drawInlineLabelParagraph(
    doc,
    innerX,
    innerW,
    y0,
    PDF_NC_LOCALIZACAO_LABEL,
    localizacaoText,
    {}
  );
  y = drawInlineLabelParagraph(doc, innerX, innerW, y, PDF_NC_PROBLEMATICA_LABEL, ncBody, {});
  return y + pad;
}

/**
 * Quebra legenda à largura da imagem (mm); força partição em tokens muito longos.
 */
function wrapPdfCaptionToImageWidth(doc, text, maxWidthMm) {
  doc.setFont(PDF_FONT, 'normal');
  doc.setFontSize(PDF_NC_CAPTION_PT);
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

/* ---------- Registo fotográfico (foto + legenda; texto sem moldura) ---------- */
const PDF_NC_PHOTO_INNER_PAD_MM = 1.5;
/**
 * Caixa única para todas as fotos do registo (largura × altura).
 * Dimensão pensada para laudo técnico: boa leitura, ~2 itens por página A4 com
 * descrição típica de 3–4 linhas; textos muito longos podem quebrar para a página seguinte.
 * A imagem é desenhada com proporção preservada (centrada na caixa).
 */
const PDF_NC_IMG_W_MM = 120;
const PDF_NC_IMG_H_MM = 58;
const PDF_NC_DESC_PAD_MM = 2;
const PDF_NC_IMAGE_TO_CAPTION_GAP_MM = 1;

/** Par no registo: colunas ~8,5 cm, imagem 8,2 × 5,8 cm (mesma altura que foto única do laudo), espaço 0,5 cm. */
const PDF_REG_PAIR_COL_W_MM = 85;
const PDF_REG_PAIR_GAP_MM = 5;
const PDF_REG_PAIR_IMG_W_MM = 82;
const PDF_REG_PAIR_ROW_GAP_MM = 4;

function registroPairLayoutScaled(contentWidth) {
  const ideal = 2 * PDF_REG_PAIR_COL_W_MM + PDF_REG_PAIR_GAP_MM;
  const scale = Math.min(1, contentWidth / ideal);
  const colW = PDF_REG_PAIR_COL_W_MM * scale;
  const gap = PDF_REG_PAIR_GAP_MM * scale;
  const imgW = PDF_REG_PAIR_IMG_W_MM * scale;
  /** Altura igual à caixa padrão do registo (`PDF_NC_IMG_H_MM`), não à proporção da foto única 120 mm. */
  const imgH = PDF_NC_IMG_H_MM * scale;
  return { colW, gap, imgW, imgH, scale };
}

/** Junta as descrições das fotos do mesmo item num único texto (segmentos separados por « — »). */
function mergePhotoDescriptionsSegmented(photos) {
  const parts = (photos || []).map((p) => pdfTrim(p?.description)).filter(Boolean);
  if (parts.length === 0) return '\u2014';
  if (parts.length === 1) return parts[0];
  return parts.join(' — ');
}

function measureRegistroPairCellHeight(doc, imgW, imgH, captionFromApp, photoNumber) {
  const cap = pdfTrim(captionFromApp);
  const capH = cap
    ? measureRegistroCaptionHeightFromApp(doc, imgW, cap, photoNumber)
    : 0;
  return (
    PDF_NC_PHOTO_INNER_PAD_MM +
    imgH +
    (capH > 0 ? PDF_NC_IMAGE_TO_CAPTION_GAP_MM + capH : 0) +
    PDF_NC_PHOTO_INNER_PAD_MM
  );
}

function measureRegistroPairRowMm(doc, photosInRow, layout) {
  const { imgW, imgH } = layout;
  if (photosInRow.length >= 2) {
    let maxH = 0;
    for (const photo of photosInRow) {
      const cap = pdfTrim(photo.caption);
      const h = measureRegistroPairCellHeight(doc, imgW, imgH, cap, photo.number);
      maxH = Math.max(maxH, h);
    }
    return maxH;
  }
  const photo = photosInRow[0];
  const cap = pdfTrim(photo.caption);
  return measureRegistroPairCellHeight(doc, imgW, imgH, cap, photo.number);
}

async function drawPdfRegistroPairCell(doc, picX, imgW, imgH, yPicTop, photo) {
  const captionFromApp = pdfTrim(photo.caption);
  if (photo.url) {
    try {
      const imgFmt = getJsPdfFormatFromDataUrl(photo.url);
      const { width: iw, height: ih } = await getDataUrlImageDimensions(photo.url);
      const { w: dw, h: dh } = fitLogoSizeMm(iw, ih, imgW, imgH);
      const dx = picX + (imgW - dw) / 2;
      const dy = yPicTop + (imgH - dh) / 2;
      doc.addImage(photo.url, imgFmt, dx, dy, dw, dh);
    } catch (e) {
      console.error('Erro ao adicionar imagem (NC):', e);
      doc.setFont(PDF_FONT, 'italic');
      doc.setFontSize(PDF_BODY_PT);
      doc.text('[Imagem não disponível]', picX + imgW / 2, yPicTop + imgH / 2, {
        align: 'center',
      });
      doc.setFont(PDF_FONT, 'normal');
    }
  }
  let yBelow = yPicTop + imgH;
  if (captionFromApp) {
    yBelow = drawPdfRegistroFotoCaptionFromApp(
      doc,
      picX,
      imgW,
      yPicTop + imgH + PDF_NC_IMAGE_TO_CAPTION_GAP_MM,
      captionFromApp,
      photo.number
    );
  }
  return yBelow + PDF_NC_PHOTO_INNER_PAD_MM;
}

/**
 * Linha do «quadro» 1×2 (bordas invisíveis): duas colunas ~8,5 cm, imagem 8,2 cm centrada na coluna;
 * linha inteira centrada na área útil. Uma foto: uma coluna centrada na página.
 */
async function drawPdfRegistroPairRow(doc, yRowTop, tableX, contentWidth, photosInRow, layout) {
  const { colW, gap, imgW, imgH } = layout;
  const n = photosInRow.length;
  const totalRowW = n === 2 ? 2 * colW + gap : colW;
  const rowLeft = tableX + (contentWidth - totalRowW) / 2;

  if (n >= 2) {
    let maxBottom = yRowTop;
    for (let i = 0; i < 2; i++) {
      const colLeft = rowLeft + i * (colW + gap);
      const picX = colLeft + (colW - imgW) / 2;
      const yPic = yRowTop + PDF_NC_PHOTO_INNER_PAD_MM;
      const bottom = await drawPdfRegistroPairCell(doc, picX, imgW, imgH, yPic, photosInRow[i]);
      maxBottom = Math.max(maxBottom, bottom);
    }
    return maxBottom;
  }

  const colLeft = rowLeft;
  const picX = colLeft + (colW - imgW) / 2;
  const yPic = yRowTop + PDF_NC_PHOTO_INNER_PAD_MM;
  return drawPdfRegistroPairCell(doc, picX, imgW, imgH, yPic, photosInRow[0]);
}

/**
 * Várias fotos do mesmo item: 2 por linha; LOCALIZAÇÃO única; PROBLEMÁTICA com descrições fundidas.
 */
async function drawPdfRegistroItemGroup(
  doc,
  yStart,
  margin,
  contentWidth,
  roomNameUpper,
  photos
) {
  const pageHeight = doc.internal.pageSize.getHeight();
  const tableX = margin;
  const lineH = PDF_BODY_LINE_MM;
  const descPad = PDF_NC_DESC_PAD_MM;
  const layout = registroPairLayoutScaled(contentWidth);
  const locText = String(roomNameUpper || '').trim() || '\u2014';
  const mergedProb = mergePhotoDescriptionsSegmented(photos);

  const rows = [];
  for (let i = 0; i < photos.length; i += 2) {
    rows.push(photos.slice(i, i + 2));
  }

  const rowHeights = rows.map((row) => measureRegistroPairRowMm(doc, row, layout));
  const textBlockH =
    PDF_NC_AFTER_PHOTO_GAP_MM +
    measureLocProbCombinedMm(doc, contentWidth, descPad, locText, mergedProb, lineH);

  function remainingHeightFromRow(ri) {
    let s = 0;
    for (let j = ri; j < rows.length; j++) {
      s += rowHeights[j];
      if (j < rows.length - 1) s += PDF_REG_PAIR_ROW_GAP_MM;
    }
    s += textBlockH;
    return s;
  }

  let y = yStart;
  for (let ri = 0; ri < rows.length; ri++) {
    if (y + remainingHeightFromRow(ri) > pageHeight - PDF_PAGE_BOTTOM_SAFE_MM) {
      doc.addPage();
      y = PDF_PAGE_TOP_SAFE_MM;
    }
    y = await drawPdfRegistroPairRow(doc, y, tableX, contentWidth, rows[ri], layout);
    if (ri < rows.length - 1) y += PDF_REG_PAIR_ROW_GAP_MM;
  }

  if (y + textBlockH > pageHeight - PDF_PAGE_BOTTOM_SAFE_MM) {
    doc.addPage();
    y = PDF_PAGE_TOP_SAFE_MM;
  }
  y += PDF_NC_AFTER_PHOTO_GAP_MM;
  y = drawPdfLocProbCombined(doc, tableX, y, contentWidth, descPad, locText, mergedProb, lineH);

  return y + PDF_LIST_ITEM_EXTRA_GAP_MM * 1.5;
}

/** Texto completo do capítulo ENCERRAMENTO (n.º de folhas só após fecho do documento). */
function buildEncerramentoCompletoPdf(nFolhas) {
  const p1 = `Sendo signatário, encerro o presente documento, constando ${nFolhas} folhas, digitadas de um só lado, datado e assinado.`;
  const p2 =
    'Todas as informações contidas neste documento são verdadeiras. Este é um trabalho isento e ético, atendendo às determinações da Resolução nº 205 do Conselho Federal de Engenharia, Arquitetura e Agronomia, de 30/09/71, que adota o Código de Ética Profissional.';
  const p3 =
    'O responsável técnico pela elaboração deste laudo de vistoria se coloca à disposição para quaisquer esclarecimentos adicionais que se fizerem necessários.';
  return `${p1}\n\n${p2}\n\n${p3}`;
}

function measureEncerramentoCompletoMm(doc, contentWidth, nFolhas) {
  doc.setFont(PDF_FONT, 'normal');
  doc.setFontSize(PDF_BODY_PT);
  return measureBodyParagraphsHeightMm(doc, buildEncerramentoCompletoPdf(nFolhas), contentWidth);
}

/**
 * Registo fotográfico: foto + legenda (inalterados); abaixo «LOCALIZAÇÃO:» e «PROBLEMÁTICA:»
 * (mesmo fluxo de texto que antes), sem moldura nem faixa.
 */
async function drawPdfNaoConformidadeTable(
  doc,
  yStart,
  margin,
  contentWidth,
  ncIdx,
  roomNameUpper,
  photo
) {
  void ncIdx;
  const pageHeight = doc.internal.pageSize.getHeight();
  const tableX = margin;
  const lineH = PDF_BODY_LINE_MM;
  const descPad = PDF_NC_DESC_PAD_MM;

  const maxUsableW = contentWidth - 2 * PDF_NC_PHOTO_INNER_PAD_MM;
  let picW = PDF_NC_IMG_W_MM;
  let picH = PDF_NC_IMG_H_MM;
  if (picW > maxUsableW) {
    const s = maxUsableW / PDF_NC_IMG_W_MM;
    picW = maxUsableW;
    picH = PDF_NC_IMG_H_MM * s;
  }
  const picX = tableX + (contentWidth - picW) / 2;

  const captionFromApp = pdfTrim(photo.caption);
  const capH = measureRegistroCaptionHeightFromApp(doc, picW, captionFromApp, photo.number);

  const locText = String(roomNameUpper || '').trim() || '\u2014';
  const ncBody = pdfTrim(photo.description) || '\u2014';
  const locProbH = measureLocProbCombinedMm(doc, contentWidth, descPad, locText, ncBody, lineH);

  const photoH =
    PDF_NC_PHOTO_INNER_PAD_MM +
    picH +
    (capH > 0 ? PDF_NC_IMAGE_TO_CAPTION_GAP_MM + capH : 0) +
    PDF_NC_PHOTO_INNER_PAD_MM;
  const totalH = photoH + PDF_NC_AFTER_PHOTO_GAP_MM + locProbH;

  let y = yStart;
  if (y + totalH > pageHeight - PDF_PAGE_BOTTOM_SAFE_MM) {
    doc.addPage();
    y = PDF_PAGE_TOP_SAFE_MM;
  }

  const yPic = y + PDF_NC_PHOTO_INNER_PAD_MM;
  if (photo.url) {
    try {
      const imgFmt = getJsPdfFormatFromDataUrl(photo.url);
      const { width: iw, height: ih } = await getDataUrlImageDimensions(photo.url);
      const { w: dw, h: dh } = fitLogoSizeMm(iw, ih, picW, picH);
      const dx = picX + (picW - dw) / 2;
      const dy = yPic + (picH - dh) / 2;
      doc.addImage(photo.url, imgFmt, dx, dy, dw, dh);
    } catch (e) {
      console.error('Erro ao adicionar imagem (NC):', e);
      doc.setFont(PDF_FONT, 'italic');
      doc.setFontSize(PDF_BODY_PT);
      doc.text('[Imagem não disponível]', tableX + contentWidth / 2, yPic + picH / 2, {
        align: 'center',
      });
      doc.setFont(PDF_FONT, 'normal');
    }
  }

  let yBelowCaption = yPic + picH;
  if (captionFromApp) {
    yBelowCaption = drawPdfRegistroFotoCaptionFromApp(
      doc,
      picX,
      picW,
      yPic + picH + PDF_NC_IMAGE_TO_CAPTION_GAP_MM,
      captionFromApp,
      photo.number
    );
  }
  const yAfterPhotoBlock = yBelowCaption + PDF_NC_PHOTO_INNER_PAD_MM;

  let yText = yAfterPhotoBlock + PDF_NC_AFTER_PHOTO_GAP_MM;
  yText = drawPdfLocProbCombined(doc, tableX, yText, contentWidth, descPad, locText, ncBody, lineH);

  return yText + PDF_LIST_ITEM_EXTRA_GAP_MM * 1.5;
}

// Gerar PDF
export const generateInspectionPDF = async (inspection, forPreview = false) => {
  if (!inspection) {
    throw new Error('Dados da vistoria não disponíveis');
  }

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = PDF_PAGE_MARGIN_MM;
  const contentWidth = pageWidth - margin * 2;
  const listX = margin + PDF_LIST_INDENT_MM;
  let yPos = PDF_PAGE_TOP_SAFE_MM;

  // Verificar nova página
  const checkNewPage = (neededSpace = 30) => {
    if (yPos + neededSpace > pageHeight - PDF_PAGE_BOTTOM_SAFE_MM) {
      doc.addPage();
      yPos = PDF_PAGE_TOP_SAFE_MM;
      return true;
    }
    return false;
  };

  await drawPdfCoverPage(doc, inspection, pageWidth, pageHeight);
  doc.addPage();
  doc.setTextColor(0, 0, 0);

  // ============================================================
  // Corpo do laudo (após capa)
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

  /** Largura do rótulo suficiente para «Empreendimento / Construtora» sem partir palavras. */
  const identLabelColW = 48;
  const identValuePairW = Math.max(24, (contentWidth - identLabelColW * 2) / 2);

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
      overflow: 'linebreak',
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

  const docsList = Array.isArray(inspection.documentos_recebidos)
    ? inspection.documentos_recebidos.filter((d) => pdfTrim(d))
    : [];
  const entregaLaudoExt = isEntregaImovelLaudoExtended(inspection);

  if (entregaLaudoExt) {
    const objT = pdfTrim(inspection.laudo_objetivo);
    yPos = drawChapterTitle(doc, margin, contentWidth, yPos, '3. OBJETIVO', {
      minFollowingMm: 28,
    });
    yPos = drawBodyParagraphs(
      doc,
      objT || '\u2014',
      margin,
      contentWidth,
      yPos,
      checkNewPage
    );
  }

  doc.addPage();
  yPos = PDF_PAGE_TOP_SAFE_MM;

  const checklistChapterNum = entregaLaudoExt ? 6 : 4;
  const ncChapterNum = entregaLaudoExt ? 7 : 5;
  const conclusaoChapterNum = entregaLaudoExt ? 8 : 6;
  const encerramentoChapterNum = entregaLaudoExt ? 9 : 7;

  if (entregaLaudoExt) {
    const metaText = finalizeLaudoMetodologiaPdf(inspection, ncChapterNum);

    yPos = drawChapterTitle(doc, margin, contentWidth, yPos, '4. ESPECIFICAÇÕES TÉCNICAS', {
      minFollowingMm: 32,
    });
    yPos = drawSubsectionTitle(doc, margin, contentWidth, yPos, '4.1 Referências', {
      minFollowingMm: 28,
    });
    doc.setFont(PDF_FONT, 'normal');
    doc.setFontSize(PDF_BODY_PT);
    doc.setTextColor(0, 0, 0);
    yPos = drawBodyParagraphs(
      doc,
      PDF_ESPECIFICACOES_INTRO,
      margin,
      contentWidth,
      yPos,
      checkNewPage
    );
    yPos += PDF_PARAGRAPH_GAP_MM;
    const refItens = [
      ...PDF_ESPECIFICACOES_NORMAS,
      ...(docsList.length > 0 ? docsList : []),
    ];
    const nRef = refItens.length;
    refItens.forEach((raw, refIdx) => {
      checkNewPage(18);
      const base = pdfTrim(String(raw)).replace(/[.;]\s*$/, '');
      const punct = refIdx === nRef - 1 ? '.' : ';';
      const line = `\u2013 ${base}${punct}`;
      const wrapped = doc.splitTextToSize(line, contentWidth);
      wrapped.forEach((wln) => {
        checkNewPage(8);
        doc.text(wln, margin, yPos);
        yPos += PDF_BODY_LINE_MM;
      });
    });
    yPos += PDF_LIST_ITEM_EXTRA_GAP_MM;
    if (docsList.length === 0) {
      yPos = drawBodyParagraphs(
        doc,
        PDF_ESPECIFICACOES_SEM_DOCS,
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
    yPos = drawBodyParagraphs(
      doc,
      metaText || '\u2014',
      margin,
      contentWidth,
      yPos,
      checkNewPage
    );

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

  yPos = drawBodyParagraphs(
    doc,
    PDF_VERIFICACAO_AMBIENTES_INTRO,
    margin,
    contentWidth,
    yPos,
    checkNewPage
  );
  yPos += PDF_PARAGRAPH_GAP_MM;

  const checklistTextWidth = contentWidth - PDF_LIST_INDENT_MM;
  const ncPhotoGroups = [];

  if (inspection.rooms_checklist && inspection.rooms_checklist.length > 0) {
    let roomNumber = 1;

    for (const room of inspection.rooms_checklist) {
      const itensNoPdf = (room.items || []).filter(
        (item) =>
          item && item.name && String(item.name).trim().toLowerCase() !== 'vidro'
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

      for (let itemIdx = 0; itemIdx < itensNoPdf.length; itemIdx++) {
        const item = itensNoPdf[itemIdx];
        checkNewPage(18);

        const mainVerify = getItemVerificationBody(item, room.room_type);
        const rawBlock = mainVerify
          ? `- ${item.name}: ${mainVerify}`
          : `- ${item.name}: \u2014`;
        const block = punctuatePdfChecklistItemBlock(
          rawBlock,
          itemIdx === itensNoPdf.length - 1
        );
        doc.setFont(PDF_FONT, 'normal');
        doc.setFontSize(PDF_BODY_PT);
        doc.setTextColor(0, 0, 0);
        yPos = drawBodyParagraphs(doc, block, listX, checklistTextWidth, yPos, checkNewPage);
        yPos += PDF_LIST_ITEM_EXTRA_GAP_MM;

        const photosWithUrl = (item.photos || []).filter((p) => p && p.url);
        if (photosWithUrl.length > 0) {
          ncPhotoGroups.push({ room, photos: photosWithUrl });
        }
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
  // N. REGISTRO FOTOGRÁFICO
  // ============================================================
  checkNewPage(40);
  yPos = drawChapterTitle(
    doc,
    margin,
    contentWidth,
    yPos,
    `${ncChapterNum}. REGISTRO FOTOGRÁFICO`,
    { minFollowingMm: 52 }
  );
  if (ncPhotoGroups.length === 0) {
    yPos = drawBodyParagraphs(
      doc,
      PDF_REGISTRO_SEM_FOTOS_TEXTO,
      margin,
      contentWidth,
      yPos,
      checkNewPage
    );
    yPos += PDF_PARAGRAPH_GAP_MM;
  } else {
    yPos = drawBodyParagraphs(
      doc,
      PDF_REGISTRO_FOTOGRAFICO_INTRO,
      margin,
      contentWidth,
      yPos,
      checkNewPage
    );
    yPos += PDF_PARAGRAPH_GAP_MM;
    let ncIdx = 0;
    for (const { room, photos } of ncPhotoGroups) {
      ncIdx += 1;
      const roomUpper = String(room.room_name || '').toUpperCase();
      if (photos.length === 1) {
        yPos = await drawPdfNaoConformidadeTable(
          doc,
          yPos,
          margin,
          contentWidth,
          ncIdx,
          roomUpper,
          photos[0]
        );
      } else {
        yPos = await drawPdfRegistroItemGroup(
          doc,
          yPos,
          margin,
          contentWidth,
          roomUpper,
          photos
        );
      }
    }
  }

  // ============================================================
  // CONCLUSÃO
  // ============================================================
  yPos += PDF_CHAPTER_TITLE_BEFORE_MM;
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

  yPos += PDF_PARAGRAPH_GAP_MM;

  if (textoConclusao) {
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
  // ENCERRAMENTO — reserva de espaço + desenho único após total de páginas (sem retângulo branco)
  // ============================================================
  checkNewPage(40);
  yPos = drawChapterTitle(
    doc,
    margin,
    contentWidth,
    yPos,
    `${encerramentoChapterNum}. ENCERRAMENTO`,
    { minFollowingMm: 48 }
  );
  const encStartPage = doc.internal.getNumberOfPages();
  yPos += PDF_PARAGRAPH_GAP_MM;
  const encBodyTopY = yPos;
  /** Reserva com n.º de folhas “máximo” para não sobrepor a assinatura; texto final desenhado depois. */
  const reservedEncH = measureEncerramentoCompletoMm(doc, contentWidth, 99999);
  yPos = encBodyTopY + reservedEncH;
  yPos += PDF_PARAGRAPH_GAP_MM;

  // ============================================================
  // Responsável técnico / assinatura (sem título de capítulo)
  // ============================================================
  checkNewPage(36);
  yPos += PDF_PARAGRAPH_GAP_MM * 1.5;
  /** Espaço extra entre o fim do texto do encerramento e a linha local/data (assinatura). */
  yPos += 10;

  const responsavel = formatPdfResponsavelTecnicoNome(
    inspection.responsavel_final || inspection.responsavel_tecnico || ''
  );
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

  const totalPagesLaudo = doc.internal.getNumberOfPages();
  doc.setPage(encStartPage);
  doc.setTextColor(0, 0, 0);
  drawBodyParagraphs(
    doc,
    buildEncerramentoCompletoPdf(totalPagesLaudo),
    margin,
    contentWidth,
    encBodyTopY,
    checkNewPage
  );
  doc.setPage(totalPagesLaudo);

  // ============================================================
  // RODAPÉ em todas as páginas (capa = p. 1 sem rodapé/numerar)
  // ============================================================
  const footerLeftText = buildPdfFooterLeftLine();
  const totalPages = doc.internal.getNumberOfPages();
  const footerBottomY = pageHeight - PDF_PAGE_BOTTOM_SAFE_MM;
  const footerLineStep = PDF_BODY_LINE_MM * 0.72;

  for (let i = 1; i <= totalPages; i++) {
    if (i === 1) continue;
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
