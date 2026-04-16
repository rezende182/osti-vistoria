/**
 * Fotos «remotas» (gridfs no servidor) — só entram quando o checklist em base64 fica grande demais;
 * o utilizador continua a trabalhar igual; o descarregamento é automático ao gravar.
 */
import { API_BASE } from '../config/api';
import { inspectionsApi } from '../services/api';
import { getDataUrlSize } from './imageCompressor';

export const GRIDFS_URL_PREFIX = 'gridfs:';

export function isGridFsChecklistPhotoUrl(url) {
  return typeof url === 'string' && url.startsWith(GRIDFS_URL_PREFIX);
}

export function parseGridFsFileId(url) {
  if (!isGridFsChecklistPhotoUrl(url)) return null;
  const id = url.slice(GRIDFS_URL_PREFIX.length).trim();
  if (!/^[a-fA-F0-9]{24}$/.test(id)) return null;
  return id;
}

export function dataUrlToBlob(dataUrl) {
  const parts = String(dataUrl).split(',');
  const meta = parts[0] || '';
  const b64 = parts[1];
  if (!b64) throw new Error('data URL inválida');
  const mimeMatch = meta.match(/data:([^;]+)/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const bin = atob(b64);
  const len = bin.length;
  const u8 = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) u8[i] = bin.charCodeAt(i);
  return new Blob([u8], { type: mime });
}

/** Soma aproximada do «peso» das fotos inline (evita documento BSON ~16 MB). */
export function sumChecklistInlinePhotoBytes(rooms) {
  let total = 0;
  for (const room of rooms || []) {
    for (const item of room.items || []) {
      for (const p of item.photos || []) {
        const u = p?.url;
        if (typeof u !== 'string') continue;
        if (u.startsWith('data:image')) total += getDataUrlSize(u);
        else if (isGridFsChecklistPhotoUrl(u)) total += 48;
      }
    }
  }
  return total;
}

/**
 * Limite conservador: o BSON do documento no MongoDB ~16 MB inclui tudo na vistoria.
 * O JSON do checklist em base64 é bem maior que a soma «decodificada» das imagens.
 */
const SAFE_INLINE_PHOTO_BYTES = 4 * 1024 * 1024;
/** Tamanho UTF-8 de `JSON.stringify(rooms_checklist)` — proxies cortam PUTs enormes (erro «Network»). */
const MAX_ROOMS_CHECKLIST_JSON_BYTES = 8 * 1024 * 1024;
const MAX_OFFLOAD_PER_SAVE = 120;

function findLargestDataUrlPhotoSlot(rooms) {
  let best = null;
  let bestSize = 0;
  for (let ri = 0; ri < (rooms || []).length; ri += 1) {
    const items = rooms[ri].items || [];
    for (let ii = 0; ii < items.length; ii += 1) {
      const photos = items[ii].photos || [];
      for (let pi = 0; pi < photos.length; pi += 1) {
        const u = photos[pi]?.url;
        if (typeof u !== 'string' || !u.startsWith('data:image')) continue;
        const sz = getDataUrlSize(u);
        if (sz > bestSize) {
          bestSize = sz;
          best = { ri, ii, pi };
        }
      }
    }
  }
  return best;
}

export function estimateRoomsChecklistJsonUtf8Bytes(rooms) {
  try {
    const s = JSON.stringify(rooms || []);
    if (typeof TextEncoder !== 'undefined') {
      return new TextEncoder().encode(s).length;
    }
    return new Blob([s]).size;
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
}

function needsMoreOffload(rooms) {
  return (
    sumChecklistInlinePhotoBytes(rooms) > SAFE_INLINE_PHOTO_BYTES ||
    estimateRoomsChecklistJsonUtf8Bytes(rooms) > MAX_ROOMS_CHECKLIST_JSON_BYTES
  );
}

/**
 * Substitui as maiores data URLs por referências `gridfs:` até ficar abaixo do limiar seguro.
 * Sem alterar legendas/NC — só o campo `url` de algumas fotos.
 */
export async function offloadExcessChecklistPhotos(rooms, inspectionId, userId) {
  let clone;
  try {
    clone = JSON.parse(JSON.stringify(rooms || []));
  } catch {
    return rooms || [];
  }
  if (!inspectionId || !userId) return clone;

  let n = 0;
  while (needsMoreOffload(clone) && n < MAX_OFFLOAD_PER_SAVE) {
    n += 1;
    const slot = findLargestDataUrlPhotoSlot(clone);
    if (!slot) break;
    const { ri, ii, pi } = slot;
    const url = clone[ri].items[ii].photos[pi].url;
    try {
      const blob = dataUrlToBlob(url);
      let res = { ok: false };
      for (let attempt = 0; attempt < 3; attempt += 1) {
        res = await inspectionsApi.uploadChecklistPhoto(inspectionId, blob, userId);
        if (res.ok && res.data?.url && String(res.data.url).startsWith(GRIDFS_URL_PREFIX)) {
          break;
        }
        if (attempt < 2) await new Promise((r) => setTimeout(r, 600));
      }
      if (!res.ok || !res.data?.url || !String(res.data.url).startsWith(GRIDFS_URL_PREFIX)) {
        break;
      }
      clone[ri].items[ii].photos[pi] = {
        ...clone[ri].items[ii].photos[pi],
        url: res.data.url,
      };
    } catch {
      break;
    }
  }
  return clone;
}

export async function fetchChecklistPhotoBlob(inspectionId, fileIdHex, getIdToken) {
  const token = await getIdToken();
  if (!token) throw new Error('Sem sessão');
  const fid = String(fileIdHex).trim();
  const res = await fetch(
    `${API_BASE}/inspections/${encodeURIComponent(inspectionId)}/checklist-photo/${encodeURIComponent(fid)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error(`Foto HTTP ${res.status}`);
  return res.blob();
}

export function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onloadend = () => resolve(fr.result);
    fr.onerror = () => reject(new Error('Falha ao ler imagem'));
    fr.readAsDataURL(blob);
  });
}

export async function hydrateChecklistGridfsPhotosForPdf(inspection, getIdToken) {
  const clone = JSON.parse(JSON.stringify(inspection));
  const iid = clone?.id;
  const rooms = clone?.rooms_checklist;
  if (!iid || !Array.isArray(rooms) || typeof getIdToken !== 'function') return clone;

  for (const room of rooms) {
    for (const item of room.items || []) {
      const photos = item.photos || [];
      for (let i = 0; i < photos.length; i += 1) {
        const p = photos[i];
        const u = p?.url;
        const fid = parseGridFsFileId(u);
        if (!fid) continue;
        try {
          const blob = await fetchChecklistPhotoBlob(iid, fid, getIdToken);
          const dataUrl = await blobToDataUrl(blob);
          photos[i] = { ...p, url: dataUrl };
        } catch (e) {
          console.warn('[PDF] Foto remota omitida:', fid, e);
          photos[i] = { ...p, url: '' };
        }
      }
    }
  }
  return clone;
}
