import React from 'react';

/**
 * Prédio duplo — formas ocupam quase todo o viewBox (sem “margem” enorme),
 * para ficar proporcional ao Home/Trees do Lucide dentro do quadrado.
 */
const W = 'rgba(15, 23, 42, 0.24)';

export function ApartmentBlockIcon({ className }) {
  return (
    <svg
      viewBox="0 0 80 80"
      className={className ? `block ${className}` : 'block'}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Torre esquerda — encosta fundo e laterais */}
      <rect x="0" y="30" width="36" height="50" rx="4" fill="currentColor" />
      <rect x="6" y="38" width="24" height="9" rx="2" fill={W} />
      <rect x="6" y="51" width="24" height="9" rx="2" fill={W} />
      <rect x="6" y="64" width="24" height="8" rx="2" fill={W} />
      {/* Torre direita — mais alta, encosta topo e fundo */}
      <rect x="32" y="2" width="48" height="78" rx="4" fill="currentColor" />
      <rect x="40" y="10" width="32" height="11" rx="2" fill={W} />
      <rect x="40" y="26" width="32" height="11" rx="2" fill={W} />
      <rect x="40" y="42" width="32" height="11" rx="2" fill={W} />
      <rect x="40" y="58" width="32" height="11" rx="2" fill={W} />
      <rect x="40" y="72" width="32" height="6" rx="2" fill={W} />
    </svg>
  );
}
