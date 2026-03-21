import React, { useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/auth';
import { isFirebaseAuthAvailable } from '@/firebase';

const Login = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast.error('Preencha e-mail e senha.');
      return;
    }
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      toast.success('Sessão iniciada.');
    } catch (err) {
      const code = err?.code || '';
      if (
        code === 'auth/invalid-credential' ||
        code === 'auth/wrong-password' ||
        code === 'auth/user-not-found'
      ) {
        toast.error('E-mail ou senha incorretos.');
      } else if (code === 'auth/invalid-email') {
        toast.error('E-mail inválido.');
      } else if (code === 'auth/too-many-requests') {
        toast.error('Muitas tentativas. Tente mais tarde.');
      } else {
        toast.error(err?.message || 'Não foi possível entrar.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-8 shadow-sm sm:p-10">
      {!isFirebaseAuthAvailable() ? (
        <div
          className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          role="alert"
        >
          Firebase não está configurado. Defina as variáveis{' '}
          <code className="rounded bg-amber-100/80 px-1">REACT_APP_FIREBASE_*</code> na Vercel ou em{' '}
          <code className="rounded bg-amber-100/80 px-1">.env.local</code> e faça novo deploy.
        </div>
      ) : null}
      <div className="mb-8 text-center lg:text-left">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Entrar na conta
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Informe seu e-mail e senha para acessar o sistema.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label
            htmlFor="login-email"
            className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500"
          >
            E-mail
          </label>
          <input
            id="login-email"
            type="email"
            name="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-slate-900 outline-none transition-shadow placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            placeholder="nome@empresa.pt"
          />
        </div>
        <div>
          <label
            htmlFor="login-password"
            className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500"
          >
            Palavra-passe
          </label>
          <input
            id="login-password"
            type="password"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-slate-900 outline-none transition-shadow focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            placeholder="••••••••"
          />
        </div>
        <button
          type="submit"
          disabled={submitting || !isFirebaseAuthAvailable()}
          className="w-full rounded-xl bg-blue-600 py-3.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-60"
        >
          {submitting ? 'A entrar…' : 'Entrar'}
        </button>
      </form>
    </div>
  );
};

export default Login;
