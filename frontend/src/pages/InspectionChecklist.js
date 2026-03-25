import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Plus, Trash2 } from 'lucide-react';
import RoomSelector from '../components/RoomSelector';
import ChecklistItem from '../components/ChecklistItem';
import { LogoutHeaderButton } from '../components/LogoutHeaderButton';
import { toast } from 'sonner';
import { useAuth } from '@/auth';
import { inspectionsApi } from '../services/api';
import { loadInspectionWithFallback } from '../utils/inspectionLoader';
import {
  getInspectionLocally,
  saveInspectionLocally,
  initDB,
  enqueueSyncOperation,
} from '../utils/offlineStorage';
import BrandLogo from '@/components/BrandLogo';

// Itens padrão de cozinha — reutilizado em Área de Serviço
const ITEMS_COZINHA = [
  'Teto',
  'Paredes',
  'Revestimento da Parede (Azulejo)',
  'Esquadrias - Janela',
  'Peitoril da Janela',
  'Esquadrias - Porta',
  'Soleiras',
  'Pintura',
  'Pia e Bancada',
  'Louças e Metais',
  'Instalações Hidráulicas',
  'Instalação de Gás',
  'Ralo',
  'Piso (contrapiso/cerâmica)',
  'Tomadas, interruptores e iluminação',
  'Ventilação Forçada',
  'Interfone',
  'Limpeza',
  'Dimensões',
];

// Templates de cômodos com itens na ordem correta
const ROOM_TEMPLATES = {
  sala: {
    name: 'Sala',
    items: [
      'Teto',
      'Paredes',
      'Esquadrias – Janela',
      'Peitoril da Janela',
      'Esquadrias – Porta',
      'Soleiras / Baguetes',
      'Pintura',
      'Piso (contrapiso/cerâmica)',
      'Rodapé',
      'Tomadas, interruptores e iluminação',
      'Quadro de energia',
      'Ponto de Ar-Condicionado',
      'Limpeza',
      'Dimensões'
    ]
  },
  cozinha: {
    name: 'Cozinha',
    items: [...ITEMS_COZINHA],
  },
  area_servico: {
    name: 'Área de Serviço',
    items: [...ITEMS_COZINHA],
  },
  banheiro: {
    name: 'Banheiro',
    items: [
      'Teto',
      'Paredes',
      'Piso e Azulejo Cerâmico',
      'Esquadria - Janela',
      'Peitoril da Janela',
      'Esquadrias - Porta',
      'Soleira',
      'Pintura',
      'Louças e Metais',
      'Instalações Hidráulicas',
      'Box de banho',
      'Ralo',
      'Tomadas, interruptores e iluminação',
      'Ventilação Forçada',
      'Limpeza',
      'Dimensões'
    ]
  },
  varanda: {
    name: 'Área Externa (Varanda)',
    items: [
      'Teto',
      'Paredes',
      'Revestimento da Parede (Azulejo)',
      'Esquadria - Janela',
      'Peitoril da Janela',
      'Esquadrias - Porta',
      'Soleira',
      'Guarda-Corpo',
      'Pintura',
      'Piso (contrapiso/cerâmica)',
      'Ralo',
      'Rodapé',
      'Tomadas, interruptores e iluminação',
      'Limpeza',
      'Dimensões'
    ]
  },
  quarto: {
    name: 'Quarto',
    items: [
      'Teto',
      'Paredes',
      'Esquadrias - Janela',
      'Peitoril da Janela',
      'Esquadrias - Porta',
      'Soleira/Baguete',
      'Pintura',
      'Ponto de Ar-Condicionado',
      'Piso (contrapiso/cerâmica)',
      'Rodapé',
      'Tomadas, interruptores e iluminação',
      'Limpeza',
      'Dimensões'
    ]
  }
};

// Cômodos iniciais padrão - VAZIO, usuário adiciona conforme necessário
const DEFAULT_ROOMS = [];

const InspectionChecklist = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const uid = user?.uid;
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [roomsData, setRoomsData] = useState([]);
  const [roomsList, setRoomsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddRoom, setShowAddRoom] = useState(false);
  /** Confirmação antes de excluir cômodo (mobile + desktop) */
  const [deleteRoomTarget, setDeleteRoomTarget] = useState(null);
  const contentRef = useRef(null);

  const loadInspection = useCallback(async () => {
    try {
      const res = await loadInspectionWithFallback(id, uid);
      if (!res.ok) {
        toast.error(res.error || 'Erro ao carregar vistoria');
        return;
      }
      if (res.fromLocal) {
        toast.info('Sem servidor — a mostrar dados guardados neste dispositivo.');
      }
      const inspection = res.data;
      const roomsChecklist = inspection.rooms_checklist || [];

      if (roomsChecklist.length === 0) {
        // Sem cômodos padrão - usuário adiciona
        setRoomsData([]);
        setRoomsList([]);
        setSelectedRoomId(null);
      } else {
        setRoomsData(roomsChecklist);
        const savedRooms = roomsChecklist.map((room) => ({
          id: room.room_id,
          name: room.room_name,
          type: room.room_type || room.room_id
        }));
        setRoomsList(savedRooms);
        if (savedRooms.length > 0) {
          setSelectedRoomId(savedRooms[0].id);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar vistoria:', error);
      toast.error('Erro ao carregar vistoria');
    } finally {
      setLoading(false);
    }
  }, [id, uid]);

  useEffect(() => {
    loadInspection();
  }, [loadInspection]);

  // Função para renumerar TODAS as fotos globalmente
  // Ordem: cômodos da esquerda para direita (ordem das abas), itens de cima para baixo
  const renumberAllPhotos = (newRoomsData) => {
    let globalNumber = 1;
    const updatedRooms = newRoomsData.map((room) => ({
      ...room,
      items: room.items.map((item) => {
        const photos = (item.photos || []).map((photo) => {
          // Preserva a parte da legenda após o número (se houver)
          const existingCaption = photo.caption || '';
          const captionParts = existingCaption.match(/^Foto \d+\.\s*(.*)/);
          const userText = captionParts ? captionParts[1] : '';
          
          const updatedPhoto = {
            ...photo,
            number: globalNumber,
            caption: `Foto ${globalNumber}. ${userText}`
          };
          globalNumber++;
          return updatedPhoto;
        });
        return { ...item, photos };
      })
    }));
    return updatedRooms;
  };

  // Função para contar total de fotos globalmente
  const getTotalPhotoCount = () => {
    let count = 0;
    roomsData.forEach((room) => {
      room.items.forEach((item) => {
        const photos = item.photos || [];
        count += photos.length;
      });
    });
    return count;
  };

  const handleItemChange = (roomIndex, itemIndex, updatedItem, shouldRenumber = false) => {
    const newRoomsData = [...roomsData];
    newRoomsData[roomIndex].items[itemIndex] = updatedItem;
    
    if (shouldRenumber) {
      const renumberedData = renumberAllPhotos(newRoomsData);
      setRoomsData(renumberedData);
    } else {
      setRoomsData(newRoomsData);
    }
  };

  // Função para adicionar foto e renumerar TODAS as fotos
  const handleAddPhoto = (roomIndex, itemIndex, photoData) => {
    const newRoomsData = [...roomsData];
    const item = newRoomsData[roomIndex].items[itemIndex];
    
    // Adiciona foto com número temporário (será corrigido pela renumeração)
    const newPhoto = {
      url: photoData,
      caption: `Foto 0. `,
      number: 0
    };
    
    item.photos = [...(item.photos || []), newPhoto];
    
    // Renumera TODAS as fotos para garantir ordem correta
    const renumberedData = renumberAllPhotos(newRoomsData);
    setRoomsData(renumberedData);
  };

  // Função para remover foto e renumerar TODAS as fotos
  const handleRemovePhoto = (roomIndex, itemIndex, photoIndex) => {
    const newRoomsData = [...roomsData];
    const item = newRoomsData[roomIndex].items[itemIndex];
    item.photos = item.photos.filter((_, i) => i !== photoIndex);
    
    // Renumera TODAS as fotos para garantir ordem correta
    const renumberedData = renumberAllPhotos(newRoomsData);
    setRoomsData(renumberedData);
  };

  const itemChecklistCompleto = (item) => {
    if (!item.exists) return false;
    if (item.exists === 'nao') return true;
    if (item.exists === 'sim') {
      const obs = item.observations && String(item.observations).trim();
      return Boolean(item.condition || obs);
    }
    return false;
  };

  const calculateRoomProgress = (room) => {
    const totalItems = room.items.length;
    const completedItems = room.items.filter(itemChecklistCompleto).length;
    return totalItems > 0 ? (completedItems / totalItems) * 100 : 0;
  };

  const getRoomsProgress = () => {
    const progress = {};
    roomsData.forEach((room) => {
      progress[room.room_id] = calculateRoomProgress(room);
    });
    return progress;
  };

  // Trocar de aba e voltar ao topo da página
  const handleRoomSelect = (roomId) => {
    setSelectedRoomId(roomId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const addRoom = (type) => {
    const template = ROOM_TEMPLATES[type];
    if (!template) return;

    const count = roomsList.filter(r => r.type === type).length;
    const suffix = count > 0 ? ` ${count + 1}` : '';
    const newId = `${type}_${Date.now()}`;
    const newName = `${template.name}${suffix}`;

    const newRoom = {
      id: newId,
      name: newName,
      type: type
    };

    const newRoomData = {
      room_id: newId,
      room_name: newName,
      room_type: type,
      items: template.items.map((itemName) => ({
        name: itemName,
        exists: null,
        condition: null,
        observations: '',
        photos: []
      }))
    };

    setRoomsList([...roomsList, newRoom]);
    setRoomsData([...roomsData, newRoomData]);
    setSelectedRoomId(newId);
    setShowAddRoom(false);
    toast.success(`${newName} adicionado!`);
  };

  const requestDeleteRoom = (roomId) => {
    const roomToDelete = roomsList.find((r) => r.id === roomId);
    if (!roomToDelete) return;
    setDeleteRoomTarget({ id: roomToDelete.id, name: roomToDelete.name });
  };

  const removeRoomConfirmed = (roomId) => {
    const roomToDelete = roomsList.find((r) => r.id === roomId);
    if (!roomToDelete) return;

    const newRoomsList = roomsList.filter((r) => r.id !== roomId);
    const newRoomsData = roomsData.filter((r) => r.room_id !== roomId);

    setRoomsList(newRoomsList);
    setRoomsData(newRoomsData);

    if (selectedRoomId === roomId) {
      if (newRoomsList.length > 0) {
        setSelectedRoomId(newRoomsList[0].id);
      } else {
        setSelectedRoomId(null);
      }
    }

    if (newRoomsData.length > 0) {
      const renumberedData = renumberAllPhotos(newRoomsData);
      setRoomsData(renumberedData);
    }

    toast.success(`${roomToDelete.name} removido!`);
  };

  const confirmDeleteRoom = () => {
    if (!deleteRoomTarget) return;
    removeRoomConfirmed(deleteRoomTarget.id);
    setDeleteRoomTarget(null);
  };

  // Validar se todos os itens estão preenchidos (existência "sim" + observação dispensa condição)
  const validateChecklist = () => {
    const missingItems = [];

    roomsData.forEach((room) => {
      room.items.forEach((item) => {
        if (!item.exists) {
          missingItems.push(`${room.room_name}: "${item.name}" - Existência`);
        } else if (item.exists === 'sim') {
          const obs = item.observations && String(item.observations).trim();
          if (!item.condition && !obs) {
            missingItems.push(`${room.room_name}: "${item.name}" - Condição ou observação`);
          }
        }
      });
    });

    return missingItems;
  };

  const pendingChecklistItems = validateChecklist();
  const canAddAnotherRoom =
    roomsData.length === 0 || pendingChecklistItems.length === 0;

  const handleOpenAddRoomModal = () => {
    if (roomsData.length > 0) {
      const missing = validateChecklist();
      if (missing.length > 0) {
        const displayItems = missing.slice(0, 5);
        const remaining = missing.length - 5;
        let message =
          '⚠️ Preencha Existência e, quando o item existir, Condição ou observação antes de adicionar outro cômodo.\n\nItens pendentes:\n' +
          displayItems.join('\n');
        if (remaining > 0) {
          message += `\n\n... e mais ${remaining} item(s) faltando`;
        }
        toast.error(message, { duration: 8000 });
        return;
      }
    }
    setShowAddRoom(true);
  };

  const handleSaveAndContinue = async () => {
    // Verificar se há pelo menos um cômodo
    if (roomsData.length === 0) {
      toast.error('⚠️ Adicione pelo menos um cômodo antes de continuar!', { duration: 5000 });
      return;
    }

    // Validar checklist
    const missingItems = validateChecklist();
    
    if (missingItems.length > 0) {
      // Mostrar mensagem de erro clara
      const displayItems = missingItems.slice(0, 5);
      const remaining = missingItems.length - 5;
      
      let message =
        '⚠️ Não é possível continuar!\n\nPreencha Existência e, quando o item existir, Condição ou observação.\n\nItens pendentes:\n' +
        displayItems.join('\n');
      if (remaining > 0) {
        message += `\n\n... e mais ${remaining} item(s) faltando`;
      }
      
      toast.error(message, { duration: 8000 });
      return; // Permanece na página
    }

    if (!uid) {
      toast.error('Sessão inválida. Inicie sessão novamente.');
      return;
    }

    try {
      await initDB().catch(() => {});
      const result = await inspectionsApi.update(
        id,
        {
          rooms_checklist: roomsData,
        },
        uid
      );
      if (result.ok) {
        toast.success('Checklist salvo com sucesso!');
        navigate(`/inspection/${id}/review`);
        return;
      }
      const local = await getInspectionLocally(id);
      if (local) {
        await saveInspectionLocally({
          ...local,
          rooms_checklist: roomsData,
        });
        await enqueueSyncOperation({
          method: 'PUT',
          path: `/inspections/${id}`,
          payload: { rooms_checklist: roomsData },
          dedupKey: `PUT:/inspections/${id}:checklist`,
          inspectionId: id,
          userId: uid,
        });
        toast.warning(
          'Servidor indisponível — checklist guardado só neste dispositivo.'
        );
        navigate(`/inspection/${id}/review`);
        return;
      }
      toast.error(result.error || 'Erro ao salvar checklist');
    } catch (error) {
      console.error('Erro ao salvar checklist:', error);
      toast.error('Erro ao salvar checklist');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const selectedRoom = roomsData.find((room) => room.room_id === selectedRoomId);
  const selectedRoomIndex = roomsData.findIndex((room) => room.room_id === selectedRoomId);

  return (
    <div className="min-h-dvh bg-slate-50 pb-44 sm:pb-40">
      {/* Header */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 px-4 py-5 text-white sm:py-6">
        <div className="mx-auto w-full max-w-app-readable xl:max-w-app-wide">
          <button
            type="button"
            data-testid="back-to-identification-button"
            onClick={() => navigate(`/inspection/${id}/edit`)}
            className="mb-4 flex min-h-touch items-center gap-2 text-slate-300 transition-colors hover:text-white sm:min-h-0"
          >
            <ArrowLeft size={20} className="shrink-0" />
            <span className="text-left text-sm sm:text-base">Voltar para Identificação</span>
          </button>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <BrandLogo className="h-[3.75rem] w-auto max-w-[10rem] shrink-0 object-contain object-left py-0.5 sm:h-[4.5rem] sm:max-w-[12rem]" />
              <h1 className="text-balance text-xl font-bold font-secondary uppercase tracking-tight sm:text-2xl lg:text-[1.65rem]">
                Inspeção Técnica e Checklist de Verificação
              </h1>
            </div>
            <LogoutHeaderButton />
          </div>
        </div>
      </div>

      {/* Room Selector */}
      <RoomSelector
        rooms={roomsList}
        selectedRoomId={selectedRoomId}
        onSelectRoom={handleRoomSelect}
        roomsProgress={getRoomsProgress()}
        onAddRoom={handleOpenAddRoomModal}
        canAddRoom={canAddAnotherRoom}
        onDeleteRoom={requestDeleteRoom}
      />

      {/* Add Room Modal */}
      {deleteRoomTarget && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-room-title"
            className="w-full max-w-md rounded-t-xl bg-white p-6 shadow-xl sm:rounded-xl"
          >
            <h3
              id="delete-room-title"
              className="mb-2 text-lg font-bold text-slate-900 font-secondary uppercase"
            >
              Excluir cômodo?
            </h3>
            <p className="mb-6 text-sm leading-relaxed text-slate-600">
              O cômodo <strong className="text-slate-900">{deleteRoomTarget.name}</strong> e todos
              os itens, fotos e respostas serão removidos. Esta ação não pode ser desfeita.
            </p>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setDeleteRoomTarget(null)}
                className="min-h-touch w-full rounded-lg border-2 border-slate-200 px-4 py-3 font-semibold text-slate-700 transition-colors hover:bg-slate-50 sm:min-h-0 sm:w-auto"
              >
                Cancelar
              </button>
              <button
                type="button"
                data-testid="confirm-delete-room-button"
                onClick={confirmDeleteRoom}
                className="min-h-touch w-full rounded-lg bg-red-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-red-700 sm:min-h-0 sm:w-auto"
              >
                Excluir cômodo
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddRoom && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-t-xl bg-white p-6 shadow-xl sm:rounded-lg">
            <h3 className="text-xl font-bold text-slate-900 font-secondary uppercase mb-4">
              Adicionar Cômodo
            </h3>
            <div className="space-y-2">
              {Object.keys(ROOM_TEMPLATES).map((type) => (
                <button
                  key={type}
                  type="button"
                  data-testid={`add-room-${type}`}
                  onClick={() => addRoom(type)}
                  className="min-h-touch w-full rounded-lg bg-slate-100 px-4 py-3 text-left font-semibold text-slate-700 transition-colors hover:bg-slate-200 sm:min-h-0"
                >
                  {ROOM_TEMPLATES[type].name}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setShowAddRoom(false)}
              className="mt-4 min-h-touch w-full rounded-lg bg-slate-900 px-4 py-3 font-semibold text-white transition-colors hover:bg-slate-800 sm:min-h-0"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Checklist Items */}
      <div
        ref={contentRef}
        className="mx-auto w-full max-w-app-readable px-4 py-6 sm:px-6 xl:max-w-app-wide"
      >
        {roomsList.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Plus size={40} className="text-blue-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Nenhum cômodo adicionado</h2>
            <p className="text-slate-500 mb-6">Clique no botão "Adicionar" acima para incluir os cômodos do imóvel</p>
            <button
              type="button"
              onClick={() => setShowAddRoom(true)}
              className="min-h-touch rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-blue-700 sm:min-h-0"
            >
              + Adicionar Cômodo
            </button>
          </div>
        ) : (
          <>
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <h2 className="text-balance text-xl font-bold font-secondary uppercase text-slate-900 sm:text-2xl lg:pr-4">
                {selectedRoom?.room_name}
              </h2>
              {selectedRoom && (
                <button
                  type="button"
                  data-testid="delete-current-room-button"
                  onClick={() => requestDeleteRoom(selectedRoom.room_id)}
                  className="inline-flex min-h-touch w-full shrink-0 items-center justify-center gap-2 rounded-lg border-2 border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800 transition-colors hover:border-red-300 hover:bg-red-100 active:bg-red-100 sm:min-h-0 sm:w-auto sm:py-2.5"
                >
                  <Trash2 size={18} className="shrink-0" aria-hidden />
                  Excluir cômodo
                </button>
              )}
            </div>

            {selectedRoom?.items.map((item, itemIndex) => (
              <ChecklistItem
                key={`${selectedRoomId}-${itemIndex}`}
                item={item}
                onChange={(updatedItem, shouldRenumber) => handleItemChange(selectedRoomIndex, itemIndex, updatedItem, shouldRenumber)}
                onAddPhoto={(photoData) => handleAddPhoto(selectedRoomIndex, itemIndex, photoData)}
                onRemovePhoto={(photoIndex) => handleRemovePhoto(selectedRoomIndex, itemIndex, photoIndex)}
                globalPhotoCount={getTotalPhotoCount()}
              />
            ))}
          </>
        )}
      </div>

      {/* Fixed Bottom Buttons */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-slate-200 bg-white/95 p-4 pb-bottom-safe backdrop-blur-sm supports-[backdrop-filter]:bg-white/80">
        <div className="mx-auto w-full max-w-app-readable space-y-3 sm:px-2 xl:max-w-app-wide">
          <button
            type="button"
            data-testid="save-and-continue-button"
            onClick={handleSaveAndContinue}
            className="flex min-h-touch w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-4 text-base font-bold font-secondary uppercase text-white transition-all duration-200 hover:bg-blue-700 active:scale-[0.99] sm:min-h-0 sm:text-lg"
          >
            Salvar e Continuar
            <ArrowRight size={20} />
          </button>
          {roomsList.length > 0 && (
            <button
              type="button"
              data-testid="continue-add-room-button"
              disabled={!canAddAnotherRoom}
              title={
                !canAddAnotherRoom
                  ? 'Preencha Existência e Condição em todos os itens de todos os cômodos antes de adicionar outro'
                  : undefined
              }
              onClick={handleOpenAddRoomModal}
              className={`flex min-h-touch w-full items-center justify-center gap-2 rounded-lg border py-3 text-sm font-semibold transition-all duration-200 sm:min-h-0 ${
                canAddAnotherRoom
                  ? 'border-slate-200 bg-slate-100 text-slate-800 hover:bg-slate-200 active:scale-[0.99]'
                  : 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
              }`}
            >
              <Plus size={18} />
              Continuar adicionando cômodo
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default InspectionChecklist;
