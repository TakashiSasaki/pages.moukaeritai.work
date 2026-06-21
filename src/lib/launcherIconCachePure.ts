export interface LauncherIconCacheDoc {
  schemaVersion: 'github-pages-auditor.launcherIconCache.v1';
  siteId: string;
  ownerRepo: string;
  pageUrl: string;
  sourceIconUrl: string;
  sourceKind: string;
  contentType: string;
  encoding: 'base64';
  dataBase64: string;
  byteLength: number;
  sha256: string;
  fetchedAt: string;
  expiresAt: string;
  lastUsedAt?: string;
}

/**
 * Generates a deterministic safe cache identifier using SHA-256 on the normalized details.
 * Implements a flawless fallback hash code block for non-window/node and unsecure non-SSL contexts.
 */
export async function getCacheId(siteId: string, iconUrl: string): Promise<string> {
  const normUrl = iconUrl.toLowerCase().trim();
  const rawKey = `${siteId}:${normUrl}`;
  try {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
      const encoder = new TextEncoder();
      const data = encoder.encode(rawKey);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
  } catch (e) {
    console.warn('Subtle crypto is unavailable; utilizing backup hash generation:', e);
  }

  // Backup basic string hashing (djb2 style hex generator)
  let hash = 5381;
  for (let i = 0; i < rawKey.length; i++) {
    hash = (hash * 33) ^ rawKey.charCodeAt(i);
  }
  return 'bkh_' + Math.abs(hash).toString(16).padStart(16, '0');
}

/**
 * Checks if a cached document has expired.
 */
export function isCacheExpired(docData: LauncherIconCacheDoc): boolean {
  try {
    const expiredTime = new Date(docData.expiresAt).getTime();
    if (isNaN(expiredTime)) {
      return true;
    }
    return Date.now() > expiredTime;
  } catch {
    return true;
  }
}
