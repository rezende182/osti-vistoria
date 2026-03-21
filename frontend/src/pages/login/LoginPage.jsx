import React, { useState } from 'react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { Loader2, Lock, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/auth';
import LoginTextField from '@/components/login/LoginTextField';
import { auth, isFirebaseAuthAvailable } from '@/firebase';
import { mapAuthErrorToMessage } from './mapAuthErrorToMessage';
import styles from './LoginPage.module.css';

const RESET_GENERIC =
  'Não foi possível enviar o e-mail. Verifique o endereço e tente de novo.';

function mapResetError(err) {
  const code = err?.code || '';
  if (code === 'auth/invalid-email') return 'E-mail inválido.';
  if (code === 'auth/missing-email') return 'Informe seu e-mail.';
  if (code === 'auth/network-request-failed') {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return 'Sem conexão. Verifique sua internet.';
    }
    return RESET_GENERIC;
  }
  return RESET_GENERIC;
}

function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resetSending, setResetSending] = useState(false);
  const [formError, setFormError] = useState(null);

  const clearFormError = () => setFormError(null);
  const firebaseOk = isFirebaseAuthAvailable();

  const handleSubmit = async (e) => {
    e.preventDefault();
    clearFormError();
    if (!email.trim() || !password) {
      setFormError('Preencha e-mail e senha.');
      return;
    }
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      toast.success('Sessão iniciada.');
    } catch (err) {
      setFormError(mapAuthErrorToMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!firebaseOk || !auth) {
      toast.error('Firebase não está configurado.');
      return;
    }
    const trimmed = email.trim();
    if (!trimmed) {
      toast.info('Digite seu e-mail no campo acima para recuperar a senha.');
      return;
    }
    setResetSending(true);
    try {
      await sendPasswordResetEmail(auth, trimmed);
      toast.success(
        'Se existir uma conta com este e-mail, enviámos instruções para redefinir a senha.'
      );
    } catch (err) {
      toast.error(mapResetError(err));
    } finally {
      setResetSending(false);
    }
  };

  return (
    <div className={styles.card}>
      {!firebaseOk ? (
        <div className={styles.firebaseWarn} role="alert">
          Firebase não está configurado. Defina as variáveis{' '}
          <code>REACT_APP_FIREBASE_*</code> na Vercel ou em <code>.env.local</code> e faça novo
          deploy.
        </div>
      ) : null}

      <header className={styles.header}>
        <h1 className={styles.title}>Entrar no sistema</h1>
        <p className={styles.subtitle}>
          Use o e-mail e a senha da sua organização para continuar.
        </p>
      </header>

      <form onSubmit={handleSubmit} className={styles.form} noValidate>
        <LoginTextField
          id="login-email"
          label="E-mail"
          type="email"
          name="email"
          autoComplete="email"
          value={email}
          onChange={(e) => {
            clearFormError();
            setEmail(e.target.value);
          }}
          placeholder="seu@email.com"
          icon={Mail}
          disabled={submitting}
        />

        <LoginTextField
          id="login-password"
          label="Senha"
          type="password"
          name="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => {
            clearFormError();
            setPassword(e.target.value);
          }}
          placeholder="••••••••"
          icon={Lock}
          disabled={submitting}
        />

        <div className={styles.forgotRow}>
          <button
            type="button"
            className={styles.forgotLink}
            onClick={handleForgotPassword}
            disabled={submitting || resetSending || !firebaseOk}
          >
            {resetSending ? 'A enviar…' : 'Esqueci minha senha'}
          </button>
        </div>

        <button
          type="submit"
          disabled={submitting || !firebaseOk}
          className={styles.submit}
        >
          {submitting ? (
            <>
              <Loader2 className={styles.spinner} size={18} aria-hidden />
              Entrando…
            </>
          ) : (
            'Entrar no sistema'
          )}
        </button>
      </form>

      {formError ? (
        <p className={styles.error} role="alert" aria-live="polite">
          {formError}
        </p>
      ) : null}
    </div>
  );
}

export default LoginPage;
