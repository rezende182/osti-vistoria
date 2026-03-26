import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import AuthLayout from '@/layouts/AuthLayout';
import ForgotPassword from '@/pages/ForgotPassword';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import { getPostLoginRedirect } from './redirect';
import { useAuth } from './AuthProvider';

/**
 * Área privada: só renderiza filhos com utilizador autenticado.
 * Deve ser usado apenas quando `authReady` já é true (garantido por AppRoutes).
 */
export function RequireAuth() {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}

/**
 * Rota /login: acessível sempre após auth estar pronta; sessão ativa redireciona para destino seguro.
 */
export function LoginRoute() {
  const { user } = useAuth();
  const location = useLocation();

  if (user) {
    return (
      <Navigate to={getPostLoginRedirect()} replace />
    );
  }

  return (
    <AuthLayout>
      <Login />
    </AuthLayout>
  );
}

/**
 * Rota /register: visitantes; utilizador autenticado vai para o destino pós-login.
 */
export function RegisterRoute() {
  const { user } = useAuth();
  const location = useLocation();

  if (user) {
    return <Navigate to={getPostLoginRedirect()} replace />;
  }

  return (
    <AuthLayout>
      <Register />
    </AuthLayout>
  );
}

/**
 * Rota /forgot-password: visitantes; sessão ativa redireciona (evita confusão).
 */
export function ForgotPasswordRoute() {
  const { user } = useAuth();
  const location = useLocation();

  if (user) {
    return <Navigate to={getPostLoginRedirect()} replace />;
  }

  return (
    <AuthLayout>
      <ForgotPassword />
    </AuthLayout>
  );
}
