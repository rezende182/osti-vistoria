export const MIN_PASSWORD = 6;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isEmailValid(email) {
  return EMAIL_RE.test(String(email).trim());
}

/** @param {{ show: boolean }} opts — mostrar mensagens após interação ou submit */
export function getNomeMessage(nome, { show }) {
  if (!show) return '';
  const t = String(nome).trim();
  if (!t) return 'Nome completo é obrigatório';
  if (t.length < 2) return 'Informe nome e sobrenome';
  return '';
}

export function getEmailMessage(email, { show }) {
  if (!show) return '';
  const t = String(email).trim();
  if (!t) return 'E-mail é obrigatório';
  if (!isEmailValid(t)) return 'E-mail inválido';
  return '';
}

export function getConfirmEmailMessage(email, confirmEmail, { show }) {
  if (!show) return '';
  const e = String(email).trim();
  const c = String(confirmEmail).trim();
  if (!c) return 'Confirme o e-mail';
  if (!isEmailValid(c)) return 'E-mail inválido';
  if (e !== c) return 'Os e-mails não coincidem';
  return '';
}

export function getPasswordMessage(password, { show }) {
  if (!show) return '';
  if (!password) return 'Senha é obrigatória';
  if (password.length < MIN_PASSWORD) {
    return 'A senha deve ter no mínimo 6 caracteres';
  }
  return '';
}

export function getConfirmMessage(password, confirm, { show }) {
  if (!show) return '';
  if (!confirm) return 'Confirme a senha';
  if (confirm !== password) return 'As senhas não coincidem';
  return '';
}

/** Telefone opcional; só valida se o utilizador começou a preencher */
export function getPhoneMessage(phone, { show }) {
  if (!show) return '';
  const raw = String(phone).trim();
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  if (digits.length > 0 && digits.length < 10) {
    return 'Telefone parece incompleto (campo opcional)';
  }
  return '';
}

export function registerFormIsValid({
  nome,
  email,
  confirmEmail,
  password,
  confirm,
  telefone,
}) {
  if (getNomeMessage(nome, { show: true })) return false;
  if (getEmailMessage(email, { show: true })) return false;
  if (getConfirmEmailMessage(email, confirmEmail, { show: true })) return false;
  if (getPasswordMessage(password, { show: true })) return false;
  if (getConfirmMessage(password, confirm, { show: true })) return false;
  if (getPhoneMessage(telefone, { show: true })) return false;
  return true;
}
