import React, { useState } from 'react';
import { LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/auth';

/**
 * Botão Sair para headers escuros (gradiente slate).
 */
export function LogoutHeaderButton() {
  const { logout } = useAuth();
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

  return (
    <button
      type="button"
      data-testid="header-logout-button"
      onClick={handleLogout}
      disabled={busy}
      className="inline-flex min-h-touch shrink-0 items-center gap-2 self-start rounded-lg border border-white/45 bg-white/10 px-3 py-2.5 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/20 disabled:opacity-50 sm:min-h-0 sm:self-center sm:px-4"
    >
      <LogOut className="h-4 w-4 shrink-0" aria-hidden />
      Sair
    </button>
  );
}
