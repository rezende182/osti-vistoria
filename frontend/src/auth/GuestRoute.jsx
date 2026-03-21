import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import PageLoader from '@/components/PageLoader';
import { useAuth } from './AuthProvider';
import { getPostLoginRedirect } from './redirect';

/**
 * Rotas só para visitantes (ex.: login). Utilizador autenticado é enviado para destino seguro.
 */
const GuestRoute = () => {
  const { user, initializing } = useAuth();
  const location = useLocation();

  if (initializing) {
    return <PageLoader label="A verificar sessão…" />;
  }

  if (user) {
    const to = getPostLoginRedirect(location.state);
    return <Navigate to={to} replace />;
  }

  return <Outlet />;
};

export default GuestRoute;
