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
} from './pdfLayout';
import { formatPdfAssinaturaDataLine } from './pdfAssinaturaFormat';

/** Logótipo personalizado no PDF — largura × altura em mm (lado a lado com o título) */
const PDF_LOGO_W_MM = 52;
const PDF_LOGO_H_MM = 22;

const PDF_TITLE_LINE1 = 'RELATÓRIO DE VISTORIA';
const PDF_TITLE_LINE2 = 'RECEBIMENTO DE IMÓVEL';
const PDF_TITLE_LINES = [PDF_TITLE_LINE1, PDF_TITLE_LINE2];

/** Endereço, cidade e UF para a secção 3. Introdução (identificação da vistoria). */
function formatPdfIntroLocalizacao(inspection) {
  const e = (inspection.endereco || '').trim();
  const c = (inspection.cidade || '').trim();
  const u = (inspection.uf || '').trim().toUpperCase();
  const cidadeUf = u ? (c ? `${c} - ${u}` : u) : c;
  if (e && cidadeUf) return `${e}, ${cidadeUf}`;
  if (e) return e;
  return cidadeUf || '-';
}

/** Texto fixo da secção 3. INTRODUÇÃO com dados da identificação. */
function buildPdfIntroducaoText(inspection) {
  const loc = formatPdfIntroLocalizacao(inspection);
  const apt = (inspection.unidade || '').trim() || '-';
  const emp = (inspection.empreendimento || '').trim() || '-';

  return [
    `O presente laudo técnico, referente ao imóvel localizado no endereço: ${loc}, apartamento nº: ${apt}, do empreendimento ${emp}, tem como objetivo registrar os resultados da vistoria técnica realizada, avaliando as condições construtivas, acabamentos, instalações prediais e demais elementos relevantes para a utilização segura e adequada do bem.`,
    'A inspeção foi conduzida de acordo com normas técnicas aplicáveis e procedimentos de engenharia reconhecidos, buscando identificar eventuais irregularidades, vícios aparentes ou não conformidades que possam comprometer o uso, segurança ou desempenho do imóvel.',
    'Este documento constitui registro formal da condição do imóvel no momento da entrega, fornecendo suporte técnico para o recebimento e eventual acionamento de garantias junto à construtora, quando necessário.',
  ].join('\n\n');
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
  // PÁGINA 1: CABEÇALHO — só logótipo se o utilizador enviou; senão só o título
  // ============================================================

  doc.setFont(PDF_FONT, 'bold');
  doc.setTextColor(0, 0, 0);

  const customLogo = inspection.pdf_logo_data_url;
  const hasCustomLogo =
    customLogo &&
    typeof customLogo === 'string' &&
    customLogo.startsWith('data:image/');

  if (hasCustomLogo) {
    const logoFormat = getJsPdfFormatFromDataUrl(customLogo);
    try {
      doc.addImage(
        customLogo,
        logoFormat,
        margin,
        yPos,
        PDF_LOGO_W_MM,
        PDF_LOGO_H_MM
      );
    } catch (e) {
      console.log('Erro ao adicionar logo ao PDF:', e);
    }

    const titleX = margin + PDF_LOGO_W_MM + 8;
    doc.setFontSize(PDF_CHAPTER_TITLE_PT);
    const lineStep = PDF_CHAPTER_LINE_MM;
    let ty = yPos + 8;
    PDF_TITLE_LINES.forEach((ln) => {
      doc.text(ln, titleX, ty);
      ty += lineStep;
    });

    const titleBlockH = PDF_TITLE_LINES.length * lineStep + 4;
    yPos += Math.max(PDF_LOGO_H_MM + 8, titleBlockH, 28);
  } else {
    doc.setFontSize(PDF_CHAPTER_TITLE_PT);
    const lineStep = PDF_CHAPTER_LINE_MM;
    const cx = pageWidth / 2;
    let ty = yPos + 6;
    PDF_TITLE_LINES.forEach((ln) => {
      doc.text(ln, cx, ty, { align: 'center' });
      ty += lineStep;
    });
    yPos += PDF_TITLE_LINES.length * lineStep + 10;
  }

  // ============================================================
  // 1. IDENTIFICAÇÃO DA VISTORIA TÉCNICA
  // ============================================================
  yPos = drawChapterTitle(
    doc,
    margin,
    contentWidth,
    yPos,
    '1. IDENTIFICAÇÃO DA VISTORIA TÉCNICA'
  );

  const identificacaoData = [
    ['Cliente', inspection.cliente || '-'],
    ['Endereço', inspection.endereco || '-'],
    ['Cidade', inspection.cidade || '-'],
    ['UF', inspection.uf || '-'],
    ['Apartamento', inspection.unidade || '-'],
    ['Empreendimento', inspection.empreendimento || '-'],
    ['Construtora', inspection.construtora || '-'],
    ['Responsável Técnico', inspection.responsavel_tecnico || '-'],
    ['CREA', inspection.crea || '-'],
    ['Data', formatDate(inspection.data)],
    ['Horário de Início', inspection.horario_inicio || '-'],
    ['Horário de Término', inspection.horario_termino || '-'],
    ['Tipo do Imóvel', inspection.tipo_imovel === 'novo' ? 'Novo' : inspection.tipo_imovel === 'usado' ? 'Usado' : 'Reformado'],
    ['Energia Disponível', inspection.energia_disponivel === 'sim' ? 'Sim' : 'Não']
  ];

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
      0: { fontStyle: 'bold', cellWidth: 50, fillColor: [245, 245, 245] },
      1: { cellWidth: contentWidth - 50 }
    },
    margin: { left: margin, right: margin }
  });

  yPos = doc.lastAutoTable.finalY + 10;

  // ============================================================
  // 2. DOCUMENTOS RECEBIDOS E ANALISADOS
  // ============================================================
  yPos = drawChapterTitle(
    doc,
    margin,
    contentWidth,
    yPos,
    '2. DOCUMENTOS RECEBIDOS E ANALISADOS'
  );

  doc.setFont(PDF_FONT, 'normal');
  doc.setFontSize(PDF_BODY_PT);
  
  if (inspection.documentos_recebidos && inspection.documentos_recebidos.length > 0) {
    const docs = inspection.documentos_recebidos;
    docs.forEach((docItem, index) => {
      doc.text(`${index + 1}. ${docItem}`, listX, yPos);
      yPos += PDF_BODY_LINE_MM;
      if (index < docs.length - 1) {
        yPos += PDF_LIST_ITEM_EXTRA_GAP_MM;
      }
    });
  } else {
    doc.setFont(PDF_FONT, 'italic');
    doc.text('Nenhum documento recebido registrado.', listX, yPos);
    yPos += PDF_BODY_LINE_MM;
  }

  // Primeira página: só cabeçalho + secções 1 e 2. O restante começa na página seguinte.
  doc.addPage();
  yPos = margin;

  // ============================================================
  // 3. INTRODUÇÃO
  // ============================================================
  yPos = drawChapterTitle(
    doc,
    margin,
    contentWidth,
    yPos,
    '3. INTRODUÇÃO'
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
  // 4. INSPEÇÃO TÉCNICA E CHECKLIST DE VERIFICAÇÃO (em seguida à introdução)
  // ============================================================
  yPos = drawChapterTitle(
    doc,
    margin,
    contentWidth,
    yPos,
    '4. INSPEÇÃO TÉCNICA E CHECKLIST DE VERIFICAÇÃO'
  );

  if (inspection.rooms_checklist && inspection.rooms_checklist.length > 0) {
    let roomNumber = 1;

    for (const room of inspection.rooms_checklist) {
      // FILTRAR: Apenas itens que EXISTEM (exists === 'sim')
      const itensExistentes = room.items.filter(item => item.exists === 'sim');
      
      // Se não há itens existentes neste cômodo, pular
      if (itensExistentes.length === 0) {
        continue;
      }

      checkNewPage(26);

      yPos = drawSubsectionTitle(
        doc,
        margin,
        contentWidth,
        yPos,
        `4.${roomNumber} ${room.room_name.toUpperCase()}`
      );

      doc.setFont(PDF_FONT, 'normal');
      doc.setFontSize(PDF_BODY_PT);
      doc.text('Itens verificados:', listX, yPos);
      yPos += PDF_BODY_LINE_MM + PDF_LIST_ITEM_EXTRA_GAP_MM;

      // Itens do cômodo (APENAS os que existem)
      for (const item of itensExistentes) {
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
        /** Existência + observação preenchida, sem Aprovado/Reprovado (regra do checklist). */
        const somenteObservacao =
          item.exists === 'sim' && !hasCondition && obsTrim;

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
  yPos = drawChapterTitle(doc, margin, contentWidth, yPos, '5. CONCLUSÃO');

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
    '6. RESPONSÁVEL TÉCNICO / ASSINATURA'
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
    '7. CONSIDERAÇÕES FINAIS E ASPECTOS LEGAIS'
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
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(PDF_BODY_PT);
    doc.setFont(PDF_FONT, 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text('OSTI ENGENHARIA - Relatório de Vistoria', margin, pageHeight - 10);
    doc.text(`Página ${i} de ${totalPages}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
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
