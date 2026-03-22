import { auth } from '@/firebase';
import { usersApi } from '@/services/usersApi';

/**
 * Envia perfil ao backend após `createUserWithEmailAndPassword`.
 * Usa token explícito se o interceptor ainda não tiver o `user` do React atualizado.
 */
export async function syncProfileAfterSignUp({ nome, email, telefone }) {
  try {
    const token =
      auth?.currentUser != null
        ? await auth.currentUser.getIdToken()
        : null;
    const res = await usersApi.registerProfile(
      {
        nome: nome.trim(),
        email: email.trim(),
        telefone: telefone?.trim() ? telefone.trim() : null,
      },
      token
    );
    if (!res.ok && typeof console !== 'undefined' && console.warn) {
      console.warn('[cadastro] Perfil não sincronizado com o servidor:', res.error);
    }
  } catch (e) {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('[cadastro] Perfil não sincronizado:', e);
    }
  }
}
