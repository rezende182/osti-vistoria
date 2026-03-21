/**
 * Cliente HTTP central para a API FastAPI (Render).
 * Base: {BACKEND_URL}/api — ex.: https://osti-vistoria.onrender.com/api
 *
 * CORS: o backend deve incluir a origem do app (Electron dev: http://localhost:3000)
 * ou CORS_ORIGINS=* no Render. Origem file:// no .exe pode exigir * no servidor.
 *
 * Vistorias são isoladas por Firebase `user.uid` (query `userId` + corpo em POST).
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

const AUTH_REQUIRED_MSG = 'Sessão inválida. Inicie sessão novamente.';

function normalizeUserId(userId) {
  if (userId === undefined || userId === null) return '';
  const s = String(userId).trim();
  return s;
}

function userQuery(userId) {
  const uid = normalizeUserId(userId);
  if (!uid) return null;
  return { userId: uid };
}

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

function rejectNoUser() {
  return Promise.resolve({ ok: false, data: null, error: AUTH_REQUIRED_MSG });
}

/**
 * Perfil pós-cadastro Firebase (opcional). Falha silenciosa no cliente se API estiver indisponível.
 */
export const usersApi = {
  registerProfile: (body) =>
    wrap(client.post('/users/register', body).then((r) => r.data)),
};

export const inspectionsApi = {
  list: (userId) => {
    const q = userQuery(userId);
    if (!q) return rejectNoUser();
    return wrap(client.get('/inspections', { params: q }).then((r) => r.data));
  },

  get: (id, userId) => {
    const q = userQuery(userId);
    if (!q) return rejectNoUser();
    return wrap(client.get(`/inspections/${id}`, { params: q }).then((r) => r.data));
  },

  create: (payload, userId) => {
    const q = userQuery(userId);
    if (!q) return rejectNoUser();
    const body = {
      ...payload,
      userId: q.userId,
    };
    return wrap(client.post('/inspections', body).then((r) => r.data));
  },

  update: (id, payload, userId) => {
    const q = userQuery(userId);
    if (!q) return rejectNoUser();
    return wrap(
      client.put(`/inspections/${id}`, payload, { params: q }).then((r) => r.data)
    );
  },

  updateIdentification: (id, payload, userId) => {
    const q = userQuery(userId);
    if (!q) return rejectNoUser();
    return wrap(
      client
        .put(`/inspections/${id}/identification`, payload, { params: q })
        .then((r) => r.data)
    );
  },

  remove: (id, userId) => {
    const q = userQuery(userId);
    if (!q) return rejectNoUser();
    return wrap(client.delete(`/inspections/${id}`, { params: q }).then((r) => r.data));
  },

  /** Upload de foto (multipart) */
  uploadPhoto: (id, file, userId) => {
    const q = userQuery(userId);
    if (!q) return rejectNoUser();
    const form = new FormData();
    form.append('file', file);
    return wrap(
      client.post(`/inspections/${id}/upload-photo`, form, { params: q }).then((r) => r.data)
    );
  },
};

export default inspectionsApi;
