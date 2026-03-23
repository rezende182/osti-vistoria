import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Loader2, Lock, Mail, Phone, User } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/auth';
import styles from '@/components/auth/AuthFormLayout.module.css';
import LoginTextField from '@/components/login/LoginTextField';
import { isFirebaseAuthAvailable } from '@/firebase';
import { mapSignupError } from './mapSignupError';
import {
  getConfirmEmailMessage,
  getConfirmMessage,
  getEmailMessage,
  getNomeMessage,
  getPasswordMessage,
  getPhoneMessage,
  registerFormIsValid,
} from './registerValidation';
import { maskBrazilPhoneInput } from './phoneMask';
import { syncProfileAfterSignUp } from './syncProfileAfterSignUp';

function RegisterPage() {
  const { signUp } = useAuth();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [touched, setTouched] = useState({
    nome: false,
    email: false,
    confirmEmail: false,
    telefone: false,
    password: false,
    confirm: false,
  });
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);

  const clearFormError = () => setFormError(null);
  const firebaseOk = isFirebaseAuthAvailable();

  const show = useMemo(
    () => ({
      nome: touched.nome || attemptedSubmit,
      email: touched.email || attemptedSubmit,
      confirmEmail: touched.confirmEmail || attemptedSubmit,
      telefone: touched.telefone || attemptedSubmit,
      password: touched.password || attemptedSubmit,
      confirm: touched.confirm || attemptedSubmit,
    }),
    [touched, attemptedSubmit]
  );

  const nomeMsg = getNomeMessage(nome, { show: show.nome });
  const emailMsg = getEmailMessage(email, { show: show.email });
  const confirmEmailMsg = getConfirmEmailMessage(email, confirmEmail, {
    show: show.confirmEmail,
  });
  const phoneMsg = getPhoneMessage(telefone, { show: show.telefone });
  const passwordMsg = getPasswordMessage(password, { show: show.password });
  const confirmMsg = getConfirmMessage(password, confirm, { show: show.confirm });

  const touch = (key) => () =>
    setTouched((prev) => ({ ...prev, [key]: true }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    clearFormError();
    setAttemptedSubmit(true);

    if (
      !registerFormIsValid({
        nome,
        email,
        confirmEmail,
        password,
        confirm,
        telefone,
      })
    ) {
      setFormError('Corrija os campos destacados antes de continuar.');
      return;
    }

    const nomeTrim = nome.trim();
    const emailTrim = email.trim();

    setSubmitting(true);
    try {
      const credential = await signUp(emailTrim, password);
      toast.success('Conta criada com sucesso.');
      const u = credential?.user;
      if (u?.uid) {
        void syncProfileAfterSignUp({
          nome: nomeTrim,
          email: u.email || emailTrim,
          telefone: telefone.trim() || null,
        });
      }
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
          Preencha os dados abaixo para aceder ao sistema de vistorias.
        </p>
      </header>

      <form onSubmit={handleSubmit} className={styles.form} noValidate>
        <LoginTextField
          id="register-nome"
          label="Nome completo"
          type="text"
          name="nome"
          autoComplete="name"
          value={nome}
          onChange={(e) => {
            clearFormError();
            setTouched((p) => ({ ...p, nome: true }));
            setNome(e.target.value);
          }}
          onBlur={touch('nome')}
          placeholder="Ex: João Silva"
          icon={User}
          disabled={submitting}
          supportText={
            show.nome
              ? nomeMsg || 'Como consta no documento de identificação'
              : 'Como consta no documento de identificação'
          }
          supportTone={nomeMsg ? 'error' : 'neutral'}
          invalid={Boolean(nomeMsg)}
        />

        <LoginTextField
          id="register-email"
          label="E-mail"
          type="email"
          name="email"
          autoComplete="email"
          value={email}
          onChange={(e) => {
            clearFormError();
            setTouched((p) => ({ ...p, email: true }));
            setEmail(e.target.value);
          }}
          onBlur={touch('email')}
          placeholder="Ex: joao@email.com"
          icon={Mail}
          disabled={submitting}
          supportText={emailMsg || 'Este e-mail será usado para login'}
          supportTone={emailMsg ? 'error' : 'neutral'}
          invalid={Boolean(emailMsg)}
        />

        <LoginTextField
          id="register-confirm-email"
          label="Confirmar e-mail"
          type="email"
          name="confirmEmail"
          autoComplete="off"
          value={confirmEmail}
          onChange={(e) => {
            clearFormError();
            setTouched((p) => ({ ...p, confirmEmail: true }));
            setConfirmEmail(e.target.value);
          }}
          onBlur={touch('confirmEmail')}
          placeholder="Repita seu e-mail"
          icon={Mail}
          disabled={submitting}
          supportText={
            show.confirmEmail
              ? confirmEmailMsg || 'Deve ser igual ao e-mail acima'
              : 'Deve ser igual ao e-mail acima'
          }
          supportTone={confirmEmailMsg ? 'error' : 'neutral'}
          invalid={Boolean(confirmEmailMsg)}
        />

        <LoginTextField
          id="register-telefone"
          label="Telefone (opcional)"
          type="tel"
          name="telefone"
          autoComplete="tel"
          value={telefone}
          onChange={(e) => {
            clearFormError();
            setTouched((p) => ({ ...p, telefone: true }));
            setTelefone(maskBrazilPhoneInput(e.target.value));
          }}
          onBlur={touch('telefone')}
          placeholder="Ex: (11) 98765-4321"
          icon={Phone}
          disabled={submitting}
          supportText={
            show.telefone
              ? phoneMsg || 'DDD + número — pode ficar em branco'
              : 'DDD + número — pode ficar em branco'
          }
          supportTone={phoneMsg ? 'error' : 'neutral'}
          invalid={Boolean(phoneMsg)}
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
            setTouched((p) => ({ ...p, password: true }));
            setPassword(e.target.value);
          }}
          onBlur={touch('password')}
          placeholder="Mínimo de 6 caracteres"
          icon={Lock}
          disabled={submitting}
          supportText={show.password ? passwordMsg : 'Mínimo de 6 caracteres'}
          supportTone={passwordMsg ? 'error' : 'neutral'}
          invalid={Boolean(passwordMsg)}
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
            setTouched((p) => ({ ...p, confirm: true }));
            setConfirm(e.target.value);
          }}
          onBlur={touch('confirm')}
          placeholder="Digite a senha novamente"
          icon={Lock}
          disabled={submitting}
          supportText={show.confirm ? confirmMsg : 'Deve coincidir com o campo acima'}
          supportTone={confirmMsg ? 'error' : 'neutral'}
          invalid={Boolean(confirmMsg)}
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

        <Link to="/login" className={styles.secondaryAction}>
          <ArrowLeft size={18} strokeWidth={2} aria-hidden />
          Voltar para o login
        </Link>
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
