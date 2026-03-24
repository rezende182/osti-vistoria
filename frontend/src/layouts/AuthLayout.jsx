import React from 'react';
import { Outlet } from 'react-router-dom';
import BrandLogo from '@/components/BrandLogo';
import { APP_LOGO_ALT } from '@/constants/brand';
import styles from './AuthLayout.module.css';

/**
 * Layout público (login): painel de marca + área do formulário — padrão SaaS.
 * Aceita `children` (composto) ou `<Outlet />` (rotas aninhadas).
 */
const AuthLayout = ({ children }) => (
  <div className={styles.shell}>
    <aside className={styles.brand}>
      <div className={styles.brandInner}>
        <BrandLogo alt="" className={styles.logo} />
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
          <BrandLogo className={styles.mobileLogo} />
        </div>
        {children ?? <Outlet />}
      </div>
    </main>
  </div>
);

export default AuthLayout;
