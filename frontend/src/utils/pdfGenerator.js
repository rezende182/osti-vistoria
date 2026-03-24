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
  PDF_BODY_PT,
  PDF_BODY_LINE_MM,
  PDF_PAGE_BOTTOM_SAFE_MM,
} from './pdfLayout';
import { formatPdfAssinaturaDataLine } from './pdfAssinaturaFormat';

// Logo OSTI oficial no PDF (public/logo-osti.png); fallback CDN legado
const PDF_LOGO_LOCAL = `${process.env.PUBLIC_URL || ''}/logo-osti.png`;
const PDF_LOGO_FALLBACK =
  'https://customer-assets.emergentagent.com/job_vistoria-imovel-1/artifacts/msx2fmcu_Design%20sem%20nome-Photoroom.png';
/** Logo horizontal (~2,3:1) — largura × altura em mm */
const PDF_LOGO_W_MM = 52;
const PDF_LOGO_H_MM = 22;

// Texto legal padrão
const LEGAL_TEXT =
  'A vistoria foi realizada nas condições disponíveis no momento da inspeção, podendo limitações como ausência de energia, água, gás, iluminação ou acesso restringir a execução de testes.\n\n' +
  'Eventuais falhas não identificadas e manifestadas posteriormente caracterizam-se como vícios não aparentes à época da vistoria, devendo ser tratadas conforme garantias aplicáveis.';

// Carregar imagem como base64 com retry
const loadImageAsBase64 = async (url, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        const blob = await response.blob();
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(blob);
        });
      }
      console.log(`Tentativa ${i + 1} retornou status ${response.status}`);
    } catch (e) {
      console.log(`Tentativa ${i + 1} falhou para carregar logo:`, e);
    }
    // Aguardar 500ms antes de retry
    await new Promise(r => setTimeout(r, 500));
  }
  console.log('Não foi possível carregar o logo após todas as tentativas');
  return null;
};

// Formatar data
const formatDate = (dateString) => {
  if (!dateString) return '-';
  const parts = dateString.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateString;
};

/** Texto da legenda: `Foto N: …` (remove prefixo duplicado vindo do app). */
function buildPdfPhotoCaptionText(caption, photoNumber) {
  const n =
    photoNumber != null && photoNumber !== '' && !Number.isNaN(Number(photoNumber))
      ? String(photoNumber)
      : '?';
  let rest = String(caption || '').trim();
  rest = rest.replace(/^Foto\s*\d+\s*[.:]?\s*/i, '').trim();
  return rest ? `Foto ${n}: ${rest}` : `Foto ${n}:`;
}

/**
 * Quebra legenda à largura da imagem (mm); força partição em tokens muito longos.
 */
function wrapPdfCaptionToImageWidth(doc, text, maxWidthMm) {
  doc.setFont('helvetica', 'normal');
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

/** Títulos longos de secção quebram em várias linhas dentro da margem */
function drawSectionTitle(doc, margin, contentWidth, yPos, title, gapAfter = 8) {
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  const lines = doc.splitTextToSize(title, contentWidth);
  const lineStep = 7;
  lines.forEach((ln, i) => {
    doc.text(ln, margin, yPos + i * lineStep);
  });
  return yPos + lines.length * lineStep + gapAfter;
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
  const contentWidth = pageWidth - (margin * 2);
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
  // PÁGINA 1: CABEÇALHO - Logo + Título lado a lado
  // ============================================================
  
  // Carregar logo OSTI (PDF apenas)
  let logoBase64 = null;
  try {
    logoBase64 = await loadImageAsBase64(PDF_LOGO_LOCAL);
    if (!logoBase64) {
      logoBase64 = await loadImageAsBase64(PDF_LOGO_FALLBACK);
    }
  } catch (e) {
    console.log('Erro ao carregar logo:', e);
  }

  // Logo à esquerda
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'PNG', margin, yPos, PDF_LOGO_W_MM, PDF_LOGO_H_MM);
    } catch (e) {
      console.log('Erro ao adicionar logo ao PDF:', e);
    }
  }

  const titleX = margin + PDF_LOGO_W_MM + 8;
  // Título à direita do logo
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('RELATÓRIO DE VISTORIA', titleX, yPos + 8);
  doc.text('RECEBIMENTO DE IMÓVEL', titleX, yPos + 16);
  
  yPos += Math.max(35, PDF_LOGO_H_MM + 10);

  // ============================================================
  // 1. IDENTIFICAÇÃO DA VISTORIA TÉCNICA
  // ============================================================
  yPos = drawSectionTitle(
    doc,
    margin,
    contentWidth,
    yPos,
    '1. IDENTIFICAÇÃO DA VISTORIA TÉCNICA',
    6
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
      font: 'helvetica',
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
  yPos = drawSectionTitle(
    doc,
    margin,
    contentWidth,
    yPos,
    '2. DOCUMENTOS RECEBIDOS E ANALISADOS',
    6
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(PDF_BODY_PT);
  
  if (inspection.documentos_recebidos && inspection.documentos_recebidos.length > 0) {
    inspection.documentos_recebidos.forEach((docItem, index) => {
      doc.text(`${index + 1}. ${docItem}`, margin + 5, yPos);
      yPos += PDF_BODY_LINE_MM;
    });
  } else {
    doc.setFont('helvetica', 'italic');
    doc.text('Nenhum documento recebido registrado.', margin + 5, yPos);
    yPos += PDF_BODY_LINE_MM;
  }

  // Checklist sempre em página nova: a 1.ª página contém apenas 1 e 2
  doc.addPage();
  yPos = margin;

  // ============================================================
  // 3. INSPEÇÃO TÉCNICA E CHECKLIST DE VERIFICAÇÃO
  // ============================================================
  yPos = drawSectionTitle(
    doc,
    margin,
    contentWidth,
    yPos,
    '3. INSPEÇÃO TÉCNICA E CHECKLIST DE VERIFICAÇÃO',
    8
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

      // Nome do cômodo (ex: 3.1 SALA)
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text(`3.${roomNumber} ${room.room_name.toUpperCase()}`, margin, yPos);
      yPos += 8;
      
      // "Itens verificados:"
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(PDF_BODY_PT);
      doc.text('Itens verificados:', margin, yPos);
      yPos += PDF_BODY_LINE_MM + 2;

      // Itens do cômodo (APENAS os que existem)
      for (const item of itensExistentes) {
        // Espaço mínimo para faixa + condição (~30 mm); observações/fotos quebram depois
        checkNewPage(30);

        // FAIXA CINZA com nome do item (#CDCDCC)
        doc.setFillColor(205, 205, 204);
        doc.rect(margin, yPos - 4, contentWidth, 10, 'F');
        
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(PDF_BODY_PT);
        doc.setTextColor(0, 0, 0);
        doc.text(item.name, margin + 3, yPos + 2);
        yPos += 12;

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
            margin,
            contentWidth,
            yPos,
            checkNewPage
          );
          yPos += 2;
        } else {
          // Condição
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(PDF_BODY_PT);
          doc.setTextColor(0, 0, 0);
          doc.text('Condição: ', margin, yPos);

          doc.setFont('helvetica', 'bold');
          if (item.condition === 'aprovado') {
            doc.setTextColor(34, 139, 34); // Verde
            doc.text('APROVADO', margin + 22, yPos);
          } else if (item.condition === 'reprovado') {
            doc.setTextColor(178, 34, 34); // Vermelho
            doc.text('REPROVADO', margin + 22, yPos);
          } else {
            doc.setTextColor(0, 0, 0);
            doc.text('-', margin + 22, yPos);
          }
          doc.setTextColor(0, 0, 0);
          yPos += PDF_BODY_LINE_MM;

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(PDF_BODY_PT);

          if (item.condition === 'aprovado') {
            doc.text('Observações: ', margin, yPos);
            doc.setFont('helvetica', 'italic');
            doc.text(
              'Item em conformidade, sem irregularidades aparentes.',
              margin + 26,
              yPos
            );
            yPos += PDF_BODY_LINE_MM;
          } else if (item.condition === 'reprovado') {
            doc.text('Observações:', margin, yPos);
            yPos += PDF_BODY_LINE_MM;

            if (obsTrim) {
              yPos = drawBodyParagraphs(
                doc,
                obsTrim,
                margin + 5,
                contentWidth - 10,
                yPos,
                checkNewPage
              );
            }
            yPos += 2;
          }
        }

        // Fotos: legenda `Foto N: …` com quebra na largura da imagem; sem cabeçalho "Fotos:"
        const photos = item.photos || [];
        if (photos.length > 0) {
          /* Formato 10×15 cm (retrato) */
          const imgWidth = 100;
          const imgHeight = 150;

          for (const photo of photos) {
            const captionFull = buildPdfPhotoCaptionText(
              photo.caption,
              photo.number
            );
            const captionLines = wrapPdfCaptionToImageWidth(
              doc,
              captionFull,
              imgWidth
            );
            const captionBlockH = captionLines.length * PDF_BODY_LINE_MM;
            const gapBeforeImg = 4;
            checkNewPage(captionBlockH + gapBeforeImg + imgHeight + 14);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(PDF_BODY_PT);
            doc.setTextColor(0, 0, 0);
            let yCap = yPos;
            captionLines.forEach((ln) => {
              doc.text(ln, pageWidth / 2, yCap, { align: 'center' });
              yCap += PDF_BODY_LINE_MM;
            });
            yPos = yCap + gapBeforeImg;

            if (photo.url) {
              try {
                const imgX = (pageWidth - imgWidth) / 2;
                doc.addImage(photo.url, 'JPEG', imgX, yPos, imgWidth, imgHeight);
                yPos += imgHeight + 8;
              } catch (e) {
                console.error('Erro ao adicionar imagem:', e);
                doc.setFont('helvetica', 'italic');
                doc.text('[Imagem não disponível]', pageWidth / 2, yPos, {
                  align: 'center',
                });
                yPos += 8;
              }
            }
          }
        }

        yPos += 5;
      }

      yPos += 8;
      roomNumber++;
    }
  } else {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(PDF_BODY_PT);
    doc.text('Nenhum cômodo foi adicionado ao checklist.', margin + 5, yPos);
    yPos += 10;
  }

  // ============================================================
  // 4. CONCLUSÃO (sempre inicia no topo de uma página nova)
  // ============================================================
  doc.addPage();
  yPos = margin;
  yPos = drawSectionTitle(doc, margin, contentWidth, yPos, '4. CONCLUSÃO', 10);

  doc.setFont('helvetica', 'normal');
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
    yPos += 4;
    yPos = drawBodyParagraphs(
      doc,
      textoConclusao,
      margin,
      contentWidth,
      yPos,
      checkNewPage
    );
  }

  /* Espaço entre o fim do texto da secção 4 e o título da secção 5 (evita título colado ao parágrafo) */
  yPos += 12;

  // ============================================================
  // 5. RESPONSÁVEL TÉCNICO / ASSINATURA
  // ============================================================
  checkNewPage(36);
  yPos = drawSectionTitle(
    doc,
    margin,
    contentWidth,
    yPos,
    '5. RESPONSÁVEL TÉCNICO / ASSINATURA',
    12
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
  // 6. CONSIDERAÇÕES FINAIS E ASPECTOS LEGAIS
  // ============================================================
  yPos += 8;
  checkNewPage(28);
  yPos = drawSectionTitle(
    doc,
    margin,
    contentWidth,
    yPos,
    '6. CONSIDERAÇÕES FINAIS E ASPECTOS LEGAIS',
    10
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
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
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
