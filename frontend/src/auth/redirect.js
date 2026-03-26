/**
 * Após login/registo: sempre a página inicial (não restaura a rota anterior).
 */
export function getPostLoginRedirect() {
  return '/';
}
