const GENERIC = 'Erro ao criar conta';

export function mapSignupError(err) {
  const code = err?.code || '';
  if (code === 'auth/email-already-in-use') {
    return 'E-mail já está em uso';
  }
  if (code === 'auth/weak-password') {
    return 'Senha deve ter no mínimo 6 caracteres';
  }
  return GENERIC;
}
