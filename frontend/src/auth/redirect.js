/**
 * Caminho seguro para redirecionar após login (evita URLs externas / open redirect).
 */
export function getPostLoginRedirect(navigationState) {
  const from = navigationState?.from;
  if (from && typeof from.pathname === 'string' && from.pathname.startsWith('/')) {
    const path = `${from.pathname}${from.search || ''}${from.hash || ''}`;
    if (path.startsWith('/login')) return '/';
    return path;
  }
  return '/';
}
