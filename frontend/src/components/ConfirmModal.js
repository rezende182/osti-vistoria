import React from 'react';
import { AlertTriangle } from 'lucide-react';

const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-sm animate-fade-in">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
            <AlertTriangle size={24} className="text-red-600" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 font-secondary uppercase">
            {title}
          </h3>
        </div>
        
        <p className="text-slate-600 mb-6">{message}</p>
        
        <div className="flex gap-3">
          <button
            data-testid="confirm-no-button"
            onClick={onClose}
            className="flex-1 py-3 px-4 bg-slate-100 text-slate-700 rounded-lg font-semibold hover:bg-slate-200 transition-colors"
          >
            Não
          </button>
          <button
            data-testid="confirm-yes-button"
            onClick={onConfirm}
            className="flex-1 py-3 px-4 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors"
          >
            Sim, excluir
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
