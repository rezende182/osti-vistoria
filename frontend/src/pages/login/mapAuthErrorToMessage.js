const CREDENTIAL_MSG = 'E-mail ou senha incorretos';
const NETWORK_MSG = 'Erro de conexão. Verifique sua internet';
const GENERIC_MSG = 'Erro ao fazer login. Tente novamente';

/**
 * O Firebase às vezes devolve auth/network-request-failed com internet OK (credencial errada,
 * bloqueador, ou resposta da API mal interpretada). Só sugerimos “verifique a internet” se
 * o browser reportar offline.
 */
export function mapAuthErrorToMessage(err) {
  const code = err?.code || '';
  const message = String(err?.message || '').toLowerCase();

  if (
    code === 'auth/invalid-credential' ||
    code === 'auth/wrong-password' ||
    code === 'auth/user-not-found'
  ) {
    return CREDENTIAL_MSG;
  }

  if (
    message.includes('invalid-login-credentials') ||
    message.includes('invalid credential') ||
    message.includes('wrong-password') ||
    message.includes('user-not-found')
  ) {
    return CREDENTIAL_MSG;
  }

  if (code === 'auth/network-request-failed') {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return NETWORK_MSG;
    }
    return CREDENTIAL_MSG;
  }

  return GENERIC_MSG;
}

export { CREDENTIAL_MSG, NETWORK_MSG, GENERIC_MSG };
