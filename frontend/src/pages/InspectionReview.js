import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { LogoutHeaderButton } from '../components/LogoutHeaderButton';
import { toast } from 'sonner';
import { useAuth } from '@/auth';
import { inspectionsApi } from '../services/api';
import { loadInspectionWithFallback } from '../utils/inspectionLoader';
import {
  getInspectionLocally,
  saveInspectionLocally,
  initDB,
  enqueueSyncOperation,
} from '../utils/offlineStorage';
import {
  TEXTOS_CONCLUSAO,
  CLASSIFICACAO_FINAL_LABELS,
  conclusaoPareceAutomatica,
} from '../constants/inspectionClassificacao';
import BrandLogo from '@/components/BrandLogo';

const CLASSIFICACAO_OPTIONS = [
  { value: 'aprovado', label: CLASSIFICACAO_FINAL_LABELS.aprovado, color: 'green' },
  {
    value: 'aprovado_com_ressalvas',
    label: CLASSIFICACAO_FINAL_LABELS.aprovado_com_ressalvas,
    color: 'yellow',
  },
  { value: 'reprovado', label: CLASSIFICACAO_FINAL_LABELS.reprovado, color: 'red' },
  { value: 'outro', label: CLASSIFICACAO_FINAL_LABELS.outro, color: 'slate' },
];

const CONCLUSAO_PLACEHOLDER = 'Digite suas observações finais sobre a vistoria...';

const InspectionReview = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const uid = user?.uid;
  const [inspection, setInspection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [classificacao, setClassificacao] = useState('');
  const [conclusao, setConclusao] = useState('');
  const [responsavelFinal, setResponsavelFinal] = useState('');
  const [creaFinal, setCreaFinal] = useState('');
  const [dataEmissaoLaudo, setDataEmissaoLaudo] = useState('');

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
      const data = res.data;
      setInspection(data);
      setClassificacao(data.classificacao_final || '');
      setConclusao(data.conclusao || '');
      setResponsavelFinal(data.responsavel_final || data.responsavel_tecnico || '');
      setCreaFinal(data.crea_final || data.crea || '');
      setDataEmissaoLaudo(
        data.data_final || new Date().toISOString().slice(0, 10)
      );
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

  const handleFinalize = async () => {
    if (!classificacao) {
      toast.error('Selecione a classificação final do imóvel');
      return;
    }
    if (!dataEmissaoLaudo) {
      toast.error('Selecione a data de emissão do laudo (aparece na assinatura do PDF).');
      return;
    }

    try {
      await initDB().catch(() => {});
      const payload = {
        classificacao_final: classificacao,
        conclusao,
        assinatura: '',
        responsavel_final: responsavelFinal,
        crea_final: creaFinal,
        data_final: dataEmissaoLaudo,
        horario_termino: inspection?.horario_termino || '',
        outro_somente_conclusao: classificacao === 'outro',
        classificacao_escolha_rotulo: '',
      };
      if (!uid) {
        toast.error('Sessão inválida. Inicie sessão novamente.');
        return;
      }

      const result = await inspectionsApi.update(id, payload, uid);
      if (result.ok) {
        toast.success('Vistoria finalizada com sucesso!');
        navigate(`/inspection/${id}`);
        return;
      }
      const local = await getInspectionLocally(id);
      if (local) {
        await saveInspectionLocally({
          ...local,
          ...payload,
          status: 'concluida',
        });
        await enqueueSyncOperation({
          method: 'PUT',
          path: `/inspections/${id}`,
          payload: { ...payload, status: 'concluida' },
          dedupKey: `PUT:/inspections/${id}:finalize`,
          inspectionId: id,
          userId: uid,
        });
        toast.warning(
          'Servidor indisponível — finalização guardada só neste dispositivo.'
        );
        navigate(`/inspection/${id}`);
        return;
      }
      toast.error(result.error || 'Erro ao finalizar vistoria');
    } catch (error) {
      console.error('Erro ao finalizar vistoria:', error);
      toast.error('Erro ao finalizar vistoria');
    }
  };

  const handleBackToChecklist = async () => {
    try {
      await initDB().catch(() => {});
      const partialPayload = {
        classificacao_final: classificacao || null,
        conclusao: conclusao || '',
        assinatura: '',
        responsavel_final: responsavelFinal || '',
        crea_final: creaFinal || '',
        data_final: dataEmissaoLaudo || null,
        horario_termino: inspection?.horario_termino || '',
        outro_somente_conclusao: classificacao === 'outro',
        classificacao_escolha_rotulo: '',
      };
      if (!uid) {
        navigate(`/inspection/${id}/checklist`);
        return;
      }
      const result = await inspectionsApi.update(id, partialPayload, uid);
      if (!result.ok) {
        const local = await getInspectionLocally(id);
        if (local) {
          await saveInspectionLocally({
            ...local,
            ...partialPayload,
          });
          await enqueueSyncOperation({
            method: 'PUT',
            path: `/inspections/${id}`,
            payload: partialPayload,
            dedupKey: `PUT:/inspections/${id}:review_partial`,
            inspectionId: id,
            userId: uid,
          });
        }
      }
    } catch (error) {
      console.error('Erro ao salvar dados parciais:', error);
    }
    navigate(`/inspection/${id}/checklist`);
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
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <BrandLogo className="h-14 w-auto max-w-[11rem] shrink-0 object-contain object-left py-0.5 sm:h-[4.75rem] sm:max-w-[13rem]" />
              <h1 className="text-balance text-xl font-bold font-secondary uppercase tracking-tight sm:text-2xl">
                Conclusão / Observações gerais
              </h1>
            </div>
            <LogoutHeaderButton />
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto md:max-w-2xl px-4 py-6">
        <div className="bg-white rounded-lg shadow-[0_2px_8px_rgba(0,0,0,0.04)] p-6">
          {/* Classificação Final */}
          <div className="mb-6">
            <label className="text-xs font-bold tracking-wider uppercase text-slate-500 mb-2 block">
              Classificação Final do Imóvel *
            </label>
            <p className="text-sm text-slate-600 mb-3 leading-relaxed">
              Selecione a classificação final com base nas condições técnicas observadas durante a
              vistoria.
            </p>
            <div className="space-y-2">
              {CLASSIFICACAO_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  data-testid={`classificacao-${option.value}`}
                  onClick={() => {
                    setClassificacao(option.value);
                    if (option.value === 'outro') {
                      if (conclusaoPareceAutomatica(conclusao)) {
                        setConclusao('');
                      }
                    } else if (conclusaoPareceAutomatica(conclusao)) {
                      setConclusao(TEXTOS_CONCLUSAO[option.value]);
                    }
                  }}
                  className={`w-full py-3 px-3 rounded-lg text-left text-sm leading-snug font-semibold transition-all duration-200 ${
                    classificacao === option.value
                      ? option.color === 'green'
                        ? 'bg-green-600 text-white'
                        : option.color === 'yellow'
                        ? 'bg-yellow-500 text-slate-900'
                        : option.color === 'red'
                        ? 'bg-red-600 text-white'
                        : option.color === 'slate'
                        ? 'bg-slate-500 text-white'
                        : 'bg-slate-100 text-slate-600'
                      : option.value === 'outro'
                      ? 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Corpo do parecer (conclusão) */}
          <div className="mb-6 rounded-lg">
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
              Texto do parecer
            </label>
            <textarea
              data-testid="conclusao-textarea"
              value={conclusao}
              onChange={(e) => setConclusao(e.target.value)}
              placeholder={CONCLUSAO_PLACEHOLDER}
              className="w-full resize-none rounded-lg border border-slate-300 p-4 text-justify leading-relaxed text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={14}
            />
            <button
              type="button"
              data-testid="conclusao-limpar-button"
              onClick={() => setConclusao('')}
              className="mt-2 text-sm font-semibold text-slate-600 underline underline-offset-2 hover:text-slate-900"
            >
              Limpar texto da conclusão
            </button>
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

          <div className="mb-6">
            <label className="text-xs font-bold tracking-wider uppercase text-slate-500 mb-2 block">
              Data de emissão do laudo (assinatura no PDF)
            </label>
            <input
              data-testid="data-emissao-laudo-input"
              type="date"
              value={dataEmissaoLaudo}
              onChange={(e) => setDataEmissaoLaudo(e.target.value)}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
            />
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
    </div>
  );
};

export default InspectionReview;
