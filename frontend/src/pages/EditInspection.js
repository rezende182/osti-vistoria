import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Home, ArrowRight, RefreshCw, Eraser } from 'lucide-react';
import NavigationModal from '../components/NavigationModal';
import { LogoutHeaderButton } from '../components/LogoutHeaderButton';
import { toast } from 'sonner';
import { useAuth } from '@/auth';
import { inspectionsApi } from '../services/api';
import { loadInspectionWithFallback } from '../utils/inspectionLoader';
import TimePickerField from '../components/TimePickerField';
import { BRASIL_UFS } from '../constants/brasilEstados';
import BrandLogo from '@/components/BrandLogo';
import InspectionPdfLogoField from '@/components/InspectionPdfLogoField';
import {
  LAUDO_METODOLOGIA_PRESETS,
  LAUDO_OBJETIVO_PRESETS,
  nextMetodologiaPreset,
  nextObjetivoPreset,
} from '../constants/laudoEntregaTextos';

const SUBTIPO_FLUXO_LABEL = {
  apartamento: 'Entrega de Imóvel',
  area_comum: 'Entrega de Area Comum',
};

function isFilled(v) {
  return v != null && String(v).trim() !== '';
}

function validateIdentificationRequired(fd) {
  return (
    isFilled(fd.cliente) &&
    isFilled(fd.contratante_cpf_cnpj) &&
    isFilled(fd.endereco) &&
    isFilled(fd.cidade) &&
    isFilled(fd.uf) &&
    isFilled(fd.tipo_imovel) &&
    isFilled(fd.responsavel_tecnico) &&
    isFilled(fd.crea) &&
    isFilled(fd.responsavel_cpf_cnpj) &&
    isFilled(fd.data) &&
    isFilled(fd.horario_inicio)
  );
}

function validateEntregaImovel(fd) {
  if (!validateIdentificationRequired(fd)) return false;
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
    <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-600">{text}</h3>
  );
}

const laudoTextareaClass =
  'w-full rounded-lg border border-slate-300 px-4 py-3 text-sm leading-relaxed text-slate-800 text-justify transition-colors placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25';

const EditInspection = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const uid = user?.uid;
  const [showExitModal, setShowExitModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    cliente: '',
    data: '',
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
    imovel_tipologia: '',
    imovel_area: '',
    imovel_numero_pavimentos: '',
    tipo_imovel: 'novo',
    energia_disponivel: '',
    documentos_recebidos: [],
    pdf_logo_data_url: '',
    tipo_vistoria_fluxo: '',
    imovel_categoria: '',
    responsavel_cpf_cnpj: '',
    contratante_cpf_cnpj: '',
  });

  const documentosOptions = [
    'Manual do proprietário',
    'Manual de uso e manutenção',
    'Memorial descritivo',
    'Projeto arquitetônico',
  ];

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
      setFormData({
        cliente: data.cliente || '',
        data: data.data || '',
        endereco: data.endereco || '',
        cidade: data.cidade || '',
        uf: data.uf || '',
        unidade: data.unidade || '',
        empreendimento: data.empreendimento || '',
        construtora: data.construtora || '',
        responsavel_tecnico: data.responsavel_tecnico || '',
        crea: data.crea || '',
        horario_inicio: data.horario_inicio || '',
        horario_termino: data.horario_termino || '',
        responsavel_construtora: data.responsavel_construtora || '',
        laudo_objetivo: data.laudo_objetivo || '',
        laudo_relato_vistoria:
          data.tipo_vistoria_fluxo === 'apartamento' ? '' : data.laudo_relato_vistoria || '',
        laudo_relato_adendo_descricao:
          data.tipo_vistoria_fluxo === 'apartamento' ? '' : data.laudo_relato_adendo_descricao || '',
        laudo_relato_adendo_retrabalho:
          data.tipo_vistoria_fluxo === 'apartamento' ? '' : data.laudo_relato_adendo_retrabalho || '',
        laudo_relato_adendo_impedimento:
          data.tipo_vistoria_fluxo === 'apartamento' ? '' : data.laudo_relato_adendo_impedimento || '',
        laudo_metodologia: data.laudo_metodologia || '',
        imovel_tipologia: data.imovel_tipologia === 'sobrado' ? 'sobrado' : 'terreo',
        imovel_area: data.imovel_area || '',
        imovel_numero_pavimentos: data.imovel_numero_pavimentos || '',
        tipo_imovel: data.tipo_imovel || 'novo',
        energia_disponivel: data.energia_disponivel ?? '',
        documentos_recebidos: data.documentos_recebidos || [],
        pdf_logo_data_url: data.pdf_logo_data_url || '',
        tipo_vistoria_fluxo: data.tipo_vistoria_fluxo || '',
        imovel_categoria:
          data.imovel_categoria === 'casa'
            ? 'casa'
            : data.imovel_categoria === 'apartamento'
              ? 'apartamento'
              : data.tipo_vistoria_fluxo === 'apartamento'
                ? 'apartamento'
                : '',
        responsavel_cpf_cnpj: data.responsavel_cpf_cnpj || '',
        contratante_cpf_cnpj: data.contratante_cpf_cnpj || '',
      });
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

    if (formData.tipo_vistoria_fluxo === 'apartamento') {
      if (!validateEntregaImovel(formData)) {
        toast.error(
          'Preencha os campos obrigatórios: dados do responsável técnico (nome, CREA, CPF), contratante (nome e CPF/CNPJ), imóvel (endereço, cidade, UF, condição), data e horário de início da vistoria, tipo do imóvel (Apartamento, Casa Térrea ou Sobrado), e Apartamento/Bloco quando for apartamento.'
        );
        return;
      }
    } else if (!validateIdentificationRequired(formData)) {
      toast.error(
        'Preencha os campos obrigatórios: responsável técnico (nome, CREA, CPF), contratante (nome e CPF/CNPJ), imóvel (endereço, cidade, UF, condição), data e horário de início da vistoria.'
      );
      return;
    }

    if (!uid) {
      toast.error('Sessão inválida. Inicie sessão novamente.');
      return;
    }

    try {
      const payload = { ...formData };
      if (formData.tipo_vistoria_fluxo === 'apartamento') {
        if (payload.imovel_categoria === 'apartamento') {
          payload.imovel_tipologia = 'terreo';
        }
        payload.imovel_numero_pavimentos = '';
      } else {
        delete payload.imovel_categoria;
      }
      if (payload.imovel_tipologia !== 'terreo' && payload.imovel_tipologia !== 'sobrado') {
        payload.imovel_tipologia = 'terreo';
      }
      payload.pdf_empresa_nome = '';
      payload.pdf_empresa_cnpj = '';
      if (
        formData.tipo_vistoria_fluxo === 'apartamento' ||
        formData.tipo_vistoria_fluxo === 'area_comum'
      ) {
        payload.laudo_relato_vistoria = '';
        payload.laudo_relato_adendo_descricao = '';
        payload.laudo_relato_adendo_retrabalho = '';
        payload.laudo_relato_adendo_impedimento = '';
      }
      const result = await inspectionsApi.updateIdentification(id, payload, uid);
      if (result.ok) {
        toast.success('Informações atualizadas!');
        navigate(`/inspection/${id}/checklist`);
      } else {
        toast.error(result.error || 'Erro ao atualizar vistoria');
      }
    } catch (error) {
      console.error('Erro ao atualizar vistoria:', error);
      toast.error('Erro ao atualizar vistoria');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const isLaudoEntregaFlux =
    formData.tipo_vistoria_fluxo === 'apartamento' ||
    formData.tipo_vistoria_fluxo === 'area_comum';
  const laudoOnlyPage = isLaudoEntregaFlux && location.hash === '#objetivo-metodologia';

  const laudoObjetivoMetodologiaFields = (
    <>
      <div className="mb-8">
        {laudoBlockTitle('Objetivo')}
        <div className="mb-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              setFormData((prev) => ({
                ...prev,
                laudo_objetivo: nextObjetivoPreset(prev.laudo_objetivo),
              }))
            }
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw size={16} />
            Alternar texto
          </button>
          <button
            type="button"
            onClick={() => setFormData((prev) => ({ ...prev, laudo_objetivo: '' }))}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-700 hover:bg-slate-50"
          >
            <Eraser size={16} />
            Limpar
          </button>
        </div>
        <textarea
          name="laudo_objetivo"
          value={formData.laudo_objetivo}
          onChange={handleChange}
          rows={8}
          placeholder={
            LAUDO_OBJETIVO_PRESETS[0]
              ? `${LAUDO_OBJETIVO_PRESETS[0].slice(0, 80)}…`
              : 'Texto do objetivo do laudo…'
          }
          className={laudoTextareaClass}
        />
      </div>

      <div className="mb-8">
        {laudoBlockTitle('Metodologia')}
        <div className="mb-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              setFormData((prev) => ({
                ...prev,
                laudo_metodologia: nextMetodologiaPreset(prev.laudo_metodologia),
              }))
            }
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw size={16} />
            Alternar texto
          </button>
          <button
            type="button"
            onClick={() => setFormData((prev) => ({ ...prev, laudo_metodologia: '' }))}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-700 hover:bg-slate-50"
          >
            <Eraser size={16} />
            Limpar
          </button>
        </div>
        <textarea
          name="laudo_metodologia"
          value={formData.laudo_metodologia}
          onChange={handleChange}
          rows={16}
          placeholder={
            LAUDO_METODOLOGIA_PRESETS[0]
              ? `${LAUDO_METODOLOGIA_PRESETS[0].slice(0, 80).replace(/\s+/g, ' ').trim()}…`
              : 'Texto da metodologia do laudo…'
          }
          className={laudoTextareaClass}
        />
      </div>
    </>
  );

  if (laudoOnlyPage) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 px-4 py-6 text-white">
          <div className="mx-auto max-w-md md:max-w-2xl">
            <button
              data-testid="home-button"
              type="button"
              onClick={() => setShowExitModal(true)}
              className="mb-4 flex items-center gap-2 text-slate-300 transition-colors hover:text-white"
            >
              <Home size={20} />
              Página Inicial
            </button>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 flex-1 items-center gap-4">
                <BrandLogo className="h-16 w-auto max-w-[12rem] shrink-0 object-contain object-left py-1 sm:h-[5.25rem] sm:max-w-[14rem]" />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <h1 className="text-balance text-xl font-bold font-secondary uppercase tracking-tight sm:text-2xl">
                    Objetivo e Metodologia
                  </h1>
                  {formData.tipo_vistoria_fluxo &&
                    SUBTIPO_FLUXO_LABEL[formData.tipo_vistoria_fluxo] && (
                      <p className="w-full text-center text-sm font-bold font-secondary uppercase tracking-wide text-slate-300 sm:text-base">
                        ({SUBTIPO_FLUXO_LABEL[formData.tipo_vistoria_fluxo]})
                      </p>
                    )}
                </div>
              </div>
              <LogoutHeaderButton />
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-md px-4 py-6 md:max-w-2xl">
          <form
            onSubmit={handleSubmit}
            className="min-h-[calc(100dvh-12rem)] rounded-lg bg-white p-6 shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
          >
            {laudoObjetivoMetodologiaFields}
            <button
              type="button"
              onClick={() =>
                navigate({ pathname: `/inspection/${id}/edit`, hash: '' }, { replace: true })
              }
              className="mb-4 w-full rounded-lg border-2 border-slate-300 py-3 font-bold font-secondary uppercase tracking-wide text-slate-700 transition-colors hover:bg-slate-50"
            >
              Voltar à identificação
            </button>
            <button
              data-testid="submit-button"
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-4 text-lg font-bold font-secondary uppercase text-white transition-all duration-200 hover:bg-blue-700 active:scale-95"
            >
              Verificação dos ambientes e não conformidades
              <ArrowRight size={20} />
            </button>
          </form>
        </div>

        <NavigationModal
          isOpen={showExitModal}
          onClose={() => setShowExitModal(false)}
          onConfirm={() => navigate('/')}
          title="Voltar para Início"
          message="Tem certeza que deseja voltar para a página inicial? Os dados não salvos serão perdidos."
        />
      </div>
    );
  }

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
                  Identificação da Vistoria Técnica
                </h1>
                {formData.tipo_vistoria_fluxo &&
                  formData.tipo_vistoria_fluxo !== 'apartamento' &&
                  SUBTIPO_FLUXO_LABEL[formData.tipo_vistoria_fluxo] && (
                    <p className="w-full text-center text-sm font-bold font-secondary uppercase tracking-wide text-slate-300 sm:text-base">
                      ({SUBTIPO_FLUXO_LABEL[formData.tipo_vistoria_fluxo]})
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
          {formData.tipo_vistoria_fluxo === 'apartamento' ? (
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
                  CREA *
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
                  CPF *
                </label>
                <input
                  type="text"
                  name="responsavel_cpf_cnpj"
                  value={formData.responsavel_cpf_cnpj}
                  onChange={handleChange}
                  required
                  placeholder="CPF do responsável técnico"
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoComplete="off"
                />
              </div>

              {sectionTitle('Identificação do contratante')}
              <div className="mb-4">
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Nome do contratante *
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
                  CPF/CNPJ *
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
                  Área do imóvel
                </label>
                <input
                  data-testid="input-imovel-area"
                  type="text"
                  name="imovel_area"
                  value={formData.imovel_area}
                  onChange={handleChange}
                  placeholder="Ex.: 85 m²"
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoComplete="off"
                />
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
                  Condição do imóvel *
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
                  Horário de início *
                </label>
                <TimePickerField
                  data-testid="input-horario-inicio"
                  value={formData.horario_inicio}
                  onChange={(v) => setFormData({ ...formData, horario_inicio: v })}
                  className="w-full max-w-xs rounded-lg border border-slate-300"
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
              {sectionTitle('Identificação do Responsável Técnico')}
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
                  CREA *
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
                  CPF *
                </label>
                <input
                  type="text"
                  name="responsavel_cpf_cnpj"
                  value={formData.responsavel_cpf_cnpj}
                  onChange={handleChange}
                  required
                  placeholder="CPF do responsável técnico"
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoComplete="off"
                />
              </div>

              {sectionTitle('Identificação do contratante')}
              <div className="mb-4">
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Nome do contratante *
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
              <div className="mb-6">
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
                  CPF/CNPJ *
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

              {sectionTitle('Dados do imóvel')}
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
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Tipo do imóvel *
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
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Área do imóvel
                </label>
                <input
                  data-testid="input-imovel-area"
                  type="text"
                  name="imovel_area"
                  value={formData.imovel_area}
                  onChange={handleChange}
                  placeholder="Ex.: 85 m²"
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoComplete="off"
                />
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
                  Condição do imóvel *
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
                  Horário de início *
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
          )}

          {/* Submit Button */}
          <button
            data-testid="submit-button"
            type="submit"
            className="w-full bg-blue-600 text-white py-4 rounded-lg font-bold font-secondary uppercase text-lg transition-all duration-200 hover:bg-blue-700 active:scale-95 flex items-center justify-center gap-2"
          >
            VERIFICAÇÃO DOS AMBIENTES E NÃO CONFORMIDADES
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

export default EditInspection;
