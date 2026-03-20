import React from 'react';
import { X } from 'lucide-react';

/**
 * Modal reutilizável: orientações de inspeção (texto só leitura).
 */
const InspectionOrientationModal = ({ isOpen, onClose, itemTitle, bullets }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="orientation-modal-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/55 backdrop-blur-[1px]"
        onClick={onClose}
        aria-label="Fechar"
      />
      <div className="relative z-10 w-full max-w-md max-h-[85vh] overflow-hidden rounded-xl bg-white shadow-2xl border border-slate-200 flex flex-col">
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-100 bg-slate-50/80">
          <div className="min-w-0">
            <h2
              id="orientation-modal-title"
              className="text-lg font-bold text-slate-900 font-secondary leading-tight"
            >
              {itemTitle}
            </h2>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mt-1">
              Orientações de inspeção
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 p-2 rounded-lg text-slate-500 hover:bg-slate-200/80 hover:text-slate-900 transition-colors"
            aria-label="Fechar"
          >
            <X size={22} />
          </button>
        </div>
        <div className="px-5 py-4 overflow-y-auto">
          <ul className="list-disc pl-5 space-y-2.5 text-sm text-slate-700 leading-relaxed">
            {(bullets || []).map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default InspectionOrientationModal;
