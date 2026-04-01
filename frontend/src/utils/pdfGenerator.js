import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { TEXTOS_CONCLUSAO } from '../constants/inspectionClassificacao';
import {
  drawBodyParagraphs,
  drawInlineLabelParagraph,
  drawResponsavelAssinaturaSection,
  drawChapterTitle,
  drawSubsectionTitle,
  drawElementTitle,
  measureBodyParagraphsHeightMm,
  measureInlineLabelParagraphMm,
  PDF_FONT,
  PDF_BODY_PT,
  PDF_BODY_LINE_MM,
  PDF_PAGE_TOP_SAFE_MM,
  PDF_CHAPTER_TITLE_PT,
  PDF_CHAPTER_TITLE_BEFORE_MM,
  PDF_CHAPTER_TITLE_AFTER_MM,
  PDF_ABNT_BLANK_LINE_MM,
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

/**
 * Margem inferior útil no laudo: espaço abaixo do rodapé + faixa (~16 mm) + folga (evita sobreposição).
 * (Helvetica ≈ Arial; Calibri exigiria fonte embutida.)
 */
const PDF_LAUDO_PAGE_BOTTOM_SAFE_MM = 30;
const laudoBodyParagraphsOpts = { bottomMarginMm: PDF_LAUDO_PAGE_BOTTOM_SAFE_MM };

/** Rodapé institucional (páginas 2+): faixa ~1,6 cm, linha superior cinza. */
const PDF_LAUDO_FOOTER_BAND_MM = 16;
const PDF_LAUDO_FOOTER_BOTTOM_MARGIN_MM = 8;
const PDF_LAUDO_FOOTER_LINE_GRAY = [170, 170, 170];
const PDF_LAUDO_FOOTER_PT = 8;
const PDF_LAUDO_FOOTER_LOGO_MAX_H_MM = 12;
const PDF_LAUDO_FOOTER_LOGO_MAX_W_MM = 34;
const PDF_LAUDO_FOOTER_CENTER_TITLE = 'OSTI ENGENHARIA – Engenharia Diagnóstica';
const PDF_LAUDO_FOOTER_CENTER_CONTACT =
  'contato@engenhariaosti.com.br  | (13) 98138-5425';
const PDF_LAUDO_FOOTER_CENTER_CITY =
  'Rua Primeiro de Janeiro, 674 Sala 1, Nova Mirim - Praia Grande – SP';

/** Garante `;` entre itens com marcador e `.` no último de cada lista (ambiente). */
function punctuatePdfChecklistItemBlock(block, isLastInList) {
  const end = isLastInList ? '.' : ';';
  let s = String(block).replace(/\s+$/, '');
  s = s.replace(/\s*[.;]\s*$/, '');
  return s + end;
}

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

function pdfIdentLabelComDoisPontos(text) {
  const s = String(text ?? '').trim();
  if (!s) return s;
  return /:\s*$/.test(s) ? s : `${s}:`;
}

function pdfIdentLabelCell(text) {
  return {
    content: pdfIdentLabelComDoisPontos(text),
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

/** Capa — campo Endereço: ex. «Praia Grande - SP» (cidade em título; UF maiúscula). */
function pdfCidadeUfCapaTitleHyphen(cidade, uf) {
  const cityFmt = pdfCidadeTituloLaudo(cidade);
  const u = pdfUfSomenteSigla(uf).toUpperCase();
  if (cityFmt && u) return `${cityFmt} - ${u}`;
  if (cityFmt) return cityFmt;
  if (u) return u;
  return '';
}

/** Cidade em formato título (ex.: «Praia Grande») para a identificação no PDF. */
function pdfCidadeTituloLaudo(cidade) {
  const c = pdfTrim(cidade);
  if (!c) return '';
  return c
    .toLocaleLowerCase('pt-BR')
    .split(/(\s+)/)
    .map((part) => {
      if (/^\s+$/.test(part)) return part;
      if (!part) return '';
      return part.charAt(0).toLocaleUpperCase('pt-BR') + part.slice(1);
    })
    .join('');
}

/** Identificação do laudo: ex. «Praia Grande - MG» (cidade em título; UF em maiúsculas). */
function pdfCidadeUfLaudoIdentificacao(cidade, uf) {
  const cityFmt = pdfCidadeTituloLaudo(cidade);
  const u = pdfUfSomenteSigla(uf);
  if (cityFmt && u) return `${cityFmt} - ${u.toUpperCase()}`;
  if (cityFmt) return cityFmt;
  if (u) return u.toUpperCase();
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

/** Horário do início e do término na mesma linha (duas colunas rótulo/valor). */
function pdfIdentRowHorarios(horarioInicio, horarioTermino) {
  const hi = horarioInicio == null ? '' : String(horarioInicio).trim();
  const ht = horarioTermino == null ? '' : String(horarioTermino).trim();
  return [
    pdfIdentLabelCell('Horário\u00A0do\u00A0início'),
    { content: hi || '—' },
    /** NBSP mantém cada rótulo numa linha; coluna direita com largura compatível. */
    pdfIdentLabelCell('Horário\u00A0do\u00A0término'),
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
      pdfCidadeUfLaudoIdentificacao(inspection.cidade, inspection.uf) || '—',
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

/**
 * Títulos principais do laudo (capítulos): texto após o número todo em MAIÚSCULAS. Não aplicar à capa.
 */
function pdfChapterTitleUpperCase(fullTitle) {
  const t = String(fullTitle ?? '').trim();
  const m = /^(\d+(?:\.\d+)*)\s+([\s\S]+)$/.exec(t);
  if (!m) return t.toLocaleUpperCase('pt-BR');
  return `${m[1]} ${m[2].trim().toLocaleUpperCase('pt-BR')}`.trim();
}

/**
 * Subtítulos (ex. 3.1): só a primeira letra em maiúscula; resto em minúsculas (pt-BR).
 */
function pdfAbntHeadingTitleCase(fullTitle) {
  const t = String(fullTitle ?? '').trim();
  const m = /^(\d+(?:\.\d+)*)\s+([\s\S]+)$/.exec(t);
  if (!m) {
    const lower = t.toLocaleLowerCase('pt-BR');
    return lower ? lower.charAt(0).toUpperCase() + lower.slice(1) : t;
  }
  const rest = m[2].trim().toLocaleLowerCase('pt-BR');
  const text = rest ? rest.charAt(0).toUpperCase() + rest.slice(1) : '';
  return `${m[1]} ${text}`.trim();
}

/** Título de ambiente (N.M nome): mesma regra dos subtítulos (primeira letra maiúscula). */
function pdfAbntElementRoomLine(chapterNum, roomIndex, roomNameRaw) {
  const raw = String(roomNameRaw ?? '').trim();
  const lower = raw.toLocaleLowerCase('pt-BR');
  const title = raw ? lower.charAt(0).toUpperCase() + lower.slice(1) : '\u2014';
  return pdfAbntHeadingTitleCase(`${chapterNum}.${roomIndex} ${title}`);
}

function measureChapterTitleBlockMm(
  doc,
  contentWidth,
  titleText,
  yStart,
  topReset,
  beforeMm = PDF_CHAPTER_TITLE_BEFORE_MM,
  afterMm = PDF_CHAPTER_TITLE_AFTER_MM
) {
  const blankBefore = yStart <= topReset + 0.5 ? 0 : beforeMm;
  doc.setFont(PDF_FONT, 'bold');
  doc.setFontSize(PDF_CHAPTER_TITLE_PT);
  const lines = doc.splitTextToSize(String(titleText), contentWidth);
  return blankBefore + lines.length * PDF_CHAPTER_LINE_MM + afterMm;
}

/** Altura estimada da tabela de identificação (autoTable), para manter título + tabela na mesma página. */
function estimateIdentificacaoTableHeightMm(
  doc,
  rows,
  contentWidth,
  identLabelColLeftW,
  identLabelColRightW,
  identValueColW
) {
  /** Largura da célula com colSpan 3 (valor nas colunas 1–3): V | rótulo dir. | V */
  const valueWColSpan3 =
    identValueColW + identLabelColRightW + identValueColW;
  doc.setFont(PDF_FONT, 'normal');
  doc.setFontSize(PDF_IDENT_TABLE_PT);
  const lh = PDF_IDENT_TABLE_PT * PDF_PT_TO_MM * 1.45;
  let h = 0;
  for (const row of rows) {
    if (!row || !row.length) continue;
    const first = row[0];
    if (row.length === 1 && first && first.colSpan === 4) {
      const txt = String(first.content ?? '');
      const n = Math.max(1, doc.splitTextToSize(txt, contentWidth - 8).length);
      h += n * lh + 5;
      continue;
    }
    if (row.length === 2 && row[1] && row[1].colSpan === 3) {
      const txt = String(row[1].content ?? '');
      const n = Math.max(1, doc.splitTextToSize(txt, valueWColSpan3 - 4).length);
      h += n * lh + PDF_IDENT_TABLE_CELL_PAD * 2 + 1;
      continue;
    }
    if (row.length >= 4) {
      const t1 = String(row[1]?.content ?? row[1] ?? '');
      const t3 = String(row[3]?.content ?? row[3] ?? '');
      const n = Math.max(
        1,
        doc.splitTextToSize(t1, identValueColW - 2).length,
        doc.splitTextToSize(t3, identValueColW - 2).length
      );
      h += n * lh + PDF_IDENT_TABLE_CELL_PAD * 2 + 1;
    }
  }
  return h + 12;
}

/** Texto fixo da secção 2. INTRODUÇÃO (fluxo sem Objetivo/Metodologia estendida) com dados da identificação. */
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

/**
 * Fluxo Entrega de Imóvel com blocos Objetivo / Especificações / Metodologia no laudo.
 * Inclui categoria ainda vazia ou registos antigos em que `imovel_categoria` não veio da API.
 */
function isEntregaImovelLaudoExtended(inspection) {
  const f = String(inspection.tipo_vistoria_fluxo || '').trim();
  if (f !== 'apartamento') return false;
  const c = inspection.imovel_categoria;
  const cStr = c == null ? '' : String(c).trim();
  return (
    c === 'apartamento' ||
    c === 'casa' ||
    cStr === ''
  );
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

/** Texto da secção 3.1 Referências (documentos do app, quando houver). */
function buildPdfEspecificacoesReferenciasText(inspection) {
  const intro =
    'O presente laudo foi elaborado com base em inspeção visual das condições aparentes da edificação, considerando as boas práticas construtivas e as diretrizes das normas técnicas aplicáveis.';
  const normsBlock = [
    'Foram adotadas como referência as seguintes normas:',
    '– ABNT NBR 13752:1996 – Perícias de engenharia na construção civil;',
    '– ABNT NBR 16747 – Inspeção predial;',
    '– ABNT NBR 15575 – Desempenho de edificações habitacionais;',
    '– ABNT NBR 5674 – Manutenção de edificações;',
  ].join('\n');

  const docs = (inspection.documentos_recebidos || [])
    .map((d) => pdfTrim(d))
    .filter(Boolean);

  if (docs.length > 0) {
    const docList = [
      'Foram analisados os seguintes documentos técnicos fornecidos:',
      ...docs.map((d) => `– ${d};`),
    ].join('\n');
    return [intro, normsBlock, docList].join('\n\n');
  }

  const noDocs =
    'Não foram disponibilizados documentos técnicos da edificação, restringindo-se a análise às condições aparentes observadas no momento da vistoria.';
  return [intro, normsBlock, noDocs].join('\n\n');
}

function getJsPdfFormatFromDataUrl(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') return 'JPEG';
  const head = dataUrl.slice(0, 48).toLowerCase();
  if (head.includes('image/png')) return 'PNG';
  return 'JPEG';
}

async function buildPdfLaudoFooterLogoBox(logoUrl) {
  if (!logoUrl || typeof logoUrl !== 'string' || !logoUrl.startsWith('data:image/')) {
    return null;
  }
  try {
    const { width: iw, height: ih } = await getDataUrlImageDimensions(logoUrl);
    const { w, h } = fitLogoSizeMm(
      iw,
      ih,
      PDF_LAUDO_FOOTER_LOGO_MAX_W_MM,
      PDF_LAUDO_FOOTER_LOGO_MAX_H_MM
    );
    return {
      url: logoUrl,
      w,
      h,
      fmt: getJsPdfFormatFromDataUrl(logoUrl),
    };
  } catch {
    return null;
  }
}

function drawPdfLaudoFooterPage(
  doc,
  pageNum,
  totalPages,
  pageWidth,
  pageHeight,
  margin,
  contentWidth,
  logoBox,
  centerTitle,
  centerContact,
  centerCity
) {
  const bandTop =
    pageHeight - PDF_LAUDO_FOOTER_BOTTOM_MARGIN_MM - PDF_LAUDO_FOOTER_BAND_MM;
  doc.setDrawColor(...PDF_LAUDO_FOOTER_LINE_GRAY);
  doc.setLineWidth(0.11);
  doc.line(margin, bandTop, pageWidth - margin, bandTop);
  doc.setDrawColor(0, 0, 0);

  const bandBottom = pageHeight - PDF_LAUDO_FOOTER_BOTTOM_MARGIN_MM;
  const yMid = bandTop + (bandBottom - bandTop) / 2;

  const leftW = contentWidth * 0.26;
  const centerW = contentWidth * 0.48;
  const xLeftCol = margin;
  const xCenter = margin + leftW + centerW / 2;
  const xRight = pageWidth - margin;

  const fs = PDF_LAUDO_FOOTER_PT;
  const lh = fs * PDF_PT_TO_MM * 1.12;

  if (logoBox && logoBox.url) {
    const lx = xLeftCol + Math.max(0, (leftW - logoBox.w) / 2);
    const ly = yMid - logoBox.h / 2;
    doc.addImage(logoBox.url, logoBox.fmt, lx, ly, logoBox.w, logoBox.h);
  }

  doc.setFontSize(fs);
  doc.setTextColor(0, 0, 0);
  const blockH = 3 * lh;
  let y0 = yMid - blockH / 2 + lh * 0.72;
  doc.setFont(PDF_FONT, 'bold');
  doc.text(centerTitle, xCenter, y0, { align: 'center', maxWidth: centerW });
  y0 += lh;
  doc.setFont(PDF_FONT, 'normal');
  doc.text(centerContact, xCenter, y0, { align: 'center', maxWidth: centerW });
  y0 += lh;
  doc.text(centerCity, xCenter, y0, { align: 'center', maxWidth: centerW });

  doc.setFont(PDF_FONT, 'normal');
  doc.text(`Página ${pageNum} de ${totalPages}`, xRight, yMid + lh * 0.2, {
    align: 'right',
  });
}

/** Capa A4: margens 2 cm; Helvetica = Arial no motor PDF. */
const PDF_COVER_MARGIN_MM = 20;
const PDF_COVER_LOGO_W_MM = 70;
const PDF_COVER_GAP_BELOW_LOGO_MM = 28;
const PDF_COVER_TITLE_MAIN_PT = 24;
const PDF_COVER_GAP_AFTER_TITLE_MM = 8;
const PDF_COVER_INFO_PT = 12;
/** Entrelinha do bloco Assunto/Contratante/… (1,5 cm entre baselines). */
const PDF_COVER_FIELD_LINE_STEP_MM = 15;
const PDF_COVER_TRACKING_PT = 0.35;
/** Espaço entre o bloco central e a cidade no rodapé. */
const PDF_COVER_GAP_ABOVE_FOOTER_MM = 10;
/** Cidade e data no fim da capa: 1 cm entre linhas (baseline → baseline); antes 0,5 cm + 0,5 cm. */
const PDF_COVER_CITY_DATE_LINE_MM = 10;

/**
 * Valor do campo Endereço (sem o rótulo): logradouro, unidade em linha, cidade em título - UF.
 * Ex.: Rua …, 357, Apto 1.103 Bloco A, Praia Grande - SP
 */
function buildPdfCoverEnderecoValor(inspection) {
  const parts = [];
  const e = pdfTrim(inspection.endereco);
  if (e) parts.push(e);
  const u = pdfTrim(inspection.unidade);
  if (u) parts.push(u);
  const loc = pdfCidadeUfCapaTitleHyphen(inspection.cidade, inspection.uf);
  if (loc) parts.push(loc);
  return parts.length ? parts.join(', ') : '\u2014';
}

function measureCoverFieldsHeightMm(doc, maxW, lineStepMm, fields) {
  let h = 0;
  doc.setFontSize(PDF_COVER_INFO_PT);
  for (const { label, value } of fields) {
    doc.setFont(PDF_FONT, 'bold');
    const labelPart = `${label} `;
    const labelW = doc.getTextWidth(labelPart);
    doc.setFont(PDF_FONT, 'normal');
    const v = value != null && String(value).trim() !== '' ? String(value) : '\u2014';
    const valueLines = doc.splitTextToSize(v, Math.max(8, maxW - labelW));
    const n = Math.max(1, valueLines.length);
    h += n * lineStepMm;
  }
  return h;
}

/**
 * Rótulo em negrito + valor à direita (continuação com indent); alinhado à esquerda em xLeft.
 */
function drawCoverFieldsLeft(doc, xLeft, yStart, maxW, lineStepMm, fields) {
  let y = yStart;
  doc.setFontSize(PDF_COVER_INFO_PT);
  for (const { label, value } of fields) {
    doc.setFont(PDF_FONT, 'bold');
    const labelPart = `${label} `;
    const labelW = doc.getTextWidth(labelPart);
    doc.setFont(PDF_FONT, 'normal');
    const v = value != null && String(value).trim() !== '' ? String(value) : '\u2014';
    const valueLines = doc.splitTextToSize(v, Math.max(8, maxW - labelW));
    const lines = valueLines.length ? valueLines : [''];
    lines.forEach((vl, i) => {
      if (i === 0) {
        doc.setFont(PDF_FONT, 'bold');
        doc.text(labelPart, xLeft, y);
        doc.setFont(PDF_FONT, 'normal');
        doc.text(vl, xLeft + labelW, y);
      } else {
        doc.text(vl, xLeft + labelW, y);
      }
      y += lineStepMm;
    });
  }
  return y;
}

/**
 * Primeira página: logo → título → assunto/contratante/endereço/RT; rodapé: Cidade - UF e data.
 */
async function drawPdfCoverPage(doc, inspection, pageWidth, pageHeight) {
  const cx = pageWidth / 2;
  const textMaxW = pageWidth - 2 * PDF_COVER_MARGIN_MM;
  const xLeft = PDF_COVER_MARGIN_MM;
  const logoUrl = inspection.pdf_logo_data_url;
  const hasLogo =
    logoUrl && typeof logoUrl === 'string' && logoUrl.startsWith('data:image/');

  const cidadeRodape = pdfCidadeUfCapaHyphenUpper(inspection.cidade, inspection.uf);
  const dataRodape = formatPdfLaudoCoverDateDdMmYyyy(
    inspection.data_final || inspection.data
  );

  const yDataRodape = pageHeight - PDF_COVER_MARGIN_MM - 2;
  const yCidadeRodape = yDataRodape - PDF_COVER_CITY_DATE_LINE_MM;
  const yLimiteBlocoCentral = yCidadeRodape - PDF_COVER_GAP_ABOVE_FOOTER_MM;

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

  const yAposTitulo = y + PDF_COVER_GAP_AFTER_TITLE_MM;

  const creaTxt = pdfTrim(inspection.crea) || '\u2014';
  const camposCapa = [
    {
      label: 'Assunto:',
      value: 'Vistoria Técnica para Recebimento de Imóvel',
    },
    {
      label: 'Contratante:',
      value: pdfTrim(inspection.cliente) || '\u2014',
    },
    {
      label: 'Endereço:',
      value: buildPdfCoverEnderecoValor(inspection),
    },
    {
      label: 'Responsável Técnico:',
      value: `${formatPdfResponsavelTecnicoNome(
        inspection.responsavel_tecnico
      )} — CREA: nº ${creaTxt}`,
    },
  ];

  const alturaBloco = measureCoverFieldsHeightMm(
    doc,
    textMaxW,
    PDF_COVER_FIELD_LINE_STEP_MM,
    camposCapa
  );
  const zonaVertical =
    Math.max(0, yLimiteBlocoCentral - yAposTitulo);
  const yBloco =
    yAposTitulo + Math.max(0, (zonaVertical - alturaBloco) / 2);

  doc.setFont(PDF_FONT, 'normal');
  doc.setFontSize(PDF_COVER_INFO_PT);
  drawCoverFieldsLeft(
    doc,
    xLeft,
    yBloco,
    textMaxW,
    PDF_COVER_FIELD_LINE_STEP_MM,
    camposCapa
  );

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

const PDF_REG_LOCAL_LABEL = 'Local:';
const PDF_REG_NC_LABEL = 'Não Conformidade:';
/** Espaço entre o fim da caixa da foto e o texto Local | Não Conformidade. */
const PDF_NC_AFTER_PHOTO_GAP_MM = 5;

/** Valores do registo fotográfico: só a primeira letra em maiúscula (resto em minúsculas). */
function pdfRegistroDisplayValue(s) {
  const t = String(s ?? '').trim();
  if (!t) return '\u2014';
  const lower = t.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/**
 * Problemática no PDF: um único texto corrido; remove travessões / traços usados como separadores.
 */
function formatPdfProblematicaParagraph(s) {
  let t = String(s ?? '').trim();
  if (!t) return '\u2014';
  t = t.replace(/\s*[—–]\s*/g, ' ');
  t = t.replace(/\s+-\s+/g, ' ');
  t = t.replace(/\s+/g, ' ');
  t = t.trim();
  const lower = t.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/** Uma linha: **Local:** ambiente **| Não Conformidade:** texto (com quebra). */
function measureRegistroLocalNcBlockMm(doc, contentWidth, pad, localizacaoText, ncBody, lineH) {
  void lineH;
  const innerW = Math.max(20, contentWidth - 2 * pad);
  const room = pdfRegistroDisplayValue(localizacaoText);
  const descNorm = (formatPdfProblematicaParagraph(ncBody) || '').trim() || '\u2014';
  doc.setFontSize(PDF_BODY_PT);
  doc.setFont(PDF_FONT, 'bold');
  const wLoc = doc.getTextWidth(`${PDF_REG_LOCAL_LABEL} `);
  doc.setFont(PDF_FONT, 'normal');
  const wRoom = doc.getTextWidth(room);
  const wPipe = doc.getTextWidth(' | ');
  doc.setFont(PDF_FONT, 'bold');
  const wNc = doc.getTextWidth(`${PDF_REG_NC_LABEL} `);
  doc.setFont(PDF_FONT, 'normal');
  const prefixW = wLoc + wRoom + wPipe + wNc;
  const firstW = Math.max(10, innerW - prefixW);
  const linesFirst = doc.splitTextToSize(descNorm, firstW);
  const firstLine = linesFirst[0] || '';
  let lineCount = 1;
  const rest = descNorm.substring(firstLine.length).replace(/^\s+/, '');
  if (rest) {
    lineCount += doc.splitTextToSize(rest, innerW).length;
  }
  return pad + PDF_BODY_LINE_MM * 0.35 + lineCount * PDF_BODY_LINE_MM + pad;
}

function drawPdfRegistroLocalNcBlock(doc, tableX, yTop, contentWidth, pad, localizacaoText, ncBody, lineH) {
  void lineH;
  const innerX = tableX + pad;
  const innerW = Math.max(20, contentWidth - 2 * pad);
  const room = pdfRegistroDisplayValue(localizacaoText);
  const descNorm = (formatPdfProblematicaParagraph(ncBody) || '').trim() || '\u2014';
  const lh = PDF_BODY_LINE_MM;
  let y = yTop + pad + lh * 0.35;
  doc.setFontSize(PDF_BODY_PT);
  doc.setTextColor(0, 0, 0);
  let x = innerX;
  doc.setFont(PDF_FONT, 'bold');
  doc.text(`${PDF_REG_LOCAL_LABEL} `, x, y);
  x += doc.getTextWidth(`${PDF_REG_LOCAL_LABEL} `);
  doc.setFont(PDF_FONT, 'normal');
  doc.text(room, x, y);
  x += doc.getTextWidth(room);
  doc.text(' | ', x, y);
  x += doc.getTextWidth(' | ');
  doc.setFont(PDF_FONT, 'bold');
  doc.text(`${PDF_REG_NC_LABEL} `, x, y);
  x += doc.getTextWidth(`${PDF_REG_NC_LABEL} `);
  const firstW = Math.max(10, innerW - (x - innerX));
  doc.setFont(PDF_FONT, 'normal');
  const linesFirst = doc.splitTextToSize(descNorm, firstW);
  const firstLine = linesFirst[0] || '';
  if (firstLine) {
    doc.text(firstLine, x, y);
  }
  const rest = descNorm.substring(firstLine.length).replace(/^\s+/, '');
  if (rest) {
    y += lh;
    doc.splitTextToSize(rest, innerW).forEach((ln) => {
      doc.text(ln, innerX, y);
      y += lh;
    });
  }
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
/** Caixa de referência do registo: 12 cm largura × 9 cm altura; modo compacto: 12 × 7 cm. */
const PDF_NC_IMG_W_MM = 120;
const PDF_NC_IMG_H_MM = 90;
const PDF_NC_IMG_COMPACT_H_MM = 70;
/** Pequeno respiro colado ao fim da foto, antes de `PDF_NC_AFTER_PHOTO_GAP_MM`. */
const PDF_NC_REG_LOC_PROB_PAD_MM = 1.5;
const PDF_NC_IMAGE_TO_CAPTION_GAP_MM = 1;
/** Separador visual entre cada foto do registo (linha + espaços). */
const PDF_REG_BLOCK_GAP_BEFORE_LINE_MM = 3;
const PDF_REG_BLOCK_GAP_AFTER_LINE_MM = 6;
const PDF_REG_AFTER_LAST_PHOTO_MM = 4;
/** Espaço vertical entre os dois blocos quando há 2 fotos na mesma página. */
const PDF_REG_TWO_PER_PAGE_GAP_MM = 6;
/** Modo compacto: menos espaço entre blocos e entre as duas fotos. */
const PDF_REG_COMPACT_BLOCK_GAP_BEFORE_LINE_MM = 2;
const PDF_REG_COMPACT_BLOCK_GAP_AFTER_LINE_MM = 4;
const PDF_REG_COMPACT_PAIR_GAP_MM = 4;
const PDF_REG_COMPACT_AFTER_PHOTO_GAP_MM = 3;
const PDF_REG_COMPACT_LOC_PAD_MM = 1;
/** Altura útil mínima (mm) para uma foto isolada abaixo do texto; se menor, nova página. */
const PDF_REG_MIN_USABLE_SINGLE_MM = 52;

function registroPhotoAspectRatio(compact) {
  return (compact ? PDF_NC_IMG_COMPACT_H_MM : PDF_NC_IMG_H_MM) / PDF_NC_IMG_W_MM;
}

function registroLocPadMm(compact) {
  return compact ? PDF_REG_COMPACT_LOC_PAD_MM : PDF_NC_REG_LOC_PROB_PAD_MM;
}

function registroAfterPhotoGapLayoutMm(compact) {
  return compact ? PDF_REG_COMPACT_AFTER_PHOTO_GAP_MM : PDF_NC_AFTER_PHOTO_GAP_MM;
}

function registroBlockTailGapsMm(compact, isLastPhoto) {
  if (isLastPhoto) {
    return { beforeSep: 0, afterSep: PDF_REG_AFTER_LAST_PHOTO_MM };
  }
  return compact
    ? {
        beforeSep: PDF_REG_COMPACT_BLOCK_GAP_BEFORE_LINE_MM,
        afterSep: PDF_REG_COMPACT_BLOCK_GAP_AFTER_LINE_MM,
      }
    : {
        beforeSep: PDF_REG_BLOCK_GAP_BEFORE_LINE_MM,
        afterSep: PDF_REG_BLOCK_GAP_AFTER_LINE_MM,
      };
}

function drawPdfRegistroBlockSeparator(doc, xLeft, contentWidth, yMm) {
  doc.setDrawColor(...PDF_LAUDO_FOOTER_LINE_GRAY);
  doc.setLineWidth(0.11);
  doc.line(xLeft, yMm, xLeft + contentWidth, yMm);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.2);
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

function defaultRegistroPicSizeMm(contentWidth) {
  const maxUsableW = contentWidth - 2 * PDF_NC_PHOTO_INNER_PAD_MM;
  let picW = PDF_NC_IMG_W_MM;
  let picH = PDF_NC_IMG_H_MM;
  if (picW > maxUsableW) {
    const s = maxUsableW / PDF_NC_IMG_W_MM;
    picW = maxUsableW;
    picH = PDF_NC_IMG_H_MM * s;
  }
  return { picW, picH };
}

/**
 * Altura total do bloco com dimensões explícitas da caixa da foto (deve coincidir com o desenho).
 * `opts.compact`: proporção 12×7 cm e espaçamentos reduzidos.
 */
function measureRegistroBlockTotalMm(doc, contentWidth, photo, roomName, isLastPhoto, picW, picH, opts = {}) {
  const compact = opts.compact === true;
  const captionFromApp = pdfTrim(photo.caption);
  const capH = measureRegistroCaptionHeightFromApp(doc, picW, captionFromApp, photo.number);
  const locText = String(roomName || '').trim() || '\u2014';
  const ncBody = pdfTrim(photo.description) || '\u2014';
  const lineH = PDF_BODY_LINE_MM;
  const locGap = registroLocPadMm(compact);
  const afterPh = registroAfterPhotoGapLayoutMm(compact);
  const locProbH = measureRegistroLocalNcBlockMm(doc, contentWidth, locGap, locText, ncBody, lineH);
  const captionGap = captionFromApp ? PDF_NC_IMAGE_TO_CAPTION_GAP_MM : 0;
  const core =
    PDF_NC_PHOTO_INNER_PAD_MM +
    capH +
    captionGap +
    picH +
    locGap +
    afterPh +
    locProbH;
  const tail = registroBlockTailGapsMm(compact, isLastPhoto);
  if (isLastPhoto) return core + tail.afterSep;
  return core + tail.beforeSep + tail.afterSep;
}

function measureRegistroPhotoBlockMm(doc, contentWidth, photo, roomName, isLastPhoto) {
  const { picW, picH } = defaultRegistroPicSizeMm(contentWidth);
  return measureRegistroBlockTotalMm(doc, contentWidth, photo, roomName, isLastPhoto, picW, picH);
}

/**
 * Maior largura (proporção normal ou compacta) para um bloco caber em `usableH` (mm).
 * Tenta primeiro proporção normal (12×9), depois compacta (12×7).
 */
function maxRegistroPhotoSizeForUsableMm(
  doc,
  contentWidth,
  photo,
  roomName,
  isLastPhoto,
  usableH
) {
  const maxUsableW = contentWidth - 2 * PDF_NC_PHOTO_INNER_PAD_MM;
  const minW = 32;

  const search = (compact) => {
    const ar = registroPhotoAspectRatio(compact);
    const tryW = (picW) => {
      const w = Math.min(maxUsableW, picW);
      const h = w * ar;
      const t = measureRegistroBlockTotalMm(doc, contentWidth, photo, roomName, isLastPhoto, w, h, {
        compact,
      });
      return { picW: w, picH: h, blockH: t, compact };
    };

    let best = tryW(minW);
    if (best.blockH > usableH) {
      return null;
    }

    let lo = minW;
    let hi = maxUsableW;
    const tHi = tryW(hi);
    if (tHi.blockH <= usableH) {
      return tHi;
    }

    for (let k = 0; k < 55; k++) {
      const mid = (lo + hi) / 2;
      const cand = tryW(mid);
      if (cand.blockH <= usableH) {
        best = cand;
        lo = mid;
      } else {
        hi = mid;
      }
      if (hi - lo < 0.25) break;
    }
    return best;
  };

  return search(false) || search(true);
}

/** Duas fotos empilhadas: mesma largura/altura; tenta normal e depois compacto. */
function maxRegistroPairStackedMm(
  doc,
  contentWidth,
  photo1,
  room1,
  photo2,
  room2,
  isLast2,
  usableH
) {
  const maxUsableW = contentWidth - 2 * PDF_NC_PHOTO_INNER_PAD_MM;
  const minW = 32;

  const search = (compact) => {
    const ar = registroPhotoAspectRatio(compact);
    const between = compact ? PDF_REG_COMPACT_PAIR_GAP_MM : PDF_REG_TWO_PER_PAGE_GAP_MM;
    const totalAt = (picW) => {
      const w = Math.min(maxUsableW, picW);
      const h = w * ar;
      return (
        measureRegistroBlockTotalMm(doc, contentWidth, photo1, room1, false, w, h, { compact }) +
        between +
        measureRegistroBlockTotalMm(doc, contentWidth, photo2, room2, isLast2, w, h, { compact })
      );
    };

    if (totalAt(minW) > usableH) {
      return null;
    }

    let lo = minW;
    let hi = maxUsableW;
    if (totalAt(hi) <= usableH) {
      const w = hi;
      return { picW: w, picH: w * ar, compact, between };
    }

    let bestW = minW;
    for (let k = 0; k < 55; k++) {
      const mid = (lo + hi) / 2;
      if (totalAt(mid) <= usableH) {
        bestW = mid;
        lo = mid;
      } else {
        hi = mid;
      }
      if (hi - lo < 0.25) break;
    }
    const w = Math.min(maxUsableW, bestW);
    return { picW: w, picH: w * ar, compact, between };
  };

  return search(false) || search(true);
}

/**
 * Registo: legenda acima da foto; abaixo «Local: … | Não Conformidade: …»; bloco íntegro.
 * `layoutOpts`: `picW`/`picH`, `compact` (12×7 + gaps menores), `skipBlockPageBreak`.
 */
async function drawPdfNaoConformidadeTable(
  doc,
  yStart,
  margin,
  contentWidth,
  ncIdx,
  roomName,
  photo,
  isLastPhoto,
  layoutOpts = {}
) {
  void ncIdx;
  const {
    picW: optW,
    picH: optH,
    skipBlockPageBreak = false,
    compact: layoutCompact = false,
  } = layoutOpts;
  const compact = layoutCompact === true;
  const pageHeight = doc.internal.pageSize.getHeight();
  const bottomLimit = pageHeight - PDF_LAUDO_PAGE_BOTTOM_SAFE_MM;
  const tableX = margin;
  const lineH = PDF_BODY_LINE_MM;
  const locGap = registroLocPadMm(compact);

  let picW;
  let picH;
  if (optW != null && optH != null) {
    picW = optW;
    picH = optH;
  } else {
    const d = defaultRegistroPicSizeMm(contentWidth);
    picW = d.picW;
    picH = d.picH;
  }
  const picX = tableX + (contentWidth - picW) / 2;

  const captionFromApp = pdfTrim(photo.caption);
  const locText = String(roomName || '').trim() || '\u2014';
  const ncBody = pdfTrim(photo.description) || '\u2014';
  const totalBlockH = measureRegistroBlockTotalMm(
    doc,
    contentWidth,
    photo,
    roomName,
    isLastPhoto,
    picW,
    picH,
    { compact }
  );

  let y = yStart;
  if (!skipBlockPageBreak) {
    const maxUsablePageH = bottomLimit - PDF_PAGE_TOP_SAFE_MM;
    while (y + totalBlockH > bottomLimit) {
      if (y <= PDF_PAGE_TOP_SAFE_MM + 0.5 && totalBlockH > maxUsablePageH) {
        break;
      }
      doc.addPage();
      y = PDF_PAGE_TOP_SAFE_MM;
      if (y + totalBlockH > bottomLimit && totalBlockH > maxUsablePageH) {
        break;
      }
    }
  }

  y += PDF_NC_PHOTO_INNER_PAD_MM;
  if (captionFromApp) {
    y = drawPdfRegistroFotoCaptionFromApp(doc, picX, picW, y, captionFromApp, photo.number);
  }
  if (captionFromApp) {
    y += PDF_NC_IMAGE_TO_CAPTION_GAP_MM;
  }

  const yPic = y;
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

  let yText = yPic + picH + locGap + registroAfterPhotoGapLayoutMm(compact);
  yText = drawPdfRegistroLocalNcBlock(doc, tableX, yText, contentWidth, locGap, locText, ncBody, lineH);

  const tail = registroBlockTailGapsMm(compact, isLastPhoto);
  if (isLastPhoto) {
    return yText + tail.afterSep;
  }

  const ySep = yText + tail.beforeSep;
  if (ySep + tail.afterSep > bottomLimit) {
    doc.addPage();
    return PDF_PAGE_TOP_SAFE_MM;
  }
  drawPdfRegistroBlockSeparator(doc, tableX, contentWidth, ySep);
  return ySep + tail.afterSep;
}

/**
 * Registo: começa abaixo do texto introdutório; 2 fotos por página empilhadas, largura maximizada em conjunto;
 * modo compacto (12×7) quando o par não cabe em proporção normal (12×9).
 */
async function drawRegistroFotograficoBlocks(doc, yPos, margin, contentWidth, ncPhotoGroups) {
  const pageHeight = doc.internal.pageSize.getHeight();
  const bottomLimit = pageHeight - PDF_LAUDO_PAGE_BOTTOM_SAFE_MM;
  const n = ncPhotoGroups.length;
  let ncIdx = 0;
  let i = 0;

  let yPageTop = yPos;

  while (i < n) {
    let usable = bottomLimit - yPageTop;

    if (i + 1 < n) {
      const { room, photo } = ncPhotoGroups[i];
      const { room: room2, photo: photo2 } = ncPhotoGroups[i + 1];
      const roomName = String(room.room_name || '').trim();
      const roomName2 = String(room2.room_name || '').trim();
      const isLast2 = i + 2 >= n;

      let pair = maxRegistroPairStackedMm(
        doc,
        contentWidth,
        photo,
        roomName,
        photo2,
        roomName2,
        isLast2,
        usable
      );
      if (!pair) {
        doc.addPage();
        yPageTop = PDF_PAGE_TOP_SAFE_MM;
        usable = bottomLimit - yPageTop;
        pair = maxRegistroPairStackedMm(
          doc,
          contentWidth,
          photo,
          roomName,
          photo2,
          roomName2,
          isLast2,
          usable
        );
      }
      if (!pair) {
        const ar = registroPhotoAspectRatio(true);
        const maxUsableW = contentWidth - 2 * PDF_NC_PHOTO_INNER_PAD_MM;
        const w = Math.min(maxUsableW, 32);
        pair = {
          picW: w,
          picH: w * ar,
          compact: true,
          between: PDF_REG_COMPACT_PAIR_GAP_MM,
        };
      }

      const totalPair =
        measureRegistroBlockTotalMm(doc, contentWidth, photo, roomName, false, pair.picW, pair.picH, {
          compact: pair.compact,
        }) +
        pair.between +
        measureRegistroBlockTotalMm(doc, contentWidth, photo2, roomName2, isLast2, pair.picW, pair.picH, {
          compact: pair.compact,
        });
      const yStartPair = yPageTop + Math.max(0, (usable - totalPair) / 2);

      ncIdx += 1;
      const yAfterFirst = await drawPdfNaoConformidadeTable(
        doc,
        yStartPair,
        margin,
        contentWidth,
        ncIdx,
        roomName,
        photo,
        false,
        {
          picW: pair.picW,
          picH: pair.picH,
          skipBlockPageBreak: true,
          compact: pair.compact,
        }
      );

      ncIdx += 1;
      const yAfter = await drawPdfNaoConformidadeTable(
        doc,
        yAfterFirst + pair.between,
        margin,
        contentWidth,
        ncIdx,
        roomName2,
        photo2,
        isLast2,
        {
          picW: pair.picW,
          picH: pair.picH,
          skipBlockPageBreak: true,
          compact: pair.compact,
        }
      );

      i += 2;
      if (i < n) {
        doc.addPage();
        yPageTop = PDF_PAGE_TOP_SAFE_MM;
      } else {
        yPageTop = yAfter;
      }
    } else {
      let usableSingle = usable;
      if (usableSingle < PDF_REG_MIN_USABLE_SINGLE_MM) {
        doc.addPage();
        yPageTop = PDF_PAGE_TOP_SAFE_MM;
        usableSingle = bottomLimit - yPageTop;
      }
      const { room, photo } = ncPhotoGroups[i];
      const roomName = String(room.room_name || '').trim();
      let s1 = maxRegistroPhotoSizeForUsableMm(doc, contentWidth, photo, roomName, true, usableSingle);
      if (!s1) {
        doc.addPage();
        yPageTop = PDF_PAGE_TOP_SAFE_MM;
        usableSingle = bottomLimit - yPageTop;
        s1 = maxRegistroPhotoSizeForUsableMm(doc, contentWidth, photo, roomName, true, usableSingle);
      }
      if (!s1) {
        const ar = registroPhotoAspectRatio(true);
        const maxUsableW = contentWidth - 2 * PDF_NC_PHOTO_INNER_PAD_MM;
        const w = Math.min(maxUsableW, 32);
        s1 = {
          picW: w,
          picH: w * ar,
          compact: true,
          blockH: measureRegistroBlockTotalMm(doc, contentWidth, photo, roomName, true, w, w * ar, {
            compact: true,
          }),
        };
      }
      const y1 = yPageTop + Math.max(0, (usableSingle - s1.blockH) / 2);
      ncIdx += 1;
      yPageTop = await drawPdfNaoConformidadeTable(doc, y1, margin, contentWidth, ncIdx, roomName, photo, true, {
        picW: s1.picW,
        picH: s1.picH,
        skipBlockPageBreak: true,
        compact: s1.compact,
      });
      i += 1;
    }
  }

  return yPageTop;
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
    if (yPos + neededSpace > pageHeight - PDF_LAUDO_PAGE_BOTTOM_SAFE_MM) {
      doc.addPage();
      yPos = PDF_PAGE_TOP_SAFE_MM;
      return true;
    }
    return false;
  };

  await drawPdfCoverPage(doc, inspection, pageWidth, pageHeight);
  doc.addPage();
  doc.setTextColor(0, 0, 0);

  const entregaLaudoExt = isEntregaImovelLaudoExtended(inspection);
  const objChapterNum = 2;
  const especificacoesChapterNum = 3;
  const metodologiaChapterNum = entregaLaudoExt ? 4 : 3;
  const checklistChapterNum = entregaLaudoExt ? 5 : 3;
  const ncChapterNum = entregaLaudoExt ? 6 : 4;
  const conclusaoChapterNum = entregaLaudoExt ? 7 : 5;
  const encerramentoChapterNum = entregaLaudoExt ? 8 : 6;

  // ============================================================
  // Corpo do laudo (após capa)
  // 1. IDENTIFICAÇÃO DA VISTORIA TÉCNICA
  // ============================================================
  const identificacaoData = buildIdentificacaoTableBody(inspection);
  /** Rótulos coluna esquerda (mais longos); coluna direita mais estreita junto ao fim do texto. */
  const identLabelColLeftW = 48;
  /** Largura mínima para «Horário do término:» em uma linha (12 pt negrito). */
  const identLabelColRightW = 46;
  const identValueColW = Math.max(
    24,
    (contentWidth - identLabelColLeftW - identLabelColRightW) / 2
  );

  const titleIdentificacao = pdfChapterTitleUpperCase('1. IDENTIFICAÇÃO DA VISTORIA TÉCNICA');
  /** Espaçamento do título «Identificação»: 1 linha acima/abaixo (como antes do 1,5× nos outros capítulos). */
  const identificacaoTituloBeforeMm = PDF_ABNT_BLANK_LINE_MM;
  const identificacaoTituloAfterMm = PDF_ABNT_BLANK_LINE_MM;
  const hIdentTitle = measureChapterTitleBlockMm(
    doc,
    contentWidth,
    titleIdentificacao,
    yPos,
    PDF_PAGE_TOP_SAFE_MM,
    identificacaoTituloBeforeMm,
    identificacaoTituloAfterMm
  );
  const hIdentTable = estimateIdentificacaoTableHeightMm(
    doc,
    identificacaoData,
    contentWidth,
    identLabelColLeftW,
    identLabelColRightW,
    identValueColW
  );
  if (
    yPos + hIdentTitle + hIdentTable >
    pageHeight - PDF_LAUDO_PAGE_BOTTOM_SAFE_MM
  ) {
    doc.addPage();
    yPos = PDF_PAGE_TOP_SAFE_MM;
  }

  yPos = drawChapterTitle(doc, margin, contentWidth, yPos, titleIdentificacao, {
    minFollowingMm: 28,
    chapterTitleBeforeMm: identificacaoTituloBeforeMm,
    chapterTitleAfterMm: identificacaoTituloAfterMm,
  });

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
        cellWidth: identLabelColLeftW,
        fillColor: PDF_IDENT_LABEL_FILL,
      },
      1: { cellWidth: identValueColW },
      2: {
        fontStyle: 'bold',
        cellWidth: identLabelColRightW,
        fillColor: PDF_IDENT_LABEL_FILL,
      },
      3: { cellWidth: identValueColW },
    },
    margin: { left: margin, right: margin },
  });

  const yAfterIdentTable = doc.lastAutoTable.finalY;

  if (entregaLaudoExt) {
    const objT = pdfTrim(inspection.laudo_objetivo);
    const objBody = objT || '\u2014';
    const titleObjetivo = pdfChapterTitleUpperCase(`${objChapterNum}. OBJETIVO`);
    const hObjTitle = measureChapterTitleBlockMm(
      doc,
      contentWidth,
      titleObjetivo,
      yAfterIdentTable,
      PDF_PAGE_TOP_SAFE_MM
    );
    const hObjBody = measureBodyParagraphsHeightMm(doc, objBody, contentWidth);
    const bottomLimit = pageHeight - PDF_LAUDO_PAGE_BOTTOM_SAFE_MM;
    const roomForObjetivo =
      bottomLimit - yAfterIdentTable - hObjTitle - hObjBody;
    /** Entre o fim da tabela e «2. OBJETIVO»: até 10 mm, reduzindo o necessário para caber na mesma página. */
    const gapPosObjetivoMm = Math.max(0, Math.min(10, roomForObjetivo));
    yPos = yAfterIdentTable + gapPosObjetivoMm;

    yPos = drawChapterTitle(doc, margin, contentWidth, yPos, titleObjetivo, {
      minFollowingMm: 28,
    });
    yPos = drawBodyParagraphs(
      doc,
      objBody,
      margin,
      contentWidth,
      yPos,
      checkNewPage,
      laudoBodyParagraphsOpts
    );
  } else {
    yPos = yAfterIdentTable + 10;
  }

  if (entregaLaudoExt) {
    const espBody = buildPdfEspecificacoesReferenciasText(inspection);

    checkNewPage(40);
    yPos = drawChapterTitle(
      doc,
      margin,
      contentWidth,
      yPos,
      pdfChapterTitleUpperCase(
        `${especificacoesChapterNum}. ESPECIFICAÇÕES TÉCNICAS`
      ),
      {
        minFollowingMm: 36,
        /** Espaço total até «3.1 Referências» ≈ 1 cm (só o 1 cm do subtítulo ABNT). */
        chapterTitleAfterMm: 0,
      }
    );
    yPos = drawSubsectionTitle(
      doc,
      margin,
      contentWidth,
      yPos,
      pdfAbntHeadingTitleCase(`${especificacoesChapterNum}.1 Referências`),
      { minFollowingMm: 28 }
    );
    yPos = drawBodyParagraphs(
      doc,
      espBody,
      margin,
      contentWidth,
      yPos,
      checkNewPage,
      laudoBodyParagraphsOpts
    );

    const metaText = finalizeLaudoMetodologiaPdf(inspection, ncChapterNum);

    checkNewPage(40);
    yPos = drawChapterTitle(
      doc,
      margin,
      contentWidth,
      yPos,
      pdfChapterTitleUpperCase(`${metodologiaChapterNum}. METODOLOGIA`),
      {
        minFollowingMm: 36,
      }
    );
    yPos = drawBodyParagraphs(
      doc,
      metaText || '\u2014',
      margin,
      contentWidth,
      yPos,
      checkNewPage,
      laudoBodyParagraphsOpts
    );

    checkNewPage(52);
    yPos = drawChapterTitle(
      doc,
      margin,
      contentWidth,
      yPos,
      pdfChapterTitleUpperCase(`${checklistChapterNum}. VERIFICAÇÃO DOS AMBIENTES`),
      { minFollowingMm: 52 }
    );
  } else {
    // ============================================================
    // 2. INTRODUÇÃO
    // ============================================================
    yPos = drawChapterTitle(
      doc,
      margin,
      contentWidth,
      yPos,
      pdfChapterTitleUpperCase('2. INTRODUÇÃO'),
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
      checkNewPage,
      laudoBodyParagraphsOpts
    );

    // ============================================================
    // 3. VERIFICAÇÃO DOS AMBIENTES (após introdução; fluxo sem Metodologia)
    // ============================================================
    yPos = drawChapterTitle(
      doc,
      margin,
      contentWidth,
      yPos,
      pdfChapterTitleUpperCase(`${checklistChapterNum}. VERIFICAÇÃO DOS AMBIENTES`),
      { minFollowingMm: 52 }
    );
  }

  yPos = drawBodyParagraphs(
    doc,
    PDF_VERIFICACAO_AMBIENTES_INTRO,
    margin,
    contentWidth,
    yPos,
    checkNewPage,
    laudoBodyParagraphsOpts
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

      yPos = drawElementTitle(
        doc,
        margin,
        contentWidth,
        yPos,
        pdfAbntElementRoomLine(checklistChapterNum, roomNumber, room.room_name)
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
        yPos = drawBodyParagraphs(
          doc,
          block,
          listX,
          checklistTextWidth,
          yPos,
          checkNewPage,
          laudoBodyParagraphsOpts
        );
        yPos += PDF_LIST_ITEM_EXTRA_GAP_MM;

        const photosWithUrl = (item.photos || []).filter((p) => p && p.url);
        for (const photo of photosWithUrl) {
          ncPhotoGroups.push({ room, photo });
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
    pdfChapterTitleUpperCase(`${ncChapterNum}. REGISTRO FOTOGRÁFICO`),
    { minFollowingMm: 52 }
  );
  if (ncPhotoGroups.length === 0) {
    yPos = drawBodyParagraphs(
      doc,
      PDF_REGISTRO_SEM_FOTOS_TEXTO,
      margin,
      contentWidth,
      yPos,
      checkNewPage,
      laudoBodyParagraphsOpts
    );
    yPos += PDF_PARAGRAPH_GAP_MM;
  } else {
    yPos = drawBodyParagraphs(
      doc,
      PDF_REGISTRO_FOTOGRAFICO_INTRO,
      margin,
      contentWidth,
      yPos,
      checkNewPage,
      laudoBodyParagraphsOpts
    );
    yPos += PDF_PARAGRAPH_GAP_MM;
    yPos = await drawRegistroFotograficoBlocks(doc, yPos, margin, contentWidth, ncPhotoGroups);
  }

  // ============================================================
  // CONCLUSÃO
  // ============================================================
  checkNewPage(40);
  yPos = drawChapterTitle(
    doc,
    margin,
    contentWidth,
    yPos,
    pdfChapterTitleUpperCase(`${conclusaoChapterNum}. CONCLUSÃO`),
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
      checkNewPage,
      laudoBodyParagraphsOpts
    );
  }

  yPos += PDF_PARAGRAPH_GAP_MM;

  // ============================================================
  // ENCERRAMENTO — reserva de espaço + desenho único após total de páginas (sem retângulo branco)
  // ============================================================
  /** Reserva com n.º de folhas “máximo”; texto final desenhado depois do fecho do PDF. */
  const reservedEncH = measureEncerramentoCompletoMm(doc, contentWidth, 99999);
  const encTitleText = pdfChapterTitleUpperCase(`${encerramentoChapterNum}. ENCERRAMENTO`);
  doc.setFont(PDF_FONT, 'bold');
  doc.setFontSize(PDF_CHAPTER_TITLE_PT);
  const encTitleLines = doc.splitTextToSize(encTitleText, contentWidth);
  const encTitleBlockH =
    PDF_CHAPTER_TITLE_BEFORE_MM +
    encTitleLines.length * PDF_CHAPTER_LINE_MM +
    PDF_CHAPTER_TITLE_AFTER_MM;

  const signatureAreaMm = 26;
  /** Espaço data → linha de assinatura (layout em `drawResponsavelAssinaturaSection`). */
  const gapDataAssinaturaMm = 12;
  const assinaturaBlockH =
    12 +
    signatureAreaMm +
    10 +
    PDF_BODY_LINE_MM * 6 +
    24 +
    (gapDataAssinaturaMm - 16);
  /** Entre o fim do texto do encerramento e a data (local) à direita — um pouco menor que antes. */
  const encerramentoToAssinaturaGapMm = 5;

  const afterEncTitleMm =
    PDF_PARAGRAPH_GAP_MM +
    reservedEncH +
    PDF_PARAGRAPH_GAP_MM +
    PDF_PARAGRAPH_GAP_MM * 1.5 +
    encerramentoToAssinaturaGapMm +
    assinaturaBlockH;

  if (yPos + encTitleBlockH + afterEncTitleMm > pageHeight - PDF_LAUDO_PAGE_BOTTOM_SAFE_MM) {
    doc.addPage();
    yPos = PDF_PAGE_TOP_SAFE_MM;
  }

  yPos = drawChapterTitle(doc, margin, contentWidth, yPos, encTitleText, {
    minFollowingMm: afterEncTitleMm,
    bottomMarginMm: PDF_LAUDO_PAGE_BOTTOM_SAFE_MM,
  });
  const encStartPage = doc.internal.getNumberOfPages();
  yPos += PDF_PARAGRAPH_GAP_MM;
  const encBodyTopY = yPos;
  yPos = encBodyTopY + reservedEncH;
  yPos += PDF_PARAGRAPH_GAP_MM;

  // ============================================================
  // Responsável técnico / assinatura (sem título de capítulo)
  // ============================================================
  yPos += PDF_PARAGRAPH_GAP_MM * 1.5;
  yPos += encerramentoToAssinaturaGapMm;

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
      gapAfterLocalDateMm: gapDataAssinaturaMm,
      bottomMarginMm: PDF_LAUDO_PAGE_BOTTOM_SAFE_MM,
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
    checkNewPage,
    laudoBodyParagraphsOpts
  );
  doc.setPage(totalPagesLaudo);

  // ============================================================
  // Rodapé institucional (capa = p. 1 sem rodapé)
  // ============================================================
  const totalPages = doc.internal.getNumberOfPages();
  const footerLogoBox = await buildPdfLaudoFooterLogoBox(inspection.pdf_logo_data_url);

  for (let i = 1; i <= totalPages; i++) {
    if (i === 1) continue;
    doc.setPage(i);
    drawPdfLaudoFooterPage(
      doc,
      i,
      totalPages,
      pageWidth,
      pageHeight,
      margin,
      contentWidth,
      footerLogoBox,
      PDF_LAUDO_FOOTER_CENTER_TITLE,
      PDF_LAUDO_FOOTER_CENTER_CONTACT,
      PDF_LAUDO_FOOTER_CENTER_CITY
    );
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
