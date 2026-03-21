import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { auth } from '@/firebase';

const AuthContext = createContext(null);

/**
 * Estado global de sessão Firebase. Subscreve `onAuthStateChanged` uma vez na raiz da app.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  /** true até a primeira resolução do listener de auth */
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setInitializing(false);
    });
    return unsubscribe;
  }, []);

  const login = useCallback(
    (email, password) => signInWithEmailAndPassword(auth, email, password),
    []
  );

  const logout = useCallback(() => signOut(auth), []);

  const getIdToken = useCallback(async () => {
    if (!user) return null;
    return user.getIdToken();
  }, [user]);

  const value = useMemo(
    () => ({
      user,
      initializing,
      /** @deprecated Prefira `initializing` — mantido por compatibilidade */
      loading: initializing,
      isAuthenticated: Boolean(user),
      login,
      logout,
      getIdToken,
    }),
    [user, initializing, login, logout, getIdToken]
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider');
  }
  return ctx;
}
