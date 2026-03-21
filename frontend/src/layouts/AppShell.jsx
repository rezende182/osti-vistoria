import React, { useState } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { LogOut, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/auth';

const LOGO_URL =
  'https://customer-assets.emergentagent.com/job_vistoria-imovel-1/artifacts/msx2fmcu_Design%20sem%20nome-Photoroom.png';

/**
 * Shell autenticado: header fixo global com navegação de marca e sessão (logout).
 */
const AppShell = () => {
  const { user, logout } = useAuth();
  const [busy, setBusy] = useState(false);

  const handleLogout = async () => {
    setBusy(true);
    try {
      await logout();
      toast.success('Sessão encerrada.');
    } catch (e) {
      toast.error(e?.message || 'Erro ao sair.');
    } finally {
      setBusy(false);
    }
  };

  const email = user?.email || '';

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50">
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-white/80">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between gap-4 px-4 sm:h-16 sm:px-6">
          <Link
            to="/"
            className="flex min-w-0 items-center gap-3 rounded-md outline-none ring-blue-500/40 focus-visible:ring-2"
          >
            <img src={LOGO_URL} alt="" className="h-8 w-auto shrink-0 sm:h-9" />
            <div className="min-w-0 text-left">
              <span className="block truncate text-sm font-bold tracking-tight text-slate-900 sm:text-base">
                OSTI Vistoria
              </span>
              <span className="hidden text-xs text-slate-500 sm:block">
                Recebimento de imóvel
              </span>
            </div>
          </Link>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <div className="hidden min-w-0 max-w-[200px] text-right sm:block md:max-w-xs">
              <p className="truncate text-xs font-medium text-slate-500">Sessão</p>
              <p className="truncate text-sm font-semibold text-slate-800" title={email}>
                {email || '—'}
              </p>
            </div>
            <div
              className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 sm:h-10 sm:w-10"
              title={email}
              aria-hidden
            >
              <UserRound className="h-5 w-5" strokeWidth={2} />
            </div>
            <button
              type="button"
              onClick={handleLogout}
              disabled={busy}
              className="inline-flex min-h-touch items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-50 sm:min-h-0 sm:px-4"
            >
              <LogOut className="h-4 w-4 shrink-0" aria-hidden />
              <span>Sair</span>
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1">
        <Outlet />
      </div>
    </div>
  );
};

export default AppShell;
