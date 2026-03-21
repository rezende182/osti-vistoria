import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

/**
 * Configuração via REACT_APP_* (Create React App / Vercel).
 * Inicialização defensiva: falha de config não derruba a app inteira.
 */
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

let app = null;
/** null se a config estiver incompleta ou se initializeApp falhar */
let auth = null;

const hasRequiredKeys =
  Boolean(firebaseConfig.apiKey) &&
  Boolean(firebaseConfig.projectId) &&
  Boolean(firebaseConfig.appId);

try {
  if (hasRequiredKeys) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
  } else {
    console.warn(
      '[firebase] Variáveis REACT_APP_FIREBASE_* em falta — defina-as na Vercel / .env.local.'
    );
  }
} catch (e) {
  console.error('[firebase] Erro ao inicializar:', e);
  app = null;
  auth = null;
}

export { auth };
export default app;

export function isFirebaseAuthAvailable() {
  return Boolean(auth);
}
