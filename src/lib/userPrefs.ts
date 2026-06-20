import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { getUserSettingDocPath, getEnvironmentName } from './firestorePaths';
import { createAnonymousSessionExpiration } from './anonymousSessionLifecycle';

/**
 * Saves the last visited path to Firestore for the given user.
 */
export async function saveLastPath(uid: string, isAnonymous: boolean, path: string): Promise<void> {
  if (!uid || !path) return;
  // Don't save redirecting of root if not needed, but saving actual paths is good
  try {
    const env = getEnvironmentName(import.meta.env.MODE);
    const docPath = getUserSettingDocPath(env, uid, isAnonymous, 'navigation');
    const docRef = doc(db, docPath);
    const now = new Date();
    const payload: any = {
      lastPath: path,
      updatedAt: serverTimestamp()
    };

    if (isAnonymous) {
      payload.createdAt = now.toISOString();
      payload.expiresAt = createAnonymousSessionExpiration(now).toISOString();
      payload.lastSeenAt = now.toISOString();
    }

    await setDoc(docRef, payload, { merge: true });
  } catch (e) {
    console.warn('Failed to save last path to Firestore:', e);
  }
}

/**
 * Retrieves the last visited path from Firestore for the given user.
 */
export async function getLastPath(uid: string, isAnonymous: boolean): Promise<string | null> {
  if (!uid) return null;
  try {
    const env = getEnvironmentName(import.meta.env.MODE);
    const docPath = getUserSettingDocPath(env, uid, isAnonymous, 'navigation');
    const docRef = doc(db, docPath);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists() && docSnap.data().lastPath) {
      return docSnap.data().lastPath;
    }
  } catch (e) {
    console.warn('Failed to read last path from Firestore:', e);
  }
  return null;
}
