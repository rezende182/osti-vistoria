const FALLBACK = 'Erro ao criar conta. Tente novamente';

export function mapSignupError(err) {
  const code = err?.code || '';
  if (code === 'auth/email-already-in-use') {
    return 'Este e-mail já está em uso';
  }
  if (code === 'auth/invalid-email') {
    return 'E-mail inválido';
  }
  if (code === 'auth/weak-password') {
    return 'A senha deve ter no mínimo 6 caracteres';
  }
  if (code === 'auth/operation-not-allowed') {
    return 'Cadastro por e-mail não está ativo no projeto Firebase (ative Email/Password na consola).';
  }
  return FALLBACK;
}
