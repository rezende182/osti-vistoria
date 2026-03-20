import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

/**
 * Seleção de horário sem o diálogo nativo (evita botão "Limpar").
 * Apenas Cancelar e Confirmar no painel.
 */
export default function TimePickerField({
  value,
  onChange,
  disabled,
  className = '',
  id,
  'data-testid': testId,
}) {
  const [open, setOpen] = useState(false);
  const [h, setH] = useState(9);
  const [m, setM] = useState(0);

  useEffect(() => {
    if (open && value && /^\d{1,2}:\d{2}$/.test(value)) {
      const [hh, mm] = value.split(':').map((x) => parseInt(x, 10));
      if (!Number.isNaN(hh) && !Number.isNaN(mm)) {
        setH(Math.min(23, Math.max(0, hh)));
        setM(Math.min(59, Math.max(0, mm)));
      }
    }
  }, [open, value]);

  const display =
    value && String(value).trim() ? value : 'Selecionar horário';

  const apply = () => {
    onChange(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    setOpen(false);
  };

  const cancel = () => setOpen(false);

  return (
    <>
      <button
        type="button"
        id={id}
        data-testid={testId}
        disabled={disabled}
        onClick={() => !disabled && setOpen(true)}
        className={`inline-flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-lg bg-white text-left text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed ${className}`}
      >
        <Clock size={18} className="text-slate-500 shrink-0" />
        <span className="font-medium tabular-nums">{display}</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="time-picker-title"
          onClick={cancel}
        >
          <div
            className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-sm overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 pt-5 pb-2">
              <h3 id="time-picker-title" className="text-base font-bold text-slate-900">
                Horário
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Ajuste horas e minutos e confirme.
              </p>
            </div>
            <div className="flex justify-center items-center gap-2 px-5 py-4">
              <select
                value={h}
                onChange={(e) => setH(Number(e.target.value))}
                className="text-lg font-semibold tabular-nums border border-slate-300 rounded-lg px-3 py-2 bg-slate-50"
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>
                    {String(i).padStart(2, '0')}
                  </option>
                ))}
              </select>
              <span className="text-2xl font-bold text-slate-400">:</span>
              <select
                value={m}
                onChange={(e) => setM(Number(e.target.value))}
                className="text-lg font-semibold tabular-nums border border-slate-300 rounded-lg px-3 py-2 bg-slate-50"
              >
                {Array.from({ length: 60 }, (_, i) => (
                  <option key={i} value={i}>
                    {String(i).padStart(2, '0')}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 p-4 border-t border-slate-100 bg-slate-50">
              <button
                type="button"
                onClick={cancel}
                className="flex-1 py-3 rounded-xl font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={apply}
                className="flex-1 py-3 rounded-xl font-semibold bg-slate-900 text-white hover:bg-slate-800"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
