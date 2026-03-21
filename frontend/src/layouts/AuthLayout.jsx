import React from 'react';
import { Outlet } from 'react-router-dom';
import styles from './AuthLayout.module.css';

const LOGO_URL =
  'https://customer-assets.emergentagent.com/job_vistoria-imovel-1/artifacts/msx2fmcu_Design%20sem%20nome-Photoroom.png';

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
        <img src={LOGO_URL} alt="" className={styles.logo} />
        <h1 className={styles.headline}>Vistoria de recebimento de imóvel</h1>
        <p className={styles.lead}>
          Transforme a gestão de vistorias em um processo simples, rápido e 100% digital. Tudo na
          palma da sua mão.
        </p>
      </div>
      <p className={styles.brandFooter}>OSTI Engenharia</p>
    </aside>

    <main className={styles.main}>
      <div className={styles.mainInner}>
        <div className={styles.mobileBrand}>
          <img src={LOGO_URL} alt="OSTI Engenharia" className={styles.mobileLogo} />
          <span className={styles.mobileTitle}>OSTI Vistoria</span>
        </div>
        {children ?? <Outlet />}
      </div>
    </main>
  </div>
);

export default AuthLayout;
