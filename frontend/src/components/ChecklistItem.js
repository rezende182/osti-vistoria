import React, { useState, useRef, useEffect } from 'react';
import {
  Camera,
  MessageSquare,
  X,
  Image,
  FolderOpen,
  Smartphone,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/auth';
import InspectionOrientationModal from './InspectionOrientationModal';
import { getOrientationForItemName } from '../constants/itemOrientations';
import { compressImage, formatFileSize, getDataUrlSize } from '../utils/imageCompressor';
import { inspectionsApi } from '../services/api';

const ChecklistItem = ({
  item,
  roomName = '',
  onChange,
  onAddPhoto,
  onRemovePhoto,
  globalPhotoCount,
}) => {
  const { user } = useAuth();
  const uid = user?.uid;
  const [showPhotoInput, setShowPhotoInput] = useState(false);
  const [showObservations, setShowObservations] = useState(false);
  const [showMobileWarning, setShowMobileWarning] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [showOrientationModal, setShowOrientationModal] = useState(false);
  const [gerandoIA, setGerandoIA] = useState(false);
  const orientation = getOrientationForItemName(item.name);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const photos = (item.photos || []).map((photo, index) => {
    if (typeof photo === 'string') {
      return { url: photo, caption: `Foto ${index + 1}`, number: index + 1 };
    }
    return photo;
  });

  // Itens que não têm campo "Existência" - apenas Condição
  const itensApenasCondicao = ['Limpeza', 'Dimensões'];
  const isApenasCondicao = itensApenasCondicao.includes(item.name);

  // Detectar se é dispositivo móvel
  const isMobileDevice = () => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  };

  const handleExistenceChange = (value) => {
    const newItem = { ...item, exists: value };
    if (value === 'nao') {
      newItem.condition = null;
    }
    onChange(newItem);
  };

  const handleConditionChange = (value) => {
    if (value === 'reprovado') {
      setShowObservations(true);
    }
    // Para itens que são apenas condição, marcar automaticamente como "existe"
    if (isApenasCondicao && item.exists !== 'sim') {
      onChange({ ...item, exists: 'sim', condition: value });
    } else {
      onChange({ ...item, condition: value });
    }
  };

  useEffect(() => {
    if (item.condition === 'reprovado') {
      setShowObservations(true);
    }
  }, [item.condition]);

  const handleObservationsChange = (value) => {
    onChange({ ...item, observations: value });
  };

  const handleDescricaoChange = (value) => {
    onChange({ ...item, descricao: value });
  };

  const handleGerarTextoTecnico = async () => {
    const d = String(item.descricao ?? '').trim();
    if (d.length < 3) {
      toast.error('Descreva o que observou (algumas palavras) antes de gerar.');
      return;
    }
    if (!photos.length) return;
    if (!uid) {
      toast.error('Sessão inválida. Inicie sessão novamente.');
      return;
    }
    setGerandoIA(true);
    toast.info('A gerar legenda técnica e observação...');
    try {
      const res = await inspectionsApi.generateItemChecklistText(
        {
          room_name: roomName || '—',
          item_name: item.name,
          descricao: d,
          num_fotos: photos.length,
        },
        uid
      );
      if (!res.ok) {
        toast.error(res.error || 'Não foi possível gerar o texto.');
        return;
      }
      const { legendas, observacao_tecnica } = res.data;
      const newPhotos = photos.map((photo, index) => {
        const leg = String(legendas[index] || '').trim();
        const body = leg || 'Registo fotográfico do elemento.';
        return {
          ...photo,
          caption: `Foto ${photo.number}. ${body}`,
        };
      });
      onChange({
        ...item,
        photos: newPhotos,
        observations: String(observacao_tecnica || '').trim() || item.observations,
      });
      setShowObservations(true);
      toast.success('Texto gerado — reveja e ajuste se necessário.');
    } catch (e) {
      console.error(e);
      toast.error('Erro ao gerar texto técnico.');
    } finally {
      setGerandoIA(false);
    }
  };

  // Escolher arquivo do dispositivo
  const handleChooseFile = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Tirar foto pela câmera
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
        // Comprimir imagem antes de adicionar
        const compressedImage = await compressImage(file, {
          maxWidth: 1200,
          maxHeight: 1200,
          quality: 0.7
        });
        
        // Log da compressão
        const originalSize = file.size;
        const compressedSize = getDataUrlSize(compressedImage);
        console.log(`[Compressão] Original: ${formatFileSize(originalSize)} → Comprimido: ${formatFileSize(compressedSize)}`);
        
        // Chamar função do componente pai para adicionar foto com número global
        onAddPhoto(compressedImage);
      } catch (error) {
        console.error('Erro ao processar imagem:', error);
        // Fallback: usar imagem original se compressão falhar
        const reader = new FileReader();
        const base64 = await new Promise((resolve) => {
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(file);
        });
        onAddPhoto(base64);
      }
    }
    
    setIsCompressing(false);
    // Limpar input para permitir selecionar o mesmo arquivo novamente
    e.target.value = '';
  };

  const handleRemovePhoto = (index) => {
    onRemovePhoto(index);
  };

  const updatePhotoCaption = (index, caption) => {
    const newPhotos = [...(item.photos || [])];
    const photo = newPhotos[index];
    
    // Preserva o número da foto, mas permite editar o texto após "Foto X. "
    // Se o usuário apagar o prefixo, recoloca automaticamente
    let finalCaption = caption;
    const prefixPattern = /^Foto \d+\.\s*/;
    
    if (!prefixPattern.test(caption)) {
      // Usuário apagou o prefixo, recoloca
      finalCaption = `Foto ${photo.number}. ${caption}`;
    }
    
    newPhotos[index] = { ...photo, caption: finalCaption };
    onChange({ ...item, photos: newPhotos });
  };

  const getStatusColor = () => {
    if (item.exists === 'nao') return 'border-slate-300 bg-slate-50';
    if (item.condition === 'aprovado') return 'border-green-500 bg-green-50';
    if (item.condition === 'reprovado') return 'border-red-500 bg-red-50';
    return 'border-slate-300 bg-white';
  };

  return (
    <div data-testid="checklist-item" className={`border-2 rounded-lg p-4 mb-3 transition-all duration-200 ${getStatusColor()}`}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <h4 className="font-bold text-slate-900 flex-1 leading-snug">{item.name}</h4>
        <button
          type="button"
          data-testid={`orientation-info-${item.name}`}
          onClick={() => setShowOrientationModal(true)}
          className="shrink-0 px-2 py-1 rounded-md text-xs font-bold uppercase tracking-wide text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors"
          aria-label="Dicas de inspeção"
        >
          Dicas
        </button>
      </div>

      <InspectionOrientationModal
        isOpen={showOrientationModal}
        onClose={() => setShowOrientationModal(false)}
        itemTitle={orientation.title}
        bullets={orientation.bullets}
      />

      {/* Existência - NÃO mostrar para Limpeza e Dimensões */}
      {!isApenasCondicao && (
        <div className="mb-3">
          <label className="text-xs font-bold tracking-wider uppercase text-slate-500 mb-2 block">
            Existência
          </label>
          <div className="flex gap-2">
            <button
              data-testid={`exists-sim-${item.name}`}
              onClick={() => handleExistenceChange('sim')}
              className={`flex-1 py-2 px-4 rounded-lg font-semibold transition-all duration-200 ${
                item.exists === 'sim'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Existe
            </button>
            <button
              data-testid={`exists-nao-${item.name}`}
              onClick={() => handleExistenceChange('nao')}
              className={`flex-1 py-2 px-4 rounded-lg font-semibold transition-all duration-200 ${
                item.exists === 'nao'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Não existe
            </button>
          </div>
        </div>
      )}

      {/* Condição - Sempre mostrar para Limpeza/Dimensões, ou quando existe !== 'nao' */}
      {(isApenasCondicao || item.exists !== 'nao') && (
        <div className="mb-3">
          <label className="text-xs font-bold tracking-wider uppercase text-slate-500 mb-2 block">
            Condição
          </label>
          <div className="flex gap-2">
            <button
              data-testid={`condition-aprovado-${item.name}`}
              onClick={() => handleConditionChange('aprovado')}
              className={`flex-1 py-2 px-4 rounded-lg font-semibold transition-all duration-200 ${
                item.condition === 'aprovado'
                  ? 'bg-green-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Aprovado
            </button>
            <button
              data-testid={`condition-reprovado-${item.name}`}
              onClick={() => handleConditionChange('reprovado')}
              className={`flex-1 py-2 px-4 rounded-lg font-semibold transition-all duration-200 ${
                item.condition === 'reprovado'
                  ? 'bg-red-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Reprovado
            </button>
          </div>
        </div>
      )}

      {/* Action buttons */}
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

      {/* Photo upload */}
      {showPhotoInput && (
        <div className="mt-3 p-3 bg-slate-50 rounded-lg">
          <label className="text-xs font-bold tracking-wider uppercase text-slate-500 mb-3 block">
            Adicionar Fotos
          </label>
          
          {/* Inputs escondidos */}
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

          {/* Botões de ação */}
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

          {/* Aviso de dispositivo móvel */}
          {showMobileWarning && (
            <div className="mb-3 p-3 bg-yellow-100 border border-yellow-300 rounded-lg">
              <p className="text-sm text-yellow-800 font-medium">
                A função "Tirar Foto" está disponível apenas em dispositivos móveis (celular ou tablet).
              </p>
            </div>
          )}

          {photos.length > 0 && (
            <div className="mt-4 mb-4 rounded-lg border border-slate-200 bg-white p-3">
              <label
                className="text-xs font-bold tracking-wider uppercase text-slate-500 mb-2 block"
                htmlFor={`descricao-item-${item.name}`}
              >
                Descrição do que observou
              </label>
              <textarea
                id={`descricao-item-${item.name}`}
                data-testid={`descricao-item-${item.name}`}
                value={item.descricao ?? ''}
                onChange={(e) => handleDescricaoChange(e.target.value)}
                placeholder="Ex.: trinca junto ao rodapé, tinta a descascar na zona da janela..."
                rows={3}
                className="w-full p-3 border border-slate-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
              />
              <p className="text-xs text-slate-500 mb-3 leading-relaxed">
                Com base nesta descrição, o sistema pode gerar a legenda técnica de cada foto e a
                observação do item (requer API configurada no servidor).
              </p>
              <button
                type="button"
                data-testid={`gerar-ia-${item.name}`}
                onClick={handleGerarTextoTecnico}
                disabled={gerandoIA}
                className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-50 disabled:pointer-events-none"
              >
                {gerandoIA ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    A gerar…
                  </>
                ) : (
                  <>
                    <Sparkles size={18} className="shrink-0" aria-hidden />
                    Gerar legenda e observação (IA)
                  </>
                )}
              </button>
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
                        <span className="text-xs font-bold text-blue-600">
                          FOTO {photo.number}
                        </span>
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

      {/* Observations */}
      {showObservations && (
        <div className="mt-3">
          <textarea
            data-testid={`observation-textarea-${item.name}`}
            value={item.observations}
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
