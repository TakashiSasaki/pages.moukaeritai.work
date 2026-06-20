import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, signInWithPopup, GoogleAuthProvider, signInAnonymously, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './lib/firebase';
import { getGithubTokenDocPath, getEnvironmentName, getUserSettingDocPath } from './lib/firestorePaths';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInAsGuest: () => Promise<void>;
  logout: () => Promise<void>;
  hasStoredPat: boolean;
  savePatToFirestore: (pat: string) => Promise<void>;
  getStoredPat: () => Promise<string | null>;
  getStoredTokenType: () => Promise<'classic' | 'fine_grained' | 'unknown' | null>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasStoredPat, setHasStoredPat] = useState(false);

  const getDocRef = (uid: string, isAnonymous: boolean) => {
    const env = getEnvironmentName(import.meta.env.MODE);
    const fullPath = getGithubTokenDocPath(env, uid, isAnonymous);
    return doc(db, fullPath);
  };

  const getStoredPat = async (): Promise<string | null> => {
    if (!user) return null;
    try {
      const docRef = getDocRef(user.uid, user.isAnonymous);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists() && docSnap.data().token) {
        return docSnap.data().token;
      }
    } catch(e) {
      console.error("Failed to fetch PAT from Firestore:", e);
    }
    return null;
  };

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
      const pat = await getStoredPat();
      setHasStoredPat(!!pat);
    };
    checkPatStatus();
  }, [user]);

  const savePatToFirestore = async (pat: string) => {
    if (!user) throw new Error('Must be logged in');
    // First validate with backend
    const token = await user.getIdToken();
    const res = await fetch('/api/pat/validate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ pat: pat.trim() })
    });
    
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.details || errData.error || 'Failed to validate PAT');
    }

    // Since validation succeeded, save directly to Firestore
    try {
      const docRef = getDocRef(user.uid, user.isAnonymous);
      await setDoc(docRef, {
        token: pat,
        updatedAt: serverTimestamp()
      });

      // Save token metadata as a separate non-secret document under user settings
      const env = getEnvironmentName(import.meta.env.MODE);
      const metadataPath = getUserSettingDocPath(env, user.uid, user.isAnonymous, 'tokenMetadata');
      const metadataDocRef = doc(db, metadataPath);
      const derivedType = pat.startsWith('github_pat_') ? 'fine_grained' : (pat.startsWith('ghp_') ? 'classic' : 'unknown');
      await setDoc(metadataDocRef, {
        tokenType: derivedType,
        updatedAt: serverTimestamp()
      });

      setHasStoredPat(true);
    } catch (e: any) {
      console.error("Failed to save to Firestore:", e);
      throw new Error("Failed to save to Firestore: " + e.message);
    }
  };

  const getStoredTokenType = async (): Promise<'classic' | 'fine_grained' | 'unknown' | null> => {
    if (!user) return null;
    try {
      const env = getEnvironmentName(import.meta.env.MODE);
      const metadataPath = getUserSettingDocPath(env, user.uid, user.isAnonymous, 'tokenMetadata');
      const docRef = doc(db, metadataPath);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists() && docSnap.data().tokenType) {
        return docSnap.data().tokenType;
      }
    } catch (e) {
      console.error("Failed to fetch token metadata:", e);
    }
    return null;
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
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, signInAsGuest, logout, hasStoredPat, savePatToFirestore, getStoredPat, getStoredTokenType }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
