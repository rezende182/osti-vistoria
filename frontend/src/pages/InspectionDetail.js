import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Home, Download, CheckCircle2, AlertCircle, Clock, Edit, FileText, XCircle, Share2, MessageCircle, Mail, Eye, X, Layers } from 'lucide-react';
import NavigationModal from '../components/NavigationModal';
import { LogoutHeaderButton } from '../components/LogoutHeaderButton';
import { toast } from 'sonner';
import { useAuth } from '@/auth';
import { generateInspectionPDF } from '../utils/pdfGenerator';
import { loadInspectionWithFallback } from '../utils/inspectionLoader';
import { CLASSIFICACAO_BADGE_SHORT } from '../constants/inspectionClassificacao';
import BrandLogo from '@/components/BrandLogo';

function formatInspectionDate(iso) {
  if (!iso) return '—';
  const p = String(iso).split('-');
  if (p.length === 3) return `${p[2]}/${p[1]}/${p[0]}`;
  return String(iso);
}

const InspectionDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const uid = user?.uid;
  const [inspection, setInspection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showExitModal, setShowExitModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [showPdfViewer, setShowPdfViewer] = useState(false);
  const [pdfDataUrl, setPdfDataUrl] = useState(null);

  const loadInspection = useCallback(async () => {
    try {
      const res = await loadInspectionWithFallback(id, uid);
      if (!res.ok) {
        toast.error(res.error || 'Erro ao carregar vistoria');
        return;
      }
      if (res.fromLocal) {
        toast.info('Sem servidor — a mostrar dados guardados neste dispositivo.');
      }
      setInspection(res.data);
    } catch (error) {
      console.error('Erro ao carregar vistoria:', error);
      toast.error('Erro ao carregar vistoria');
    } finally {
      setLoading(false);
    }
  }, [id, uid]);

  useEffect(() => {
    loadInspection();
  }, [loadInspection]);

  const getStatusInfo = () => {
    if (inspection?.status === 'concluida') {
      if (inspection.classificacao_final === 'aprovado') {
        return { icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50', label: CLASSIFICACAO_BADGE_SHORT.aprovado };
      } else if (inspection.classificacao_final === 'aprovado_com_ressalvas') {
        return { icon: AlertCircle, color: 'text-yellow-600', bg: 'bg-yellow-50', label: CLASSIFICACAO_BADGE_SHORT.aprovado_com_ressalvas };
      } else if (inspection.classificacao_final === 'reprovado') {
        return { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50', label: CLASSIFICACAO_BADGE_SHORT.reprovado };
      } else if (inspection.classificacao_final === 'outro') {
        return { icon: Layers, color: 'text-slate-600', bg: 'bg-slate-100', label: CLASSIFICACAO_BADGE_SHORT.outro };
      }
    }
    return { icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50', label: 'EM ANDAMENTO' };
  };

  // Função para BAIXAR PDF diretamente (sem abrir nova aba)
  const handleDownloadPDF = async () => {
    if (!inspection) {
      toast.error('Dados da vistoria não disponíveis');
      return;
    }

    setGeneratingPdf(true);
    toast.info('Gerando PDF...');

    try {
      const result = await generateInspectionPDF(inspection, false);
      if (result) {
        toast.success('PDF baixado com sucesso!');
      }
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      toast.error('Erro ao gerar PDF. Tente novamente.');
    } finally {
      setGeneratingPdf(false);
    }
  };

  // Função para VISUALIZAR PDF dentro do app (modal)
  const handleViewPDF = async () => {
    if (!inspection) {
      toast.error('Dados da vistoria não disponíveis');
      return;
    }

    setGeneratingPdf(true);
    toast.info('Gerando visualização...');

    try {
      const result = await generateInspectionPDF(inspection, true);
      if (result && result.blob) {
        // Criar URL do blob para exibir no modal
        const blobUrl = URL.createObjectURL(result.blob);
        setPdfDataUrl(blobUrl);
        setShowPdfViewer(true);
      }
    } catch (error) {
      console.error('Erro ao gerar visualização:', error);
      toast.error('Erro ao gerar visualização.');
    } finally {
      setGeneratingPdf(false);
    }
  };

  // Fechar visualização do PDF
  const closePdfViewer = () => {
    if (pdfDataUrl) {
      URL.revokeObjectURL(pdfDataUrl);
    }
    setShowPdfViewer(false);
    setPdfDataUrl(null);
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

  if (!inspection) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-500">Vistoria não encontrada</p>
      </div>
    );
  }

  const statusInfo = getStatusInfo();
  const StatusIcon = statusInfo.icon;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white py-6 px-4">
        <div className="max-w-md mx-auto md:max-w-2xl">
          <button
            data-testid="home-button"
            onClick={() => setShowExitModal(true)}
            className="flex items-center gap-2 text-slate-300 hover:text-white mb-4 transition-colors"
          >
            <Home size={20} />
            Página Inicial
          </button>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <BrandLogo className="h-14 w-auto max-w-[11rem] shrink-0 object-contain object-left py-0.5 sm:h-[4.75rem] sm:max-w-[13rem]" />
              <div className="min-w-0">
                <h1 className="mb-1 text-2xl font-bold font-secondary uppercase tracking-tight">
                  {inspection.cliente}
                </h1>
                <p className="text-sm text-slate-300">{inspection.data}</p>
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
              <LogoutHeaderButton />
              <div className={`flex items-center justify-center gap-1 self-start rounded-lg px-3 py-2 sm:self-end ${statusInfo.bg}`}>
                <StatusIcon size={18} className={statusInfo.color} />
                <span className={`text-xs font-bold ${statusInfo.color}`}>{statusInfo.label}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-md mx-auto md:max-w-2xl px-4 py-6">
        {/* Botões de Edição (quando concluída) */}
        {inspection.status === 'concluida' && (
          <div className="space-y-2 mb-4">
            <button
              data-testid="edit-inspection-button"
              onClick={() => navigate(`/inspection/${id}/checklist`)}
              className="w-full bg-slate-100 text-slate-700 py-3 rounded-lg font-semibold transition-all duration-200 hover:bg-slate-200 flex items-center justify-center gap-2"
            >
              <Edit size={18} />
              Editar Vistoria
            </button>
            <button
              data-testid="edit-info-button"
              onClick={() => navigate(`/inspection/${id}/edit`)}
              className="w-full bg-slate-100 text-slate-700 py-3 rounded-lg font-semibold transition-all duration-200 hover:bg-slate-200 flex items-center justify-center gap-2"
            >
              <FileText size={18} />
              Editar Informações
            </button>
          </div>
        )}

        {/* Informações - Mostra dados da identificação */}
        <div className="bg-white rounded-lg shadow-[0_2px_8px_rgba(0,0,0,0.04)] p-6 mb-4">
          <h2 className="text-xl font-bold text-slate-900 font-secondary uppercase mb-4">Informações</h2>
          <div className="space-y-3 text-sm">
            {inspection.tipo_vistoria_fluxo === 'apartamento' &&
            (inspection.imovel_categoria === 'apartamento' ||
              inspection.imovel_categoria === 'casa') ? (
              <>
                <h3 className="border-b border-slate-200 pb-1 text-xs font-bold uppercase tracking-wider text-slate-700">
                  Identificação do Responsável Técnico
                </h3>
                {inspection.pdf_empresa_nome && (
                  <div>
                    <span className="text-xs font-bold tracking-wider uppercase text-slate-500">
                      Nome da empresa
                    </span>
                    <p className="text-slate-900">{inspection.pdf_empresa_nome}</p>
                  </div>
                )}
                {inspection.pdf_empresa_cnpj && (
                  <div>
                    <span className="text-xs font-bold tracking-wider uppercase text-slate-500">
                      CNPJ da empresa
                    </span>
                    <p className="text-slate-900">{inspection.pdf_empresa_cnpj}</p>
                  </div>
                )}
                <div>
                  <span className="text-xs font-bold tracking-wider uppercase text-slate-500">
                    Nome do Responsável Técnico
                  </span>
                  <p className="text-slate-900">{inspection.responsavel_tecnico}</p>
                </div>
                <div>
                  <span className="text-xs font-bold tracking-wider uppercase text-slate-500">CREA / CAU</span>
                  <p className="text-slate-900">{inspection.crea}</p>
                </div>
                {inspection.responsavel_cpf_cnpj && (
                  <div>
                    <span className="text-xs font-bold tracking-wider uppercase text-slate-500">
                      CPF / CNPJ
                    </span>
                    <p className="text-slate-900">{inspection.responsavel_cpf_cnpj}</p>
                  </div>
                )}

                <h3 className="mt-4 border-b border-slate-200 pb-1 text-xs font-bold uppercase tracking-wider text-slate-700">
                  Identificação do contratante
                </h3>
                <div>
                  <span className="text-xs font-bold tracking-wider uppercase text-slate-500">Nome</span>
                  <p className="text-slate-900">{inspection.cliente}</p>
                </div>
                <div>
                  <span className="text-xs font-bold tracking-wider uppercase text-slate-500">CPF / CNPJ</span>
                  <p className="text-slate-900">{inspection.contratante_cpf_cnpj || '—'}</p>
                </div>

                <h3 className="mt-4 border-b border-slate-200 pb-1 text-xs font-bold uppercase tracking-wider text-slate-700">
                  Dados do Imóvel
                </h3>
                <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/80 p-4">
                  <div>
                    <span className="text-xs font-bold tracking-wider uppercase text-slate-500">
                      Tipo do imóvel (contratante)
                    </span>
                    <p className="text-slate-900">
                      {inspection.imovel_categoria === 'casa' ? 'Casa' : 'Apartamento'}
                    </p>
                  </div>
                  {inspection.imovel_categoria === 'casa' && (
                    <div>
                      <span className="text-xs font-bold tracking-wider uppercase text-slate-500">Tipologia</span>
                      <p className="text-slate-900">
                        {inspection.imovel_tipologia === 'sobrado'
                          ? 'Sobrado'
                          : inspection.imovel_tipologia === 'terreo'
                            ? 'Térrea'
                            : '—'}
                      </p>
                    </div>
                  )}
                  <div>
                    <span className="text-xs font-bold tracking-wider uppercase text-slate-500">Endereço</span>
                    <p className="text-slate-900">{inspection.endereco}</p>
                  </div>
                  {inspection.imovel_categoria === 'apartamento' && (
                    <div>
                      <span className="text-xs font-bold tracking-wider uppercase text-slate-500">
                        Apartamento / Bloco
                      </span>
                      <p className="text-slate-900">{inspection.unidade || '—'}</p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-xs font-bold tracking-wider uppercase text-slate-500">Cidade</span>
                      <p className="text-slate-900">{inspection.cidade || '-'}</p>
                    </div>
                    <div>
                      <span className="text-xs font-bold tracking-wider uppercase text-slate-500">UF</span>
                      <p className="text-slate-900">{inspection.uf || '-'}</p>
                    </div>
                  </div>
                  <div>
                    <span className="text-xs font-bold tracking-wider uppercase text-slate-500">
                      Nome do empreendimento
                    </span>
                    <p className="text-slate-900">{inspection.empreendimento || '—'}</p>
                  </div>
                  <div>
                    <span className="text-xs font-bold tracking-wider uppercase text-slate-500">Construtora</span>
                    <p className="text-slate-900">{inspection.construtora || '—'}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-xs font-bold tracking-wider uppercase text-slate-500">
                        Condição do imóvel
                      </span>
                      <p className="text-slate-900">
                        {inspection.tipo_imovel === 'novo'
                          ? 'Novo'
                          : inspection.tipo_imovel === 'usado'
                            ? 'Usado'
                            : 'Reformado'}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs font-bold tracking-wider uppercase text-slate-500">
                        Energia disponível
                      </span>
                      <p className="text-slate-900">
                        {inspection.energia_disponivel === 'sim' ? 'Sim' : 'Não'}
                      </p>
                    </div>
                  </div>
                </div>

                <h3 className="mt-4 border-b border-slate-200 pb-1 text-xs font-bold uppercase tracking-wider text-slate-700">
                  Identificação da vistoria
                </h3>
                <div>
                  <span className="text-xs font-bold tracking-wider uppercase text-slate-500">
                    Data da vistoria
                  </span>
                  <p className="text-slate-900">{inspection.data}</p>
                </div>
                <div>
                  <span className="text-xs font-bold tracking-wider uppercase text-slate-500">
                    Horário de início
                  </span>
                  <p className="text-slate-900">{inspection.horario_inicio || '—'}</p>
                </div>
                {inspection.documentos_recebidos?.length > 0 && (
                  <div>
                    <span className="text-xs font-bold tracking-wider uppercase text-slate-500">
                      Documentos recebidos
                    </span>
                    <ul className="mt-1 text-slate-900">
                      {inspection.documentos_recebidos.map((doc, idx) => (
                        <li key={idx} className="text-sm">
                          • {doc}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <>
                <div>
                  <span className="text-xs font-bold tracking-wider uppercase text-slate-500">Cliente</span>
                  <p className="text-slate-900">{inspection.cliente}</p>
                </div>
                <div>
                  <span className="text-xs font-bold tracking-wider uppercase text-slate-500">Endereço</span>
                  <p className="text-slate-900">{inspection.endereco}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs font-bold tracking-wider uppercase text-slate-500">Cidade</span>
                    <p className="text-slate-900">{inspection.cidade || '-'}</p>
                  </div>
                  <div>
                    <span className="text-xs font-bold tracking-wider uppercase text-slate-500">UF</span>
                    <p className="text-slate-900">{inspection.uf || '-'}</p>
                  </div>
                </div>
                {inspection.tipo_vistoria_fluxo === 'apartamento' ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-xs font-bold tracking-wider uppercase text-slate-500">
                        Entrega de Imóvel
                      </span>
                      <p className="text-slate-900">{inspection.unidade || '—'}</p>
                    </div>
                    <div>
                      <span className="text-xs font-bold tracking-wider uppercase text-slate-500">
                        Empreendimento
                      </span>
                      <p className="text-slate-900">{inspection.empreendimento || '-'}</p>
                    </div>
                  </div>
                ) : (
                  <div>
                    <span className="text-xs font-bold tracking-wider uppercase text-slate-500">
                      Empreendimento
                    </span>
                    <p className="text-slate-900">{inspection.empreendimento || '-'}</p>
                  </div>
                )}
                <div>
                  <span className="text-xs font-bold tracking-wider uppercase text-slate-500">Construtora</span>
                  <p className="text-slate-900">{inspection.construtora || '-'}</p>
                </div>
                {inspection.responsavel_cpf_cnpj && (
                  <div>
                    <span className="text-xs font-bold tracking-wider uppercase text-slate-500">
                      CPF / CNPJ (RT)
                    </span>
                    <p className="text-slate-900">{inspection.responsavel_cpf_cnpj}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs font-bold tracking-wider uppercase text-slate-500">
                      Responsável Técnico
                    </span>
                    <p className="text-slate-900">{inspection.responsavel_tecnico}</p>
                  </div>
                  <div>
                    <span className="text-xs font-bold tracking-wider uppercase text-slate-500">CREA / CAU</span>
                    <p className="text-slate-900">{inspection.crea}</p>
                  </div>
                </div>
                <div>
                  <span className="text-xs font-bold tracking-wider uppercase text-slate-500">Data</span>
                  <p className="text-slate-900">{inspection.data}</p>
                </div>
                <div>
                  <span className="text-xs font-bold tracking-wider uppercase text-slate-500">
                    Horário de início
                  </span>
                  <p className="text-slate-900">{inspection.horario_inicio || '—'}</p>
                </div>
                <div>
                  <span className="text-xs font-bold tracking-wider uppercase text-slate-500">Tipo do imóvel</span>
                  <p className="text-slate-900">
                    {inspection.imovel_tipologia === 'sobrado'
                      ? 'Sobrado'
                      : inspection.imovel_tipologia === 'terreo'
                        ? 'Térreo'
                        : '—'}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs font-bold tracking-wider uppercase text-slate-500">
                      Condição do imóvel
                    </span>
                    <p className="text-slate-900">
                      {inspection.tipo_imovel === 'novo'
                        ? 'Novo'
                        : inspection.tipo_imovel === 'usado'
                          ? 'Usado'
                          : 'Reformado'}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs font-bold tracking-wider uppercase text-slate-500">
                      Energia Disponível
                    </span>
                    <p className="text-slate-900">
                      {inspection.energia_disponivel === 'sim' ? 'Sim' : 'Não'}
                    </p>
                  </div>
                </div>
                {inspection.documentos_recebidos?.length > 0 && (
                  <div>
                    <span className="text-xs font-bold tracking-wider uppercase text-slate-500">
                      Documentos Recebidos
                    </span>
                    <ul className="mt-1 text-slate-900">
                      {inspection.documentos_recebidos.map((doc, idx) => (
                        <li key={idx} className="text-sm">
                          • {doc}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Checklist Summary */}
        {inspection.rooms_checklist?.length > 0 && (
          <div className="bg-white rounded-lg shadow-[0_2px_8px_rgba(0,0,0,0.04)] p-6 mb-4">
            <h2 className="text-xl font-bold text-slate-900 font-secondary uppercase mb-4">Inspeção Técnica e Checklist de Verificação</h2>
            {inspection.rooms_checklist.map((room, index) => {
              // Filtrar apenas itens que existem (aprovados ou reprovados)
              const itensLista = (room.items || []).filter((item) => item && item.exists !== 'nao');

              if (itensLista.length === 0) return null;
              
              return (
                <div key={index} className="mb-4 pb-4 border-b border-slate-200 last:border-0">
                  <h3 className="font-bold text-slate-900 mb-2">{room.room_name}</h3>
                  <div className="space-y-1">
                    {itensLista.map((item, itemIndex) => {
                      const getItemColor = () => {
                        if (item.condition === 'aprovado') return 'text-green-600';
                        if (item.condition === 'reprovado') return 'text-red-600';
                        return 'text-slate-400';
                      };
                      return (
                        <div key={itemIndex} className="flex items-start justify-between text-sm">
                          <div className="flex-1">
                            <span className="text-slate-700">{item.name}</span>
                          </div>
                          <span className={`font-semibold ${getItemColor()}`}>
                            {item.condition === 'aprovado' ? 'Aprovado' :
                              item.condition === 'reprovado' ? 'Reprovado' : '-'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Finalização */}
        {inspection.status === 'concluida' && (
          <div className="bg-white rounded-lg shadow-[0_2px_8px_rgba(0,0,0,0.04)] p-6 mb-4">
            <h2 className="text-xl font-bold text-slate-900 font-secondary uppercase mb-4">Finalização</h2>
            
            {inspection.conclusao && (
              <div className="mb-4">
                <span className="text-xs font-bold tracking-wider uppercase text-slate-500">Conclusão</span>
                <p className="text-slate-700 mt-1">{inspection.conclusao}</p>
              </div>
            )}

            {inspection.assinatura && (
              <div className="mb-4">
                <span className="text-xs font-bold tracking-wider uppercase text-slate-500 block mb-2">Assinatura</span>
                <img src={inspection.assinatura} alt="Assinatura" className="border border-slate-300 rounded-lg max-w-xs" />
              </div>
            )}

            <div className="text-sm text-slate-600 space-y-1">
              <p><strong>Responsável:</strong> {inspection.responsavel_final || inspection.responsavel_tecnico}</p>
              <p><strong>CREA:</strong> {inspection.crea_final || inspection.crea}</p>
              <p>
                <strong>Data:</strong>{' '}
                {formatInspectionDate(inspection.data || inspection.data_final)}
              </p>
              <div className="grid grid-cols-2 gap-4 mt-2">
                <p><strong>Horário de Início:</strong> {inspection.horario_inicio || '-'}</p>
                <p><strong>Horário de Término:</strong> {inspection.horario_termino || '-'}</p>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3">
          {inspection.status === 'em_andamento' && (
            <button
              data-testid="continue-inspection-button"
              onClick={() => navigate(`/inspection/${id}/checklist`)}
              className="w-full bg-blue-600 text-white py-4 rounded-lg font-bold font-secondary uppercase text-lg transition-all duration-200 hover:bg-blue-700 active:scale-95 flex items-center justify-center gap-2"
            >
              <Edit size={20} />
              Continuar Vistoria
            </button>
          )}
          {inspection.status === 'concluida' && (
            <>
              {/* Botão Visualizar PDF */}
              <button
                data-testid="view-pdf-button"
                onClick={handleViewPDF}
                disabled={generatingPdf}
                className="w-full bg-slate-700 text-white py-4 rounded-lg font-bold font-secondary uppercase text-lg transition-all duration-200 hover:bg-slate-800 active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 mb-3"
              >
                {generatingPdf ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Gerando...
                  </>
                ) : (
                  <>
                    <Eye size={20} />
                    Visualizar PDF
                  </>
                )}
              </button>
              
              {/* Botão Baixar PDF */}
              <button
                data-testid="download-pdf-button"
                onClick={handleDownloadPDF}
                disabled={generatingPdf}
                className="w-full bg-blue-600 text-white py-4 rounded-lg font-bold font-secondary uppercase text-lg transition-all duration-200 hover:bg-blue-700 active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {generatingPdf ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Gerando...
                  </>
                ) : (
                  <>
                    <Download size={20} />
                    Baixar PDF
                  </>
                )}
              </button>
              
              {/* Botão Concluído */}
              <button
                data-testid="done-button"
                onClick={() => {
                  toast.success('Vistoria salva com sucesso!');
                  navigate('/');
                }}
                className="w-full mt-3 bg-green-600 text-white py-4 rounded-lg font-bold font-secondary uppercase text-lg transition-all duration-200 hover:bg-green-700 active:scale-95 flex items-center justify-center gap-2"
              >
                Concluído
              </button>
            </>
          )}
        </div>
      </div>

      {/* Navigation Modal */}
      <NavigationModal
        isOpen={showExitModal}
        onClose={() => setShowExitModal(false)}
        onConfirm={() => navigate('/')}
        title="Voltar para Início"
        message="Tem certeza que deseja voltar para a página inicial?"
      />

      {/* PDF Viewer Modal - Visualização interna */}
      {showPdfViewer && pdfDataUrl && (
        <div className="fixed inset-0 bg-black/90 z-50 flex flex-col">
          {/* Header do Viewer */}
          <div className="bg-slate-900 p-4 flex items-center justify-between">
            <h3 className="text-lg font-bold text-white">Pré-visualização do PDF</h3>
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  closePdfViewer();
                  handleDownloadPDF();
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold flex items-center gap-2 hover:bg-blue-700"
              >
                <Download size={18} />
                Baixar
              </button>
              <button 
                onClick={closePdfViewer} 
                className="p-2 text-white hover:bg-slate-700 rounded-lg"
              >
                <X size={24} />
              </button>
            </div>
          </div>
          
          {/* PDF usando embed tag */}
          <div className="flex-1 overflow-auto bg-slate-700 p-4">
            <embed
              src={pdfDataUrl}
              type="application/pdf"
              className="w-full h-full min-h-[75vh] bg-white rounded-lg"
              title="Visualização do PDF"
            />
          </div>
          
          {/* Footer do Viewer */}
          <div className="bg-slate-900 p-3 flex justify-center gap-3">
            <button
              onClick={() => {
                closePdfViewer();
                handleDownloadPDF();
              }}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold flex items-center gap-2 hover:bg-blue-700"
            >
              <Download size={18} />
              Baixar PDF
            </button>
            <button
              onClick={() => setShowShareModal(true)}
              className="px-6 py-3 bg-slate-700 text-white rounded-lg font-semibold flex items-center gap-2 hover:bg-slate-600"
            >
              <Share2 size={18} />
              Compartilhar
            </button>
            <button
              onClick={closePdfViewer}
              className="px-6 py-3 bg-slate-600 text-white rounded-lg font-semibold hover:bg-slate-500"
            >
              Fechar
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

export default InspectionDetail;
