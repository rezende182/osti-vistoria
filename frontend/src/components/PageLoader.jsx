import React from 'react';

/**
 * Estado de carregamento em página inteira (auth, dados iniciais).
 */
const PageLoader = ({ label = 'A carregar…' }) => (
  <div
    className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-slate-50"
    role="status"
    aria-live="polite"
    aria-busy="true"
  >
    <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />
    {label ? (
      <p className="text-sm font-medium text-slate-500">{label}</p>
    ) : null}
  </div>
);

export default PageLoader;
