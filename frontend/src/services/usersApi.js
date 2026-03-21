/**
 * API de utilizadores (perfil pós-cadastro Firebase).
 * Usa o mesmo cliente axios que o resto da app (`API_BASE` + `/api`).
 */
import { apiClient, getErrorMessage } from './api';

function wrap(promise) {
  return promise
    .then((data) => ({ ok: true, data, error: null }))
    .catch((e) => ({ ok: false, data: null, error: getErrorMessage(e) }));
}

/**
 * @typedef {Object} UserRegisterProfilePayload
 * @property {string} userId - Firebase uid
 * @property {string} nome
 * @property {string} email
 * @property {string|null} [telefone]
 */

export const usersApi = {
  /**
   * POST /api/users/register — upsert por `userId` (idempotente).
   * @param {UserRegisterProfilePayload} payload
   * @returns {Promise<{ ok: boolean, data?: any, error?: string }>}
   */
  registerProfile: (payload) =>
    wrap(apiClient.post('/users/register', payload).then((r) => r.data)),
};
