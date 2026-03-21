import { usersApi } from '@/services/usersApi';

/**
 * Envia perfil ao backend após `createUserWithEmailAndPassword`.
 * Não interrompe o fluxo se a API falhar.
 */
export async function syncProfileAfterSignUp({ userId, nome, email, telefone }) {
  try {
    const res = await usersApi.registerProfile({
      userId,
      nome: nome.trim(),
      email: email.trim(),
      telefone: telefone?.trim() ? telefone.trim() : null,
    });
    if (!res.ok && typeof console !== 'undefined' && console.warn) {
      console.warn('[cadastro] Perfil não sincronizado com o servidor:', res.error);
    }
  } catch (e) {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('[cadastro] Perfil não sincronizado:', e);
    }
  }
}
