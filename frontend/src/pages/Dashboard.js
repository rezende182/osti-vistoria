import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Trash2, Clock, CheckCircle2, AlertCircle, XCircle } from 'lucide-react';
import FAB from '../components/FAB';
import ConfirmModal from '../components/ConfirmModal';
import { toast } from 'sonner';
import { inspectionsApi } from '../services/api';
import { getAllInspectionsLocally, initDB } from '../utils/offlineStorage';

const LOGO_URL = 'https://customer-assets.emergentagent.com/job_vistoria-imovel-1/artifacts/msx2fmcu_Design%20sem%20nome-Photoroom.png';

const Dashboard = () => {
  const navigate = useNavigate();
  const [inspections, setInspections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, inspectionId: null, inspectionName: '' });

  const fetchInspections = useCallback(async () => {
    try {
      await initDB().catch(() => {});
      const result = await inspectionsApi.list();
      if (result.ok) {
        setInspections(result.data);
        return;
      }
      console.warn('API lista:', result.error);
      const local = await getAllInspectionsLocally();
      if (local.length) {
        setInspections(local);
        toast.info('Sem conexão com o servidor — mostrando dados salvos neste dispositivo.');
      } else {
        toast.error(result.error || 'Não foi possível carregar as vistorias.');
      }
    } catch (error) {
      console.error('Erro ao carregar vistorias:', error);
      toast.error('Erro ao carregar vistorias.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInspections();
  }, [fetchInspections]);

  const openDeleteModal = (e, id, name) => {
    e.stopPropagation();
    setDeleteModal({ isOpen: true, inspectionId: id, inspectionName: name });
  };

  const closeDeleteModal = () => {
    setDeleteModal({ isOpen: false, inspectionId: null, inspectionName: '' });
  };

  const confirmDelete = async () => {
    try {
      const result = await inspectionsApi.remove(deleteModal.inspectionId);
      if (result.ok) {
        toast.success('Vistoria excluída com sucesso!');
        fetchInspections();
      } else {
        toast.error(result.error || 'Erro ao excluir vistoria');
      }
    } catch (error) {
      console.error('Erro ao excluir vistoria:', error);
      toast.error('Erro ao excluir vistoria');
    } finally {
      closeDeleteModal();
    }
  };

  const getStatusInfo = (inspection) => {
    if (inspection.status === 'concluida') {
      if (inspection.classificacao_final === 'aprovado') {
        return { icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50', label: 'APROVADO', tab: 'aprovado' };
      } else if (inspection.classificacao_final === 'aprovado_com_ressalvas') {
        return { icon: AlertCircle, color: 'text-yellow-600', bg: 'bg-yellow-50', label: 'APROVADO C/ RESSALVAS', tab: 'ressalvas' };
      } else if (inspection.classificacao_final === 'reprovado') {
        return { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50', label: 'REPROVADO', tab: 'reprovado' };
      }
    }
    return { icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50', label: 'EM ANDAMENTO', tab: 'andamento' };
  };

  const filteredInspections = inspections.filter((inspection) => {
    const matchesSearch = 
      inspection.cliente.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inspection.empreendimento.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inspection.unidade.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (activeTab === 'all') return matchesSearch;
    
    const statusInfo = getStatusInfo(inspection);
    return matchesSearch && statusInfo.tab === activeTab;
  });

  const tabs = [
    { id: 'all', label: 'Todas', count: inspections.length },
    { id: 'andamento', label: 'Em Andamento', count: inspections.filter(i => getStatusInfo(i).tab === 'andamento').length },
    { id: 'ressalvas', label: 'C/ Ressalvas', count: inspections.filter(i => getStatusInfo(i).tab === 'ressalvas').length },
    { id: 'aprovado', label: 'Aprovadas', count: inspections.filter(i => getStatusInfo(i).tab === 'aprovado').length },
    { id: 'reprovado', label: 'Reprovadas', count: inspections.filter(i => getStatusInfo(i).tab === 'reprovado').length },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white py-6 px-4">
        <div className="max-w-md mx-auto md:max-w-2xl lg:max-w-4xl">
          <div className="flex items-center gap-4 mb-2">
            <img src={LOGO_URL} alt="OSTI Engenharia" className="h-16 w-auto" />
            <div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight font-secondary uppercase">
                Vistoria de Recebimento de Imóvel
              </h1>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-md mx-auto md:max-w-2xl lg:max-w-4xl px-4 py-6">
        {/* Search */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
            <input
              data-testid="search-input"
              type="text"
              placeholder="Buscar por cliente, empreendimento ou unidade..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 overflow-x-auto">
          <div className="flex gap-2 min-w-max pb-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                data-testid={`tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all duration-200 whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab.label} ({tab.count})
              </button>
            ))}
          </div>
        </div>

        {/* Inspections List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="text-slate-500 mt-4">Carregando vistorias...</p>
          </div>
        ) : filteredInspections.length === 0 ? (
          <div className="text-center py-12">
            <Clock size={64} className="mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500">
              {searchTerm ? 'Nenhuma vistoria encontrada' : 'Nenhuma vistoria cadastrada'}
            </p>
            <p className="text-sm text-slate-400 mt-2">
              Clique no botão + para criar uma nova vistoria
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredInspections.map((inspection) => {
              const statusInfo = getStatusInfo(inspection);
              const StatusIcon = statusInfo.icon;

              return (
                <div
                  key={inspection.id}
                  data-testid="inspection-card"
                  onClick={() => navigate(`/inspection/${inspection.id}`)}
                  className="bg-white rounded-lg shadow-[0_2px_8px_rgba(0,0,0,0.04)] p-4 cursor-pointer transition-all duration-200 hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] hover:-translate-y-0.5"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-slate-900 font-secondary uppercase">{inspection.cliente}</h3>
                      <div className="text-sm text-slate-500 mt-1">
                        {inspection.unidade} - {inspection.empreendimento}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`flex items-center gap-1 px-2 py-1 rounded ${statusInfo.bg}`}>
                        <StatusIcon size={16} className={statusInfo.color} />
                        <span className={`text-xs font-bold ${statusInfo.color}`}>{statusInfo.label}</span>
                      </div>
                      <button
                        data-testid={`delete-inspection-${inspection.id}`}
                        onClick={(e) => openDeleteModal(e, inspection.id, inspection.cliente)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span>{inspection.data}</span>
                    <span>{inspection.tipo_imovel.toUpperCase()}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* FAB */}
      <FAB onClick={() => navigate('/new-inspection')} />

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={closeDeleteModal}
        onConfirm={confirmDelete}
        title="Excluir Vistoria"
        message={`Tem certeza que deseja excluir a vistoria de "${deleteModal.inspectionName}"? Esta ação não pode ser desfeita.`}
      />
    </div>
  );
};

export default Dashboard;
