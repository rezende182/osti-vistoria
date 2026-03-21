import React from 'react';

/**
 * Evita tela totalmente branca quando há erro de renderização (mobile/produção).
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-6 text-center">
          <h1 className="text-lg font-bold text-slate-900 mb-2">Algo deu errado</h1>
          <p className="text-sm text-slate-600 mb-4 max-w-md">
            Atualize a página ou limpe os dados do site nas definições do navegador. Se o problema
            continuar, contacte o suporte.
          </p>
          <button
            type="button"
            className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-semibold"
            onClick={() => window.location.reload()}
          >
            Atualizar página
          </button>
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <pre className="mt-6 text-left text-xs text-red-700 max-w-full overflow-auto p-2 bg-red-50 rounded">
              {String(this.state.error)}
            </pre>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
