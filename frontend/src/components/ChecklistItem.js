import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Image,
  FolderOpen,
  Smartphone,
  Trash2,
  ChevronUp,
  ChevronDown,
  GripVertical,
  ClipboardList,
  AlertTriangle,
} from 'lucide-react';
import { compressImage, formatFileSize, getDataUrlSize } from '../utils/imageCompressor';

const btnGhost =
  'rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent';

const ChecklistItem = ({
  item,
  onChange,
  onAddPhoto,
  onRemovePhoto,
  onRemoveItem,
  canMoveUp = false,
  canMoveDown = false,
  onMoveUp,
  onMoveDown,
  dragHandleProps,
}) => {
  const [showNcPanel, setShowNcPanel] = useState(false);
  const [showMobileWarning, setShowMobileWarning] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [showVerificationsModal, setShowVerificationsModal] = useState(false);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const existsNao = item.exists === 'nao';

  useEffect(() => {
    if (existsNao) {
      setShowNcPanel(false);
      setShowVerificationsModal(false);
    }
  }, [existsNao]);

  const legacyMerged = (() => {
    const vps = Array.isArray(item.verification_points) ? item.verification_points : [];
    return vps
      .filter((vp) => vp && !vp.excluded)
      .map((vp) => (vp.text || '').trim())
      .filter(Boolean)
      .join(', ');
  })();

  const verificationBody = ((item.verification_text || '').trim() || legacyMerged).trim();

  const setExists = (value) => {
    onChange({ ...item, exists: value });
  };

  const isMobileDevice = () => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  };

  const handleChooseFile = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleTakePhoto = () => {
    if (!isMobileDevice()) {
      setShowMobileWarning(true);
      setTimeout(() => setShowMobileWarning(false), 3000);
      return;
    }
    if (cameraInputRef.current) {
      cameraInputRef.current.click();
    }
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    setIsCompressing(true);

    for (const file of files) {
      try {
        const compressedImage = await compressImage(file, {
          maxWidth: 1200,
          maxHeight: 1200,
          quality: 0.7,
        });

        const originalSize = file.size;
        const compressedSize = getDataUrlSize(compressedImage);
        console.log(
          `[Compressão] Original: ${formatFileSize(originalSize)} → Comprimido: ${formatFileSize(compressedSize)}`
        );

        onAddPhoto(compressedImage);
      } catch (error) {
        console.error('Erro ao processar imagem:', error);
        const reader = new FileReader();
        const base64 = await new Promise((resolve) => {
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(file);
        });
        onAddPhoto(base64);
      }
    }

    setIsCompressing(false);
    e.target.value = '';
  };

  const handleRemovePhoto = (index) => {
    onRemovePhoto(index);
  };

  const updatePhotoCaption = (index, caption) => {
    const newPhotos = [...(item.photos || [])];
    const photo = newPhotos[index];

    let finalCaption = caption;
    const prefixPattern = /^Foto \d+\.\s*/;

    if (!prefixPattern.test(caption)) {
      finalCaption = `Foto ${photo.number}. ${caption}`;
    }

    newPhotos[index] = { ...photo, caption: finalCaption };
    onChange({ ...item, photos: newPhotos });
  };

  const photos = (item.photos || []).map((photo, index) => {
    if (typeof photo === 'string') {
      return { url: photo, caption: `Foto ${index + 1}`, number: index + 1 };
    }
    return photo;
  });

  const headerLockedClass = existsNao ? 'pointer-events-none select-none opacity-45' : '';

  return (
    <div
      data-testid="checklist-item"
      className={[
        'rounded-xl border transition-[box-shadow,border-color] duration-200',
        'shadow-[0_1px_2px_rgba(15,23,42,0.04)]',
        existsNao
          ? 'border-amber-200/90 bg-gradient-to-b from-amber-50/70 to-amber-50/30'
          : 'border-slate-200/90 bg-white hover:shadow-[0_2px_8px_rgba(15,23,42,0.06)]',
      ].join(' ')}
    >
      <div className="p-3.5 sm:p-4">
        <div className={`flex items-start justify-between gap-3 ${headerLockedClass}`}>
          <div className="flex min-w-0 flex-1 gap-2 sm:gap-2.5">
            {(onMoveUp || onMoveDown || dragHandleProps) && (
              <div className="flex shrink-0 flex-col items-center gap-0 pt-0.5">
                {onMoveUp && (
                  <button
                    type="button"
                    data-testid={`move-item-up-${item.name}`}
                    disabled={!canMoveUp}
                    onClick={onMoveUp}
                    className={btnGhost}
                    aria-label="Mover item para cima"
                    title="Mover para cima"
                  >
                    <ChevronUp size={18} strokeWidth={2.25} aria-hidden />
                  </button>
                )}
                {dragHandleProps && (
                  <div
                    {...dragHandleProps}
                    className="cursor-grab touch-none select-none rounded-lg p-1.5 text-slate-300 transition-colors hover:bg-slate-100 hover:text-slate-500 active:cursor-grabbing"
                    aria-label="Arrastar para reordenar"
                    title="Arrastar para reordenar"
                  >
                    <GripVertical size={18} strokeWidth={2} aria-hidden />
                  </div>
                )}
                {onMoveDown && (
                  <button
                    type="button"
                    data-testid={`move-item-down-${item.name}`}
                    disabled={!canMoveDown}
                    onClick={onMoveDown}
                    className={btnGhost}
                    aria-label="Mover item para baixo"
                    title="Mover para baixo"
                  >
                    <ChevronDown size={18} strokeWidth={2.25} aria-hidden />
                  </button>
                )}
              </div>
            )}
            <h4 className="min-w-0 flex-1 pt-0.5 text-[0.9375rem] font-semibold leading-snug tracking-tight text-slate-800 sm:text-base">
              {item.name}
            </h4>
          </div>
          <div className="flex shrink-0 items-start gap-1 sm:gap-1.5">
            {onRemoveItem && (
              <button
                type="button"
                data-testid={`remove-item-${item.name}`}
                onClick={onRemoveItem}
                className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                aria-label={`Remover elemento ${item.name}`}
                title="Remover elemento"
              >
                <Trash2 size={18} strokeWidth={2} aria-hidden />
              </button>
            )}
            <button
              type="button"
              data-testid={`verification-points-${item.name}`}
              onClick={() => setShowVerificationsModal(true)}
              className="inline-flex max-w-[min(100%,11rem)] items-center gap-1.5 rounded-lg border border-slate-200/90 bg-slate-50/80 px-2 py-1.5 text-[10px] font-semibold uppercase leading-tight tracking-wide text-slate-600 transition-colors hover:border-slate-300 hover:bg-white hover:text-slate-800 sm:max-w-none sm:px-2.5 sm:text-[11px]"
              aria-label="Itens verificados"
            >
              <ClipboardList size={13} strokeWidth={2.25} className="shrink-0 text-slate-500" aria-hidden />
              <span className="truncate sm:whitespace-normal">Itens verificados</span>
            </button>
          </div>
        </div>

        <div className="mt-3.5 flex flex-col gap-2.5 border-t border-slate-100 pt-3.5 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">
            Situação
          </span>
          <div className="inline-flex w-full gap-1.5 rounded-lg bg-slate-100/80 p-1 sm:w-auto">
            <button
              type="button"
              data-testid={`exists-sim-${item.name}`}
              onClick={() => setExists('sim')}
              className={[
                'min-h-[2.25rem] flex-1 rounded-md px-3 py-2 text-center text-xs font-semibold transition-all sm:min-h-0 sm:min-w-[5.5rem]',
                !existsNao
                  ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80'
                  : 'text-slate-500 hover:text-slate-700',
              ].join(' ')}
            >
              Existe
            </button>
            <button
              type="button"
              data-testid={`exists-nao-${item.name}`}
              onClick={() => setExists('nao')}
              className={[
                'min-h-[2.25rem] flex-1 rounded-md px-3 py-2 text-center text-xs font-semibold transition-all sm:min-h-0 sm:min-w-[5.5rem]',
                existsNao
                  ? 'bg-white text-amber-900 shadow-sm ring-1 ring-amber-200/90'
                  : 'text-slate-500 hover:text-slate-700',
              ].join(' ')}
            >
              Não existe
            </button>
          </div>
        </div>

        {existsNao && (
          <p className="mt-3 rounded-lg border border-amber-100/90 bg-white/60 px-3 py-2.5 text-[13px] leading-relaxed text-amber-950/90">
            <span className="font-medium text-amber-900">Inexistente</span> neste ambiente — o restante
            fica indisponível até marcar <span className="font-medium">Existe</span>. Não entra no PDF.
          </p>
        )}

        {!existsNao && (
          <>
            <div className="mt-3.5">
              <button
                type="button"
                data-testid={`nc-button-${item.name}`}
                onClick={() => setShowNcPanel(!showNcPanel)}
                className={[
                  'inline-flex w-full items-center justify-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-semibold uppercase tracking-[0.08em] transition-all sm:w-auto sm:min-w-[12rem]',
                  showNcPanel
                    ? 'border-amber-300/80 bg-amber-100/60 text-amber-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]'
                    : 'border-amber-200/70 bg-amber-50/40 text-amber-900 hover:border-amber-300 hover:bg-amber-50/80',
                ].join(' ')}
              >
                <AlertTriangle size={15} strokeWidth={2.25} className="shrink-0 opacity-90" aria-hidden />
                Não conformidades
                {photos.length > 0 ? (
                  <span className="rounded-full bg-amber-200/80 px-2 py-0.5 text-[10px] font-bold tabular-nums text-amber-950">
                    {photos.length}
                  </span>
                ) : null}
              </button>
            </div>

            {showNcPanel && (
              <div
                className="mt-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3 sm:p-3.5"
                data-testid={`nc-panel-${item.name}`}
              >
                <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">
                  Fotos
                </p>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileUpload}
                  className="hidden"
                />

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <button
                    data-testid={`choose-file-${item.name}`}
                    type="button"
                    onClick={handleChooseFile}
                    disabled={isCompressing}
                    className="flex min-h-touch items-center justify-center gap-2 rounded-xl border border-sky-200/80 bg-sky-50/80 py-2.5 text-sm font-medium text-sky-900 transition-colors hover:bg-sky-100/90 disabled:opacity-50 sm:min-h-0"
                  >
                    {isCompressing ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
                        A processar…
                      </>
                    ) : (
                      <>
                        <FolderOpen size={17} strokeWidth={2} className="text-sky-600" />
                        Ficheiro
                      </>
                    )}
                  </button>
                  <button
                    data-testid={`take-photo-${item.name}`}
                    type="button"
                    onClick={handleTakePhoto}
                    disabled={isCompressing}
                    className="flex min-h-touch items-center justify-center gap-2 rounded-xl border border-emerald-200/80 bg-emerald-50/80 py-2.5 text-sm font-medium text-emerald-900 transition-colors hover:bg-emerald-100/90 disabled:opacity-50 sm:min-h-0"
                  >
                    {isCompressing ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
                        A processar…
                      </>
                    ) : (
                      <>
                        <Smartphone size={17} strokeWidth={2} className="text-emerald-600" />
                        Câmara
                      </>
                    )}
                  </button>
                </div>

                {showMobileWarning && (
                  <div className="mt-3 rounded-lg border border-amber-200/60 bg-amber-50/50 px-3 py-2">
                    <p className="text-[13px] leading-relaxed text-amber-900/90">
                      A câmara só está disponível em telemóvel ou tablet.
                    </p>
                  </div>
                )}

                {photos.length > 0 && (
                  <div className="mt-4 space-y-2.5">
                    <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">
                      {photos.length} foto{photos.length !== 1 ? 's' : ''}
                    </p>
                    {photos.map((photo, index) => (
                      <div
                        key={index}
                        className="rounded-xl border border-slate-100 bg-white p-2.5 shadow-sm"
                      >
                        <div className="flex gap-3">
                          <div className="relative h-[4.5rem] w-[4.5rem] shrink-0 overflow-hidden rounded-lg bg-slate-100">
                            <img
                              src={photo.url}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                            <button
                              type="button"
                              onClick={() => handleRemovePhoto(index)}
                              className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-white/95 text-rose-500 shadow ring-1 ring-slate-200/80 transition-colors hover:bg-rose-50 hover:text-rose-600"
                              aria-label="Remover foto"
                            >
                              <X size={12} strokeWidth={2.5} />
                            </button>
                          </div>
                          <div className="min-w-0 flex-1 pt-0.5">
                            <div className="mb-1.5 flex items-center gap-1.5">
                              <Image size={12} className="text-slate-300" aria-hidden />
                              <span className="text-[11px] font-semibold uppercase tracking-wide text-sky-700">
                                Foto {photo.number}
                              </span>
                            </div>
                            <input
                              type="text"
                              value={photo.caption}
                              onChange={(e) => updatePhotoCaption(index, e.target.value)}
                              placeholder="Legenda…"
                              className="w-full rounded-lg border border-slate-200/90 bg-slate-50/50 px-2.5 py-2 text-[13px] text-slate-800 placeholder:text-slate-400 focus:border-sky-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {showVerificationsModal &&
        createPortal(
          <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/40 p-4 backdrop-blur-[2px] sm:items-center">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="vp-modal-title"
              className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl ring-1 ring-slate-200/60 sm:rounded-2xl"
            >
              <div className="border-b border-slate-100 px-4 py-4 sm:px-5">
                <h3
                  id="vp-modal-title"
                  className="font-secondary text-lg font-semibold capitalize leading-snug text-slate-900"
                >
                  Itens verificados — {item.name}
                </h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-slate-500">
                  Texto de referência dos pontos de verificação deste elemento.
                </p>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-5">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                  Elementos e verificações
                </p>
                <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4 text-[13px] leading-relaxed text-slate-700 whitespace-pre-wrap">
                  {verificationBody || (
                    <span className="text-slate-400 italic">
                      Nenhum texto definido. Registe não conformidades (fotos) quando o elemento
                      existir.
                    </span>
                  )}
                </div>
              </div>
              <div className="border-t border-slate-100 p-4 sm:px-5">
                <button
                  type="button"
                  onClick={() => setShowVerificationsModal(false)}
                  className="min-h-touch w-full rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800 sm:min-h-0"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

export default ChecklistItem;
