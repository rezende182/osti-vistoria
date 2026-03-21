import React from 'react';
import { Outlet } from 'react-router-dom';

const LOGO_URL =
  'https://customer-assets.emergentagent.com/job_vistoria-imovel-1/artifacts/msx2fmcu_Design%20sem%20nome-Photoroom.png';

/**
 * Layout público (login): painel de marca + área do formulário — padrão SaaS.
 */
const AuthLayout = () => (
  <div className="min-h-dvh bg-slate-50 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
    <aside className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-10 py-12 text-white lg:flex">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-600/20 via-transparent to-transparent" />
      <div className="relative z-10">
        <img src={LOGO_URL} alt="" className="h-11 w-auto opacity-95" />
        <h1 className="mt-10 max-w-md text-3xl font-bold leading-tight tracking-tight">
          Vistoria de recebimento de imóvel
        </h1>
        <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-300">
          Aceda à sua conta para gerir vistorias, relatórios e equipa em qualquer dispositivo.
        </p>
      </div>
      <p className="relative z-10 text-xs text-slate-500">OSTI Engenharia</p>
    </aside>

    <main className="flex min-h-dvh flex-col justify-center px-4 py-10 sm:px-8 lg:px-12">
      <div className="mx-auto w-full max-w-md lg:max-w-sm">
        <div className="mb-8 flex items-center gap-3 lg:hidden">
          <img src={LOGO_URL} alt="OSTI Engenharia" className="h-10 w-auto" />
          <span className="text-sm font-semibold text-slate-700">OSTI Vistoria</span>
        </div>
        <Outlet />
      </div>
    </main>
  </div>
);

export default AuthLayout;
