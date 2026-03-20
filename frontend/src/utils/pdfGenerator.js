import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  TEXTOS_CONCLUSAO,
  CLASSIFICACAO_FINAL_LABELS,
} from '../constants/inspectionClassificacao';
import {
  drawBodyParagraphs,
  drawClassificationBadge,
  drawSignatureBlock,
  PDF_BODY_PT,
  PDF_BODY_LINE_MM,
} from './pdfLayout';

// Logo da empresa - usar arquivo local para evitar problemas de CORS/CDN
const LOGO_URL = '/logo-osti.png';

// Texto legal padrão
const LEGAL_TEXT = "A vistoria foi realizada nas condições disponíveis no momento da inspeção, podendo limitações como ausência de energia, água, gás, iluminação ou acesso restringir a execução de testes. Eventuais falhas não identificadas e manifestadas posteriormente caracterizam-se como vícios não aparentes à época da vistoria, devendo ser tratadas conforme garantias aplicáveis.";

// Cores
const COLORS = {
  black: [0, 0, 0],
  white: [255, 255, 255],
  gray: [205, 205, 204],
  grayLight: [245, 245, 245],
  green: [34, 139, 34],
  yellow: [218, 165, 32],
  red: [178, 34, 34]
};

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
    if (yPos + neededSpace > pageHeight - margin) {
      doc.addPage();
      yPos = margin;
      return true;
    }
    return false;
  };

  // ============================================================
  // PÁGINA 1: CABEÇALHO - Logo + Título lado a lado
  // ============================================================
  
  // Carregar logo
  let logoBase64 = null;
  try {
    logoBase64 = await loadImageAsBase64(LOGO_URL);
  } catch (e) {
    console.log('Erro ao carregar logo:', e);
  }

  // Logo à esquerda
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'PNG', margin, yPos, 45, 22);
    } catch (e) {
      console.log('Erro ao adicionar logo ao PDF:', e);
    }
  }

  // Título à direita do logo
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('RELATÓRIO DE VISTORIA', margin + 55, yPos + 8);
  doc.text('RECEBIMENTO DE IMÓVEL', margin + 55, yPos + 16);
  
  yPos += 35;

  // ============================================================
  // 1. IDENTIFICAÇÃO DA VISTORIA
  // ============================================================
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('1. IDENTIFICAÇÃO DA VISTORIA', margin, yPos);
  yPos += 8;

  const identificacaoData = [
    ['Cliente', inspection.cliente || '-'],
    ['Endereço', inspection.endereco || '-'],
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
  // 2. DOCUMENTOS RECEBIDOS
  // ============================================================
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('2. DOCUMENTOS RECEBIDOS', margin, yPos);
  yPos += 8;

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

  // ============================================================
  // 3. CHECKLIST DA VISTORIA (nova página)
  // ============================================================
  doc.addPage();
  yPos = margin;
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('3. CHECKLIST DA VISTORIA', margin, yPos);
  yPos += 10;

  if (inspection.rooms_checklist && inspection.rooms_checklist.length > 0) {
    let roomNumber = 1;

    for (const room of inspection.rooms_checklist) {
      // FILTRAR: Apenas itens que EXISTEM (exists === 'sim')
      const itensExistentes = room.items.filter(item => item.exists === 'sim');
      
      // Se não há itens existentes neste cômodo, pular
      if (itensExistentes.length === 0) {
        continue;
      }

      checkNewPage(60);

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
        checkNewPage(100);

        // FAIXA CINZA com nome do item (#CDCDCC)
        doc.setFillColor(205, 205, 204);
        doc.rect(margin, yPos - 4, contentWidth, 10, 'F');
        
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(PDF_BODY_PT);
        doc.setTextColor(0, 0, 0);
        doc.text(item.name, margin + 3, yPos + 2);
        yPos += 12;

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
        doc.setTextColor(0, 0, 0); // Resetar cor para preto
        yPos += PDF_BODY_LINE_MM;

        // Observações
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(PDF_BODY_PT);
        
        if (item.condition === 'aprovado') {
          // Texto automático para APROVADO
          doc.text('Observações: ', margin, yPos);
          doc.setFont('helvetica', 'italic');
          doc.text('Item em conformidade, sem irregularidades aparentes.', margin + 26, yPos);
          yPos += PDF_BODY_LINE_MM;
        } else if (item.condition === 'reprovado') {
          doc.text('Observações:', margin, yPos);
          yPos += PDF_BODY_LINE_MM;
          
          if (item.observations && item.observations.trim()) {
            yPos = drawBodyParagraphs(
              doc,
              item.observations,
              margin + 5,
              contentWidth - 10,
              yPos,
              checkNewPage
            );
          }
          yPos += 2;
        }

        // Fotos
        const photos = item.photos || [];
        if (photos.length > 0) {
          checkNewPage(50);
          
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(0, 0, 0);
          doc.text('Fotos:', margin, yPos);
          yPos += 8;

          const imgWidth = 120;
          const imgHeight = 90;

          for (const photo of photos) {
            checkNewPage(imgHeight + 20);

            // Legenda centralizada
            const caption = photo.caption || `Foto ${photo.number || ''}`;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(PDF_BODY_PT);
            doc.text(caption, pageWidth / 2, yPos, { align: 'center' });
            yPos += 5;

            // Imagem centralizada
            if (photo.url) {
              try {
                const imgX = (pageWidth - imgWidth) / 2;
                doc.addImage(photo.url, 'JPEG', imgX, yPos, imgWidth, imgHeight);
                yPos += imgHeight + 8;
              } catch (e) {
                console.error('Erro ao adicionar imagem:', e);
                doc.setFont('helvetica', 'italic');
                doc.text('[Imagem não disponível]', pageWidth / 2, yPos, { align: 'center' });
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
  // 4. CONCLUSÃO
  // ============================================================
  checkNewPage(60);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('4. CONCLUSÃO', margin, yPos);
  yPos += 10;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(PDF_BODY_PT);
  doc.text('Classificação Final do Imóvel:', margin, yPos);
  yPos += 8;

  if (inspection.classificacao_final) {
    let bgColor;
    let darkOnYellow = false;
    switch (inspection.classificacao_final) {
      case 'aprovado':
        bgColor = COLORS.green;
        break;
      case 'aprovado_com_ressalvas':
        bgColor = COLORS.yellow;
        darkOnYellow = true;
        break;
      case 'reprovado':
        bgColor = COLORS.red;
        break;
      default:
        bgColor = COLORS.gray;
    }
    const labelText =
      CLASSIFICACAO_FINAL_LABELS[inspection.classificacao_final] || 'PENDENTE';
    yPos = drawClassificationBadge(
      doc,
      labelText,
      margin,
      contentWidth,
      yPos,
      bgColor,
      darkOnYellow
    );
  }

  const textoConclusao =
    inspection.conclusao ||
    (inspection.classificacao_final
      ? TEXTOS_CONCLUSAO[inspection.classificacao_final]
      : null);

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

  // ============================================================
  // 5. RESPONSÁVEL TÉCNICO
  // ============================================================
  checkNewPage(80);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('5. RESPONSÁVEL TÉCNICO', margin, yPos);
  yPos += 10;

  const responsavel = inspection.responsavel_final || inspection.responsavel_tecnico || '-';
  const crea = inspection.crea_final || inspection.crea || '-';
  const dataFinal = inspection.data_final ? formatDate(inspection.data_final) : formatDate(inspection.data);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(PDF_BODY_PT);
  
  doc.text(`Responsável: ${responsavel}`, margin, yPos);
  yPos += PDF_BODY_LINE_MM;
  doc.text(`CREA: ${crea}`, margin, yPos);
  yPos += PDF_BODY_LINE_MM;
  doc.text(`Data: ${dataFinal}`, margin, yPos);
  yPos += PDF_BODY_LINE_MM;
  
  if (inspection.horario_inicio) {
    doc.text(`Horário de Início: ${inspection.horario_inicio}`, margin, yPos);
    yPos += PDF_BODY_LINE_MM;
  }
  if (inspection.horario_termino) {
    doc.text(`Horário de Término: ${inspection.horario_termino}`, margin, yPos);
    yPos += PDF_BODY_LINE_MM;
  }

  yPos += 8;

  yPos = drawSignatureBlock(doc, margin, contentWidth, yPos, 42, checkNewPage);

  // ============================================================
  // 6. OBSERVAÇÕES LEGAIS
  // ============================================================
  yPos += 8;
  checkNewPage(50);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('6. OBSERVAÇÕES LEGAIS', margin, yPos);
  yPos += 10;

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
  const dataFormatada = formatDate(inspection.data).replace(/\//g, '-');
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
