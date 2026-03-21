import React from 'react';
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
  placeholder,
  icon: Icon,
  disabled = false,
}) {
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
          placeholder={placeholder}
          disabled={disabled}
          className={Icon ? styles.input : `${styles.input} ${styles.inputNoIcon}`}
        />
      </div>
    </div>
  );
}

export default LoginTextField;
