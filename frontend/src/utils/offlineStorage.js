/**
 * IndexedDB: vistorias locais + fila de sync (v2: itens com queueId, dedupKey, method, path, payload).
 */

const DB_NAME = 'VistoriaDB';
const DB_VERSION = 2;
const STORE_INSPECTIONS = 'inspections';
const STORE_PENDING_SYNC = 'pendingSync';

let db = null;

export const initDB = () => {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('[OfflineDB] Erro ao abrir banco de dados');
      reject(request.error);
    };

    request.onsuccess = () => {
      db = request.result;
      console.log('[OfflineDB] Banco de dados aberto com sucesso');
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = event.target.result;

      if (event.oldVersion < 1) {
        if (!database.objectStoreNames.contains(STORE_INSPECTIONS)) {
          const inspectionsStore = database.createObjectStore(STORE_INSPECTIONS, {
            keyPath: 'id',
          });
          inspectionsStore.createIndex('status', 'status', { unique: false });
          inspectionsStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        }
      }

      if (event.oldVersion < 2) {
        if (database.objectStoreNames.contains(STORE_PENDING_SYNC)) {
          database.deleteObjectStore(STORE_PENDING_SYNC);
        }
        const syncStore = database.createObjectStore(STORE_PENDING_SYNC, {
          keyPath: 'queueId',
        });
        syncStore.createIndex('dedupKey', 'dedupKey', { unique: false });
        syncStore.createIndex('timestamp', 'timestamp', { unique: false });
      }

      console.log('[OfflineDB] Banco atualizado para versão', DB_VERSION);
    };
  });
};

export const saveInspectionLocally = async (inspection) => {
  const database = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_INSPECTIONS], 'readwrite');
    const store = transaction.objectStore(STORE_INSPECTIONS);

    const data = {
      ...inspection,
      updatedAt: new Date().toISOString(),
      isOffline:
        inspection.isOffline !== undefined ? inspection.isOffline : true,
    };

    const request = store.put(data);

    request.onsuccess = () => {
      console.log('[OfflineDB] Vistoria salva localmente:', inspection.id);
      resolve(data);
    };

    request.onerror = () => {
      console.error('[OfflineDB] Erro ao salvar vistoria');
      reject(request.error);
    };
  });
};

export const getInspectionLocally = async (id) => {
  const database = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_INSPECTIONS], 'readonly');
    const store = transaction.objectStore(STORE_INSPECTIONS);
    const request = store.get(id);

    request.onsuccess = () => {
      resolve(request.result || null);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
};

export const getAllInspectionsLocally = async () => {
  const database = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_INSPECTIONS], 'readonly');
    const store = transaction.objectStore(STORE_INSPECTIONS);
    const request = store.getAll();

    request.onsuccess = () => {
      resolve(request.result || []);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
};

export const deleteInspectionLocally = async (id) => {
  const database = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_INSPECTIONS], 'readwrite');
    const store = transaction.objectStore(STORE_INSPECTIONS);
    const request = store.delete(id);

    request.onsuccess = () => {
      console.log('[OfflineDB] Vistoria removida localmente:', id);
      resolve();
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
};

/**
 * Enfileira operação para sync automático (dedup por dedupKey).
 * @returns {Promise<string>} queueId
 */
export async function enqueueSyncOperation({
  method,
  path,
  payload,
  dedupKey,
  localInspectionId,
  inspectionId,
  /** Firebase uid — enviado como query `userId` na sincronização */
  userId,
}) {
  const database = await initDB();
  const existing = await getPendingSyncQueue();
  for (const row of existing) {
    if (row.dedupKey === dedupKey) {
      await removePendingSyncItem(row.queueId);
      console.log('[OfflineDB] Fila sync: substituindo operação pendente', dedupKey);
    }
  }

  const queueId =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `q-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const item = {
    id: queueId,
    queueId,
    dedupKey,
    method: String(method).toUpperCase(),
    path,
    url: path,
    payload: payload === undefined ? null : payload,
    timestamp: new Date().toISOString(),
    retryCount: 0,
    lastAttemptAt: null,
    nextRetryAt: null,
    localInspectionId: localInspectionId || null,
    inspectionId: inspectionId || null,
    userId: userId ? String(userId).trim() : null,
  };

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_PENDING_SYNC], 'readwrite');
    const store = transaction.objectStore(STORE_PENDING_SYNC);
    const request = store.add(item);

    request.onsuccess = () => {
      console.log('[OfflineDB] Operação enfileirada para sync', queueId, method, path);
      resolve(queueId);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

/** @deprecated use enqueueSyncOperation */
export const addToPendingSync = async (operation) => {
  if (operation.type === 'CREATE_INSPECTION' && operation.payload) {
    return enqueueSyncOperation({
      method: 'POST',
      path: '/inspections',
      payload: operation.payload,
      dedupKey: `POST:/inspections:local:${operation.id}`,
      localInspectionId: operation.id,
    });
  }
  console.warn('[OfflineDB] addToPendingSync formato legado ignorado', operation);
  return null;
};

export const getPendingSyncQueue = async () => {
  const database = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_PENDING_SYNC], 'readonly');
    const store = transaction.objectStore(STORE_PENDING_SYNC);
    const request = store.getAll();

    request.onsuccess = () => {
      resolve(request.result || []);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
};

/** Alias */
export const getPendingSync = getPendingSyncQueue;

export const removePendingSyncItem = async (queueId) => {
  const database = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_PENDING_SYNC], 'readwrite');
    const store = transaction.objectStore(STORE_PENDING_SYNC);
    const request = store.delete(queueId);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
};

export const updatePendingSyncQueueItem = async (queueId, updates) => {
  const database = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_PENDING_SYNC], 'readwrite');
    const store = transaction.objectStore(STORE_PENDING_SYNC);
    const getReq = store.get(queueId);

    getReq.onsuccess = () => {
      const cur = getReq.result;
      if (!cur) {
        resolve(null);
        return;
      }
      const putReq = store.put({ ...cur, ...updates });
      putReq.onsuccess = () => resolve(cur);
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });
};

/** @deprecated use removePendingSyncItem(queueId) */
export const removePendingSync = removePendingSyncItem;

export const isOnline = () => navigator.onLine;

export const registerConnectivityListeners = (onOnline, onOffline) => {
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);

  return () => {
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
  };
};

export default {
  initDB,
  saveInspectionLocally,
  getInspectionLocally,
  getAllInspectionsLocally,
  deleteInspectionLocally,
  enqueueSyncOperation,
  addToPendingSync,
  getPendingSyncQueue,
  getPendingSync,
  removePendingSyncItem,
  updatePendingSyncQueueItem,
  removePendingSync,
  isOnline,
  registerConnectivityListeners,
};
