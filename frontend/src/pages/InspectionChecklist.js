import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Plus } from 'lucide-react';
import RoomSelector from '../components/RoomSelector';
import ChecklistItem from '../components/ChecklistItem';
import { toast } from 'sonner';
import { inspectionsApi } from '../services/api';
import { loadInspectionWithFallback } from '../utils/inspectionLoader';
import {
  getInspectionLocally,
  saveInspectionLocally,
  initDB,
} from '../utils/offlineStorage';

const LOGO_URL = 'https://customer-assets.emergentagent.com/job_vistoria-imovel-1/artifacts/msx2fmcu_Design%20sem%20nome-Photoroom.png';

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
      'Piso (contrapiso / cerâmica)',
      'Rodapé',
      'Tomadas, interruptores e iluminação',
      'Quadro de energia',
      'Limpeza',
      'Dimensões'
    ]
  },
  cozinha: {
    name: 'Cozinha',
    items: [
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
      'Piso Cerâmico',
      'Tomadas, interruptores e iluminação',
      'Ventilação Forçada',
      'Interfone',
      'Limpeza',
      'Dimensões'
    ]
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
      'Piso (Contrapiso/Cerâmica)',
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
      'Piso',
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
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [roomsData, setRoomsData] = useState([]);
  const [roomsList, setRoomsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddRoom, setShowAddRoom] = useState(false);
  const contentRef = useRef(null);

  useEffect(() => {
    loadInspection();
  }, [id]);

  const loadInspection = async () => {
    try {
      const res = await loadInspectionWithFallback(id);
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
  };

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

  const calculateRoomProgress = (room) => {
    const totalItems = room.items.length;
    const completedItems = room.items.filter(
      (item) => item.exists && (item.exists === 'nao' || item.condition)
    ).length;
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

  // Função para excluir um cômodo
  const deleteRoom = (roomId) => {
    const roomToDelete = roomsList.find(r => r.id === roomId);
    if (!roomToDelete) return;

    // Remover da lista de cômodos
    const newRoomsList = roomsList.filter(r => r.id !== roomId);
    const newRoomsData = roomsData.filter(r => r.room_id !== roomId);

    setRoomsList(newRoomsList);
    setRoomsData(newRoomsData);

    // Se o cômodo excluído era o selecionado, selecionar outro
    if (selectedRoomId === roomId) {
      if (newRoomsList.length > 0) {
        setSelectedRoomId(newRoomsList[0].id);
      } else {
        setSelectedRoomId(null);
      }
    }

    // Renumerar fotos após exclusão
    if (newRoomsData.length > 0) {
      const renumberedData = renumberAllPhotos(newRoomsData);
      setRoomsData(renumberedData);
    }

    toast.success(`${roomToDelete.name} removido!`);
  };

  // Validar se todos os itens estão preenchidos
  const validateChecklist = () => {
    const missingItems = [];
    
    roomsData.forEach((room) => {
      room.items.forEach((item) => {
        if (!item.exists) {
          missingItems.push(`${room.room_name}: "${item.name}" - Existência`);
        } else if (item.exists === 'sim' && !item.condition) {
          missingItems.push(`${room.room_name}: "${item.name}" - Condição`);
        }
      });
    });
    
    return missingItems;
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
      
      let message = '⚠️ Não é possível continuar!\n\nPreencha todos os campos de Existência e Condição.\n\nItens pendentes:\n' + displayItems.join('\n');
      if (remaining > 0) {
        message += `\n\n... e mais ${remaining} item(s) faltando`;
      }
      
      toast.error(message, { duration: 8000 });
      return; // Permanece na página
    }

    try {
      await initDB().catch(() => {});
      const result = await inspectionsApi.update(id, {
        rooms_checklist: roomsData,
      });
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
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* Header */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white py-6 px-4">
        <div className="max-w-md mx-auto md:max-w-2xl">
          <button
            data-testid="back-to-identification-button"
            onClick={() => navigate(`/inspection/${id}/edit`)}
            className="flex items-center gap-2 text-slate-300 hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft size={20} />
            Voltar para Identificação
          </button>
          <div className="flex items-center gap-4">
            <img src={LOGO_URL} alt="OSTI Engenharia" className="h-10 w-auto" />
            <h1 className="text-2xl font-bold tracking-tight font-secondary uppercase">
              Checklist da Vistoria
            </h1>
          </div>
        </div>
      </div>

      {/* Room Selector */}
      <RoomSelector
        rooms={roomsList}
        selectedRoomId={selectedRoomId}
        onSelectRoom={handleRoomSelect}
        roomsProgress={getRoomsProgress()}
        onAddRoom={() => setShowAddRoom(true)}
        onDeleteRoom={deleteRoom}
      />

      {/* Add Room Modal */}
      {showAddRoom && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-slate-900 font-secondary uppercase mb-4">
              Adicionar Cômodo
            </h3>
            <div className="space-y-2">
              {Object.keys(ROOM_TEMPLATES).map((type) => (
                <button
                  key={type}
                  data-testid={`add-room-${type}`}
                  onClick={() => addRoom(type)}
                  className="w-full py-3 px-4 bg-slate-100 text-slate-700 rounded-lg font-semibold text-left hover:bg-slate-200 transition-colors"
                >
                  {ROOM_TEMPLATES[type].name}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowAddRoom(false)}
              className="w-full mt-4 py-3 px-4 bg-slate-900 text-white rounded-lg font-semibold hover:bg-slate-800 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Checklist Items */}
      <div ref={contentRef} className="max-w-md mx-auto md:max-w-2xl px-4 py-6">
        {roomsList.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Plus size={40} className="text-blue-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Nenhum cômodo adicionado</h2>
            <p className="text-slate-500 mb-6">Clique no botão "Adicionar" acima para incluir os cômodos do imóvel</p>
            <button
              onClick={() => setShowAddRoom(true)}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              + Adicionar Cômodo
            </button>
          </div>
        ) : (
          <>
            <h2 className="text-2xl font-bold text-slate-900 font-secondary uppercase mb-4">
              {selectedRoom?.room_name}
            </h2>

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

      {/* Fixed Bottom Button */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4">
        <div className="max-w-md mx-auto md:max-w-2xl">
          <button
            data-testid="save-and-continue-button"
            onClick={handleSaveAndContinue}
            className="w-full bg-blue-600 text-white py-4 rounded-lg font-bold font-secondary uppercase text-lg transition-all duration-200 hover:bg-blue-700 active:scale-95 flex items-center justify-center gap-2"
          >
            Salvar e Continuar
            <ArrowRight size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default InspectionChecklist;
