import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Camera,
  MessageSquare,
  X,
  Image,
  FolderOpen,
  Smartphone,
  Trash2,
  ChevronUp,
  ChevronDown,
  GripVertical,
  ClipboardList,
} from 'lucide-react';
import { compressImage, formatFileSize, getDataUrlSize } from '../utils/imageCompressor';

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
  const [showPhotoInput, setShowPhotoInput] = useState(false);
  const [showObservations, setShowObservations] = useState(false);
  const [showMobileWarning, setShowMobileWarning] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [showVerificationsModal, setShowVerificationsModal] = useState(false);
  const [extraDraft, setExtraDraft] = useState('');
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  useEffect(() => {
    if (showVerificationsModal) setExtraDraft('');
  }, [showVerificationsModal]);

  const legacyMerged = (() => {
    const vps = Array.isArray(item.verification_points) ? item.verification_points : [];
    return vps
      .filter((vp) => vp && !vp.excluded)
      .map((vp) => (vp.text || '').trim())
      .filter(Boolean)
      .join(', ');
  })();

  const verificationBody = ((item.verification_text || '').trim() || legacyMerged).trim();
  const additionalVerifications = Array.isArray(item.additional_verifications)
    ? item.additional_verifications
    : [];

  const isMobileDevice = () => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  };

  const handleObservationsChange = (value) => {
    onChange({ ...item, observations: value });
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

  const extraCount = additionalVerifications.length;

  return (
    <div
      data-testid="checklist-item"
      className="border-2 rounded-lg p-4 transition-all duration-200 border-slate-300 bg-white"
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex min-w-0 flex-1 gap-2">
          {(onMoveUp || onMoveDown || dragHandleProps) && (
            <div className="flex shrink-0 flex-col items-center gap-0.5 pt-0.5">
              {onMoveUp && (
                <button
                  type="button"
                  data-testid={`move-item-up-${item.name}`}
                  disabled={!canMoveUp}
                  onClick={onMoveUp}
                  className="rounded-md p-1 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
                  aria-label="Mover item para cima"
                  title="Mover para cima"
                >
                  <ChevronUp size={22} aria-hidden />
                </button>
              )}
              {dragHandleProps && (
                <div
                  {...dragHandleProps}
                  className="cursor-grab touch-none select-none rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700 active:cursor-grabbing"
                  aria-label="Arrastar para reordenar"
                  title="Arrastar para reordenar"
                >
                  <GripVertical size={22} aria-hidden />
                </div>
              )}
              {onMoveDown && (
                <button
                  type="button"
                  data-testid={`move-item-down-${item.name}`}
                  disabled={!canMoveDown}
                  onClick={onMoveDown}
                  className="rounded-md p-1 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
                  aria-label="Mover item para baixo"
                  title="Mover para baixo"
                >
                  <ChevronDown size={22} aria-hidden />
                </button>
              )}
            </div>
          )}
          <h4 className="min-w-0 flex-1 font-bold capitalize text-slate-900 leading-snug tracking-tight">
            {item.name}
          </h4>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
          {onRemoveItem && (
            <button
              type="button"
              data-testid={`remove-item-${item.name}`}
              onClick={onRemoveItem}
              className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-red-50 hover:text-red-700 active:bg-red-100"
              aria-label={`Remover elemento ${item.name}`}
              title="Remover elemento"
            >
              <Trash2 size={20} aria-hidden />
            </button>
          )}
          <button
            type="button"
            data-testid={`verification-points-${item.name}`}
            onClick={() => setShowVerificationsModal(true)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-bold uppercase tracking-wide text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors"
            aria-label="Itens verificados"
          >
            <ClipboardList size={14} aria-hidden />
            Itens verificados
            {extraCount > 0 && (
              <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] tabular-nums text-blue-800">
                +{extraCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {showVerificationsModal &&
        createPortal(
          <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-4 sm:items-center">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="vp-modal-title"
              className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-t-xl bg-white shadow-xl sm:rounded-xl"
            >
              <div className="border-b border-slate-200 px-4 py-3 sm:px-5">
                <h3
                  id="vp-modal-title"
                  className="text-lg font-bold font-secondary capitalize text-slate-900"
                >
                  Itens verificados — {item.name}
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Texto de referência do elemento. Pode incluir critérios adicionais abaixo, se
                  necessário.
                </p>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-5">
                <div className="space-y-5">
                  <div>
                    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                      Elementos e verificações
                    </p>
                    <div className="rounded-lg border border-slate-200 bg-slate-50/90 p-4 text-sm leading-relaxed text-slate-800 whitespace-pre-wrap">
                      {verificationBody || (
                        <span className="text-slate-500 italic">
                          Nenhum texto de verificação definido. Use observações e fotos, ou inclua
                          critérios abaixo.
                        </span>
                      )}
                    </div>
                  </div>
                  {additionalVerifications.length > 0 && (
                    <div>
                      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                        Critérios adicionais incluídos
                      </p>
                      <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-slate-800">
                        {additionalVerifications.map((line, i) => (
                          <li key={i}>
                            {line.charAt(0).toUpperCase()}
                            {line.slice(1)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div>
                    <label
                      htmlFor={`extra-criterion-${item.id || item.name}`}
                      className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500"
                    >
                      Incluir critério
                    </label>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
                      <input
                        id={`extra-criterion-${item.id || item.name}`}
                        type="text"
                        value={extraDraft}
                        onChange={(e) => setExtraDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const t = extraDraft.trim();
                            if (!t) return;
                            const cap = t.charAt(0).toUpperCase() + t.slice(1);
                            onChange({
                              ...item,
                              additional_verifications: [...additionalVerifications, cap],
                            });
                            setExtraDraft('');
                          }
                        }}
                        placeholder="Descreva o critério a incluir"
                        className="min-h-touch min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 sm:min-h-0"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const t = extraDraft.trim();
                          if (!t) return;
                          const cap = t.charAt(0).toUpperCase() + t.slice(1);
                          onChange({
                            ...item,
                            additional_verifications: [...additionalVerifications, cap],
                          });
                          setExtraDraft('');
                        }}
                        className="min-h-touch shrink-0 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 sm:min-h-0"
                      >
                        Incluir
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <div className="border-t border-slate-200 p-4 sm:px-5">
                <button
                  type="button"
                  onClick={() => setShowVerificationsModal(false)}
                  className="min-h-touch w-full rounded-lg bg-slate-900 py-3 text-sm font-semibold text-white hover:bg-slate-800 sm:min-h-0"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      <div className="flex gap-2">
        <button
          data-testid={`photo-button-${item.name}`}
          onClick={() => setShowPhotoInput(!showPhotoInput)}
          className="flex items-center gap-2 px-3 py-2 bg-blue-100 text-blue-700 rounded-lg font-semibold text-sm transition-all duration-200 hover:bg-blue-200"
        >
          <Camera size={16} />
          Foto ({photos.length})
        </button>
        <button
          data-testid={`observation-button-${item.name}`}
          onClick={() => setShowObservations(!showObservations)}
          className="flex items-center gap-2 px-3 py-2 bg-slate-100 text-slate-700 rounded-lg font-semibold text-sm transition-all duration-200 hover:bg-slate-200"
        >
          <MessageSquare size={16} />
          Observações
        </button>
      </div>

      {showPhotoInput && (
        <div className="mt-3 p-3 bg-slate-50 rounded-lg">
          <label className="text-xs font-bold tracking-wider uppercase text-slate-500 mb-3 block">
            Adicionar Fotos
          </label>

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

          <div className="flex gap-2 mb-3">
            <button
              data-testid={`choose-file-${item.name}`}
              onClick={handleChooseFile}
              disabled={isCompressing}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-blue-600 text-white rounded-lg font-semibold text-sm transition-all duration-200 hover:bg-blue-700 active:scale-95 disabled:opacity-50"
            >
              {isCompressing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Comprimindo...
                </>
              ) : (
                <>
                  <FolderOpen size={18} />
                  Escolher Arquivo
                </>
              )}
            </button>
            <button
              data-testid={`take-photo-${item.name}`}
              onClick={handleTakePhoto}
              disabled={isCompressing}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-green-600 text-white rounded-lg font-semibold text-sm transition-all duration-200 hover:bg-green-700 active:scale-95 disabled:opacity-50"
            >
              {isCompressing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Comprimindo...
                </>
              ) : (
                <>
                  <Smartphone size={18} />
                  Tirar Foto
                </>
              )}
            </button>
          </div>

          {showMobileWarning && (
            <div className="mb-3 p-3 bg-yellow-100 border border-yellow-300 rounded-lg">
              <p className="text-sm text-yellow-800 font-medium">
                A função &quot;Tirar Foto&quot; está disponível apenas em dispositivos móveis (celular ou
                tablet).
              </p>
            </div>
          )}

          {photos.length > 0 && (
            <div className="mt-4 space-y-3">
              <label className="text-xs font-bold tracking-wider uppercase text-slate-500 block">
                Fotos Adicionadas ({photos.length})
              </label>
              {photos.map((photo, index) => (
                <div key={index} className="bg-white rounded-lg p-3 border border-slate-200">
                  <div className="flex gap-3">
                    <div className="relative flex-shrink-0">
                      <img
                        src={photo.url}
                        alt={photo.caption}
                        className="w-20 h-20 object-cover rounded-lg"
                      />
                      <button
                        onClick={() => handleRemovePhoto(index)}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600"
                      >
                        <X size={12} />
                      </button>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Image size={14} className="text-slate-400" />
                        <span className="text-xs font-bold text-blue-600">FOTO {photo.number}</span>
                      </div>
                      <input
                        type="text"
                        value={photo.caption}
                        onChange={(e) => updatePhotoCaption(index, e.target.value)}
                        placeholder="Digite a legenda da foto..."
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showObservations && (
        <div className="mt-3">
          <textarea
            data-testid={`observation-textarea-${item.name}`}
            value={item.observations || ''}
            onChange={(e) => handleObservationsChange(e.target.value)}
            placeholder="Digite suas observações..."
            className="w-full p-3 border border-slate-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={3}
          />
        </div>
      )}
    </div>
  );
};

export default ChecklistItem;
