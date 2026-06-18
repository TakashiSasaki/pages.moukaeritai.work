const tokenStore = new Map<string, string>();

export async function savePatToFirestore(uid: string, isAnonymous: boolean, pat: string) {
  tokenStore.set(uid, pat);
}

export async function getPatFromFirestore(uid: string, isAnonymous: boolean): Promise<string | null> {
  return tokenStore.get(uid) || null;
}

export async function deletePatFromFirestore(uid: string, isAnonymous: boolean) {
  tokenStore.delete(uid);
}

