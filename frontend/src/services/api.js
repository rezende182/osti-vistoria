/**
 * Cliente HTTP central para a API FastAPI (Render).
 * Base: {BACKEND_URL}/api — ex.: https://osti-vistoria.onrender.com/api
 *
 * Rotas protegidas (vistorias, registo de perfil): Authorization: Bearer <Firebase ID token>.
 * O backend extrai o uid do token (não confia em userId enviado pelo cliente).
 */
import axios from 'axios';
import { API_BASE } from '../config/api';

const client = axios.create({
  baseURL: API_BASE,
  timeout: 120000,
  headers: { 'Content-Type': 'application/json' },
});

/** Obtém o ID token do utilizador Firebase (definido pelo AuthProvider). */
let getIdTokenFn = async () => null;

/**
 * @param {null | (() => Promise<string|null>)} fn
 */
export function setApiAuthTokenGetter(fn) {
  getIdTokenFn =
    typeof fn === 'function'
      ? fn
      : async () => null;
}

client.interceptors.request.use(async (config) => {
  if (config.headers.Authorization) {
    return config;
  }
  try {
    const token = await getIdTokenFn();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch {
    /* sem token — pedidos públicos ou 401 nas rotas protegidas */
  }
  return config;
});

/** Cliente axios base (usado pelo syncManager) */
export const apiClient = client;

const AUTH_REQUIRED_MSG = 'Sessão inválida. Inicie sessão novamente.';

function normalizeUserId(userId) {
  if (userId === undefined || userId === null) return '';
  const s = String(userId).trim();
  return s;
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

/** Corpo sem userId — o servidor define o dono pelo token. */
function stripUserId(payload) {
  if (!payload || typeof payload !== 'object') return payload;
  const { userId: _removed, ...rest } = payload;
  return rest;
}

export const inspectionsApi = {
  list: (userId) => {
    if (!normalizeUserId(userId)) return rejectNoUser();
    return wrap(client.get('/inspections').then((r) => r.data));
  },

  get: (id, userId) => {
    if (!normalizeUserId(userId)) return rejectNoUser();
    return wrap(client.get(`/inspections/${id}`).then((r) => r.data));
  },

  create: (payload, userId) => {
    if (!normalizeUserId(userId)) return rejectNoUser();
    return wrap(
      client.post('/inspections', stripUserId(payload)).then((r) => r.data)
    );
  },

  update: (id, payload, userId) => {
    if (!normalizeUserId(userId)) return rejectNoUser();
    return wrap(client.put(`/inspections/${id}`, payload).then((r) => r.data));
  },

  updateIdentification: (id, payload, userId) => {
    if (!normalizeUserId(userId)) return rejectNoUser();
    return wrap(
      client.put(`/inspections/${id}/identification`, payload).then((r) => r.data)
    );
  },

  remove: (id, userId) => {
    if (!normalizeUserId(userId)) return rejectNoUser();
    return wrap(client.delete(`/inspections/${id}`).then((r) => r.data));
  },

  uploadPhoto: (id, file, userId) => {
    if (!normalizeUserId(userId)) return rejectNoUser();
    const form = new FormData();
    form.append('file', file);
    return wrap(
      client.post(`/inspections/${id}/upload-photo`, form).then((r) => r.data)
    );
  },
};

export default inspectionsApi;
