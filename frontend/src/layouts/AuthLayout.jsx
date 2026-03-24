import React from 'react';
import { Outlet } from 'react-router-dom';
import { APP_LOGO_ALT, APP_LOGO_URL } from '@/constants/brand';
import styles from './AuthLayout.module.css';

/**
 * Layout público (login): painel de marca + área do formulário — padrão SaaS.
 * Aceita `children` (composto) ou `<Outlet />` (rotas aninhadas).
 */
const AuthLayout = ({ children }) => (
  <div className={styles.shell}>
    <aside className={styles.brand}>
      <div className={styles.brandGlow} aria-hidden />
      <div className={styles.brandGrid} aria-hidden />
      <div className={styles.brandInner}>
        <img src={APP_LOGO_URL} alt="" className={styles.logo} />
        <h1 className={styles.headline}>Vistoria de recebimento de imóvel</h1>
        <p className={styles.lead}>
          Transforme a gestão de vistorias em um processo simples, rápido e 100% digital. Tudo na
          palma da sua mão.
        </p>
      </div>
      <p className={styles.brandFooter}>{APP_LOGO_ALT}</p>
    </aside>

    <main className={styles.main}>
      <div className={styles.mainInner}>
        <div className={styles.mobileBrand}>
          <img src={APP_LOGO_URL} alt={APP_LOGO_ALT} className={styles.mobileLogo} />
        </div>
        {children ?? <Outlet />}
      </div>
    </main>
  </div>
);

export default AuthLayout;
