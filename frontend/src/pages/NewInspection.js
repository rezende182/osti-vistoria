import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { Home, ArrowRight, RefreshCw, Eraser } from 'lucide-react';
import NavigationModal from '../components/NavigationModal';
import { LogoutHeaderButton } from '../components/LogoutHeaderButton';
import { toast } from 'sonner';
import { useAuth } from '@/auth';
import { inspectionsApi } from '../services/api';
import {
  saveInspectionLocally,
  enqueueSyncOperation,
  initDB,
} from '../utils/offlineStorage';
import TimePickerField from '../components/TimePickerField';
import { BRASIL_UFS } from '../constants/brasilEstados';
import BrandLogo from '@/components/BrandLogo';
import InspectionPdfLogoField from '@/components/InspectionPdfLogoField';
import {
  LAUDO_OBJETIVO_PRESETS,
  RELATO_TEXTO_PLACEHOLDER_TERMINO,
  buildLaudoMetodologiaCompleta,
  buildRelatoVistoriaIntro,
  nextObjetivoPreset,
} from '../constants/laudoEntregaTextos';

/** Subtítulo do header conforme `?tipo=` na URL. */
const SUBTIPO_FLUXO_LABEL = {
  apartamento: 'Entrega de Imóvel',
  area_comum: 'Entrega de Area Comum',
};

function normalizeTipoVistoriaFluxo(raw) {
  if (raw === 'apartamento' || raw === 'area_comum') return raw;
  return null;
}

function isFilled(v) {
  return v != null && String(v).trim() !== '';
}

/** Com HashRouter, `?tipo=` pode vir só no fragmento `#/path?tipo=…` — lê também do hash. */
function getTipoFluxoFromUrl(searchParams, location) {
  const direct = searchParams.get('tipo');
  if (direct) return direct;
  const hash = location.hash || '';
  const qi = hash.indexOf('?');
  if (qi !== -1) {
    return new URLSearchParams(hash.slice(qi)).get('tipo');
  }
  return null;
}

/** Obrigatórios: cliente, data, endereço, cidade, UF, responsável técnico, CREA. */
function validateIdentificationRequired(fd) {
  return (
    isFilled(fd.cliente) &&
    isFilled(fd.data) &&
    isFilled(fd.endereco) &&
    isFilled(fd.cidade) &&
    isFilled(fd.uf) &&
    isFilled(fd.responsavel_tecnico) &&
    isFilled(fd.crea)
  );
}

/** Fluxo Entrega de Imóvel: categoria; Casa → tipologia; Apartamento → unidade obrigatória; CPF/CNPJ contratante. */
function validateEntregaImovel(fd) {
  if (!validateIdentificationRequired(fd)) return false;
  if (!isFilled(fd.contratante_cpf_cnpj)) return false;
  if (!isFilled(fd.imovel_categoria)) return false;
  if (fd.imovel_categoria === 'casa') {
    if (fd.imovel_tipologia !== 'terreo' && fd.imovel_tipologia !== 'sobrado') {
      return false;
    }
  }
  if (fd.imovel_categoria === 'apartamento' && !isFilled(fd.unidade)) {
    return false;
  }
  return true;
}

function sectionTitle(text) {
  return (
    <h2 className="mb-4 border-b border-slate-200 pb-2 text-sm font-bold uppercase tracking-wider text-slate-800">
      {text}
    </h2>
  );
}

function laudoBlockTitle(text) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <span className="h-9 w-1 shrink-0 rounded-full bg-blue-600" aria-hidden />
      <h2 className="text-base font-bold uppercase tracking-wide text-slate-900 sm:text-lg">
        {text}
      </h2>
    </div>
  );
}

const laudoTextareaClass =
  'w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-sm leading-relaxed text-slate-800 shadow-inner shadow-slate-100/80 transition-colors placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25';

const NewInspection = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const tipoImovelFluxo = normalizeTipoVistoriaFluxo(
    getTipoFluxoFromUrl(searchParams, location)
  );
  const subtipoLabel =
    tipoImovelFluxo && SUBTIPO_FLUXO_LABEL[tipoImovelFluxo]
      ? SUBTIPO_FLUXO_LABEL[tipoImovelFluxo]
      : null;
  const { user } = useAuth();
  const uid = user?.uid;
  const [showExitModal, setShowExitModal] = useState(false);
  /** Fluxo Entrega de Imóvel: 1 = identificação, 2 = objetivo / relato / metodologia. */
  const [entregaStep, setEntregaStep] = useState(1);

  const [formData, setFormData] = useState({
    cliente: '',
    data: new Date().toISOString().split('T')[0],
    endereco: '',
    cidade: '',
    uf: '',
    unidade: '',
    empreendimento: '',
    construtora: '',
    responsavel_tecnico: '',
    crea: '',
    horario_inicio: '',
    horario_termino: '',
    responsavel_construtora: '',
    laudo_objetivo: '',
    laudo_relato_vistoria: '',
    laudo_relato_adendo_descricao: '',
    laudo_relato_adendo_retrabalho: '',
    laudo_relato_adendo_impedimento: '',
    laudo_metodologia: '',
    imovel_categoria: '',
    imovel_tipologia: '',
    imovel_numero_pavimentos: '',
    tipo_imovel: 'novo',
    energia_disponivel: 'sim',
    documentos_recebidos: [],
    pdf_logo_data_url: '',
    responsavel_cpf_cnpj: '',
    contratante_cpf_cnpj: '',
  });

  useEffect(() => {
    if (tipoImovelFluxo === 'area_comum') {
      setFormData((prev) => ({
        ...prev,
        unidade: '',
        imovel_categoria: '',
        imovel_tipologia: 'terreo',
        imovel_numero_pavimentos: '',
      }));
    }
  }, [tipoImovelFluxo]);

  useEffect(() => {
    if (tipoImovelFluxo !== 'apartamento' || entregaStep !== 2) return;
    setFormData((prev) => {
      const next = { ...prev };
      let changed = false;
      if (!String(prev.laudo_objetivo || '').trim()) {
        next.laudo_objetivo = LAUDO_OBJETIVO_PRESETS[0];
        changed = true;
      }
      if (!String(prev.laudo_relato_vistoria || '').trim()) {
        next.laudo_relato_vistoria = buildRelatoVistoriaIntro(prev);
        changed = true;
      }
      if (!String(prev.laudo_metodologia || '').trim()) {
        next.laudo_metodologia = buildLaudoMetodologiaCompleta(
          prev.documentos_recebidos || []
        );
        changed = true;
      }
      return changed ? next : prev;
    });
  }, [tipoImovelFluxo, entregaStep]);

  const documentosOptions = [
    'Manual do proprietário',
    'Manual de uso e manutenção',
    'Memorial descritivo',
    'Projeto arquitetônico',
  ];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleDocumentToggle = (doc) => {
    const isSelected = formData.documentos_recebidos.includes(doc);
    setFormData({
      ...formData,
      documentos_recebidos: isSelected
        ? formData.documentos_recebidos.filter((d) => d !== doc)
        : [...formData.documentos_recebidos, doc]
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (tipoImovelFluxo === 'apartamento' && entregaStep === 1) {
      if (!validateEntregaImovel(formData)) {
        toast.error(
          'Preencha os campos obrigatórios: CPF/CNPJ do contratante, tipo do imóvel (Apartamento, Casa Térrea ou Sobrado), e Apartamento/Bloco quando for apartamento.'
        );
        return;
      }
      setEntregaStep(2);
      window.scrollTo(0, 0);
      return;
    }

    if (tipoImovelFluxo === 'apartamento') {
      if (!validateEntregaImovel(formData)) {
        toast.error(
          'Preencha os campos obrigatórios: CPF/CNPJ do contratante, tipo do imóvel (Apartamento, Casa Térrea ou Sobrado), e Apartamento/Bloco quando for apartamento.'
        );
        return;
      }
    } else if (!validateIdentificationRequired(formData)) {
      toast.error(
        'Preencha os campos obrigatórios: cliente, data, endereço, cidade, UF, responsável técnico e CREA.'
      );
      return;
    }

    if (!uid) {
      toast.error('Sessão inválida. Inicie sessão novamente.');
      return;
    }

    const payload = { ...formData };
    if (tipoImovelFluxo === 'apartamento') {
      payload.tipo_vistoria_fluxo = 'apartamento';
      if (payload.imovel_categoria === 'apartamento') {
        payload.imovel_tipologia = 'terreo';
      }
      payload.imovel_numero_pavimentos = '';
    } else if (tipoImovelFluxo === 'area_comum') {
      payload.tipo_vistoria_fluxo = 'area_comum';
      delete payload.imovel_categoria;
      if (payload.imovel_tipologia !== 'terreo' && payload.imovel_tipologia !== 'sobrado') {
        payload.imovel_tipologia = 'terreo';
      }
    } else {
      delete payload.tipo_vistoria_fluxo;
      delete payload.imovel_categoria;
    }
    if (payload.imovel_tipologia !== 'terreo' && payload.imovel_tipologia !== 'sobrado') {
      payload.imovel_tipologia = 'terreo';
    }
    payload.pdf_empresa_nome = '';
    payload.pdf_empresa_cnpj = '';

    try {
      await initDB().catch(() => {});
      const result = await inspectionsApi.create(payload, uid);
      if (result.ok) {
        toast.success('Vistoria criada com sucesso!');
        navigate(`/inspection/${result.data.id}/checklist`);
        return;
      }

      const id =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `local-${Date.now()}`;
      const offlineInspection = {
        id,
        userId: uid,
        ...payload,
        pdf_logo_data_url: formData.pdf_logo_data_url || '',
        pdf_empresa_nome: '',
        pdf_empresa_cnpj: '',
        horario_termino: '',
        rooms_checklist: [],
        documentos_recebidos: formData.documentos_recebidos || [],
        status: 'em_andamento',
        created_at: new Date().toISOString(),
      };
      await saveInspectionLocally(offlineInspection);
      await enqueueSyncOperation({
        method: 'POST',
        path: '/inspections',
        payload: { ...payload, userId: uid },
        dedupKey: `POST:/inspections:local:${id}`,
        localInspectionId: id,
        userId: uid,
      });
      toast.warning(
        `Servidor indisponível: ${result.error || 'erro'}. Rascunho guardado neste dispositivo.`
      );
      navigate(`/inspection/${id}/checklist`);
    } catch (error) {
      console.error('Erro ao criar vistoria:', error);
      toast.error('Erro ao criar vistoria');
    }
  };

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
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-1 items-center gap-4">
              <BrandLogo className="h-16 w-auto max-w-[12rem] shrink-0 object-contain object-left py-1 sm:h-[5.25rem] sm:max-w-[14rem]" />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <h1 className="text-balance text-xl font-bold font-secondary uppercase tracking-tight sm:text-2xl">
                  {tipoImovelFluxo === 'apartamento' && entregaStep === 2
                    ? 'Objetivo, Relato da Vistoria e Metodologia'
                    : 'Identificação da Vistoria Técnica'}
                </h1>
                {subtipoLabel && (
                  <p className="w-full text-center text-sm font-bold font-secondary uppercase tracking-wide text-slate-300 sm:text-base">
                    ({subtipoLabel})
                  </p>
                )}
              </div>
            </div>
            <LogoutHeaderButton />
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-md mx-auto md:max-w-2xl px-4 py-6">
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-[0_2px_8px_rgba(0,0,0,0.04)] p-6">
          {tipoImovelFluxo === 'apartamento' && entregaStep === 2 ? (
            <>
              <div className="mb-8 rounded-2xl border border-slate-200/90 bg-gradient-to-b from-slate-50/90 to-white p-5 shadow-sm sm:p-6">
                {laudoBlockTitle('Objetivo')}
                <div className="mb-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    data-testid="laudo-objetivo-alternar"
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        laudo_objetivo: nextObjetivoPreset(prev.laudo_objetivo),
                      }))
                    }
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold uppercase tracking-wider text-slate-700 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50"
                  >
                    <RefreshCw size={16} />
                    Alternar texto
                  </button>
                  <button
                    type="button"
                    data-testid="laudo-objetivo-limpar"
                    onClick={() => setFormData((prev) => ({ ...prev, laudo_objetivo: '' }))}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold uppercase tracking-wider text-slate-700 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50"
                  >
                    <Eraser size={16} />
                    Limpar
                  </button>
                </div>
                <textarea
                  name="laudo_objetivo"
                  data-testid="textarea-laudo-objetivo"
                  value={formData.laudo_objetivo}
                  onChange={handleChange}
                  rows={10}
                  className={laudoTextareaClass}
                />
              </div>

              <div className="mb-8 rounded-2xl border border-slate-200/90 bg-gradient-to-b from-slate-50/90 to-white p-5 shadow-sm sm:p-6">
                {laudoBlockTitle('Relato da vistoria')}
                <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50/90 p-4 text-sm leading-relaxed text-slate-600">
                  <p className="mb-3 text-slate-700">
                    O texto principal do relato pode ser editado livremente. Além dele, você pode
                    complementar o relato com os campos logo abaixo, quando fizer sentido:
                  </p>
                  <ul className="mb-4 list-disc space-y-2 pl-5 marker:text-slate-400">
                    <li>descrever como foi a vistoria;</li>
                    <li>informar se algum item foi retrabalhado durante a vistoria;</li>
                    <li>informar se houve algum impedimento à sua inspeção.</li>
                  </ul>
                  <p className="rounded-lg border border-amber-200/80 bg-amber-50/90 px-3 py-2.5 text-xs leading-snug text-amber-950">
                    No texto principal, o horário de término aparece como{' '}
                    <span className="font-semibold">{RELATO_TEXTO_PLACEHOLDER_TERMINO}</span> até você
                    preencher o <strong>Horário de término</strong> na finalização do laudo (etapa de
                    conclusão da vistoria). Depois disso, esse horário passa a aparecer automaticamente
                    no texto do relato no PDF.
                  </p>
                </div>
                <textarea
                  name="laudo_relato_vistoria"
                  data-testid="textarea-laudo-relato"
                  value={formData.laudo_relato_vistoria}
                  onChange={handleChange}
                  rows={6}
                  className={`${laudoTextareaClass} mb-5`}
                />
                <div className="space-y-4">
                  <textarea
                    name="laudo_relato_adendo_descricao"
                    data-testid="textarea-relato-adendo-descricao"
                    value={formData.laudo_relato_adendo_descricao}
                    onChange={handleChange}
                    rows={3}
                    placeholder="Complementos sobre o andamento da vistoria…"
                    className={laudoTextareaClass}
                  />
                  <textarea
                    name="laudo_relato_adendo_retrabalho"
                    data-testid="textarea-relato-adendo-retrabalho"
                    value={formData.laudo_relato_adendo_retrabalho}
                    onChange={handleChange}
                    rows={3}
                    placeholder="Retrabalhos ocorridos durante a vistoria, se houver…"
                    className={laudoTextareaClass}
                  />
                  <textarea
                    name="laudo_relato_adendo_impedimento"
                    data-testid="textarea-relato-adendo-impedimento"
                    value={formData.laudo_relato_adendo_impedimento}
                    onChange={handleChange}
                    rows={3}
                    placeholder="Impedimentos à inspeção, se houver…"
                    className={laudoTextareaClass}
                  />
                </div>
              </div>

              <div className="mb-6 rounded-2xl border border-slate-200/90 bg-gradient-to-b from-slate-50/90 to-white p-5 shadow-sm sm:p-6">
                {laudoBlockTitle('Metodologia')}
                <p className="mb-4 text-sm leading-relaxed text-slate-600">
                  O trecho inicial lista os documentos recebidos e as NBRs de referência; você pode editar
                  todo o texto livremente.
                </p>
                <textarea
                  name="laudo_metodologia"
                  data-testid="textarea-laudo-metodologia"
                  value={formData.laudo_metodologia}
                  onChange={handleChange}
                  rows={18}
                  className={laudoTextareaClass}
                />
              </div>

              <button
                type="button"
                data-testid="entrega-voltar-identificacao"
                onClick={() => {
                  setEntregaStep(1);
                  window.scrollTo(0, 0);
                }}
                className="mb-4 w-full rounded-lg border-2 border-slate-300 py-3 font-bold font-secondary uppercase tracking-wide text-slate-700 transition-colors hover:bg-slate-50"
              >
                Voltar à identificação
              </button>
            </>
          ) : tipoImovelFluxo === 'apartamento' ? (
            <>
              {sectionTitle('Identificação do Responsável Técnico')}
              <div className="mb-6">
                <InspectionPdfLogoField
                  value={formData.pdf_logo_data_url}
                  onChange={(url) =>
                    setFormData((prev) => ({ ...prev, pdf_logo_data_url: url || '' }))
                  }
                />
              </div>
              <div className="mb-4">
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Nome do Responsável Técnico *
                </label>
                <input
                  data-testid="input-responsavel"
                  type="text"
                  name="responsavel_tecnico"
                  value={formData.responsavel_tecnico}
                  onChange={handleChange}
                  required
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="mb-4">
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
                  CREA / CAU *
                </label>
                <input
                  data-testid="input-crea"
                  type="text"
                  name="crea"
                  value={formData.crea}
                  onChange={handleChange}
                  required
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="mb-6">
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
                  CPF / CNPJ
                </label>
                <input
                  type="text"
                  name="responsavel_cpf_cnpj"
                  value={formData.responsavel_cpf_cnpj}
                  onChange={handleChange}
                  placeholder="CPF ou CNPJ do responsável técnico"
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoComplete="off"
                />
              </div>

              {sectionTitle('Identificação do contratante')}
              <div className="mb-4">
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Nome *
                </label>
                <input
                  data-testid="input-cliente"
                  type="text"
                  name="cliente"
                  value={formData.cliente}
                  onChange={handleChange}
                  required
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="mb-4">
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
                  CPF / CNPJ *
                </label>
                <input
                  data-testid="input-contratante-cpf-cnpj"
                  type="text"
                  name="contratante_cpf_cnpj"
                  value={formData.contratante_cpf_cnpj}
                  onChange={handleChange}
                  required
                  placeholder="CPF ou CNPJ do contratante"
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoComplete="off"
                />
              </div>

              {sectionTitle('Dados do Imóvel')}
              <div className="mb-6 rounded-lg border border-slate-200 bg-slate-50/90 p-4">
              <div className="mb-4">
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Tipo do Imóvel *
                </label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {[
                    {
                      categoria: 'apartamento',
                      tipologia: 'terreo',
                      label: 'Apartamento',
                      testid: 'tipo-imovel-apartamento',
                    },
                    {
                      categoria: 'casa',
                      tipologia: 'terreo',
                      label: 'Casa Térrea',
                      testid: 'tipo-imovel-casa-terrea',
                    },
                    {
                      categoria: 'casa',
                      tipologia: 'sobrado',
                      label: 'Sobrado',
                      testid: 'tipo-imovel-sobrado',
                    },
                  ].map(({ categoria, tipologia, label, testid }) => {
                    const sel =
                      formData.imovel_categoria === categoria &&
                      formData.imovel_tipologia === tipologia;
                    return (
                      <button
                        key={testid}
                        type="button"
                        data-testid={testid}
                        onClick={() => {
                          setFormData((prev) => ({
                            ...prev,
                            imovel_categoria: categoria,
                            imovel_tipologia: tipologia,
                            unidade: categoria === 'apartamento' ? prev.unidade : '',
                          }));
                        }}
                        className={`rounded-lg py-3 px-3 text-sm font-semibold transition-all duration-200 sm:text-base ${
                          sel
                            ? 'bg-slate-900 text-white shadow-md'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="mb-4">
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Endereço *
                </label>
                <input
                  data-testid="input-endereco"
                  type="text"
                  name="endereco"
                  value={formData.endereco}
                  onChange={handleChange}
                  required
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {formData.imovel_categoria === 'apartamento' && (
                <div className="mb-4">
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
                    Apartamento / Bloco *
                  </label>
                  <input
                    data-testid="input-unidade"
                    type="text"
                    name="unidade"
                    value={formData.unidade}
                    onChange={handleChange}
                    required
                    placeholder="Ex.: Torre A, apto 101"
                    className="w-full rounded-lg border border-slate-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
              <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
                    Cidade *
                  </label>
                  <input
                    data-testid="input-cidade"
                    type="text"
                    name="cidade"
                    value={formData.cidade}
                    onChange={handleChange}
                    required
                    className="w-full rounded-lg border border-slate-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
                    UF *
                  </label>
                  <select
                    data-testid="input-uf"
                    name="uf"
                    value={formData.uf}
                    onChange={handleChange}
                    required
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Selecione</option>
                    {BRASIL_UFS.map(({ uf, nome }) => (
                      <option key={uf} value={uf}>
                        {uf} — {nome}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mb-4">
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                  Empreendimento/Construtora (opcional)
                </p>
                <input
                  data-testid="input-empreendimento"
                  type="text"
                  name="empreendimento"
                  value={formData.empreendimento}
                  onChange={handleChange}
                  placeholder="Empreendimento"
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  data-testid="input-construtora"
                  type="text"
                  name="construtora"
                  value={formData.construtora}
                  onChange={handleChange}
                  placeholder="Construtora"
                  className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="mb-4">
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Condição do imóvel
                </label>
                <div className="flex gap-2">
                  {['novo', 'usado', 'reformado'].map((tipo) => (
                    <button
                      key={tipo}
                      type="button"
                      data-testid={`tipo-${tipo}`}
                      onClick={() => setFormData({ ...formData, tipo_imovel: tipo })}
                      className={`flex-1 rounded-lg py-2 px-4 font-semibold transition-all duration-200 ${
                        formData.tipo_imovel === tipo
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {tipo.charAt(0).toUpperCase() + tipo.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mb-6">
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Energia disponível
                </label>
                <div className="flex gap-2">
                  {['sim', 'nao'].map((opcao) => (
                    <button
                      key={opcao}
                      type="button"
                      data-testid={`energia-${opcao}`}
                      onClick={() => setFormData({ ...formData, energia_disponivel: opcao })}
                      className={`flex-1 rounded-lg py-2 px-4 font-semibold transition-all duration-200 ${
                        formData.energia_disponivel === opcao
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {opcao === 'sim' ? 'Sim' : 'Não'}
                    </button>
                  ))}
                </div>
              </div>
              </div>

              {sectionTitle('Identificação da vistoria')}
              <div className="mb-4">
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Data da vistoria *
                </label>
                <input
                  data-testid="input-data"
                  type="date"
                  name="data"
                  value={formData.data}
                  onChange={handleChange}
                  required
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="mb-4">
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Responsável da Construtora (quem acompanhou a vistoria)
                </label>
                <input
                  data-testid="input-responsavel-construtora"
                  type="text"
                  name="responsavel_construtora"
                  value={formData.responsavel_construtora}
                  onChange={handleChange}
                  placeholder="Nome do representante da construtora (opcional)"
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoComplete="off"
                />
              </div>
              <div className="mb-4">
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Horário de início
                </label>
                <TimePickerField
                  data-testid="input-horario-inicio"
                  value={formData.horario_inicio}
                  onChange={(v) => setFormData({ ...formData, horario_inicio: v })}
                  className="w-full max-w-xs rounded-lg border border-slate-300"
                />
              </div>
              <div className="mb-6">
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Documentos recebidos
                </label>
                <div className="space-y-2">
                  {documentosOptions.map((doc) => (
                    <label key={doc} className="flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        data-testid={`doc-${doc}`}
                        checked={formData.documentos_recebidos.includes(doc)}
                        onChange={() => handleDocumentToggle(doc)}
                        className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-slate-700">{doc}</span>
                    </label>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              <InspectionPdfLogoField
                value={formData.pdf_logo_data_url}
                onChange={(url) =>
                  setFormData((prev) => ({ ...prev, pdf_logo_data_url: url || '' }))
                }
              />
              <div className="mb-4">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 block">
                  Cliente *
                </label>
                <input
                  data-testid="input-cliente"
                  type="text"
                  name="cliente"
                  value={formData.cliente}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="mb-4">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 block">
                  Data *
                </label>
                <input
                  data-testid="input-data"
                  type="date"
                  name="data"
                  value={formData.data}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="mb-4">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 block">
                  Endereço *
                </label>
                <input
                  data-testid="input-endereco"
                  type="text"
                  name="endereco"
                  value={formData.endereco}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-xs font-bold tracking-wider uppercase text-slate-500 mb-2 block">
                    Cidade *
                  </label>
                  <input
                    data-testid="input-cidade"
                    type="text"
                    name="cidade"
                    value={formData.cidade}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold tracking-wider uppercase text-slate-500 mb-2 block">
                    UF *
                  </label>
                  <select
                    data-testid="input-uf"
                    name="uf"
                    value={formData.uf}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">Selecione</option>
                    {BRASIL_UFS.map(({ uf, nome }) => (
                      <option key={uf} value={uf}>
                        {uf} — {nome}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mb-4">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 block">
                  Tipo do Imóvel *
                </label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {[
                    { id: 'terreo', label: 'Casa Térrea', testid: 'tipo-imovel-casa-terrea' },
                    { id: 'sobrado', label: 'Sobrado', testid: 'tipo-imovel-sobrado' },
                  ].map(({ id, label, testid }) => (
                    <button
                      key={id}
                      type="button"
                      data-testid={testid}
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          imovel_tipologia: id,
                        }))
                      }
                      className={`rounded-lg py-3 px-4 text-sm font-semibold transition-all duration-200 ${
                        formData.imovel_tipologia === id
                          ? 'bg-slate-900 text-white shadow-md'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mb-4">
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                  Empreendimento/Construtora (opcional)
                </p>
                <input
                  data-testid="input-empreendimento"
                  type="text"
                  name="empreendimento"
                  value={formData.empreendimento}
                  onChange={handleChange}
                  placeholder="Empreendimento"
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  data-testid="input-construtora"
                  type="text"
                  name="construtora"
                  value={formData.construtora}
                  onChange={handleChange}
                  placeholder="Construtora"
                  className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="mb-4">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 block">
                  Responsável Técnico *
                </label>
                <input
                  data-testid="input-responsavel"
                  type="text"
                  name="responsavel_tecnico"
                  value={formData.responsavel_tecnico}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="mb-4">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 block">
                  CREA / CAU *
                </label>
                <input
                  data-testid="input-crea"
                  type="text"
                  name="crea"
                  value={formData.crea}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="mb-4">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 block">
                  CPF / CNPJ
                </label>
                <input
                  type="text"
                  name="responsavel_cpf_cnpj"
                  value={formData.responsavel_cpf_cnpj}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoComplete="off"
                />
              </div>
              <div className="mb-4">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 block">
                  Horário de Início
                </label>
                <TimePickerField
                  data-testid="input-horario-inicio"
                  value={formData.horario_inicio}
                  onChange={(v) => setFormData({ ...formData, horario_inicio: v })}
                  className="w-full max-w-xs border border-slate-300 rounded-lg"
                />
              </div>
              <div className="mb-4">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 block">
                  Condição do imóvel
                </label>
                <div className="flex gap-2">
                  {['novo', 'usado', 'reformado'].map((tipo) => (
                    <button
                      key={tipo}
                      type="button"
                      data-testid={`tipo-${tipo}`}
                      onClick={() => setFormData({ ...formData, tipo_imovel: tipo })}
                      className={`flex-1 py-2 px-4 rounded-lg font-semibold transition-all duration-200 ${
                        formData.tipo_imovel === tipo
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {tipo.charAt(0).toUpperCase() + tipo.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mb-4">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 block">
                  Energia Disponível
                </label>
                <div className="flex gap-2">
                  {['sim', 'nao'].map((opcao) => (
                    <button
                      key={opcao}
                      type="button"
                      data-testid={`energia-${opcao}`}
                      onClick={() => setFormData({ ...formData, energia_disponivel: opcao })}
                      className={`flex-1 py-2 px-4 rounded-lg font-semibold transition-all duration-200 ${
                        formData.energia_disponivel === opcao
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {opcao === 'sim' ? 'Sim' : 'Não'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mb-6">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 block">
                  Documentos Recebidos
                </label>
                <div className="space-y-2">
                  {documentosOptions.map((doc) => (
                    <label key={doc} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        data-testid={`doc-${doc}`}
                        checked={formData.documentos_recebidos.includes(doc)}
                        onChange={() => handleDocumentToggle(doc)}
                        className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-slate-700">{doc}</span>
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Submit Button */}
          <button
            data-testid="submit-button"
            type="submit"
            className="w-full bg-blue-600 text-white py-4 rounded-lg font-bold font-secondary uppercase text-lg transition-all duration-200 hover:bg-blue-700 active:scale-95 flex items-center justify-center gap-2"
          >
            {tipoImovelFluxo === 'apartamento' && entregaStep === 1
              ? 'Salvar e continuar'
              : 'Iniciar Checklist'}
            <ArrowRight size={20} />
          </button>
        </form>
      </div>

      {/* Navigation Modal */}
      <NavigationModal
        isOpen={showExitModal}
        onClose={() => setShowExitModal(false)}
        onConfirm={() => navigate('/')}
        title="Voltar para Início"
        message="Tem certeza que deseja voltar para a página inicial? Os dados não salvos serão perdidos."
      />
    </div>
  );
};

export default NewInspection;
