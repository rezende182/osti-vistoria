import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

/**
 * Configuração do projeto OSTI Vistorias (sem Analytics).
 * Inicialização defensiva: erros não derrubam a app — `auth` fica `null` e o AuthProvider trata.
 */
const firebaseConfig = {
  apiKey: 'AIzaSyCp7GwtLVC8m6GecuV8FgD8nDV7zpF5AdI',
  authDomain: 'osti-vistorias.firebaseapp.com',
  projectId: 'osti-vistorias',
  storageBucket: 'osti-vistorias.firebasestorage.app',
  messagingSenderId: '454474058028',
  appId: '1:454474058028:web:812375fb8908fd2ed54489',
};

let app = null;

try {
  app = initializeApp(firebaseConfig);
} catch (e) {
  console.error('[firebase] Falha em initializeApp:', e);
}

/** Instância Auth; `null` se a inicialização falhar */
export const auth = app ? getAuth(app) : null;

export default app;

export function isFirebaseAuthAvailable() {
  return Boolean(auth);
}
