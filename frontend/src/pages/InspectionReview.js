import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Edit, Share2, X, MessageCircle, Mail } from 'lucide-react';
import SignaturePad from '../components/SignaturePad';
import axios from 'axios';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { API_BASE as API } from '../config/api';
const LOGO_URL = 'https://customer-assets.emergentagent.com/job_vistoria-imovel-1/artifacts/msx2fmcu_Design%20sem%20nome-Photoroom.png';

const LEGAL_TEXT = "A vistoria foi realizada nas condições disponíveis no momento da inspeção, podendo limitações como ausência de energia, água, gás, iluminação ou acesso restringir a execução de testes. Eventuais falhas não identificadas e manifestadas posteriormente caracterizam-se como vícios não aparentes à época da vistoria, devendo ser tratadas conforme garantias aplicáveis.";

// Textos automáticos de conclusão baseados na classificação
const TEXTOS_CONCLUSAO = {
  aprovado: `O imóvel vistoriado encontra-se em conformidade com as condições esperadas para recebimento, não sendo identificadas anomalias ou vícios construtivos aparentes que comprometam seu uso, segurança ou desempenho.

Os sistemas, elementos construtivos e acabamentos avaliados apresentam funcionamento adequado, estando aptos para utilização imediata.

Dessa forma, o imóvel é considerado APROVADO, podendo ser recebido sem ressalvas.`,
  
  aprovado_com_ressalvas: `O imóvel vistoriado apresenta condições gerais adequadas para recebimento, entretanto foram identificadas não conformidades pontuais, de caráter não impeditivo, que não comprometem de forma significativa o uso, a segurança ou o desempenho da edificação.

As ocorrências observadas referem-se, em sua maioria, a ajustes, acabamentos ou correções localizadas, devendo ser sanadas pela construtora/incorporadora dentro dos prazos de garantia e assistência técnica.

Dessa forma, o imóvel é considerado APROVADO COM RESSALVAS, ficando o recebimento condicionado à correção dos itens apontados neste relatório.`,
  
  reprovado: `O imóvel vistoriado apresenta não conformidades relevantes, incluindo anomalias construtivas e/ou falhas de execução que comprometem o desempenho, a segurança, a funcionalidade ou as condições adequadas de uso.

As irregularidades identificadas exigem intervenção técnica corretiva antes do recebimento do imóvel, não sendo recomendada sua aceitação nas condições atuais.

Dessa forma, o imóvel é considerado REPROVADO, devendo a construtora/incorporadora providenciar as devidas correções antes da entrega definitiva.`
};

const InspectionReview = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [inspection, setInspection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [classificacao, setClassificacao] = useState('');
  const [conclusao, setConclusao] = useState('');
  const [assinatura, setAssinatura] = useState('');
  const [responsavelFinal, setResponsavelFinal] = useState('');
  const [creaFinal, setCreaFinal] = useState('');
  const [dataFinal, setDataFinal] = useState(new Date().toISOString().split('T')[0]);
  const [horarioTermino, setHorarioTermino] = useState('');
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [pdfBlob, setPdfBlob] = useState(null);
  const [showShareModal, setShowShareModal] = useState(false);

  useEffect(() => {
    loadInspection();
  }, [id]);

  const loadInspection = async () => {
    try {
      const response = await axios.get(`${API}/inspections/${id}`);
      const data = response.data;
      setInspection(data);
      setClassificacao(data.classificacao_final || '');
      setConclusao(data.conclusao || '');
      setAssinatura(data.assinatura || '');
      setResponsavelFinal(data.responsavel_final || data.responsavel_tecnico || '');
      setCreaFinal(data.crea_final || data.crea || '');
      setDataFinal(data.data_final || new Date().toISOString().split('T')[0]);
      setHorarioTermino(data.horario_termino || '');
    } catch (error) {
      console.error('Erro ao carregar vistoria:', error);
      toast.error('Erro ao carregar vistoria');
    } finally {
      setLoading(false);
    }
  };

  const handleFinalize = async () => {
    if (!classificacao) {
      toast.error('Selecione a classificação final do imóvel');
      return;
    }

    if (!assinatura) {
      toast.error('Assinatura é obrigatória');
      return;
    }

    try {
      await axios.put(`${API}/inspections/${id}`, {
        classificacao_final: classificacao,
        conclusao,
        assinatura,
        responsavel_final: responsavelFinal,
        crea_final: creaFinal,
        data_final: dataFinal,
        horario_termino: horarioTermino
      });
      toast.success('Vistoria finalizada com sucesso!');
      navigate(`/inspection/${id}`);
    } catch (error) {
      console.error('Erro ao finalizar vistoria:', error);
      toast.error('Erro ao finalizar vistoria');
    }
  };

  // Salvar dados parciais ao voltar ao checklist
  const handleBackToChecklist = async () => {
    try {
      await axios.put(`${API}/inspections/${id}`, {
        classificacao_final: classificacao || null,
        conclusao: conclusao || '',
        assinatura: assinatura || '',
        responsavel_final: responsavelFinal || '',
        crea_final: creaFinal || '',
        data_final: dataFinal || '',
        horario_termino: horarioTermino || ''
      });
    } catch (error) {
      console.error('Erro ao salvar dados parciais:', error);
    }
    navigate(`/inspection/${id}/checklist`);
  };

  const generatePDF = async (forPreview = false) => {
    if (!inspection) return null;

    const doc = new jsPDF();
    let yPos = 15;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - (margin * 2);

    const checkNewPage = (neededSpace) => {
      if (yPos + neededSpace > pageHeight - 30) {
        doc.addPage();
        yPos = 20;
        return true;
      }
      return false;
    };

    // ============ CAPA ============
    doc.setDrawColor(0, 51, 102);
    doc.setLineWidth(2);
    doc.line(margin, 15, pageWidth - margin, 15);

    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 51, 102);
    doc.text('RELATÓRIO DE VISTORIA', pageWidth / 2, 35, { align: 'center' });
    
    doc.setFontSize(16);
    doc.text('RECEBIMENTO DE IMÓVEL', pageWidth / 2, 45, { align: 'center' });

    doc.setLineWidth(0.5);
    doc.line(60, 52, pageWidth - 60, 52);

    doc.setFontSize(14);
    doc.setTextColor(51, 51, 51);
    doc.text('OSTI ENGENHARIA', pageWidth / 2, 65, { align: 'center' });

    // ============ IDENTIFICAÇÃO ============
    yPos = 80;
    doc.setFillColor(0, 51, 102);
    doc.rect(margin, yPos - 5, contentWidth, 10, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text('IDENTIFICAÇÃO', margin + 5, yPos + 2);
    yPos += 15;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(51, 51, 51);

    const infoData = [
      ['Cliente:', inspection.cliente],
      ['Data:', inspection.data],
      ['Endereço:', inspection.endereco],
      ['Unidade/Apartamento:', inspection.unidade],
      ['Empreendimento:', inspection.empreendimento || '-'],
      ['Construtora:', inspection.construtora || '-'],
      ['Responsável Técnico:', responsavelFinal || inspection.responsavel_tecnico || '-'],
      ['CREA:', creaFinal || inspection.crea || '-'],
      ['Tipo do Imóvel:', inspection.tipo_imovel?.toUpperCase() || '-'],
      ['Energia Disponível:', inspection.energia_disponivel === 'sim' ? 'Sim' : 'Não'],
      ['Horário de Início:', inspection.horario_inicio || '-'],
      ['Horário de Término:', horarioTermino || '-']
    ];

    infoData.forEach(([label, value]) => {
      doc.setFont('helvetica', 'bold');
      doc.text(label, margin, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(String(value), margin + 50, yPos);
      yPos += 7;
    });

    // ============ DOCUMENTOS RECEBIDOS ============
    yPos += 5;
    checkNewPage(40);
    doc.setFillColor(0, 51, 102);
    doc.rect(margin, yPos - 5, contentWidth, 10, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text('DOCUMENTOS RECEBIDOS', margin + 5, yPos + 2);
    yPos += 15;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(51, 51, 51);

    if (inspection.documentos_recebidos?.length > 0) {
      inspection.documentos_recebidos.forEach((doc_item) => {
        doc.text(`• ${doc_item}`, margin + 5, yPos);
        yPos += 6;
      });
    } else {
      doc.text('Nenhum documento recebido', margin + 5, yPos);
      yPos += 6;
    }

    // ============ CHECKLIST POR CÔMODOS ============
    doc.addPage();
    yPos = 20;

    doc.setFillColor(0, 51, 102);
    doc.rect(margin, yPos - 5, contentWidth, 10, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text('CHECKLIST DA VISTORIA', margin + 5, yPos + 2);
    yPos += 15;

    for (const room of (inspection.rooms_checklist || [])) {
      checkNewPage(50);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(0, 51, 102);
      doc.text(room.room_name.toUpperCase(), margin, yPos);
      yPos += 8;

      const tableData = room.items.map((item) => {
        const photos = item.photos || [];
        const photoCount = photos.length;
        return [
          item.name,
          item.exists === 'sim' ? 'SIM' : item.exists === 'nao' ? 'NÃO' : '-',
          item.condition === 'aprovado' ? 'APROVADO' : item.condition === 'reprovado' ? 'REPROVADO' : '-',
          item.observations || '-'
        ];
      });

      autoTable(doc, {
        startY: yPos,
        head: [['Item', 'Existe', 'Condição', 'Observações']],
        body: tableData,
        theme: 'grid',
        styles: { 
          fontSize: 8,
          cellPadding: 2,
          textColor: [51, 51, 51]
        },
        headStyles: { 
          fillColor: [240, 240, 240],
          textColor: [0, 51, 102],
          fontStyle: 'bold'
        },
        columnStyles: {
          0: { cellWidth: 55 },
          1: { cellWidth: 20, halign: 'center' },
          2: { cellWidth: 30, halign: 'center' },
          3: { cellWidth: 65 }
        },
        margin: { left: margin, right: margin }
      });

      yPos = doc.lastAutoTable.finalY + 10;

      // Adicionar fotos do cômodo
      let hasPhotos = false;
      for (const item of room.items) {
        const photos = item.photos || [];
        if (photos.length > 0) {
          hasPhotos = true;
          break;
        }
      }

      if (hasPhotos) {
        checkNewPage(80);
        
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(0, 51, 102);
        doc.text(`Registro Fotográfico - ${room.room_name}`, margin, yPos);
        yPos += 8;

        for (const item of room.items) {
          const photos = item.photos || [];
          for (let i = 0; i < photos.length; i++) {
            const photo = photos[i];
            const photoUrl = typeof photo === 'string' ? photo : photo.url;
            const caption = typeof photo === 'string' ? `Foto ${i + 1}` : (photo.caption || `Foto ${i + 1}`);

            checkNewPage(60);

            try {
              doc.addImage(photoUrl, 'JPEG', margin, yPos, 50, 40);
              
              doc.setFont('helvetica', 'bold');
              doc.setFontSize(9);
              doc.setTextColor(51, 51, 51);
              doc.text(`${item.name}`, margin + 55, yPos + 10);
              
              doc.setFont('helvetica', 'normal');
              doc.setFontSize(8);
              doc.text(caption, margin + 55, yPos + 18);
              
              yPos += 50;
            } catch (e) {
              console.error('Erro ao adicionar imagem:', e);
            }
          }
        }
      }
    }

    // ============ CLASSIFICAÇÃO FINAL ============
    doc.addPage();
    yPos = 20;

    doc.setFillColor(0, 51, 102);
    doc.rect(margin, yPos - 5, contentWidth, 10, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text('CLASSIFICAÇÃO FINAL', margin + 5, yPos + 2);
    yPos += 20;

    const classificacaoText = classificacao === 'aprovado' ? 'IMÓVEL APROVADO' :
      classificacao === 'aprovado_com_ressalvas' ? 'IMÓVEL APROVADO COM RESSALVAS' : 'IMÓVEL REPROVADO';
    
    const classificacaoColor = classificacao === 'aprovado' ? [0, 128, 0] :
      classificacao === 'aprovado_com_ressalvas' ? [204, 153, 0] : [204, 0, 0];

    doc.setFillColor(...classificacaoColor);
    doc.roundedRect(margin, yPos, contentWidth, 15, 3, 3, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(255, 255, 255);
    doc.text(classificacaoText, pageWidth / 2, yPos + 10, { align: 'center' });
    yPos += 30;

    // ============ CONCLUSÃO ============
    if (conclusao) {
      doc.setFillColor(0, 51, 102);
      doc.rect(margin, yPos - 5, contentWidth, 10, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(255, 255, 255);
      doc.text('CONCLUSÃO', margin + 5, yPos + 2);
      yPos += 15;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(51, 51, 51);
      const splitConclusao = doc.splitTextToSize(conclusao, contentWidth);
      doc.text(splitConclusao, margin, yPos);
      yPos += splitConclusao.length * 5 + 15;
    }

    // ============ ASSINATURA ============
    checkNewPage(80);
    doc.setFillColor(0, 51, 102);
    doc.rect(margin, yPos - 5, contentWidth, 10, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text('ASSINATURA', margin + 5, yPos + 2);
    yPos += 15;

    if (assinatura) {
      try {
        doc.addImage(assinatura, 'PNG', margin, yPos, 70, 30);
        yPos += 35;
      } catch (e) {
        console.error('Erro ao adicionar assinatura:', e);
      }
    }

    doc.setDrawColor(0, 51, 102);
    doc.setLineWidth(0.5);
    doc.line(margin, yPos, margin + 80, yPos);
    yPos += 5;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(51, 51, 51);
    doc.text(responsavelFinal || '', margin, yPos);
    yPos += 5;
    doc.setFont('helvetica', 'normal');
    doc.text(`CREA: ${creaFinal || '-'}`, margin, yPos);
    yPos += 5;
    doc.text(`Data: ${dataFinal}`, margin, yPos);
    yPos += 20;

    // ============ TEXTO LEGAL ============
    checkNewPage(50);
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, yPos, contentWidth, 40, 3, 3);
    
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    const splitLegal = doc.splitTextToSize(LEGAL_TEXT, contentWidth - 10);
    doc.text(splitLegal, margin + 5, yPos + 8);

    // Rodapé
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text('Documento gerado eletronicamente por OSTI Engenharia', pageWidth / 2, pageHeight - 10, { align: 'center' });

    if (forPreview) {
      const blob = doc.output('blob');
      return blob;
    } else {
      doc.save(`Relatorio_Vistoria_${inspection.cliente}_${inspection.data}.pdf`);
      toast.success('PDF gerado com sucesso!');
      return null;
    }
  };

  const handlePreviewPDF = async () => {
    const blob = await generatePDF(true);
    if (blob) {
      setPdfBlob(blob);
      setShowPdfPreview(true);
    }
  };

  const handleDownloadPDF = () => {
    generatePDF(false);
    setShowPdfPreview(false);
  };

  const handleShareWhatsApp = () => {
    const text = `Relatório de Vistoria - ${inspection?.cliente} - ${inspection?.data}`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
    setShowShareModal(false);
  };

  const handleShareEmail = () => {
    const subject = `Relatório de Vistoria - ${inspection?.cliente}`;
    const body = `Segue em anexo o relatório de vistoria do imóvel.\n\nCliente: ${inspection?.cliente}\nData: ${inspection?.data}\nEndereço: ${inspection?.endereco}`;
    const url = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(url, '_blank');
    setShowShareModal(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* Header */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white py-6 px-4">
        <div className="max-w-md mx-auto md:max-w-2xl">
          <button
            data-testid="back-button"
            onClick={handleBackToChecklist}
            className="flex items-center gap-2 text-slate-300 hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft size={20} />
            Voltar ao Checklist
          </button>
          <div className="flex items-center gap-4">
            <img src={LOGO_URL} alt="OSTI Engenharia" className="h-10 w-auto" />
            <h1 className="text-2xl font-bold tracking-tight font-secondary uppercase">
              Finalização da Vistoria
            </h1>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto md:max-w-2xl px-4 py-6">
        <div className="bg-white rounded-lg shadow-[0_2px_8px_rgba(0,0,0,0.04)] p-6">
          {/* Classificação Final */}
          <div className="mb-6">
            <label className="text-xs font-bold tracking-wider uppercase text-slate-500 mb-3 block">
              Classificação Final do Imóvel *
            </label>
            <div className="space-y-2">
              {[
                { value: 'aprovado', label: 'IMÓVEL APROVADO', color: 'green' },
                { value: 'aprovado_com_ressalvas', label: 'IMÓVEL APROVADO COM RESSALVAS', color: 'yellow' },
                { value: 'reprovado', label: 'IMÓVEL REPROVADO', color: 'red' }
              ].map((option) => (
                <button
                  key={option.value}
                  data-testid={`classificacao-${option.value}`}
                  onClick={() => {
                    setClassificacao(option.value);
                    // Preencher automaticamente a conclusão se estiver vazia ou for um texto padrão
                    const isDefaultText = !conclusao || 
                      Object.values(TEXTOS_CONCLUSAO).some(texto => conclusao === texto);
                    if (isDefaultText) {
                      setConclusao(TEXTOS_CONCLUSAO[option.value]);
                    }
                  }}
                  className={`w-full py-3 px-4 rounded-lg font-semibold transition-all duration-200 ${
                    classificacao === option.value
                      ? option.color === 'green'
                        ? 'bg-green-600 text-white'
                        : option.color === 'yellow'
                        ? 'bg-yellow-500 text-white'
                        : 'bg-red-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Conclusão */}
          <div className="mb-6">
            <label className="text-xs font-bold tracking-wider uppercase text-slate-500 mb-2 block">
              Conclusão / Observações Gerais
            </label>
            <textarea
              data-testid="conclusao-textarea"
              value={conclusao}
              onChange={(e) => setConclusao(e.target.value)}
              placeholder="Digite suas observações finais sobre a vistoria..."
              className="w-full p-4 border border-slate-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={5}
            />
          </div>

          {/* Texto Legal */}
          <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
            <p className="text-xs text-slate-600 italic leading-relaxed">{LEGAL_TEXT}</p>
          </div>

          {/* Responsável */}
          <div className="mb-4">
            <label className="text-xs font-bold tracking-wider uppercase text-slate-500 mb-2 block">
              Responsável Técnico
            </label>
            <input
              data-testid="responsavel-input"
              type="text"
              value={responsavelFinal}
              onChange={(e) => setResponsavelFinal(e.target.value)}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* CREA */}
          <div className="mb-4">
            <label className="text-xs font-bold tracking-wider uppercase text-slate-500 mb-2 block">
              CREA
            </label>
            <input
              data-testid="crea-input"
              type="text"
              value={creaFinal}
              onChange={(e) => setCreaFinal(e.target.value)}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Data */}
          <div className="mb-4">
            <label className="text-xs font-bold tracking-wider uppercase text-slate-500 mb-2 block">
              Data
            </label>
            <input
              data-testid="data-input"
              type="date"
              value={dataFinal}
              onChange={(e) => setDataFinal(e.target.value)}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Horários */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="text-xs font-bold tracking-wider uppercase text-slate-500 mb-2 block">
                Horário de Início
              </label>
              <input
                type="text"
                value={inspection?.horario_inicio || '-'}
                disabled
                className="w-full px-4 py-3 border border-slate-200 rounded-lg bg-slate-50 text-slate-600"
              />
            </div>
            <div>
              <label className="text-xs font-bold tracking-wider uppercase text-slate-500 mb-2 block">
                Horário de Término
              </label>
              <input
                data-testid="horario-termino-input"
                type="time"
                value={horarioTermino}
                onChange={(e) => setHorarioTermino(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Assinatura */}
          <div className="mb-6">
            <label className="text-xs font-bold tracking-wider uppercase text-slate-500 mb-3 block">
              Assinatura *
            </label>
            <SignaturePad onChange={setAssinatura} />
          </div>

          {/* Buttons */}
          <div className="space-y-3">
            <button
              data-testid="finalize-button"
              onClick={handleFinalize}
              className="w-full bg-blue-600 text-white py-4 rounded-lg font-bold font-secondary uppercase text-lg transition-all duration-200 hover:bg-blue-700 active:scale-95"
            >
              Finalizar Vistoria
            </button>
          </div>
        </div>
      </div>

      {/* PDF Preview Modal */}
      {showPdfPreview && pdfBlob && (
        <div className="fixed inset-0 bg-black/80 z-50 flex flex-col">
          <div className="bg-white p-4 flex items-center justify-between">
            <h3 className="text-lg font-bold">Pré-visualização do PDF</h3>
            <button onClick={() => setShowPdfPreview(false)} className="p-2">
              <X size={24} />
            </button>
          </div>
          <div className="flex-1 overflow-auto bg-slate-200 p-4">
            <iframe
              src={URL.createObjectURL(pdfBlob)}
              className="w-full h-full min-h-[600px] bg-white"
              title="PDF Preview"
            />
          </div>
          <div className="bg-white p-4 flex gap-3">
            <button
              onClick={handleDownloadPDF}
              className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold flex items-center justify-center gap-2"
            >
              <Download size={20} />
              Baixar PDF
            </button>
            <button
              onClick={() => setShowShareModal(true)}
              className="flex-1 bg-slate-900 text-white py-3 rounded-lg font-semibold flex items-center justify-center gap-2"
            >
              <Share2 size={20} />
              Compartilhar
            </button>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm">
            <h3 className="text-xl font-bold text-slate-900 mb-4">Compartilhar</h3>
            <div className="space-y-3">
              <button
                onClick={handleShareWhatsApp}
                className="w-full py-3 px-4 bg-green-500 text-white rounded-lg font-semibold flex items-center justify-center gap-2"
              >
                <MessageCircle size={20} />
                WhatsApp
              </button>
              <button
                onClick={handleShareEmail}
                className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg font-semibold flex items-center justify-center gap-2"
              >
                <Mail size={20} />
                E-mail
              </button>
            </div>
            <button
              onClick={() => setShowShareModal(false)}
              className="w-full mt-4 py-3 px-4 bg-slate-100 text-slate-700 rounded-lg font-semibold"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default InspectionReview;
