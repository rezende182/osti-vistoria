import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, ArrowRight } from 'lucide-react';
import NavigationModal from '../components/NavigationModal';
import { toast } from 'sonner';
import { inspectionsApi } from '../services/api';
import {
  saveInspectionLocally,
  enqueueSyncOperation,
  initDB,
} from '../utils/offlineStorage';
const LOGO_URL = 'https://customer-assets.emergentagent.com/job_vistoria-imovel-1/artifacts/msx2fmcu_Design%20sem%20nome-Photoroom.png';

const NewInspection = () => {
  const navigate = useNavigate();
  const [showExitModal, setShowExitModal] = useState(false);
  const [formData, setFormData] = useState({
    cliente: '',
    data: new Date().toISOString().split('T')[0],
    endereco: '',
    unidade: '',
    empreendimento: '',
    construtora: '',
    responsavel_tecnico: '',
    crea: '',
    horario_inicio: '',
    tipo_imovel: 'novo',
    energia_disponivel: 'sim',
    documentos_recebidos: []
  });

  const documentosOptions = [
    'Manual do proprietário',
    'Manual de uso e manutenção',
    'Memorial descritivo',
    'Projeto arquitetônico',
    'Chaves da unidade'
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

    try {
      await initDB().catch(() => {});
      const result = await inspectionsApi.create(formData);
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
        ...formData,
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
        payload: formData,
        dedupKey: `POST:/inspections:local:${id}`,
        localInspectionId: id,
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
          <div className="flex items-center gap-4">
            <img src={LOGO_URL} alt="OSTI Engenharia" className="h-12 w-auto" />
            <h1 className="text-2xl font-bold tracking-tight font-secondary uppercase">
              Identificação da Vistoria
            </h1>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-md mx-auto md:max-w-2xl px-4 py-6">
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-[0_2px_8px_rgba(0,0,0,0.04)] p-6">
          
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

          {/* Unidade */}
          <div className="mb-4">
            <label className="text-xs font-bold tracking-wider uppercase text-slate-500 mb-2 block">
              Unidade/Apartamento *
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
            <input
              data-testid="input-horario-inicio"
              type="time"
              name="horario_inicio"
              value={formData.horario_inicio}
              onChange={handleChange}
              className="w-32 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
