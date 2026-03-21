import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Lock, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/auth';
import styles from '@/components/auth/AuthFormLayout.module.css';
import LoginTextField from '@/components/login/LoginTextField';
import { isFirebaseAuthAvailable } from '@/firebase';
import { usersApi } from '@/services/api';
import { mapSignupError } from './mapSignupError';

const MIN_PASSWORD = 6;

function RegisterPage() {
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  const clearFormError = () => setFormError(null);
  const firebaseOk = isFirebaseAuthAvailable();

  const handleSubmit = async (e) => {
    e.preventDefault();
    clearFormError();
    const trimmed = email.trim();
    if (!trimmed || !password || !confirm) {
      setFormError('Preencha todos os campos.');
      return;
    }
    if (password.length < MIN_PASSWORD) {
      setFormError('Senha deve ter no mínimo 6 caracteres');
      return;
    }
    if (password !== confirm) {
      setFormError('As senhas não coincidem.');
      return;
    }
    setSubmitting(true);
    try {
      const credential = await signUp(trimmed, password);
      toast.success('Conta criada com sucesso.');
      const u = credential?.user;
      if (u?.uid) {
        usersApi
          .registerProfile({ uid: u.uid, email: u.email || trimmed })
          .catch(() => {});
      }
      /* Redirecionamento: RegisterRoute deteta user e envia para / (igual ao login). */
    } catch (err) {
      setFormError(mapSignupError(err));
    } finally {
      setSubmitting(false);
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
        <h1 className={styles.title}>Criar conta</h1>
        <p className={styles.subtitle}>
          Cadastre-se com e-mail e senha para começar a usar o sistema.
        </p>
      </header>

      <form onSubmit={handleSubmit} className={styles.form} noValidate>
        <LoginTextField
          id="register-email"
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
          id="register-password"
          label="Senha"
          type="password"
          name="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => {
            clearFormError();
            setPassword(e.target.value);
          }}
          placeholder="Mínimo 6 caracteres"
          icon={Lock}
          disabled={submitting}
        />

        <LoginTextField
          id="register-confirm"
          label="Confirmar senha"
          type="password"
          name="confirmPassword"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => {
            clearFormError();
            setConfirm(e.target.value);
          }}
          placeholder="Repita a senha"
          icon={Lock}
          disabled={submitting}
        />

        <button
          type="submit"
          disabled={submitting || !firebaseOk}
          className={styles.submit}
        >
          {submitting ? (
            <>
              <Loader2 className={styles.spinner} size={18} aria-hidden />
              Criando conta...
            </>
          ) : (
            'Criar conta'
          )}
        </button>
      </form>

      {formError ? (
        <p className={styles.error} role="alert" aria-live="polite">
          {formError}
        </p>
      ) : null}

      <p className={styles.bottomNote}>
        Já tem uma conta? <Link to="/login">Entrar</Link>
      </p>
    </div>
  );
}

export default RegisterPage;
