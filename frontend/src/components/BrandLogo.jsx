import React from 'react';
import clsx from 'clsx';
import { APP_LOGO_ALT, APP_LOGO_URL } from '@/constants/brand';

/**
 * Logo da app (PNG com transparência). Classe global evita fundo opaco herdado em alguns browsers.
 */
function BrandLogo({ className, alt, ...rest }) {
  return (
    <img
      src={APP_LOGO_URL}
      alt={alt ?? APP_LOGO_ALT}
      className={clsx('app-brand-logo', className)}
      decoding="async"
      {...rest}
    />
  );
}

export default BrandLogo;
