/**
 * Sincronização automática: fila IndexedDB → API (Mongo via Render).
 */
import { apiClient } from './api';
import {
  initDB,
  getPendingSyncQueue,
  removePendingSyncItem,
  updatePendingSyncQueueItem,
  deleteInspectionLocally,
  saveInspectionLocally,
} from '../utils/offlineStorage';

const BACKOFF_MS = [1000, 5000, 10000];
const POLL_MS = 45000;

let syncInProgress = false;
let intervalId = null;

function inspectionIdFromPath(path) {
  const m = String(path).match(/^\/inspections\/([^/]+)/);
  return m ? m[1] : null;
}

function itemPath(item) {
  return item.url || item.path;
}

/** Atualiza PUTs pendentes que ainda usam o id local após o POST criar no servidor. */
async function rewriteQueuedPathsAfterLocalReplace(oldId, newId) {
  const queue = await getPendingSyncQueue();
  for (const row of queue) {
    const path = row.url || row.path;
    if (!path || !path.includes(oldId)) continue;
    const newPath = path.split(oldId).join(newId);
    await updatePendingSyncQueueItem(row.queueId, {
      path: newPath,
      url: newPath,
      inspectionId: row.inspectionId === oldId ? newId : row.inspectionId,
      dedupKey: row.dedupKey ? row.dedupKey.split(oldId).join(newId) : row.dedupKey,
    });
  }
}

/**
 * Processa a fila pendingSync: reenvia cada item para a API.
 */
export async function syncPendingInspections() {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return;
  }
  if (syncInProgress) {
    return;
  }

  syncInProgress = true;
  console.log('Sync iniciado');

  try {
    await initDB().catch(() => {});
    const items = await getPendingSyncQueue();
    const sorted = [...items].sort(
      (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
    );

    for (const item of sorted) {
      const now = Date.now();
      if (
        item.nextRetryAt &&
        now < new Date(item.nextRetryAt).getTime()
      ) {
        continue;
      }

      try {
        const path = itemPath(item);
        const uid =
          item.userId && String(item.userId).trim() ? String(item.userId).trim() : '';
        if (!uid) {
          console.warn('[Sync] Item sem userId — ignorado (multiusuário)', item.queueId);
          continue;
        }
        const config = {
          method: item.method,
          url: path,
          validateStatus: (s) => s >= 200 && s < 300,
          params: { userId: uid },
        };
        if (
          item.payload !== null &&
          item.payload !== undefined &&
          item.method !== 'GET' &&
          item.method !== 'DELETE'
        ) {
          config.data = item.payload;
        }

        const res = await apiClient.request(config);

        console.log('Item enviado com sucesso', {
          id: item.id || item.queueId,
          method: item.method,
          url: path,
        });

        await removePendingSyncItem(item.queueId);

        if (item.method === 'POST' && path === '/inspections' && item.localInspectionId) {
          const serverData = res.data;
          if (serverData?.id) {
            await rewriteQueuedPathsAfterLocalReplace(
              item.localInspectionId,
              serverData.id
            );
            try {
              await deleteInspectionLocally(item.localInspectionId);
              await saveInspectionLocally({ ...serverData, isOffline: false });
            } catch (e) {
              console.warn('[Sync] Ajuste local pós-POST', e);
            }
            window.dispatchEvent(
              new CustomEvent('sync:inspection-id-replaced', {
                detail: {
                  oldId: item.localInspectionId,
                  newId: serverData.id,
                },
              })
            );
          }
        } else if (item.method === 'PUT' && res.data) {
          const inspId =
            item.inspectionId || inspectionIdFromPath(path);
          if (inspId && res.data.id) {
            try {
              await saveInspectionLocally({ ...res.data, isOffline: false });
            } catch (e) {
              console.warn('[Sync] Cache local após PUT', e);
            }
          }
        }
      } catch (e) {
        console.warn('Falha ao sincronizar item', {
          id: item.id || item.queueId,
          error: e?.message || e,
        });
        const retry = (item.retryCount || 0) + 1;
        const delay =
          BACKOFF_MS[Math.min(retry - 1, BACKOFF_MS.length - 1)] ?? 10000;
        await updatePendingSyncQueueItem(item.queueId, {
          retryCount: retry,
          lastAttemptAt: new Date().toISOString(),
          nextRetryAt: new Date(Date.now() + delay).toISOString(),
        });
      }
    }
  } finally {
    syncInProgress = false;
  }
}

/**
 * Inicia: sync ao arranque, ao voltar online e intervalo periódico.
 * @returns {function} cleanup
 */
export function startSyncManager() {
  syncPendingInspections();

  if (typeof window === 'undefined') {
    return () => {};
  }

  const onOnline = () => {
    syncPendingInspections();
  };

  window.addEventListener('online', onOnline);

  intervalId = window.setInterval(() => {
    syncPendingInspections();
  }, POLL_MS);

  return () => {
    window.removeEventListener('online', onOnline);
    if (intervalId) {
      window.clearInterval(intervalId);
      intervalId = null;
    }
  };
}
