import { inspectionsApi } from '../services/api';
import { getInspectionLocally, initDB } from './offlineStorage';

function canUseLocalFallback(local, userId) {
  if (!local) return false;
  if (!userId) return false;
  if (local.userId === userId) return true;
  if (local.userId == null || local.userId === '') return true;
  return false;
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

  if (!userId || !String(userId).trim()) {
    return {
      ok: false,
      data: null,
      error: 'Sessão inválida. Inicie sessão novamente.',
    };
  }

  const uid = String(userId).trim();

  const result = await inspectionsApi.get(id, uid);
  if (result.ok) {
    return { ok: true, data: result.data, fromLocal: false };
  }

  const local = await getInspectionLocally(id);
  if (canUseLocalFallback(local, uid)) {
    return {
      ok: true,
      data: local,
      fromLocal: true,
      apiError: result.error,
    };
  }

  return { ok: false, data: null, error: result.error };
}
