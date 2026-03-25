import React, { useRef } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { prepareLogoDataUrlForPdf } from '../utils/pdfLogoUpload';

/**
 * Logótipo opcional (PNG/JPEG) guardado na vistoria e usado no cabeçalho do PDF.
 */
export default function InspectionPdfLogoField({ value, onChange, disabled }) {
  const inputRef = useRef(null);

  const handlePick = () => {
    if (!disabled) inputRef.current?.click();
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const dataUrl = await prepareLogoDataUrlForPdf(file);
      onChange(dataUrl);
      toast.success('Logótipo definido para o PDF.');
    } catch (err) {
      toast.error(err?.message || 'Não foi possível processar a imagem.');
    }
  };

  const handleClear = () => {
    onChange('');
  };

  return (
    <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50/80 p-4">
      <label className="text-xs font-bold tracking-wider uppercase text-slate-500 mb-2 block">
        Logótipo no relatório PDF (opcional)
      </label>
      <p className="text-xs text-slate-600 mb-3 leading-relaxed">
        Substitui o logótipo padrão no topo da primeira página do PDF. PNG ou JPEG do seu dispositivo.
      </p>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,.jpg,.jpeg,.png"
        className="hidden"
        onChange={handleFile}
        disabled={disabled}
      />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          data-testid="pdf-logo-choose-button"
          onClick={handlePick}
          disabled={disabled}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-50 disabled:pointer-events-none"
        >
          <ImagePlus size={18} className="shrink-0" aria-hidden />
          Escolher imagem
        </button>
        {value ? (
          <button
            type="button"
            data-testid="pdf-logo-remove-button"
            onClick={handleClear}
            disabled={disabled}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <Trash2 size={16} aria-hidden />
            Remover
          </button>
        ) : null}
      </div>
      {value ? (
        <div className="mt-3 flex items-center gap-3 rounded-md border border-slate-200 bg-white p-3">
          <img
            src={value}
            alt="Pré-visualização do logótipo no PDF"
            className="max-h-16 max-w-[200px] object-contain"
          />
          <span className="text-xs text-slate-500">Pré-visualização</span>
        </div>
      ) : null}
    </div>
  );
}
