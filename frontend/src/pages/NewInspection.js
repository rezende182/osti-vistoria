import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Home, ArrowRight } from 'lucide-react';
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

const NewInspection = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tipoImovelFluxo = searchParams.get('tipo');
  const { user } = useAuth();
  const uid = user?.uid;
  const [showExitModal, setShowExitModal] = useState(false);
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
    tipo_imovel: 'novo',
    energia_disponivel: 'sim',
    documentos_recebidos: [],
    pdf_logo_data_url: '',
    pdf_empresa_nome: '',
    pdf_empresa_cnpj: '',
  });

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

    if (!formData.cliente || !formData.endereco || !formData.unidade) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    if (!uid) {
      toast.error('Sessão inválida. Inicie sessão novamente.');
      return;
    }

    try {
      await initDB().catch(() => {});
      const result = await inspectionsApi.create(formData, uid);
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
        ...formData,
        pdf_logo_data_url: formData.pdf_logo_data_url || '',
        pdf_empresa_nome: formData.pdf_empresa_nome || '',
        pdf_empresa_cnpj: formData.pdf_empresa_cnpj || '',
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
        payload: { ...formData, userId: uid },
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
                  Identificação da Vistoria Técnica
                </h1>
                {tipoImovelFluxo === 'apartamento' && (
                  <p className="w-full text-center text-sm font-bold font-secondary uppercase tracking-wide text-slate-300 sm:text-base">
                    (Apartamento)
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
          <InspectionPdfLogoField
            value={formData.pdf_logo_data_url}
            onChange={(url) =>
              setFormData((prev) => ({ ...prev, pdf_logo_data_url: url || '' }))
            }
          />

          <div className="mb-6 space-y-4 rounded-lg border border-slate-200 bg-slate-50/90 p-4">
            <p className="text-xs leading-relaxed text-slate-600">
              Campo opcional — preencha apenas se tiver empresa.
            </p>
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
                Nome da empresa (opcional)
              </label>
              <input
                type="text"
                name="pdf_empresa_nome"
                value={formData.pdf_empresa_nome}
                onChange={handleChange}
                placeholder="Ex.: Nome fantasia ou razão social"
                className="w-full rounded-lg border border-slate-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoComplete="organization"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
                CNPJ (opcional)
              </label>
              <input
                type="text"
                name="pdf_empresa_cnpj"
                value={formData.pdf_empresa_cnpj}
                onChange={handleChange}
                placeholder="00.000.000/0000-00"
                className="w-full rounded-lg border border-slate-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoComplete="off"
              />
            </div>
          </div>

          {/* Cliente */}
          <div className="mb-4">
            <label className="text-xs font-bold tracking-wider uppercase text-slate-500 mb-2 block">
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

          {/* Data */}
          <div className="mb-4">
            <label className="text-xs font-bold tracking-wider uppercase text-slate-500 mb-2 block">
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

          {/* Endereço */}
          <div className="mb-4">
            <label className="text-xs font-bold tracking-wider uppercase text-slate-500 mb-2 block">
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
                Cidade
              </label>
              <input
                data-testid="input-cidade"
                type="text"
                name="cidade"
                value={formData.cidade}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs font-bold tracking-wider uppercase text-slate-500 mb-2 block">
                UF
              </label>
              <select
                data-testid="input-uf"
                name="uf"
                value={formData.uf}
                onChange={handleChange}
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

          {/* Apartamento */}
          <div className="mb-4">
            <label className="text-xs font-bold tracking-wider uppercase text-slate-500 mb-2 block">
              Apartamento *
            </label>
            <input
              data-testid="input-unidade"
              type="text"
              name="unidade"
              value={formData.unidade}
              onChange={handleChange}
              required
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Empreendimento */}
          <div className="mb-4">
            <label className="text-xs font-bold tracking-wider uppercase text-slate-500 mb-2 block">
              Empreendimento
            </label>
            <input
              data-testid="input-empreendimento"
              type="text"
              name="empreendimento"
              value={formData.empreendimento}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Construtora */}
          <div className="mb-4">
            <label className="text-xs font-bold tracking-wider uppercase text-slate-500 mb-2 block">
              Construtora
            </label>
            <input
              data-testid="input-construtora"
              type="text"
              name="construtora"
              value={formData.construtora}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Responsável Técnico */}
          <div className="mb-4">
            <label className="text-xs font-bold tracking-wider uppercase text-slate-500 mb-2 block">
              Responsável Técnico
            </label>
            <input
              data-testid="input-responsavel"
              type="text"
              name="responsavel_tecnico"
              value={formData.responsavel_tecnico}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* CREA */}
          <div className="mb-4">
            <label className="text-xs font-bold tracking-wider uppercase text-slate-500 mb-2 block">
              CREA
            </label>
            <input
              data-testid="input-crea"
              type="text"
              name="crea"
              value={formData.crea}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Horário de Início */}
          <div className="mb-4">
            <label className="text-xs font-bold tracking-wider uppercase text-slate-500 mb-2 block">
              Horário de Início
            </label>
            <TimePickerField
              data-testid="input-horario-inicio"
              value={formData.horario_inicio}
              onChange={(v) => setFormData({ ...formData, horario_inicio: v })}
              className="w-full max-w-xs border border-slate-300 rounded-lg"
            />
          </div>

          {/* Tipo do Imóvel */}
          <div className="mb-4">
            <label className="text-xs font-bold tracking-wider uppercase text-slate-500 mb-2 block">
              Tipo do Imóvel
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

          {/* Energia Disponível */}
          <div className="mb-4">
            <label className="text-xs font-bold tracking-wider uppercase text-slate-500 mb-2 block">
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

          {/* Documentos Recebidos */}
          <div className="mb-6">
            <label className="text-xs font-bold tracking-wider uppercase text-slate-500 mb-2 block">
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

          {/* Submit Button */}
          <button
            data-testid="submit-button"
            type="submit"
            className="w-full bg-blue-600 text-white py-4 rounded-lg font-bold font-secondary uppercase text-lg transition-all duration-200 hover:bg-blue-700 active:scale-95 flex items-center justify-center gap-2"
          >
            Iniciar Checklist
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
