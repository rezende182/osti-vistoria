import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Pencil, Plus, Save, Trash2, X } from 'lucide-react';
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
import { compressRoomsChecklistPhotosIfNeeded } from '../utils/imageCompressor';
import {
  ROOM_TYPE_LABELS,
  ROOM_TYPE_ORDER,
  ROOM_TYPE_CUSTOM,
  buildItemsFromRoomType,
  getAvailableElementsToAdd,
  getElementsForRoomType,
  getMasterCatalogEntryByName,
  normalizeChecklistItemName,
} from '../constants/checklistElementTemplates';

function capitalizeFirst(text) {
  const t = (text || '').trim();
  if (!t) return '';
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function hydrateChecklistItem(item, roomType, roomId, itemIdx) {
  const id = item.id || `${roomId}_i_${itemIdx}`;
  const photos = item.photos || [];

  let verification_text =
    typeof item.verification_text === 'string' ? item.verification_text.trim() : '';

  if (!verification_text && item.verification_points?.length) {
    verification_text = item.verification_points
      .filter((vp) => vp && !vp.excluded)
      .map((vp) => (vp.text || '').trim())
      .filter(Boolean)
      .join(', ');
  }

  const templateEls = getElementsForRoomType(roomType);
  const match = templateEls.find(
    (e) => normalizeChecklistItemName(e.name) === normalizeChecklistItemName(item.name)
  );
  const catalogMatch = getMasterCatalogEntryByName(item.name);
  const resolvedText = match?.verificationText || catalogMatch?.verificationText;
  if (!verification_text && resolvedText) {
    verification_text = resolvedText;
  }
  if (!verification_text) {
    verification_text = 'Pontos de verificação do elemento';
  }
  verification_text = capitalizeFirst(verification_text);

  const {
    condition: _c,
    verification_points: _vp,
    additional_verifications: _av,
    observations: _obs,
    exists: _exists,
    ...rest
  } = item;

  return {
    ...rest,
    id,
    name: item.name,
    verification_text,
    photos,
  };
}

/** Heurística para recuperar rascunho local mais completo que o GET da API. */
function checklistProgressFingerprint(rooms) {
  if (!Array.isArray(rooms)) return { items: 0, photos: 0, chars: 0 };
  let items = 0;
  let photos = 0;
  let chars = 0;
  for (const r of rooms) {
    try {
      chars += JSON.stringify(r).length;
    } catch {
      chars += 1;
    }
    const its = r.items || [];
    items += its.length;
    for (const it of its) {
      photos += (it.photos || []).length;
    }
  }
  return { items, photos, chars };
}

function shouldPreferLocalRoomsChecklist(apiInspection, local, userId) {
  if (!local || !userId) return false;
  if (String(local.userId || '').trim() !== String(userId).trim()) return false;
  if (!Array.isArray(local.rooms_checklist)) return false;
  const apiRooms = apiInspection?.rooms_checklist || [];
  const locRooms = local.rooms_checklist;
  if (JSON.stringify(apiRooms) === JSON.stringify(locRooms)) return false;
  const tApi = apiInspection?.updated_at ? Date.parse(apiInspection.updated_at) : NaN;
  const tLoc = local.updatedAt ? Date.parse(local.updatedAt) : NaN;
  if (!Number.isNaN(tLoc) && !Number.isNaN(tApi) && tLoc > tApi) return true;
  const fpA = checklistProgressFingerprint(apiRooms);
  const fpL = checklistProgressFingerprint(locRooms);
  if (fpL.photos > fpA.photos || fpL.items > fpA.items) return true;
  if (
    fpL.photos === fpA.photos &&
    fpL.items === fpA.items &&
    fpL.chars !== fpA.chars
  ) {
    return fpL.chars >= fpA.chars;
  }
  return false;
}

const InspectionChecklist = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const uid = user?.uid;
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [roomsData, setRoomsData] = useState([]);
  const [roomsList, setRoomsList] = useState([]);
  const [loading, setLoading] = useState(true);
  /** Fluxo da vistoria (ex.: entrega de imóvel) — define o destino do botão «voltar». */
  const [tipoVistoriaFluxo, setTipoVistoriaFluxo] = useState('');
  const [showAddRoom, setShowAddRoom] = useState(false);
  /** Modal «Adicionar ambiente»: escolher tipo ou nome livre (`custom`). */
  const [addRoomStep, setAddRoomStep] = useState('choose');
  const [customRoomNameInput, setCustomRoomNameInput] = useState('');
  /** Confirmação antes de excluir ambiente (mobile + desktop) */
  const [deleteRoomTarget, setDeleteRoomTarget] = useState(null);
  /** Confirmação antes de remover item do checklist */
  const [deleteItemTarget, setDeleteItemTarget] = useState(null);
  /** Edição do nome exibido do ambiente (ex.: duplicar tipo com sufixo) */
  const [roomNameEdit, setRoomNameEdit] = useState(null);
  /** Modal: adicionar item do modelo ao ambiente */
  const [addItemForRoomId, setAddItemForRoomId] = useState(null);
  const contentRef = useRef(null);
  /** Última vistoria carregada da API — usada para gravar em IndexedDB se o PUT falhar sem cópia local. */
  const inspectionBaseRef = useRef(null);
  const lastAutosavedRoomsJsonRef = useRef('');
  const roomsDataRef = useRef([]);
  const [isSavingChecklist, setIsSavingChecklist] = useState(false);

  const normalizeRoomsChecklist = (roomsChecklist) =>
    (roomsChecklist || []).map((room) => ({
      ...room,
      items: (room.items || [])
        .filter(
          (it) =>
            it && String(it.name || '').trim().toLowerCase() !== 'vidro'
        )
        .map((it, idx) => hydrateChecklistItem(it, room.room_type, room.room_id, idx)),
    }));

  useEffect(() => {
    setRoomNameEdit((cur) => (cur && cur.roomId !== selectedRoomId ? null : cur));
  }, [selectedRoomId]);

  const loadInspection = useCallback(async () => {
    try {
      const res = await loadInspectionWithFallback(id, uid);
      if (!res.ok) {
        inspectionBaseRef.current = null;
        toast.error(res.error || 'Erro ao carregar vistoria');
        return;
      }
      if (res.fromLocal) {
        toast.info('Sem servidor — a mostrar dados guardados neste dispositivo.');
      }
      let inspection = res.data;
      if (!res.fromLocal) {
        try {
          await initDB().catch(() => {});
          const local = await getInspectionLocally(id);
          if (shouldPreferLocalRoomsChecklist(inspection, local, uid)) {
            inspection = { ...inspection, rooms_checklist: local.rooms_checklist };
          }
        } catch {
          /* ignore */
        }
      }
      inspectionBaseRef.current = {
        ...inspection,
        id: inspection.id || id,
        userId: inspection.userId || uid,
      };
      setTipoVistoriaFluxo(inspection.tipo_vistoria_fluxo || '');
      const roomsChecklist = normalizeRoomsChecklist(inspection.rooms_checklist || []);
      lastAutosavedRoomsJsonRef.current = JSON.stringify(roomsChecklist);

      if (roomsChecklist.length === 0) {
        // Sem ambientes padrão — o utilizador adiciona
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

  /** Grava checklist no dispositivo e tenta enviar ao servidor (autosave + «Salvar e Continuar»). */
  const persistChecklistDraft = useCallback(
    async (roomsSnapshot) => {
      if (!uid || !id) return { ok: false, reason: 'auth' };
      await initDB().catch(() => {});
      let base = await getInspectionLocally(id);
      if (!base && inspectionBaseRef.current) {
        base = { ...inspectionBaseRef.current };
      }
      if (!base) {
        const reload = await loadInspectionWithFallback(id, uid);
        if (reload.ok && reload.data) {
          base = {
            ...reload.data,
            id: reload.data.id || id,
            userId: reload.data.userId || uid,
          };
        }
      }
      if (!base) return { ok: false, reason: 'no_base' };

      const optimizedRooms = await compressRoomsChecklistPhotosIfNeeded(roomsSnapshot);

      const merged = {
        ...base,
        id: base.id || id,
        userId: uid,
        rooms_checklist: optimizedRooms,
      };
      await saveInspectionLocally(merged);
      inspectionBaseRef.current = {
        ...(inspectionBaseRef.current || base),
        ...merged,
        rooms_checklist: optimizedRooms,
      };

      const result = await inspectionsApi.update(
        id,
        { rooms_checklist: optimizedRooms },
        uid
      );
      if (result.ok && result.data && typeof result.data === 'object') {
        inspectionBaseRef.current = {
          ...inspectionBaseRef.current,
          ...result.data,
          rooms_checklist: optimizedRooms,
          id,
          userId: uid,
        };
        try {
          await saveInspectionLocally(inspectionBaseRef.current);
        } catch (e) {
          console.warn('[Checklist] Cache local após resposta do servidor:', e);
        }
      } else if (!result.ok) {
        await enqueueSyncOperation({
          method: 'PUT',
          path: `/inspections/${id}`,
          payload: { rooms_checklist: optimizedRooms },
          dedupKey: `PUT:/inspections/${id}:checklist`,
          inspectionId: id,
          userId: uid,
        });
      }
      return {
        ok: true,
        apiOk: result.ok,
        apiError: result.error,
        roomsOptimized: optimizedRooms,
      };
    },
    [id, uid]
  );

  useEffect(() => {
    roomsDataRef.current = roomsData;
  }, [roomsData]);

  const CHECKLIST_AUTOSAVE_DEBOUNCE_MS = 4500;

  useEffect(() => {
    if (loading || !uid || !id || isSavingChecklist) return;
    const timer = setTimeout(async () => {
      const snap = JSON.stringify(roomsDataRef.current);
      if (snap === lastAutosavedRoomsJsonRef.current) return;
      try {
        const outcome = await persistChecklistDraft(roomsDataRef.current);
        if (outcome?.ok && outcome.roomsOptimized) {
          const after = JSON.stringify(outcome.roomsOptimized);
          lastAutosavedRoomsJsonRef.current = after;
          if (after !== snap) {
            setRoomsData(outcome.roomsOptimized);
          }
        }
      } catch (e) {
        console.warn('[Checklist] Autosave:', e);
      }
    }, CHECKLIST_AUTOSAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [roomsData, loading, uid, id, isSavingChecklist, persistChecklistDraft]);

  // Função para renumerar TODAS as fotos globalmente
  // Ordem: ambientes da esquerda para direita (ordem das abas), itens de cima para baixo
  const renumberAllPhotos = (newRoomsData) => {
    let globalNumber = 1;
    const updatedRooms = newRoomsData.map((room) => ({
      ...room,
      items: room.items.map((item) => {
        const photos = (item.photos || []).map((photo) => {
          const existingCaption = photo.caption || '';
          const captionParts = existingCaption.match(/^Foto \d+\.\s*(.*)/);
          const userText = captionParts ? captionParts[1] : '';
          const description = photo?.description ?? '';

          const updatedPhoto = {
            ...photo,
            number: globalNumber,
            caption: `Foto ${globalNumber}. ${userText}`,
            description,
          };
          globalNumber++;
          return updatedPhoto;
        });
        return { ...item, photos };
      })
    }));
    return updatedRooms;
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
      number: 0,
      description: '',
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

  const requestDeleteItem = (roomIndex, itemIndex) => {
    const room = roomsData[roomIndex];
    const item = room?.items[itemIndex];
    if (!item) return;
    setDeleteItemTarget({
      roomId: room.room_id,
      itemId: item.id,
      name: item.name,
    });
  };

  const confirmDeleteItem = () => {
    if (!deleteItemTarget) return;
    const { roomId, itemId, name } = deleteItemTarget;
    setRoomsData((prev) => {
      const newRoomsData = prev.map((room) => {
        if (room.room_id !== roomId) return room;
        let idx = itemId ? room.items.findIndex((it) => it.id === itemId) : -1;
        if (idx < 0) idx = room.items.findIndex((it) => it.name === name);
        if (idx < 0) return room;
        return {
          ...room,
          items: room.items.filter((_, i) => i !== idx),
        };
      });
      return renumberAllPhotos(newRoomsData);
    });
    setDeleteItemTarget(null);
    toast.success('Item removido.');
  };

  /** Reordenar itens dentro do ambiente (PDF e fotos seguem a nova ordem) */
  const [itemDragSource, setItemDragSource] = useState(null);

  const moveItemInRoom = (roomIndex, fromIndex, toIndex) => {
    if (fromIndex === toIndex) return;
    setRoomsData((prev) => {
      const newRoomsData = prev.map((r, ri) => {
        if (ri !== roomIndex) return r;
        const items = [...r.items];
        const [removed] = items.splice(fromIndex, 1);
        items.splice(toIndex, 0, removed);
        return { ...r, items };
      });
      return renumberAllPhotos(newRoomsData);
    });
  };

  const handleItemDragStart = (e, roomIndex, itemIndex) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify({ roomIndex, itemIndex }));
    setItemDragSource({ roomIndex, itemIndex });
  };

  const handleItemDragEnd = () => {
    setItemDragSource(null);
  };

  const handleItemDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleItemDrop = (e, roomIndex, toIndex) => {
    e.preventDefault();
    let data;
    try {
      data = JSON.parse(e.dataTransfer.getData('text/plain') || '{}');
    } catch {
      setItemDragSource(null);
      return;
    }
    if (data.roomIndex !== roomIndex || typeof data.itemIndex !== 'number') {
      setItemDragSource(null);
      return;
    }
    moveItemInRoom(roomIndex, data.itemIndex, toIndex);
    setItemDragSource(null);
  };

  const cancelAddItemModal = () => {
    setAddItemForRoomId(null);
  };

  const addTemplateElementToRoom = (el) => {
    if (!addItemForRoomId || !el) return;
    const addKey = normalizeChecklistItemName(el.name);
    setRoomsData((prev) => {
      const rIdx = prev.findIndex((r) => r.room_id === addItemForRoomId);
      if (rIdx < 0) return prev;
      const room = prev[rIdx];
      if (room.items.some((it) => normalizeChecklistItemName(it.name) === addKey)) return prev;
      const itemId = `item_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const newItem = {
        id: itemId,
        name: el.name,
        verification_text: el.verificationText,
        photos: [],
      };
      const next = [...prev];
      next[rIdx] = { ...room, items: [...room.items, newItem] };
      return next;
    });
    cancelAddItemModal();
    toast.success(`Item «${el.name}» adicionado.`);
  };

  const itemChecklistCompleto = () => true;

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
    const label = ROOM_TYPE_LABELS[type];
    if (!label) return;

    const count = roomsList.filter((r) => r.type === type).length;
    const suffix = count > 0 ? ` ${count + 1}` : '';
    const newId = `${type}_${Date.now()}`;
    const newName = `${label}${suffix}`;

    const newRoom = {
      id: newId,
      name: newName,
      type,
    };

    const newRoomData = {
      room_id: newId,
      room_name: newName,
      room_type: type,
      items: buildItemsFromRoomType(type, newId),
    };

    setRoomsList([...roomsList, newRoom]);
    setRoomsData([...roomsData, newRoomData]);
    setSelectedRoomId(newId);
    setShowAddRoom(false);
    setAddRoomStep('choose');
    setCustomRoomNameInput('');
    toast.success(`${newName} adicionado!`);
  };

  const addCustomRoom = () => {
    const name = customRoomNameInput.trim();
    if (!name) {
      toast.error('Indique o nome do ambiente.');
      return;
    }
    const newId = `${ROOM_TYPE_CUSTOM}_${Date.now()}`;
    const newRoom = { id: newId, name, type: ROOM_TYPE_CUSTOM };
    const newRoomData = {
      room_id: newId,
      room_name: name,
      room_type: ROOM_TYPE_CUSTOM,
      items: [],
    };
    setRoomsList((prev) => [...prev, newRoom]);
    setRoomsData((prev) => [...prev, newRoomData]);
    setSelectedRoomId(newId);
    setShowAddRoom(false);
    setAddRoomStep('choose');
    setCustomRoomNameInput('');
    toast.success(`${name} adicionado! Adicione os itens pelo botão do checklist.`);
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

  const canAddAnotherRoom = true;

  const startEditRoomName = () => {
    if (!selectedRoomId) return;
    const room = roomsData.find((r) => r.room_id === selectedRoomId);
    if (!room) return;
    setRoomNameEdit({ roomId: room.room_id, draft: room.room_name || '' });
  };

  const cancelEditRoomName = () => setRoomNameEdit(null);

  const commitEditRoomName = () => {
    if (!roomNameEdit) return;
    const name = roomNameEdit.draft.trim();
    if (!name) {
      toast.error('Indique um nome para o ambiente.');
      return;
    }
    const rid = roomNameEdit.roomId;
    setRoomsData((prev) =>
      prev.map((r) => (r.room_id === rid ? { ...r, room_name: name } : r))
    );
    setRoomsList((prev) =>
      prev.map((r) => (r.id === rid ? { ...r, name } : r))
    );
    setRoomNameEdit(null);
    toast.success('Nome do ambiente atualizado.');
  };

  const handleOpenAddRoomModal = () => {
    setAddRoomStep('choose');
    setCustomRoomNameInput('');
    setShowAddRoom(true);
  };

  const closeAddRoomModal = () => {
    setShowAddRoom(false);
    setAddRoomStep('choose');
    setCustomRoomNameInput('');
  };

  /** Só grava — fica na página (pode ir usando enquanto adiciona cômodos). */
  const handleSaveChecklist = async () => {
    if (roomsData.length === 0) {
      toast.error('⚠️ Adicione pelo menos um ambiente antes de salvar.', { duration: 5000 });
      return;
    }

    if (!uid) {
      toast.error('Sessão inválida. Inicie sessão novamente.');
      return;
    }

    if (isSavingChecklist) return;

    try {
      setIsSavingChecklist(true);
      const outcome = await persistChecklistDraft(roomsData);
      if (!outcome.ok) {
        toast.error(
          outcome.reason === 'no_base'
            ? 'Não foi possível salvar o checklist. Recarregue a página e tente de novo.'
            : 'Não foi possível salvar o checklist. Verifique a ligação e tente de novo.'
        );
        return;
      }
      if (outcome.roomsOptimized) {
        lastAutosavedRoomsJsonRef.current = JSON.stringify(outcome.roomsOptimized);
        if (JSON.stringify(outcome.roomsOptimized) !== JSON.stringify(roomsData)) {
          setRoomsData(outcome.roomsOptimized);
        }
      }
      if (outcome.apiOk) {
        toast.success('Progresso salvo no servidor.');
      } else {
        toast.warning(
          outcome.apiError ||
            'Servidor indisponível — o progresso ficou neste dispositivo e será enviado quando a ligação estiver estável.'
        );
      }
    } catch (error) {
      console.error('Erro ao salvar checklist:', error);
      toast.error('Erro ao salvar checklist');
    } finally {
      setIsSavingChecklist(false);
    }
  };

  /** Grava e avança para a revisão do laudo. */
  const handleContinueToReview = async () => {
    if (roomsData.length === 0) {
      toast.error('⚠️ Adicione pelo menos um ambiente antes de continuar!', { duration: 5000 });
      return;
    }

    if (!uid) {
      toast.error('Sessão inválida. Inicie sessão novamente.');
      return;
    }

    if (isSavingChecklist) return;

    try {
      setIsSavingChecklist(true);
      const outcome = await persistChecklistDraft(roomsData);
      if (!outcome.ok) {
        toast.error(
          outcome.reason === 'no_base'
            ? 'Não foi possível salvar o checklist. Recarregue a página e tente de novo.'
            : 'Não foi possível salvar antes de continuar. Verifique a ligação e tente de novo.'
        );
        return;
      }
      if (outcome.roomsOptimized) {
        lastAutosavedRoomsJsonRef.current = JSON.stringify(outcome.roomsOptimized);
        if (JSON.stringify(outcome.roomsOptimized) !== JSON.stringify(roomsData)) {
          setRoomsData(outcome.roomsOptimized);
        }
      }
      if (outcome.apiOk) {
        toast.success('Checklist salvo. A seguir: revisão do laudo.');
      } else {
        toast.warning(
          outcome.apiError ||
            'Servidor indisponível — o checklist ficou neste dispositivo; na revisão confirme se está tudo em ordem.'
        );
      }
      navigate(`/inspection/${id}/review`);
    } catch (error) {
      console.error('Erro ao salvar checklist:', error);
      toast.error('Erro ao salvar checklist');
    } finally {
      setIsSavingChecklist(false);
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

  const addItemModalRoom = roomsData.find((r) => r.room_id === addItemForRoomId);
  const availableElementsToAdd = addItemModalRoom
    ? getAvailableElementsToAdd((addItemModalRoom.items || []).map((i) => i.name))
    : [];

  return (
    <div className="min-h-dvh bg-slate-50 pb-44 sm:pb-40">
      {/* Header */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 px-4 py-5 text-white sm:py-6">
        <div className="mx-auto w-full max-w-app-readable xl:max-w-app-wide">
          <button
            type="button"
            data-testid="back-from-checklist-button"
            onClick={() =>
              navigate(
                tipoVistoriaFluxo === 'apartamento' || tipoVistoriaFluxo === 'area_comum'
                  ? `/inspection/${id}/edit#objetivo-metodologia`
                  : `/inspection/${id}/edit`
              )
            }
            className="mb-4 flex min-h-touch items-center gap-2 text-slate-300 transition-colors hover:text-white sm:min-h-0"
          >
            <ArrowLeft size={20} className="shrink-0" />
            <span className="text-left text-sm sm:text-base">
              {tipoVistoriaFluxo === 'apartamento' || tipoVistoriaFluxo === 'area_comum'
                ? 'Voltar para Objetivo e Metodologia'
                : 'Voltar para Identificação'}
            </span>
          </button>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <BrandLogo className="h-[3.75rem] w-auto max-w-[10rem] shrink-0 object-contain object-left py-0.5 sm:h-[4.5rem] sm:max-w-[12rem]" />
              <h1 className="text-balance text-xl font-bold font-secondary uppercase tracking-tight sm:text-2xl lg:text-[1.65rem]">
                VERIFICAÇÃO DOS AMBIENTES E NÃO CONFORMIDADES
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
              Excluir ambiente?
            </h3>
            <p className="mb-6 text-sm leading-relaxed text-slate-600">
              O ambiente <strong className="text-slate-900">{deleteRoomTarget.name}</strong> e todos
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
                Excluir ambiente
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteItemTarget && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-item-title"
            className="w-full max-w-md rounded-t-xl bg-white p-6 shadow-xl sm:rounded-xl"
          >
            <h3
              id="delete-item-title"
              className="mb-2 text-lg font-bold text-slate-900 font-secondary uppercase"
            >
              Remover item?
            </h3>
            <p className="mb-6 text-sm leading-relaxed text-slate-600">
              Remover o item{' '}
              <strong className="text-slate-900">&quot;{deleteItemTarget.name}&quot;</strong>? Use
              quando este elemento não existir nesta vistoria.
            </p>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setDeleteItemTarget(null)}
                className="min-h-touch w-full rounded-lg border-2 border-slate-200 px-4 py-3 font-semibold text-slate-700 transition-colors hover:bg-slate-50 sm:min-h-0 sm:w-auto"
              >
                Cancelar
              </button>
              <button
                type="button"
                data-testid="confirm-delete-item-button"
                onClick={confirmDeleteItem}
                className="min-h-touch w-full rounded-lg bg-red-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-red-700 sm:min-h-0 sm:w-auto"
              >
                Remover item
              </button>
            </div>
          </div>
        </div>
      )}

      {addItemForRoomId && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-item-title"
            className="flex max-h-[min(85vh,32rem)] w-full max-w-md flex-col rounded-t-xl bg-white shadow-xl sm:max-h-[min(80vh,36rem)] sm:rounded-xl"
          >
            <div className="border-b border-slate-100 px-5 py-4">
              <h3
                id="add-item-title"
                className="text-lg font-bold text-slate-900 font-secondary uppercase"
              >
                Adicionar item ao ambiente
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                Escolha um tipo de item que ainda não está neste ambiente.
              </p>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2 sm:px-4">
              {availableElementsToAdd.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-500">
                  Todos os itens disponíveis já foram adicionados a este ambiente.
                </p>
              ) : (
                <ul className="space-y-2 pb-2">
                  {availableElementsToAdd.map((el) => (
                    <li key={el.name}>
                      <button
                        type="button"
                        data-testid={`add-template-item-${el.name}`}
                        onClick={() => addTemplateElementToRoom(el)}
                        className="w-full rounded-xl border border-slate-200/90 bg-white px-3.5 py-3 text-left shadow-sm transition-colors hover:border-blue-300 hover:bg-blue-50/90"
                      >
                        <span className="block font-secondary text-[15px] font-semibold leading-snug tracking-tight text-slate-900">
                          {el.name}
                        </span>
                        <span className="mt-1 line-clamp-2 block text-xs leading-relaxed text-slate-500">
                          {el.verificationText}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="border-t border-slate-100 p-4">
              <button
                type="button"
                onClick={cancelAddItemModal}
                className="min-h-touch w-full rounded-lg border-2 border-slate-200 px-4 py-3 font-semibold text-slate-700 hover:bg-slate-50 sm:min-h-0"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddRoom && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-t-xl bg-white p-6 shadow-xl sm:rounded-lg">
            {addRoomStep === 'choose' ? (
              <>
                <h3 className="mb-4 text-xl font-bold font-secondary uppercase text-slate-900">
                  Adicionar ambiente
                </h3>
                <div className="max-h-[min(70vh,28rem)] space-y-2 overflow-y-auto pr-1">
                  {ROOM_TYPE_ORDER.map((type) => (
                    <button
                      key={type}
                      type="button"
                      data-testid={`add-room-${type}`}
                      onClick={() => addRoom(type)}
                      className="min-h-touch w-full rounded-lg bg-slate-100 px-4 py-3 text-left font-semibold text-slate-700 transition-colors hover:bg-slate-200 sm:min-h-0"
                    >
                      {ROOM_TYPE_LABELS[type]}
                    </button>
                  ))}
                  <button
                    type="button"
                    data-testid="add-room-custom"
                    onClick={() => {
                      setAddRoomStep('customName');
                      setCustomRoomNameInput('');
                    }}
                    className="min-h-touch w-full rounded-lg border-2 border-dashed border-blue-300 bg-blue-50/80 px-4 py-3 text-left font-semibold text-blue-900 transition-colors hover:border-blue-400 hover:bg-blue-100/90 sm:min-h-0"
                  >
                    Outro ambiente
                  </button>
                </div>
                <button
                  type="button"
                  onClick={closeAddRoomModal}
                  className="mt-4 min-h-touch w-full rounded-lg bg-slate-900 px-4 py-3 font-semibold text-white transition-colors hover:bg-slate-800 sm:min-h-0"
                >
                  Cancelar
                </button>
              </>
            ) : (
              <>
                <h3 className="mb-2 text-xl font-bold font-secondary uppercase text-slate-900">
                  Nome do ambiente
                </h3>
                <p className="mb-4 text-sm leading-relaxed text-slate-600">
                  Escolha como identificar este espaço. Depois pode adicionar itens normalmente pelo
                  checklist.
                </p>
                <input
                  type="text"
                  data-testid="custom-room-name-input"
                  value={customRoomNameInput}
                  onChange={(e) => setCustomRoomNameInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addCustomRoom();
                    }
                  }}
                  placeholder="Ex.: Depósito, lavabo externo, hall"
                  className="mb-4 min-h-touch w-full rounded-lg border-2 border-slate-200 px-3 py-3 text-base text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 sm:min-h-0"
                  autoFocus
                  autoComplete="off"
                  aria-label="Nome do ambiente personalizado"
                />
                <div className="flex flex-col gap-2 sm:flex-row sm:justify-end sm:gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setAddRoomStep('choose');
                      setCustomRoomNameInput('');
                    }}
                    className="min-h-touch w-full rounded-lg border-2 border-slate-200 px-4 py-3 font-semibold text-slate-700 hover:bg-slate-50 sm:min-h-0 sm:w-auto sm:min-w-[7rem]"
                  >
                    Voltar
                  </button>
                  <button
                    type="button"
                    data-testid="confirm-custom-room"
                    onClick={addCustomRoom}
                    className="min-h-touch w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 sm:min-h-0 sm:w-auto sm:min-w-[10rem]"
                  >
                    Adicionar ambiente
                  </button>
                </div>
                <button
                  type="button"
                  onClick={closeAddRoomModal}
                  className="mt-3 min-h-touch w-full rounded-lg bg-slate-900 px-4 py-3 font-semibold text-white transition-colors hover:bg-slate-800 sm:min-h-0"
                >
                  Cancelar
                </button>
              </>
            )}
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
            <h2 className="text-xl font-bold text-slate-900 mb-2">Nenhum ambiente adicionado</h2>
            <p className="text-slate-500 mb-6">Clique no botão &quot;Adicionar&quot; acima para incluir os ambientes do imóvel</p>
            <button
              type="button"
              onClick={() => setShowAddRoom(true)}
              className="min-h-touch rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-blue-700 sm:min-h-0"
            >
              + Adicionar ambiente
            </button>
          </div>
        ) : (
          <>
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:gap-3 lg:pr-4">
                {roomNameEdit?.roomId === selectedRoomId ? (
                  <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
                    <input
                      type="text"
                      data-testid="edit-room-name-input"
                      value={roomNameEdit.draft}
                      onChange={(e) =>
                        setRoomNameEdit((cur) =>
                          cur ? { ...cur, draft: e.target.value } : cur
                        )
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          commitEditRoomName();
                        }
                        if (e.key === 'Escape') cancelEditRoomName();
                      }}
                      className="min-h-touch w-full min-w-0 rounded-lg border-2 border-blue-400 bg-white px-3 py-2.5 text-base font-bold font-secondary uppercase text-slate-900 shadow-sm outline-none focus:ring-2 focus:ring-blue-500 sm:min-h-0 sm:max-w-xl sm:py-2"
                      aria-label="Nome do ambiente"
                      autoFocus
                    />
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        data-testid="save-room-name-button"
                        onClick={commitEditRoomName}
                        className="inline-flex min-h-touch items-center justify-center gap-1 rounded-lg bg-blue-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 sm:min-h-0 sm:px-3 sm:py-2"
                        aria-label="Guardar nome"
                      >
                        <Check size={18} aria-hidden />
                        Guardar
                      </button>
                      <button
                        type="button"
                        data-testid="cancel-room-name-button"
                        onClick={cancelEditRoomName}
                        className="inline-flex min-h-touch items-center justify-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:min-h-0 sm:px-3 sm:py-2"
                        aria-label="Cancelar edição"
                      >
                        <X size={18} aria-hidden />
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex min-w-0 items-center gap-1 sm:gap-2">
                    <h2 className="text-balance text-xl font-bold font-secondary uppercase text-slate-900 sm:text-2xl">
                      {selectedRoom?.room_name}
                    </h2>
                    {selectedRoom && (
                      <button
                        type="button"
                        data-testid="edit-room-name-toggle"
                        onClick={startEditRoomName}
                        className="shrink-0 rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-200/80 hover:text-slate-900 active:bg-slate-200"
                        aria-label="Editar nome do ambiente"
                        title="Editar nome do ambiente"
                      >
                        <Pencil size={20} className="sm:h-[22px] sm:w-[22px]" aria-hidden />
                      </button>
                    )}
                  </div>
                )}
              </div>
              {selectedRoom && (
                <button
                  type="button"
                  data-testid="delete-current-room-button"
                  onClick={() => requestDeleteRoom(selectedRoom.room_id)}
                  className="inline-flex min-h-touch w-full shrink-0 items-center justify-center gap-2 rounded-lg border-2 border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800 transition-colors hover:border-red-300 hover:bg-red-100 active:bg-red-100 sm:min-h-0 sm:w-auto sm:py-2.5"
                >
                  <Trash2 size={18} className="shrink-0" aria-hidden />
                  Excluir ambiente
                </button>
              )}
            </div>

            {selectedRoom?.items.map((item, itemIndex) => {
              const itemCount = selectedRoom.items.length;
              const canReorder = itemCount > 1;
              return (
                <div
                  key={item.id || `${selectedRoomId}-${itemIndex}`}
                  onDragOver={canReorder ? handleItemDragOver : undefined}
                  onDrop={
                    canReorder
                      ? (ev) => handleItemDrop(ev, selectedRoomIndex, itemIndex)
                      : undefined
                  }
                  className={`mb-2 last:mb-0 rounded-lg transition-opacity ${
                    itemDragSource?.roomIndex === selectedRoomIndex &&
                    itemDragSource?.itemIndex === itemIndex
                      ? 'opacity-50'
                      : ''
                  }`}
                >
                  <ChecklistItem
                    item={item}
                    onChange={(updatedItem, shouldRenumber) =>
                      handleItemChange(selectedRoomIndex, itemIndex, updatedItem, shouldRenumber)
                    }
                    onAddPhoto={(photoData) =>
                      handleAddPhoto(selectedRoomIndex, itemIndex, photoData)
                    }
                    onRemovePhoto={(photoIndex) =>
                      handleRemovePhoto(selectedRoomIndex, itemIndex, photoIndex)
                    }
                    onRemoveItem={() => requestDeleteItem(selectedRoomIndex, itemIndex)}
                    canMoveUp={canReorder && itemIndex > 0}
                    canMoveDown={canReorder && itemIndex < itemCount - 1}
                    onMoveUp={
                      canReorder
                        ? () => moveItemInRoom(selectedRoomIndex, itemIndex, itemIndex - 1)
                        : undefined
                    }
                    onMoveDown={
                      canReorder
                        ? () => moveItemInRoom(selectedRoomIndex, itemIndex, itemIndex + 1)
                        : undefined
                    }
                    dragHandleProps={
                      canReorder
                        ? {
                            draggable: true,
                            onDragStart: (e) =>
                              handleItemDragStart(e, selectedRoomIndex, itemIndex),
                            onDragEnd: handleItemDragEnd,
                          }
                        : undefined
                    }
                  />
                </div>
              );
            })}

            <div className="mt-2">
              <button
                type="button"
                data-testid="add-checklist-item-button"
                onClick={() => {
                  if (!selectedRoom) return;
                  setAddItemForRoomId(selectedRoom.room_id);
                }}
                className="inline-flex min-h-touch w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-blue-300 bg-blue-50/80 px-4 py-3 text-sm font-semibold text-blue-900 transition-colors hover:border-blue-400 hover:bg-blue-100 sm:min-h-0 sm:w-auto sm:px-5"
              >
                <Plus size={20} className="shrink-0" aria-hidden />
                Adicionar item ao ambiente
              </button>
            </div>
          </>
        )}
      </div>

      {/* Fixed Bottom Buttons */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-slate-200 bg-white/95 p-4 pb-bottom-safe backdrop-blur-sm supports-[backdrop-filter]:bg-white/80">
        <div className="mx-auto w-full max-w-app-readable space-y-3 sm:px-2 xl:max-w-app-wide">
          {roomsList.length > 0 && (
            <button
              type="button"
              data-testid="continue-add-room-button"
              onClick={handleOpenAddRoomModal}
              className="flex min-h-touch w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-100 py-3 text-sm font-bold font-secondary uppercase tracking-wide text-slate-800 transition-all duration-200 hover:bg-slate-200 active:scale-[0.99] sm:min-h-0"
            >
              <Plus size={18} className="shrink-0" aria-hidden />
              Continuar adicionando ambiente
            </button>
          )}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
            <button
              type="button"
              data-testid="save-checklist-button"
              disabled={isSavingChecklist}
              onClick={handleSaveChecklist}
              className="flex min-h-touch w-full items-center justify-center gap-2 rounded-lg border-2 border-blue-600 bg-white py-3.5 text-base font-bold font-secondary uppercase tracking-wide text-blue-700 transition-all duration-200 hover:bg-blue-50 active:scale-[0.99] enabled:cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-0 sm:py-4 sm:text-lg"
            >
              <Save size={20} className="shrink-0" aria-hidden />
              {isSavingChecklist ? 'A salvar…' : 'Salvar'}
            </button>
            <button
              type="button"
              data-testid="continue-to-review-button"
              disabled={isSavingChecklist}
              onClick={handleContinueToReview}
              className="flex min-h-touch w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-3.5 text-base font-bold font-secondary uppercase text-white transition-all duration-200 hover:bg-blue-700 active:scale-[0.99] enabled:cursor-pointer disabled:cursor-not-allowed disabled:opacity-70 sm:min-h-0 sm:py-4 sm:text-lg"
            >
              {isSavingChecklist ? 'A salvar…' : 'Continuar'}
              <ArrowRight size={20} className="shrink-0" aria-hidden />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InspectionChecklist;
