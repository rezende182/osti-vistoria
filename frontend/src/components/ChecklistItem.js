import React, { useEffect, useMemo, useState, useRef } from 'react';
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
import {
  fetchChecklistPhotoBlob,
  isGridFsChecklistPhotoUrl,
  parseGridFsFileId,
} from '../utils/checklistRemotePhotos';
import ChecklistPhotoThumb from './ChecklistPhotoThumb';
import PhotoAnnotationModal from './PhotoAnnotationModal';

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
  inspectionId = '',
  getIdToken,
  storePhotoDataUrl,
}) => {
  const [showNcPanel, setShowNcPanel] = useState(false);
  const [showMobileWarning, setShowMobileWarning] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [showVerificationsModal, setShowVerificationsModal] = useState(false);
  /** Índice da foto aberta no editor de marcações (setas / traços) */
  const [annotatePhotoIndex, setAnnotatePhotoIndex] = useState(null);
  const [annotateDisplayUrl, setAnnotateDisplayUrl] = useState(null);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const legacyMerged = (() => {
    const vps = Array.isArray(item.verification_points) ? item.verification_points : [];
    return vps
      .filter((vp) => vp && !vp.excluded)
      .map((vp) => (vp.text || '').trim())
      .filter(Boolean)
      .join(', ');
  })();

  const verificationBody = ((item.verification_text || '').trim() || legacyMerged).trim();

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

  const updatePhotoDescription = (index, description) => {
    const newPhotos = [...(item.photos || [])];
    newPhotos[index] = { ...newPhotos[index], description };
    onChange({ ...item, photos: newPhotos });
  };

  const updatePhotoUrl = (index, newUrl) => {
    const newPhotos = [...(item.photos || [])];
    newPhotos[index] = { ...newPhotos[index], url: newUrl };
    onChange({ ...item, photos: newPhotos });
  };

  const photos = (item.photos || []).map((photo, index) => {
    if (typeof photo === 'string') {
      return {
        url: photo,
        caption: `Foto ${index + 1}`,
        number: index + 1,
        description: '',
      };
    }
    return { ...photo, description: photo.description ?? '' };
  });

  const photoUrlKey = useMemo(
    () =>
      JSON.stringify(
        (item.photos || []).map((p) => (typeof p === 'string' ? p : p?.url ?? ''))
      ),
    [item.photos]
  );

  useEffect(() => {
    if (annotatePhotoIndex == null) {
      setAnnotateDisplayUrl(null);
      return undefined;
    }
    const srcPhotos = item.photos || [];
    const rawObj = srcPhotos[annotatePhotoIndex];
    const raw = typeof rawObj === 'string' ? rawObj : rawObj?.url;
    if (!raw) {
      setAnnotateDisplayUrl(null);
      return undefined;
    }
    if (!isGridFsChecklistPhotoUrl(raw)) {
      setAnnotateDisplayUrl(raw);
      return undefined;
    }
    const fid = parseGridFsFileId(raw);
    if (!fid || !inspectionId || typeof getIdToken !== 'function') {
      setAnnotateDisplayUrl(null);
      return undefined;
    }
    let cancelled = false;
    let objectUrl;
    (async () => {
      try {
        const blob = await fetchChecklistPhotoBlob(inspectionId, fid, getIdToken);
        objectUrl = URL.createObjectURL(blob);
        if (!cancelled) setAnnotateDisplayUrl(objectUrl);
      } catch {
        if (!cancelled) setAnnotateDisplayUrl(null);
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [annotatePhotoIndex, photoUrlKey, item.photos, inspectionId, getIdToken]);

  const reorder =
    onMoveUp || onMoveDown || dragHandleProps ? (
      <div className="flex shrink-0 items-center gap-px">
        {onMoveUp && (
          <button
            type="button"
            data-testid={`move-item-up-${item.name}`}
            disabled={!canMoveUp}
            onClick={onMoveUp}
            className={btnGhost}
            aria-label="Mover para cima"
            title="Mover para cima"
          >
            <ChevronUp size={15} strokeWidth={2.25} aria-hidden />
          </button>
        )}
        {dragHandleProps && (
          <div
            {...dragHandleProps}
            className="cursor-grab touch-none select-none rounded p-1 text-slate-300 transition-colors hover:bg-slate-100 hover:text-slate-500 active:cursor-grabbing"
            aria-label="Arrastar"
            title="Arrastar"
          >
            <GripVertical size={15} strokeWidth={2} aria-hidden />
          </div>
        )}
        {onMoveDown && (
          <button
            type="button"
            data-testid={`move-item-down-${item.name}`}
            disabled={!canMoveDown}
            onClick={onMoveDown}
            className={btnGhost}
            aria-label="Mover para baixo"
            title="Mover para baixo"
          >
            <ChevronDown size={15} strokeWidth={2.25} aria-hidden />
          </button>
        )}
      </div>
    ) : null;

  return (
    <div
      data-testid="checklist-item"
      className="rounded-lg border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-[box-shadow] duration-200 hover:shadow-[0_1px_4px_rgba(15,23,42,0.05)]"
    >
      <div className="px-2 py-1.5 sm:px-2.5 sm:py-2">
        <div className="flex min-w-0 items-start gap-2">
          {reorder}
          <div className="min-w-0 flex-1">
            <div className="rounded-lg border border-slate-200/90 bg-gradient-to-br from-slate-50/95 to-white px-3 py-2.5 shadow-sm ring-1 ring-slate-100/70 sm:px-3.5 sm:py-3">
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
              <h4 className="min-w-0 flex-1 text-base font-bold leading-snug tracking-tight text-slate-950 sm:text-[1.05rem] font-secondary">
                {item.name}
              </h4>
              <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
                <button
                  type="button"
                  data-testid={`verification-points-${item.name}`}
                  onClick={() => setShowVerificationsModal(true)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50/95 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide text-blue-900 shadow-sm ring-1 ring-blue-200/60 transition-colors hover:border-blue-300 hover:bg-blue-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                  aria-label="Itens verificados"
                >
                  <ClipboardList size={13} strokeWidth={2.25} className="shrink-0 text-blue-600" aria-hidden />
                  Itens verificados
                </button>
                {onRemoveItem && (
                  <button
                    type="button"
                    data-testid={`remove-item-${item.name}`}
                    onClick={onRemoveItem}
                    className="inline-flex shrink-0 items-center justify-center rounded-lg border-2 border-rose-300 bg-rose-50 p-2 text-rose-600 shadow-sm transition-colors hover:border-rose-400 hover:bg-rose-100 hover:text-rose-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2"
                    aria-label={`Remover ${item.name}`}
                    title="Remover elemento"
                  >
                    <Trash2 size={18} strokeWidth={2.25} aria-hidden />
                  </button>
                )}
              </div>
            </div>
            </div>
          </div>
        </div>

        <div className="mt-2 sm:mt-2.5">
          <button
            type="button"
            data-testid={`nc-button-${item.name}`}
            onClick={() => setShowNcPanel(!showNcPanel)}
            className={[
              'flex w-full flex-col items-stretch gap-1 rounded-md border px-2 py-2 text-left transition-colors sm:px-2.5',
              showNcPanel
                ? 'border-rose-400/90 bg-rose-100 text-rose-950 shadow-inner'
                : 'border-rose-300/80 bg-rose-50 text-rose-900 hover:border-rose-400 hover:bg-rose-100/80',
            ].join(' ')}
          >
            <span className="flex items-center justify-center gap-1.5 text-center">
              <AlertTriangle size={13} strokeWidth={2.25} className="shrink-0 text-rose-600" aria-hidden />
              <span className="text-[10px] font-semibold uppercase tracking-wide sm:text-[11px]">
                Não conformidades
                {photos.length > 0 ? ` (${photos.length})` : ''}
              </span>
            </span>
            <span className="text-center text-[9px] font-normal normal-case leading-snug text-rose-900/85 sm:text-[10px]">
              Registre aqui fotos e descrições que comprovam o estado de não conformidade.
            </span>
          </button>
        </div>

        {showNcPanel && (
          <div
            className="mt-1.5 rounded-lg border border-slate-100 bg-slate-50/50 p-2"
            data-testid={`nc-panel-${item.name}`}
          >
            <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-slate-400">Fotos</p>

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

            <div className="grid grid-cols-2 gap-1.5">
              <button
                data-testid={`choose-file-${item.name}`}
                type="button"
                onClick={handleChooseFile}
                disabled={isCompressing}
                className="flex min-h-[2.5rem] items-center justify-center gap-1 rounded-lg border border-sky-200/80 bg-sky-50/80 py-1.5 text-xs font-medium text-sky-900 transition-colors hover:bg-sky-100/90 disabled:opacity-50 sm:min-h-0"
              >
                {isCompressing ? (
                  <>
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
                    <span className="text-[11px]">…</span>
                  </>
                ) : (
                  <>
                    <FolderOpen size={14} strokeWidth={2} className="text-sky-600" />
                    Ficheiro
                  </>
                )}
              </button>
              <button
                data-testid={`take-photo-${item.name}`}
                type="button"
                onClick={handleTakePhoto}
                disabled={isCompressing}
                className="flex min-h-[2.5rem] items-center justify-center gap-1 rounded-lg border border-emerald-200/80 bg-emerald-50/80 py-1.5 text-xs font-medium text-emerald-900 transition-colors hover:bg-emerald-100/90 disabled:opacity-50 sm:min-h-0"
              >
                {isCompressing ? (
                  <>
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
                    <span className="text-[11px]">…</span>
                  </>
                ) : (
                  <>
                    <Smartphone size={14} strokeWidth={2} className="text-emerald-600" />
                    Câmara
                  </>
                )}
              </button>
            </div>

            {showMobileWarning && (
              <div className="mt-2 rounded border border-amber-200/60 bg-amber-50/50 px-2 py-1.5">
                <p className="text-[11px] leading-snug text-amber-900/90">
                  Câmara só em telemóvel ou tablet.
                </p>
              </div>
            )}

            {photos.length > 0 && (
              <div className="mt-2 space-y-2">
                <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                  {photos.length} foto{photos.length !== 1 ? 's' : ''}
                  <span className="ml-1 font-normal normal-case text-slate-500">
                    — toque na miniatura para abrir e marcar (setas / cores)
                  </span>
                </p>
                {photos.map((photo, index) => (
                  <div key={index} className="rounded-lg border border-slate-100 bg-white p-2 shadow-sm">
                    <div className="flex gap-2">
                      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md bg-slate-100 ring-1 ring-slate-200/80">
                        <button
                          type="button"
                          onClick={() => setAnnotatePhotoIndex(index)}
                          className="absolute inset-0 z-0 block h-full w-full overflow-hidden rounded-md"
                          aria-label="Abrir foto para marcar setas ou traços"
                        >
                          {inspectionId && typeof getIdToken === 'function' ? (
                            <ChecklistPhotoThumb
                              url={photo.url}
                              inspectionId={inspectionId}
                              getIdToken={getIdToken}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <img src={photo.url} alt="" className="h-full w-full object-cover" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemovePhoto(index);
                          }}
                          className="absolute -right-0.5 -top-0.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-white/95 text-rose-500 shadow ring-1 ring-slate-200/80 transition-colors hover:bg-rose-50 hover:text-rose-600"
                          aria-label="Remover foto"
                        >
                          <X size={10} strokeWidth={2.5} />
                        </button>
                      </div>
                      <div className="min-w-0 flex-1 pt-0.5">
                        <div className="mb-1 flex items-center gap-1">
                          <Image size={11} className="text-slate-300" aria-hidden />
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-sky-700">
                            Foto {photo.number}
                          </span>
                        </div>
                        <input
                          type="text"
                          value={photo.caption || ''}
                          onChange={(e) => updatePhotoCaption(index, e.target.value)}
                          placeholder="Legenda…"
                          className="w-full rounded-md border border-slate-200/90 bg-slate-50/50 px-2 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-sky-300 focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-500/25"
                        />
                        <label className="mt-1.5 block">
                          <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                            Descrição da não conformidade
                          </span>
                          <textarea
                            value={photo.description != null ? photo.description : ''}
                            onChange={(e) => updatePhotoDescription(index, e.target.value)}
                            placeholder="Descreva a não conformidade…"
                            rows={2}
                            className="w-full resize-y rounded-md border border-slate-200/90 bg-white px-2 py-1.5 text-xs leading-snug text-slate-800 placeholder:text-slate-400 focus:border-rose-300 focus:outline-none focus:ring-1 focus:ring-rose-400/30"
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {annotatePhotoIndex != null &&
        isGridFsChecklistPhotoUrl(photos[annotatePhotoIndex]?.url) &&
        !annotateDisplayUrl && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 text-sm text-white">
            A carregar foto…
          </div>
        )}

      {annotatePhotoIndex != null && annotateDisplayUrl && (
        <PhotoAnnotationModal
          key={`annotate-${annotatePhotoIndex}-${annotateDisplayUrl?.slice?.(0, 48) || ''}`}
          imageUrl={annotateDisplayUrl}
          onClose={() => setAnnotatePhotoIndex(null)}
          onApply={async (dataUrl) => {
            const idx = annotatePhotoIndex;
            const stored =
              storePhotoDataUrl && typeof storePhotoDataUrl === 'function'
                ? await storePhotoDataUrl(dataUrl)
                : dataUrl;
            updatePhotoUrl(idx, stored);
            setAnnotatePhotoIndex(null);
          }}
        />
      )}

      {showVerificationsModal &&
        createPortal(
          <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/40 p-4 backdrop-blur-[2px] sm:items-center">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="vp-modal-title"
              className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl ring-1 ring-slate-200/60 sm:rounded-2xl"
            >
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
                <h3
                  id="vp-modal-title"
                  className="font-secondary text-xl font-semibold leading-snug text-slate-900"
                >
                  {item.name}
                </h3>
                <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Elementos e verificações
                </p>
                <div className="mt-2 text-[15px] leading-relaxed text-slate-800 whitespace-pre-wrap">
                  {verificationBody || (
                    <span className="text-slate-400 italic">Sem texto de referência para este elemento.</span>
                  )}
                </div>
              </div>
              <div className="border-t border-slate-100 p-4 sm:px-6">
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
