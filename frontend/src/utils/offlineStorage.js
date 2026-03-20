/**
 * Utilitário para armazenamento offline usando IndexedDB
 * Permite salvar vistorias localmente quando offline
 */

const DB_NAME = 'VistoriaDB';
const DB_VERSION = 1;
const STORE_INSPECTIONS = 'inspections';
const STORE_PENDING_SYNC = 'pendingSync';

let db = null;

/**
 * Inicializa o banco de dados IndexedDB
 */
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

      // Store para vistorias em cache
      if (!database.objectStoreNames.contains(STORE_INSPECTIONS)) {
        const inspectionsStore = database.createObjectStore(STORE_INSPECTIONS, { keyPath: 'id' });
        inspectionsStore.createIndex('status', 'status', { unique: false });
        inspectionsStore.createIndex('updatedAt', 'updatedAt', { unique: false });
      }

      // Store para operações pendentes de sincronização
      if (!database.objectStoreNames.contains(STORE_PENDING_SYNC)) {
        const syncStore = database.createObjectStore(STORE_PENDING_SYNC, { keyPath: 'id', autoIncrement: true });
        syncStore.createIndex('type', 'type', { unique: false });
        syncStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      console.log('[OfflineDB] Banco de dados criado/atualizado');
    };
  });
};

/**
 * Salva uma vistoria no cache local
 */
export const saveInspectionLocally = async (inspection) => {
  const database = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_INSPECTIONS], 'readwrite');
    const store = transaction.objectStore(STORE_INSPECTIONS);
    
    const data = {
      ...inspection,
      updatedAt: new Date().toISOString(),
      isOffline: true
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

/**
 * Obtém uma vistoria do cache local
 */
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

/**
 * Obtém todas as vistorias do cache local
 */
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

/**
 * Remove uma vistoria do cache local
 */
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
 * Adiciona operação à fila de sincronização
 */
export const addToPendingSync = async (operation) => {
  const database = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_PENDING_SYNC], 'readwrite');
    const store = transaction.objectStore(STORE_PENDING_SYNC);
    
    const data = {
      ...operation,
      createdAt: new Date().toISOString()
    };
    
    const request = store.add(data);
    
    request.onsuccess = () => {
      console.log('[OfflineDB] Operação adicionada à fila de sync');
      resolve(request.result);
    };
    
    request.onerror = () => {
      reject(request.error);
    };
  });
};

/**
 * Obtém todas as operações pendentes de sincronização
 */
export const getPendingSync = async () => {
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

/**
 * Remove operação da fila de sincronização
 */
export const removePendingSync = async (id) => {
  const database = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_PENDING_SYNC], 'readwrite');
    const store = transaction.objectStore(STORE_PENDING_SYNC);
    const request = store.delete(id);
    
    request.onsuccess = () => {
      resolve();
    };
    
    request.onerror = () => {
      reject(request.error);
    };
  });
};

/**
 * Verifica se está online
 */
export const isOnline = () => navigator.onLine;

/**
 * Registra listeners de conexão
 */
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
  addToPendingSync,
  getPendingSync,
  removePendingSync,
  isOnline,
  registerConnectivityListeners
};
