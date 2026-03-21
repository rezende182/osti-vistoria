import React from 'react';
import { Outlet } from 'react-router-dom';

/**
 * Shell autenticado: apenas área de conteúdo.
 * Título da página + Sair ficam no header escuro de cada ecrã.
 */
const AppShell = () => (
  <div className="flex min-h-dvh flex-col bg-slate-50">
    <Outlet />
  </div>
);

export default AppShell;
