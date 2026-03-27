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

function tStr(v) {
  if (v == null) return '';
  return String(v).trim();
}

function condicaoImovelLabel(tipo) {
  if (tipo === 'novo') return 'Novo';
  if (tipo === 'usado') return 'Usado';
  if (tipo === 'reformado') return 'Reformado';
  return null;
}

function energiaLabel(v) {
  if (v === 'sim') return 'Sim';
  if (v === 'nao') return 'Não';
  return null;
}

/** Sigla da UF (ex.: SP), sem nome do estado. */
function ufSomenteSigla(uf) {
  const s = tStr(uf);
  if (!s) return '';
  const head = s.split(/\s*[—–-]\s*/)[0].trim();
  if (/^[A-Za-z]{2}$/.test(head)) return head.toUpperCase();
  return head.slice(0, 2).toUpperCase();
}

/** Apartamento | Casa Térrea | Sobrado */
function tipoImovelUnificadoLabel(inv) {
  if (inv.imovel_categoria === 'apartamento') return 'Apartamento';
  if (inv.imovel_categoria === 'casa') {
    if (inv.imovel_tipologia === 'sobrado') return 'Sobrado';
    if (inv.imovel_tipologia === 'terreo') return 'Casa Térrea';
    return null;
  }
  if (inv.imovel_tipologia === 'sobrado') return 'Sobrado';
  if (inv.imovel_tipologia === 'terreo') return 'Casa Térrea';
  return null;
}

function cidadeUfExibicao(cidade, uf) {
  const c = tStr(cidade);
  const u = ufSomenteSigla(uf);
  if (c && u) return `${c}, ${u}`;
  if (c) return c;
  if (u) return u;
  return '';
}

function empreendimentoConstrutoraExibicao(emp, cons) {
  const e = tStr(emp);
  const k = tStr(cons);
  if (e && k) return `${e} / ${k}`;
  if (e || k) return e || k;
  return '';
}

function IdBlock({ title, children }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-gradient-to-b from-slate-50/90 to-white p-4 shadow-sm">
      <h3 className="mb-3 border-b border-slate-200 pb-2 text-xs font-bold uppercase tracking-wider text-slate-800">
        {title}
      </h3>
      <div className="flex flex-col">{children}</div>
    </div>
  );
}

function IdRow({ label, children }) {
  if (children == null || children === false) return null;
  if (typeof children === 'string' && !children.trim()) return null;
  return (
    <div className="flex flex-col gap-1 border-t border-slate-100 py-3 first:border-t-0 first:pt-0">
      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</span>
      <div className="text-sm font-medium leading-snug text-slate-900">{children}</div>
    </div>
  );
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
          <div className="space-y-5 text-sm">
            {inspection.tipo_vistoria_fluxo === 'apartamento' &&
            (inspection.imovel_categoria === 'apartamento' ||
              inspection.imovel_categoria === 'casa') ? (
              <>
                <IdBlock title="Identificação do Responsável Técnico">
                  <IdRow label="Nome do Responsável Técnico">{inspection.responsavel_tecnico}</IdRow>
                  <IdRow label="CREA / CAU">{inspection.crea}</IdRow>
                  {tStr(inspection.responsavel_cpf_cnpj) ? (
                    <IdRow label="CPF / CNPJ">{inspection.responsavel_cpf_cnpj}</IdRow>
                  ) : null}
                </IdBlock>

                <IdBlock title="Identificação do contratante">
                  <IdRow label="Nome">{inspection.cliente}</IdRow>
                  {tStr(inspection.contratante_cpf_cnpj) ? (
                    <IdRow label="CPF / CNPJ">{inspection.contratante_cpf_cnpj}</IdRow>
                  ) : null}
                </IdBlock>

                <IdBlock title="Dados do Imóvel">
                  {tipoImovelUnificadoLabel(inspection) ? (
                    <IdRow label="Tipo do Imóvel">{tipoImovelUnificadoLabel(inspection)}</IdRow>
                  ) : null}
                  <IdRow label="Endereço">{inspection.endereco}</IdRow>
                  {inspection.imovel_categoria === 'apartamento' && tStr(inspection.unidade) ? (
                    <IdRow label="Apartamento / Bloco">{inspection.unidade}</IdRow>
                  ) : null}
                  {cidadeUfExibicao(inspection.cidade, inspection.uf) ? (
                    <IdRow label="Cidade">
                      {cidadeUfExibicao(inspection.cidade, inspection.uf)}
                    </IdRow>
                  ) : null}
                  {empreendimentoConstrutoraExibicao(
                    inspection.empreendimento,
                    inspection.construtora
                  ) ? (
                    <IdRow label="Empreendimento/Construtora">
                      {empreendimentoConstrutoraExibicao(
                        inspection.empreendimento,
                        inspection.construtora
                      )}
                    </IdRow>
                  ) : null}
                  {condicaoImovelLabel(inspection.tipo_imovel) ? (
                    <IdRow label="Condição do imóvel">
                      {condicaoImovelLabel(inspection.tipo_imovel)}
                    </IdRow>
                  ) : null}
                  {energiaLabel(inspection.energia_disponivel) ? (
                    <IdRow label="Energia disponível">
                      {energiaLabel(inspection.energia_disponivel)}
                    </IdRow>
                  ) : null}
                </IdBlock>

                <IdBlock title="Identificação da vistoria">
                  <IdRow label="Data da vistoria">{formatInspectionDate(inspection.data)}</IdRow>
                  {tStr(inspection.responsavel_construtora) ? (
                    <IdRow label="Responsável da Construtora">
                      {inspection.responsavel_construtora}
                    </IdRow>
                  ) : null}
                  <div className="grid grid-cols-1 gap-4 border-t border-slate-100 py-3 first:border-t-0 first:pt-0 sm:grid-cols-2">
                    <div className="flex flex-col gap-1">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        Horário de início
                      </span>
                      <span className="text-sm font-medium text-slate-900">
                        {tStr(inspection.horario_inicio) || '—'}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        Horário de término
                      </span>
                      <span className="text-sm font-medium text-slate-900">
                        {tStr(inspection.horario_termino) || '—'}
                      </span>
                    </div>
                  </div>
                  {inspection.documentos_recebidos?.filter((d) => tStr(d)).length > 0 ? (
                    <div className="border-t border-slate-100 pt-3 first:border-t-0 first:pt-0">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        Documentos recebidos
                      </span>
                      <ul className="mt-2 space-y-1 text-slate-900">
                        {inspection.documentos_recebidos.filter((d) => tStr(d)).map((doc, idx) => (
                          <li key={idx} className="text-sm">
                            • {doc}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </IdBlock>

                {(tStr(inspection.laudo_objetivo) ||
                  tStr(inspection.laudo_relato_vistoria) ||
                  tStr(inspection.laudo_relato_adendo_descricao) ||
                  tStr(inspection.laudo_relato_adendo_retrabalho) ||
                  tStr(inspection.laudo_relato_adendo_impedimento) ||
                  tStr(inspection.laudo_metodologia)) && (
                  <IdBlock title="Objetivo, relato e metodologia (PDF)">
                    {tStr(inspection.laudo_objetivo) ? (
                      <div className="border-t border-slate-100 pt-3 first:border-t-0 first:pt-0">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                          Objetivo
                        </span>
                        <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">
                          {inspection.laudo_objetivo}
                        </p>
                      </div>
                    ) : null}
                    {tStr(inspection.laudo_relato_vistoria) ? (
                      <div className="border-t border-slate-100 pt-3">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                          Relato da vistoria
                        </span>
                        <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">
                          {inspection.laudo_relato_vistoria}
                        </p>
                      </div>
                    ) : null}
                    {(tStr(inspection.laudo_relato_adendo_descricao) ||
                      tStr(inspection.laudo_relato_adendo_retrabalho) ||
                      tStr(inspection.laudo_relato_adendo_impedimento)) && (
                      <div className="space-y-3 border-t border-slate-100 pt-3">
                        {tStr(inspection.laudo_relato_adendo_descricao) ? (
                          <div>
                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                              Como foi a vistoria
                            </span>
                            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">
                              {inspection.laudo_relato_adendo_descricao}
                            </p>
                          </div>
                        ) : null}
                        {tStr(inspection.laudo_relato_adendo_retrabalho) ? (
                          <div>
                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                              Retrabalho durante a vistoria
                            </span>
                            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">
                              {inspection.laudo_relato_adendo_retrabalho}
                            </p>
                          </div>
                        ) : null}
                        {tStr(inspection.laudo_relato_adendo_impedimento) ? (
                          <div>
                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                              Impedimentos à inspeção
                            </span>
                            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">
                              {inspection.laudo_relato_adendo_impedimento}
                            </p>
                          </div>
                        ) : null}
                      </div>
                    )}
                    {tStr(inspection.laudo_metodologia) ? (
                      <div className="border-t border-slate-100 pt-3">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                          Metodologia
                        </span>
                        <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">
                          {inspection.laudo_metodologia}
                        </p>
                      </div>
                    ) : null}
                  </IdBlock>
                )}
              </>
            ) : (
              <>
                <IdBlock title="Contratante e imóvel">
                  <IdRow label="Cliente">{inspection.cliente}</IdRow>
                  <IdRow label="Endereço">{inspection.endereco}</IdRow>
                  {cidadeUfExibicao(inspection.cidade, inspection.uf) ? (
                    <IdRow label="Cidade">
                      {cidadeUfExibicao(inspection.cidade, inspection.uf)}
                    </IdRow>
                  ) : null}
                  {inspection.tipo_vistoria_fluxo === 'apartamento' && tStr(inspection.unidade) ? (
                    <IdRow label="Entrega de Imóvel">{inspection.unidade}</IdRow>
                  ) : null}
                  {empreendimentoConstrutoraExibicao(
                    inspection.empreendimento,
                    inspection.construtora
                  ) ? (
                    <IdRow label="Empreendimento/Construtora">
                      {empreendimentoConstrutoraExibicao(
                        inspection.empreendimento,
                        inspection.construtora
                      )}
                    </IdRow>
                  ) : null}
                  {tipoImovelUnificadoLabel(inspection) ? (
                    <IdRow label="Tipo do Imóvel">{tipoImovelUnificadoLabel(inspection)}</IdRow>
                  ) : null}
                </IdBlock>

                <IdBlock title="Responsável técnico">
                  {tStr(inspection.responsavel_cpf_cnpj) ? (
                    <IdRow label="CPF / CNPJ">{inspection.responsavel_cpf_cnpj}</IdRow>
                  ) : null}
                  <IdRow label="Responsável Técnico">{inspection.responsavel_tecnico}</IdRow>
                  <IdRow label="CREA / CAU">{inspection.crea}</IdRow>
                </IdBlock>

                <IdBlock title="Identificação da vistoria">
                  <IdRow label="Data">{formatInspectionDate(inspection.data)}</IdRow>
                  <div className="grid grid-cols-1 gap-4 border-t border-slate-100 py-3 first:border-t-0 first:pt-0 sm:grid-cols-2">
                    <div className="flex flex-col gap-1">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        Horário de início
                      </span>
                      <span className="text-sm font-medium text-slate-900">
                        {tStr(inspection.horario_inicio) || '—'}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        Horário de término
                      </span>
                      <span className="text-sm font-medium text-slate-900">
                        {tStr(inspection.horario_termino) || '—'}
                      </span>
                    </div>
                  </div>
                  {condicaoImovelLabel(inspection.tipo_imovel) ? (
                    <IdRow label="Condição do imóvel">
                      {condicaoImovelLabel(inspection.tipo_imovel)}
                    </IdRow>
                  ) : null}
                  {energiaLabel(inspection.energia_disponivel) ? (
                    <IdRow label="Energia disponível">
                      {energiaLabel(inspection.energia_disponivel)}
                    </IdRow>
                  ) : null}
                  {inspection.documentos_recebidos?.filter((d) => tStr(d)).length > 0 ? (
                    <div className="border-t border-slate-100 pt-3 first:border-t-0 first:pt-0">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        Documentos recebidos
                      </span>
                      <ul className="mt-2 space-y-1 text-slate-900">
                        {inspection.documentos_recebidos.filter((d) => tStr(d)).map((doc, idx) => (
                          <li key={idx} className="text-sm">
                            • {doc}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </IdBlock>
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
