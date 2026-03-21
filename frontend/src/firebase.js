import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

/**
 * Configuração apenas via variáveis de ambiente (Create React App injeta no build).
 * Na Vercel: defina REACT_APP_FIREBASE_* em Project → Settings → Environment Variables
 * para Production e Preview; cada novo deploy precisa de rebuild para embutir os valores.
 *
 * auth/network-request-failed costuma ser rede, domínios autorizados no Firebase ou
 * restrições da API key no Google Cloud — ver comentários anteriores na equipa / docs Firebase.
 */

function trimEnv(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function buildFirebaseConfig() {
  const config = {
    apiKey: trimEnv(process.env.REACT_APP_FIREBASE_API_KEY),
    authDomain: trimEnv(process.env.REACT_APP_FIREBASE_AUTH_DOMAIN),
    projectId: trimEnv(process.env.REACT_APP_FIREBASE_PROJECT_ID),
    storageBucket: trimEnv(process.env.REACT_APP_FIREBASE_STORAGE_BUCKET),
    messagingSenderId: trimEnv(process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID),
    appId: trimEnv(process.env.REACT_APP_FIREBASE_APP_ID),
  };

  const out = {};
  Object.entries(config).forEach(([key, val]) => {
    if (val) out[key] = val;
  });
  return out;
}

const firebaseConfig = buildFirebaseConfig();

const REQUIRED_KEYS = ['apiKey', 'authDomain', 'projectId', 'appId'];
const missingRequired = REQUIRED_KEYS.filter((k) => !firebaseConfig[k]);

let app = null;

if (missingRequired.length > 0) {
  console.warn(
    '[firebase] Config incompleta — Auth desativado até as variáveis existirem no build.',
    'Em falta:',
    missingRequired.join(', '),
    '| Verifique REACT_APP_FIREBASE_* na Vercel e faça redeploy.'
  );
} else {
  try {
    app = initializeApp(firebaseConfig);
  } catch (e) {
    console.error('[firebase] initializeApp falhou:', e);
    app = null;
  }
}

/** Instância Auth; `null` se a config falhar ou estiver incompleta */
export const auth = app ? getAuth(app) : null;

export default app;

export function isFirebaseAuthAvailable() {
  return Boolean(auth);
}
