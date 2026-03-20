import React from 'react';
import { Calendar, MapPin, FileText, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const InspectionCard = ({ inspection }) => {
  const navigate = useNavigate();

  const getStatusInfo = () => {
    if (inspection.status === 'concluida') {
      if (inspection.classificacao_final === 'aprovado') {
        return { icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50', label: 'APROVADO' };
      } else if (inspection.classificacao_final === 'aprovado_com_ressalvas') {
        return { icon: AlertCircle, color: 'text-yellow-600', bg: 'bg-yellow-50', label: 'APROVADO C/ RESSALVAS' };
      } else if (inspection.classificacao_final === 'reprovado') {
        return { icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50', label: 'REPROVADO' };
      }
    }
    return { icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50', label: 'EM ANDAMENTO' };
  };

  const statusInfo = getStatusInfo();
  const StatusIcon = statusInfo.icon;

  return (
    <div
      data-testid="inspection-card"
      onClick={() => navigate(`/inspection/${inspection.id}`)}
      className="bg-white rounded-lg shadow-[0_2px_8px_rgba(0,0,0,0.04)] p-4 cursor-pointer transition-all duration-200 hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 active:scale-95"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="text-lg font-bold text-slate-900 font-secondary uppercase">{inspection.cliente}</h3>
          <div className="flex items-center gap-1 text-sm text-slate-500 mt-1">
            <MapPin size={14} />
            <span>{inspection.unidade} - {inspection.empreendimento}</span>
          </div>
        </div>
        <div className={`flex items-center gap-1 px-2 py-1 rounded ${statusInfo.bg}`}>
          <StatusIcon size={16} className={statusInfo.color} />
          <span className={`text-xs font-bold ${statusInfo.color}`}>{statusInfo.label}</span>
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs text-slate-500">
        <div className="flex items-center gap-1">
          <Calendar size={14} />
          <span>{inspection.data}</span>
        </div>
        <div className="flex items-center gap-1">
          <FileText size={14} />
          <span>{inspection.tipo_imovel.toUpperCase()}</span>
        </div>
      </div>
    </div>
  );
};

export default InspectionCard;