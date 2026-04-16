import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Download,
  Pencil,
  Plus,
  Save,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
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
  dataUrlToBlob,
  offloadExcessChecklistPhotos,
} from '../utils/checklistRemotePhotos';
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

/** MongoDB Compass / EJSON: `{ "$oid": "..." }` → string. */
function mongoScalarToString(v) {
  if (v == null || v === '') return '';
  if (typeof v === 'string' || typeof v === 'number') return String(v);
  if (typeof v === 'object' && v.$oid != null) return String(v.$oid);
  return String(v);
}

function isLikelyRoomsChecklistArray(arr) {
  if (!Array.isArray(arr)) return false;
  if (arr.length === 0) return true;
  const x = arr[0];
  if (!x || typeof x !== 'object') return false;
  return (
    x.room_id != null ||
    typeof x.room_name === 'string' ||
    x.room_type != null ||
    Array.isArray(x.items)
  );
}

/**
 * Aceita o JSON exportado pela app, um documento de vistoria (ex. Mongo) com `rooms_checklist`,
 * ou um array na raiz só com os ambientes.
 */
function extractRoomsChecklistFromImport(data) {
  if (data == null) return null;
  if (Array.isArray(data) && isLikelyRoomsChecklistArray(data)) {
    return data;
  }
  if (typeof data === 'object' && Array.isArray(data.rooms_checklist)) {
    return data.rooms_checklist;
  }
  return null;
}

function getImportInspectionId(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return '';
  return (
    mongoScalarToString(data.sourceInspectionId) ||
    mongoScalarToString(data.inspectionId) ||
    mongoScalarToString(data._id) ||
    mongoScalarToString(data.id) ||
    ''
  );
}

/** Cópia JSON só com o que interessa à verificação dos ambientes e NC (fotos em base64 incluídas). */
function sanitizePhotoForExport(photo) {
  if (!photo || typeof photo !== 'object') return null;
  const out = {};
  for (const pk of ['url', 'caption', 'number', 'description']) {
    if (photo[pk] !== undefined) out[pk] = photo[pk];
  }
  return Object.keys(out).length ? out : null;
}

function sanitizeChecklistItemForExport(item) {
  if (!item || typeof item !== 'object') return null;
  const keys = [
    'id',
    'name',
    'verification_text',
    'photos',
    'exists',
    'condition',
    'observations',
    'verification_points',
    'additional_verifications',
  ];
  const out = {};
  for (const k of keys) {
    if (item[k] !== undefined) out[k] = item[k];
  }
  if (Array.isArray(out.photos)) {
    out.photos = out.photos.map(sanitizePhotoForExport).filter(Boolean);
  }
  return out;
}

function sanitizeRoomsChecklistForExport(rooms) {
  if (!Array.isArray(rooms)) return [];
  return rooms.map((room) => {
    const items = (room.items || [])
      .map(sanitizeChecklistItemForExport)
      .filter(Boolean);
    return {
      room_id: room.room_id,
      room_name: room.room_name,
      room_type: room.room_type != null ? room.room_type : undefined,
      items,
    };
  });
}

function isAppChecklistBackupFile(data) {
  return data && typeof data === 'object' && !Array.isArray(data) && Number(data.backupVersion) >= 1;
}

/** Heurística para recuperar rascunho local mais completo que o GET da API. */
function checklistProgressFingerprint(rooms) {
  if (!Array.isArray(rooms)) return { roomCount: 0, items: 0, photos: 0, chars: 0 };
  const roomCount = rooms.length;
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
  return { roomCount, items, photos, chars };
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
  /** Cômodos novos sem itens/fotos ainda — antes não entravam na conta e a API antiga “ganhava”. */
  if (fpL.roomCount > fpA.roomCount) return true;
  if (fpL.photos > fpA.photos || fpL.items > fpA.items) return true;
  if (
    fpL.roomCount === fpA.roomCount &&
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
  const { user, getIdToken } = useAuth();
  const uid = user?.uid;

  const storeChecklistPhotoBlob = useCallback(
    async (dataUrl) => {
      if (!uid || !id) return dataUrl;
      try {
        const blob = dataUrlToBlob(dataUrl);
        const res = await inspectionsApi.uploadChecklistPhoto(id, blob, uid);
        if (res.ok && res.data?.url && String(res.data.url).startsWith('gridfs:')) {
          return res.data.url;
        }
      } catch {
        /* mantém data URL */
      }
      return dataUrl;
    },
    [id, uid]
  );
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
  const backupImportInputRef = useRef(null);
  /** Evita dois PUT/autosave em paralelo (corrida no offload e no tamanho do pedido). */
  const persistChainRef = useRef(Promise.resolve());
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
    (roomsSnapshot) => {
      const execute = async () => {
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
        const roomsToSave = await offloadExcessChecklistPhotos(optimizedRooms, id, uid);

        const merged = {
          ...base,
          id: base.id || id,
          userId: uid,
          rooms_checklist: roomsToSave,
        };
        await saveInspectionLocally(merged);
        inspectionBaseRef.current = {
          ...(inspectionBaseRef.current || base),
          ...merged,
          rooms_checklist: roomsToSave,
        };

        const result = await inspectionsApi.update(
          id,
          { rooms_checklist: roomsToSave },
          uid
        );
        if (result.ok && result.data && typeof result.data === 'object') {
          inspectionBaseRef.current = {
            ...inspectionBaseRef.current,
            ...result.data,
            rooms_checklist: roomsToSave,
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
            payload: { rooms_checklist: roomsToSave },
            dedupKey: `PUT:/inspections/${id}:checklist`,
            inspectionId: id,
            userId: uid,
          });
        }
        return {
          ok: true,
          apiOk: result.ok,
          apiError: result.error,
          roomsOptimized: roomsToSave,
        };
      };

      const next = persistChainRef.current.then(execute, execute);
      persistChainRef.current = next.then(
        () => undefined,
        () => undefined
      );
      return next;
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

    const newPhoto = {
      url: photoData,
      caption: `Foto 0. `,
      number: 0,
      description: '',
    };

    item.photos = [...(item.photos || []), newPhoto];

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

  const handleReplacePhoto = (roomIndex, itemIndex, photoIndex, photoData) => {
    const newRoomsData = [...roomsData];
    const item = newRoomsData[roomIndex].items[itemIndex];
    const photos = [...(item.photos || [])];
    if (!photos[photoIndex]) return;
    const prev = photos[photoIndex];
    photos[photoIndex] = {
      ...prev,
      url: photoData,
    };
    item.photos = photos;
    const renumberedData = renumberAllPhotos(newRoomsData);
    setRoomsData(renumberedData);
  };

  const handleReorderRooms = (fromIndex, toIndex) => {
    if (
      fromIndex === toIndex ||
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= roomsList.length ||
      toIndex >= roomsList.length
    ) {
      return;
    }
    const reorder = (arr) => {
      const next = [...arr];
      const [removed] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, removed);
      return next;
    };
    setRoomsList(reorder(roomsList));
    setRoomsData(renumberAllPhotos(reorder(roomsData)));
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

  /** Descarrega JSON com o checklist atual — útil quando a API falha (outro PC, rede, etc.). */
  const handleExportChecklistBackup = () => {
    try {
      const base = inspectionBaseRef.current || {};
      const roomsOnly = sanitizeRoomsChecklistForExport(roomsData);
      const payload = {
        backupVersion: 2,
        backupKind: 'rooms_checklist_verificacao_nc',
        exportedAt: new Date().toISOString(),
        inspectionId: id,
        sourceInspectionId: id,
        userId: uid || null,
        cliente: base.cliente || null,
        endereco: base.endereco || null,
        rooms_checklist: roomsOnly,
        note:
          'InSpec360 — só ambientes (cômodos), itens de verificação, fotos e textos de não conformidade. Use «Restaurar cópia» nesta vistoria ou noutra (confirmação se for outro laudo), depois «Salvar».',
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const slug = String(base.cliente || 'vistoria')
        .replace(/[^\w\s-]/gi, '')
        .trim()
        .slice(0, 36)
        .replace(/\s+/g, '-');
      a.download = `copia-ambientes-nc-${slug || 'vistoria'}-${String(id).slice(0, 8)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('Cópia descarregada — guarde no PC, pen drive ou envie por e-mail/WhatsApp.');
    } catch (e) {
      console.error(e);
      toast.error('Não foi possível exportar a cópia.');
    }
  };

  const handlePickImportBackup = () => {
    backupImportInputRef.current?.click();
  };

  const handleImportChecklistBackupFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const raw = String(reader.result || '');
      /** BOM UTF-8 (ex.: Notepad no Windows) faz falhar o JSON.parse sem isto. */
      const text = raw.replace(/^\uFEFF/, '').trim();
      let data;
      try {
        data = JSON.parse(text);
      } catch (parseErr) {
        console.error(parseErr);
        toast.error(
          'O ficheiro não é JSON válido. O que se copia do MongoDB muitas vezes traz ObjectId(...) ou ISODate(...) — isso não é JSON. No Compass use «Export» em JSON, ou no ficheiro exportado pela app substitua só o valor de «rooms_checklist» por um array JSON válido (aspas duplas, vírgulas).'
        );
        return;
      }
      try {
        const rooms = extractRoomsChecklistFromImport(data);
        if (!rooms) {
          toast.error(
            'Ficheiro inválido: precisa de um array «rooms_checklist» (como no export da app) ou um array na raiz com os ambientes (room_id, room_name, items…).'
          );
          return;
        }
        const fileInspectionId = getImportInspectionId(data);
        if (fileInspectionId && String(fileInspectionId) !== String(id)) {
          if (!isAppChecklistBackupFile(data)) {
            toast.error(
              'Este ficheiro parece ser de outro laudo e não é uma cópia JSON gerada por esta app. Exporte pela app ou abra a vistoria correspondente.'
            );
            return;
          }
          const clienteHint = data.cliente ? ` (${String(data.cliente).slice(0, 48)})` : '';
          const msg = [
            'Este ficheiro veio do laudo',
            String(fileInspectionId).slice(0, 12) + clienteHint + '.',
            '',
            'Se continuar, o checklist deste laudo será substituído pelo do ficheiro (cômodos, itens, fotos e descrições de NC).',
            'Confirma?',
          ].join('\n');
          if (typeof window !== 'undefined' && !window.confirm(msg)) {
            return;
          }
        }
        const normalized = normalizeRoomsChecklist(rooms);
        setRoomsData(normalized);
        if (normalized.length === 0) {
          setRoomsList([]);
          setSelectedRoomId(null);
        } else {
          setRoomsList(
            normalized.map((room) => ({
              id: room.room_id,
              name: room.room_name,
              type: room.room_type || room.room_id,
            }))
          );
          setSelectedRoomId(normalized[0].room_id);
        }
        setRoomNameEdit(null);
        inspectionBaseRef.current = {
          ...(inspectionBaseRef.current || {}),
          id,
          userId: uid,
          rooms_checklist: normalized,
        };
        lastAutosavedRoomsJsonRef.current = '';
        toast.success(
          'Cópia restaurada neste ecrã. Toque em «Salvar» com rede boa para enviar ao servidor.'
        );
      } catch (err) {
        console.error(err);
        toast.error(
          'Não foi possível aplicar os dados do ficheiro. Confirme que é a cópia JSON exportada por esta app, na mesma versão, sem alterar a estrutura.'
        );
      }
    };
    reader.onerror = () => toast.error('Erro ao ler o ficheiro.');
    reader.readAsText(file, 'utf-8');
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
    <div className="min-h-dvh bg-slate-50 pb-[min(28rem,50vh)] sm:pb-60">
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
        onReorderRooms={handleReorderRooms}
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
                    inspectionId={id}
                    getIdToken={getIdToken}
                    storePhotoDataUrl={storeChecklistPhotoBlob}
                    onChange={(updatedItem, shouldRenumber) =>
                      handleItemChange(selectedRoomIndex, itemIndex, updatedItem, shouldRenumber)
                    }
                    onAddPhoto={(photoData) =>
                      handleAddPhoto(selectedRoomIndex, itemIndex, photoData)
                    }
                    onRemovePhoto={(photoIndex) =>
                      handleRemovePhoto(selectedRoomIndex, itemIndex, photoIndex)
                    }
                    onReplacePhoto={(photoIndex, photoData) =>
                      handleReplacePhoto(selectedRoomIndex, itemIndex, photoIndex, photoData)
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
          <input
            ref={backupImportInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={handleImportChecklistBackupFile}
          />
          <div className="rounded-lg border border-amber-200/90 bg-amber-50/95 px-3 py-2.5 shadow-sm">
            <p className="mb-2 text-[11px] font-medium leading-snug text-amber-950/90 sm:text-xs">
              Se aparecer «sem conexão» ou a API falhar: <strong>exporte uma cópia JSON</strong> — só
              verificação dos ambientes e não conformidades (cômodos, itens, fotos em base64, legendas e
              descrições). Guarde o ficheiro no PC ou na nuvem. Pode{' '}
              <strong>Restaurar cópia</strong> neste laudo ou noutro (o app pede confirmação se for outro
              ID), depois <strong>Salvar</strong>.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                data-testid="export-checklist-backup-button"
                onClick={handleExportChecklistBackup}
                className="inline-flex min-h-touch flex-1 items-center justify-center gap-2 rounded-lg border border-amber-300/90 bg-white px-3 py-2.5 text-xs font-bold font-secondary uppercase tracking-wide text-amber-900 shadow-sm transition-colors hover:bg-amber-100/80 sm:min-h-0 sm:flex-none sm:px-4 sm:text-sm"
              >
                <Download size={16} className="shrink-0" aria-hidden />
                Exportar cópia (JSON)
              </button>
              <button
                type="button"
                data-testid="import-checklist-backup-button"
                onClick={handlePickImportBackup}
                className="inline-flex min-h-touch flex-1 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-xs font-bold font-secondary uppercase tracking-wide text-slate-800 shadow-sm transition-colors hover:bg-slate-50 sm:min-h-0 sm:flex-none sm:px-4 sm:text-sm"
              >
                <Upload size={16} className="shrink-0" aria-hidden />
                Restaurar cópia (JSON)
              </button>
            </div>
          </div>
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
