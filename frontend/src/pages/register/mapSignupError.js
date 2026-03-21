const GENERIC = 'Erro ao criar conta';

export function mapSignupError(err) {
  const code = err?.code || '';
  if (code === 'auth/email-already-in-use') {
    return 'E-mail já está em uso';
  }
  if (code === 'auth/weak-password') {
    return 'Senha deve ter no mínimo 6 caracteres';
  }
  if (code === 'auth/invalid-email') {
    return 'Digite um e-mail válido';
  }
  if (code === 'auth/operation-not-allowed') {
    return 'Cadastro por e-mail não está ativo no projeto Firebase (ative Email/Password na consola).';
  }
  return GENERIC;
}
