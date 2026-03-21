import React from 'react';
import clsx from 'clsx';
import styles from './LoginTextField.module.css';

/**
 * Campo de texto para telas de auth (ícone à esquerda, estilo SaaS).
 */
function LoginTextField({
  id,
  label,
  type = 'text',
  name,
  autoComplete,
  value,
  onChange,
  onBlur,
  placeholder,
  icon: Icon,
  disabled = false,
  /** Texto de ajuda ou validação abaixo do input */
  supportText,
  /** 'error' destaca em vermelho; 'neutral' é cinza */
  supportTone = 'neutral',
  /** Borda vermelha (ex.: validação em tempo real) */
  invalid = false,
}) {
  const inputClass = clsx(
    styles.input,
    !Icon && styles.inputNoIcon,
    invalid && styles.inputInvalid
  );

  return (
    <div className={styles.field}>
      {label ? (
        <label htmlFor={id} className={styles.label}>
          {label}
        </label>
      ) : null}
      <div className={styles.wrap}>
        {Icon ? (
          <span className={styles.icon} aria-hidden>
            <Icon size={18} strokeWidth={2} />
          </span>
        ) : null}
        <input
          id={id}
          type={type}
          name={name}
          autoComplete={autoComplete}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          placeholder={placeholder}
          disabled={disabled}
          className={inputClass}
          aria-invalid={invalid || undefined}
        />
      </div>
      {supportText ? (
        <p
          className={
            supportTone === 'error' ? styles.supportError : styles.supportNeutral
          }
          role={supportTone === 'error' ? 'status' : undefined}
        >
          {supportText}
        </p>
      ) : null}
    </div>
  );
}

export default LoginTextField;
