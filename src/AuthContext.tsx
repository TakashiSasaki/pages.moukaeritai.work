import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, signInWithPopup, GoogleAuthProvider, signInAnonymously, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './lib/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInAsGuest: () => Promise<void>;
  logout: () => Promise<void>;
  hasStoredPat: boolean;
  savePatToFirestore: (pat: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasStoredPat, setHasStoredPat] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setHasStoredPat(false);
      return;
    }
    const checkPatStatus = async () => {
      try {
        const token = await user.getIdToken();
        const res = await fetch('/api/pat/status', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        setHasStoredPat(!!data.hasPat);
      } catch (e) {
        console.error("Failed to load PAT:", e);
        setHasStoredPat(false);
      }
    };
    checkPatStatus();
  }, [user]);

  const savePatToFirestore = async (pat: string) => {
    if (!user) throw new Error('Must be logged in');
    const token = await user.getIdToken();
    const res = await fetch('/api/pat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ pat })
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.details || errData.error || 'Failed to save PAT');
    }
    setHasStoredPat(true);
  };

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const signInAsGuest = async () => {
    await signInAnonymously(auth);
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, signInAsGuest, logout, hasStoredPat, savePatToFirestore }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
