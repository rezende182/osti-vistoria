/**
 * Cliente HTTP central para a API FastAPI (Render).
 * Base: {BACKEND_URL}/api — ex.: https://osti-vistoria.onrender.com/api
 *
 * CORS: o backend deve incluir a origem do app (Electron dev: http://localhost:3000)
 * ou CORS_ORIGINS=* no Render. Origem file:// no .exe pode exigir * no servidor.
 */
import axios from 'axios';
import { API_BASE } from '../config/api';

const client = axios.create({
  baseURL: API_BASE,
  timeout: 120000,
  headers: { 'Content-Type': 'application/json' },
});

/** Cliente axios base (usado pelo syncManager) */
export const apiClient = client;

/** Mensagem legível a partir de erro Axios ou rede */
export function getErrorMessage(error) {
  if (!error) return 'Erro desconhecido.';
  if (error.response?.data?.detail !== undefined) {
    const d = error.response.data.detail;
    if (typeof d === 'string') return d;
    if (Array.isArray(d)) return d.map((x) => x.msg || JSON.stringify(x)).join('; ');
    return String(d);
  }
  if (error.message === 'Network Error') {
    return 'Sem conexão ou API indisponível. Verifique a internet.';
  }
  if (error.code === 'ECONNABORTED') return 'Tempo esgotado. Tente novamente.';
  return error.message || 'Erro ao comunicar com o servidor.';
}

function wrap(promise) {
  return promise
    .then((data) => ({ ok: true, data, error: null }))
    .catch((e) => ({ ok: false, data: null, error: getErrorMessage(e) }));
}

export const inspectionsApi = {
  list: () => wrap(client.get('/inspections').then((r) => r.data)),

  get: (id) => wrap(client.get(`/inspections/${id}`).then((r) => r.data)),

  create: (payload) =>
    wrap(client.post('/inspections', payload).then((r) => r.data)),

  update: (id, payload) =>
    wrap(client.put(`/inspections/${id}`, payload).then((r) => r.data)),

  updateIdentification: (id, payload) =>
    wrap(
      client
        .put(`/inspections/${id}/identification`, payload)
        .then((r) => r.data)
    ),

  remove: (id) => wrap(client.delete(`/inspections/${id}`).then((r) => r.data)),

  /** Upload de foto (multipart) */
  uploadPhoto: (id, file) => {
    const form = new FormData();
    form.append('file', file);
    return wrap(
      client.post(`/inspections/${id}/upload-photo`, form).then((r) => r.data)
    );
  },
};

export default inspectionsApi;
