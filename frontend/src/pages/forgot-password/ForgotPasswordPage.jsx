import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { sendPasswordResetEmail } from 'firebase/auth';
import { Loader2, Mail } from 'lucide-react';
import styles from '@/components/auth/AuthFormLayout.module.css';
import LoginTextField from '@/components/login/LoginTextField';
import { auth, isFirebaseAuthAvailable } from '@/firebase';

const SUCCESS_SENT = 'Enviamos um link de recuperação para seu e-mail';
const SUCCESS_GENERIC = 'Se o e-mail existir, você receberá um link';

function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  const firebaseOk = isFirebaseAuthAvailable();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    setSuccessMessage(null);
    const trimmed = email.trim();
    if (!trimmed) {
      setFormError('Informe seu e-mail.');
      return;
    }
    if (!firebaseOk || !auth) {
      setFormError('Firebase não está configurado.');
      return;
    }
    setSubmitting(true);
    try {
      await sendPasswordResetEmail(auth, trimmed);
      setSuccessMessage(SUCCESS_SENT);
    } catch (err) {
      const code = err?.code || '';
      if (code === 'auth/invalid-email') {
        setFormError('Digite um e-mail válido');
      } else if (code === 'auth/user-not-found') {
        setSuccessMessage(SUCCESS_GENERIC);
      } else {
        setFormError('Não foi possível enviar o e-mail. Tente novamente.');
      }
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
        <h1 className={styles.title}>Recuperar senha</h1>
        <p className={styles.subtitle}>
          Informe o e-mail da sua conta. Enviaremos um link para redefinir a senha.
        </p>
      </header>

      <form onSubmit={handleSubmit} className={styles.form} noValidate>
        <LoginTextField
          id="forgot-email"
          label="E-mail"
          type="email"
          name="email"
          autoComplete="email"
          value={email}
          onChange={(e) => {
            setFormError(null);
            setSuccessMessage(null);
            setEmail(e.target.value);
          }}
          placeholder="seu@email.com"
          icon={Mail}
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
              Enviando...
            </>
          ) : (
            'Enviar link de recuperação'
          )}
        </button>
      </form>

      {formError ? (
        <p className={styles.error} role="alert" aria-live="polite">
          {formError}
        </p>
      ) : null}

      {successMessage ? (
        <p className={styles.success} role="status" aria-live="polite">
          {successMessage}
        </p>
      ) : null}

      <p className={styles.bottomNote}>
        <Link to="/login">Voltar ao login</Link>
      </p>
    </div>
  );
}

export default ForgotPasswordPage;
