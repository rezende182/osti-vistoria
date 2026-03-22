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
 * @property {string} nome
 * @property {string} email
 * @property {string|null} [telefone]
 */

export const usersApi = {
  /**
   * POST /api/users/register — uid vem do Bearer token (Firebase).
   * @param {UserRegisterProfilePayload} payload
   * @param {string|null} [idTokenOverride] — logo após signUp, antes do interceptor atualizar
   * @returns {Promise<{ ok: boolean, data?: any, error?: string }>}
   */
  registerProfile: (payload, idTokenOverride = null) =>
    wrap(
      apiClient
        .post('/users/register', payload, {
          headers: idTokenOverride
            ? { Authorization: `Bearer ${idTokenOverride}` }
            : {},
        })
        .then((r) => r.data)
    ),
};
