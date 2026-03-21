import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import PageLoader from '@/components/PageLoader';
import { useAuth } from './AuthProvider';

/**
 * Rotas privadas: exige sessão ativa. Guarda a rota pedida em `state.from` para pós-login.
 */
const ProtectedRoute = () => {
  const { user, initializing } = useAuth();
  const location = useLocation();

  if (initializing) {
    return <PageLoader label="A verificar sessão…" />;
  }

  if (!user) {
    return (
      <Navigate to="/login" replace state={{ from: location }} />
    );
  }

  return <Outlet />;
};

export default ProtectedRoute;
