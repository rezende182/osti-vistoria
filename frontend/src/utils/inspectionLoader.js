import { inspectionsApi } from '../services/api';
import { getInspectionLocally, initDB } from './offlineStorage';

/**
 * Carrega vistoria da API; se falhar, tenta IndexedDB (modo offline).
 */
export async function loadInspectionWithFallback(id) {
  try {
    await initDB().catch(() => {});
  } catch {
    /* ignore */
  }

  const result = await inspectionsApi.get(id);
  if (result.ok) {
    return { ok: true, data: result.data, fromLocal: false };
  }

  const local = await getInspectionLocally(id);
  if (local) {
    return {
      ok: true,
      data: local,
      fromLocal: true,
      apiError: result.error,
    };
  }

  return { ok: false, data: null, error: result.error };
}
