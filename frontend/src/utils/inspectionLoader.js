import { inspectionsApi } from '../services/api';
import {
  getInspectionLocally,
  initDB,
  saveInspectionLocally,
} from './offlineStorage';

function normalizeUid(userId) {
  if (userId === undefined || userId === null) return '';
  return String(userId).trim();
}

function canUseLocalFallback(local, userId) {
  if (!local || !userId) return false;
  const uid = normalizeUid(userId);
  const rowUid = normalizeUid(local.userId);
  // Registos antigos sem userId: aceitar no dispositivo local.
  if (!rowUid) return true;
  return rowUid === uid;
}

async function cacheInspectionLocally(inspection) {
  if (!inspection?.id) return;
  try {
    await initDB();
    await saveInspectionLocally({ ...inspection, isOffline: false });
  } catch {
    /* cache opcional */
  }
}

/**
 * Carrega vistoria da API; se falhar, tenta IndexedDB (modo offline).
 * @param {string} id
 * @param {string} [userId] Firebase uid — obrigatório para API e para validar cache local
 */
export async function loadInspectionWithFallback(id, userId) {
  try {
    await initDB().catch(() => {});
  } catch {
    /* ignore */
  }

  const uid = normalizeUid(userId);
  if (!uid) {
    return {
      ok: false,
      data: null,
      error: 'Sessão inválida. Inicie sessão novamente.',
    };
  }

  const tryLocal = async () => {
    const local = await getInspectionLocally(id);
    if (canUseLocalFallback(local, uid)) {
      return {
        ok: true,
        data: local,
        fromLocal: true,
      };
    }
    return null;
  };

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    const offline = await tryLocal();
    if (offline) return offline;
    return {
      ok: false,
      data: null,
      error:
        'Sem ligação à internet e este laudo não está guardado neste dispositivo.',
    };
  }

  const result = await inspectionsApi.get(id, uid);
  if (result.ok) {
    await cacheInspectionLocally(result.data);
    return { ok: true, data: result.data, fromLocal: false };
  }

  const localHit = await tryLocal();
  if (localHit) {
    return { ...localHit, apiError: result.error };
  }

  return { ok: false, data: null, error: result.error };
}
