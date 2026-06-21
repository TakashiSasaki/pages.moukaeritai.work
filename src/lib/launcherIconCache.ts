import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { getLauncherIconCacheDocPath } from './firestorePaths';
import { getCacheId, isCacheExpired } from './launcherIconCachePure';
import type { LauncherIconCacheDoc } from './launcherIconCachePure';
export { getCacheId, isCacheExpired };
export type { LauncherIconCacheDoc };

/**
 * Retrieves a persistent cached launcher icon document from Firestore, if present.
 */
export async function getCachedIcon(
  uid: string,
  isAnonymous: boolean,
  siteId: string,
  iconUrl: string,
  env: string
): Promise<LauncherIconCacheDoc | null> {
  if (!uid || !iconUrl || !env) return null;
  const cacheId = await getCacheId(siteId, iconUrl);
  const path = getLauncherIconCacheDocPath(env, uid, isAnonymous, cacheId);
  try {
    const d = await getDoc(doc(db, path));
    if (d.exists()) {
      return d.data() as LauncherIconCacheDoc;
    }
  } catch (e) {
    console.error('Failed to read icon cache document:', e);
  }
  return null;
}

/**
 * Saves or updates a cached launcher icon document in Firestore, appending default
 * 30 days expiration and tracking usage markers.
 */
export async function saveCachedIcon(
  uid: string,
  isAnonymous: boolean,
  env: string,
  docData: Omit<LauncherIconCacheDoc, 'expiresAt' | 'lastUsedAt'>
): Promise<void> {
  if (!uid || !env) return;
  const cacheId = await getCacheId(docData.siteId, docData.sourceIconUrl);
  const path = getLauncherIconCacheDocPath(env, uid, isAnonymous, cacheId);
  
  const fetchedTime = new Date(docData.fetchedAt).getTime();
  const expiresAtDate = new Date(fetchedTime + 30 * 24 * 60 * 60 * 1000); // 30 days default ttl
  
  const payload: LauncherIconCacheDoc = {
    ...docData,
    expiresAt: expiresAtDate.toISOString(),
    lastUsedAt: new Date().toISOString()
  };

  try {
    await setDoc(doc(db, path), payload);
  } catch (e) {
    console.error('Failed to write launcher icon cache document:', e);
  }
}
