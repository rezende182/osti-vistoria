import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import TimePickerField from '../components/TimePickerField';
import { LogoutHeaderButton } from '../components/LogoutHeaderButton';
import { toast } from 'sonner';
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
const LOGO_URL = 'https://customer-assets.emergentagent.com/job_vistoria-imovel-1/artifacts/msx2fmcu_Design%20sem%20nome-Photoroom.png';

const LEGAL_TEXT =
  'A vistoria foi realizada nas condições disponíveis no momento da inspeção, podendo limitações como ausência de energia, água, gás, iluminação ou acesso restringir a execução de testes.\n\n' +
  'Eventuais falhas não identificadas e manifestadas posteriormente caracterizam-se como vícios não aparentes à época da vistoria, devendo ser tratadas conforme garantias aplicáveis.';

const CLASSIFICACAO_OPTIONS = [
  { value: 'aprovado', label: CLASSIFICACAO_FINAL_LABELS.aprovado, color: 'green' },
  { value: 'aprovado_com_ressalvas', label: CLASSIFICACAO_FINAL_LABELS.aprovado_com_ressalvas, color: 'yellow' },
  { value: 'reprovado', label: CLASSIFICACAO_FINAL_LABELS.reprovado, color: 'red' },
  { value: 'outro', label: CLASSIFICACAO_FINAL_LABELS.outro, color: 'slate' },
];

const InspectionReview = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [inspection, setInspection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [classificacao, setClassificacao] = useState('');
  const [conclusao, setConclusao] = useState('');
  const [responsavelFinal, setResponsavelFinal] = useState('');
  const [creaFinal, setCreaFinal] = useState('');
  const [horarioTermino, setHorarioTermino] = useState('');
  const [outroSomenteConclusao, setOutroSomenteConclusao] = useState(false);
  const [classificacaoEscolhaRotulo, setClassificacaoEscolhaRotulo] = useState('');

  const loadInspection = useCallback(async () => {
    try {
      const res = await loadInspectionWithFallback(id);
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
      setHorarioTermino(data.horario_termino || '');
      setOutroSomenteConclusao(!!data.outro_somente_conclusao);
      setClassificacaoEscolhaRotulo(data.classificacao_escolha_rotulo || '');
    } catch (error) {
      console.error('Erro ao carregar vistoria:', error);
      toast.error('Erro ao carregar vistoria');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadInspection();
  }, [loadInspection]);

  const handleFinalize = async () => {
    if (!classificacao) {
      toast.error('Selecione a classificação final do imóvel');
      return;
    }
    if (
      classificacao === 'outro' &&
      !outroSomenteConclusao &&
      !String(classificacaoEscolhaRotulo).trim()
    ) {
      toast.error(
        'Em Outros, preencha a classificação personalizada ou selecione “não quero nenhuma definição”.'
      );
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
        horario_termino: horarioTermino,
        outro_somente_conclusao:
          classificacao === 'outro' ? outroSomenteConclusao : false,
        classificacao_escolha_rotulo:
          classificacao === 'outro' && !outroSomenteConclusao
            ? classificacaoEscolhaRotulo
            : '',
      };
      const result = await inspectionsApi.update(id, payload);
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

  // Salvar dados parciais ao voltar ao checklist
  const handleBackToChecklist = async () => {
    try {
      await initDB().catch(() => {});
      const result = await inspectionsApi.update(id, {
        classificacao_final: classificacao || null,
        conclusao: conclusao || '',
        assinatura: '',
        responsavel_final: responsavelFinal || '',
        crea_final: creaFinal || '',
        horario_termino: horarioTermino || '',
        outro_somente_conclusao:
          classificacao === 'outro' ? outroSomenteConclusao : false,
        classificacao_escolha_rotulo:
          classificacao === 'outro' && !outroSomenteConclusao
            ? classificacaoEscolhaRotulo
            : '',
      });
      if (!result.ok) {
        const local = await getInspectionLocally(id);
        if (local) {
          await saveInspectionLocally({
            ...local,
            classificacao_final: classificacao || null,
            conclusao: conclusao || '',
            assinatura: '',
            responsavel_final: responsavelFinal || '',
            crea_final: creaFinal || '',
            horario_termino: horarioTermino || '',
            outro_somente_conclusao:
              classificacao === 'outro' ? outroSomenteConclusao : false,
            classificacao_escolha_rotulo:
              classificacao === 'outro' && !outroSomenteConclusao
                ? classificacaoEscolhaRotulo
                : '',
          });
          await enqueueSyncOperation({
            method: 'PUT',
            path: `/inspections/${id}`,
            payload: {
              classificacao_final: classificacao || null,
              conclusao: conclusao || '',
              assinatura: '',
              responsavel_final: responsavelFinal || '',
              crea_final: creaFinal || '',
              horario_termino: horarioTermino || '',
              outro_somente_conclusao:
                classificacao === 'outro' ? outroSomenteConclusao : false,
              classificacao_escolha_rotulo:
                classificacao === 'outro' && !outroSomenteConclusao
                  ? classificacaoEscolhaRotulo
                  : '',
            },
            dedupKey: `PUT:/inspections/${id}:review_partial`,
            inspectionId: id,
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
              <img src={LOGO_URL} alt="OSTI Engenharia" className="h-10 w-auto shrink-0" />
              <h1 className="text-balance text-xl font-bold font-secondary uppercase tracking-tight sm:text-2xl">
                Finalização da Vistoria
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
                      setOutroSomenteConclusao(false);
                      setClassificacaoEscolhaRotulo('');
                      if (conclusaoPareceAutomatica(conclusao)) setConclusao('');
                    } else {
                      setOutroSomenteConclusao(false);
                      setClassificacaoEscolhaRotulo('');
                      if (conclusaoPareceAutomatica(conclusao)) {
                        setConclusao(TEXTOS_CONCLUSAO[option.value]);
                      }
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

          {classificacao === 'outro' && (
            <div className="mb-4">
              <label className="text-xs font-bold tracking-wider uppercase text-slate-500 mb-2 block">
                OUTROS
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  data-testid="outro-modo-personalizada"
                  onClick={() => {
                    setOutroSomenteConclusao(false);
                  }}
                  className={`rounded-lg px-3 py-3 text-left text-sm font-semibold leading-snug transition-all border-2 ${
                    !outroSomenteConclusao
                      ? 'border-blue-600 bg-blue-50 text-slate-900'
                      : 'border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Utilize quando a análise do imóvel não se enquadrar nas classificações pré-definidas.
                </button>
                <button
                  type="button"
                  data-testid="outro-modo-so-conclusao"
                  onClick={() => {
                    setOutroSomenteConclusao(true);
                    setClassificacaoEscolhaRotulo('');
                  }}
                  className={`rounded-lg px-3 py-3 text-left text-sm font-semibold leading-snug transition-all border-2 ${
                    outroSomenteConclusao
                      ? 'border-blue-600 bg-blue-50 text-slate-900'
                      : 'border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Não quero nenhuma definição para a classificação do imóvel
                  <span className="mt-1 block text-xs font-normal text-slate-600">
                    No laudo não aparece classificação; apenas a conclusão.
                  </span>
                </button>
              </div>
            </div>
          )}

          {classificacao === 'outro' && !outroSomenteConclusao && (
            <div className="mb-4">
              <label className="text-xs font-bold tracking-wider uppercase text-slate-500 mb-2 block">
                CLASSIFICAÇÃO FINAL PERSONALIZADA:
              </label>
              <textarea
                data-testid="classificacao-escolha-rotulo"
                value={classificacaoEscolhaRotulo}
                onChange={(e) => setClassificacaoEscolhaRotulo(e.target.value)}
                placeholder="Ex. Aprovado com Ressalvas"
                className="w-full p-4 border-2 border-slate-400 bg-slate-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 font-semibold"
                rows={3}
              />
            </div>
          )}

          {/* Conclusão */}
          <div
            className={`mb-6 rounded-lg ${
              classificacao === 'outro'
                ? 'border-2 border-dashed border-slate-400 bg-slate-100 p-3'
                : ''
            }`}
          >
            <label className="text-xs font-bold tracking-wider uppercase text-slate-500 mb-2 block">
              {classificacao === 'outro'
                ? outroSomenteConclusao
                  ? 'Conclusão'
                  : 'Conclusão / observações'
                : 'Conclusão / Observações Gerais'}
            </label>
            {classificacao === 'outro' && !outroSomenteConclusao && (
              <p className="text-xs text-slate-600 mb-2 leading-relaxed">
                Texto adicional que aparece abaixo da classificação no laudo (opcional).
              </p>
            )}
            {classificacao === 'outro' && outroSomenteConclusao && (
              <p className="text-xs text-slate-600 mb-2 leading-relaxed">
                O texto abaixo é a única parte da secção 4 no laudo (sem classificação).
              </p>
            )}
            <textarea
              data-testid="conclusao-textarea"
              value={conclusao}
              onChange={(e) => setConclusao(e.target.value)}
              placeholder={
                classificacao === 'outro'
                  ? outroSomenteConclusao
                    ? 'Informe a conclusão técnica da vistoria.'
                    : 'Observações e conclusão complementar (opcional).'
                  : 'Digite suas observações finais sobre a vistoria...'
              }
              className={`w-full p-4 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                classificacao === 'outro'
                  ? 'border-2 border-dashed border-slate-400 bg-white'
                  : 'border border-slate-300'
              }`}
              rows={classificacao === 'outro' ? 7 : 5}
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

          {/* Considerações finais e aspectos legais */}
          <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
            <p className="text-xs font-bold tracking-wider text-slate-500 mb-2">
              CONSIDERAÇÕES FINAIS E ASPECTOS LEGAIS
            </p>
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
              <TimePickerField
                data-testid="horario-termino-input"
                value={horarioTermino}
                onChange={setHorarioTermino}
                className="w-full border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <p className="mb-6 text-xs text-slate-500">
            Cidade, UF e data do laudo vêm da identificação da vistoria técnica; a linha por extenso na assinatura do PDF é gerada automaticamente.
          </p>

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
