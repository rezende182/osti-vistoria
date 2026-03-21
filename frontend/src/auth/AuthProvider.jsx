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
 * Única fonte de verdade para sessão Firebase.
 * `authReady` só passa a true depois da primeira resposta do listener (ou se Auth estiver indisponível).
 * Enquanto `authReady === false`, não deve haver redirects baseados em `user`.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    if (!auth) {
      setUser(null);
      setAuthReady(true);
      return undefined;
    }

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthReady(true);
    });

    return unsubscribe;
  }, []);

  const login = useCallback(async (email, password) => {
    if (!auth) {
      throw new Error('Firebase Auth não está configurado.');
    }
    return signInWithEmailAndPassword(auth, email, password);
  }, []);

  const logout = useCallback(async () => {
    if (!auth) return;
    return signOut(auth);
  }, []);

  const getIdToken = useCallback(async () => {
    if (!user) return null;
    return user.getIdToken();
  }, [user]);

  const value = useMemo(
    () => ({
      user,
      authReady,
      /** compat */
      initializing: !authReady,
      loading: !authReady,
      isAuthenticated: Boolean(user),
      login,
      logout,
      getIdToken,
    }),
    [user, authReady, login, logout, getIdToken]
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
