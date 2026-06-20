import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { getAuditCollectionPath } from '../lib/firestorePaths';
import { RepositoryResult } from '../types';

export function useLatestAuditResults(uid: string | undefined, isAnonymous: boolean, env: string) {
  const [results, setResults] = useState<RepositoryResult[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      if (!uid) {
        setLoading(false);
        setResults(null);
        setError(null);
        return;
      }

      if (isAnonymous) {
        setLoading(false);
        setResults(null);
        setError(null);
        return;
      }

      try {
        const path = getAuditCollectionPath(env, uid);
        const q = query(collection(db, path), orderBy('createdAt', 'desc'), limit(1));
        const snap = await getDocs(q);

        if (snap.empty) {
          setResults(null);
          setLoading(false);
          return;
        }

        const data = snap.docs[0].data();
        if (data.results && Array.isArray(data.results)) {
          setResults(data.results as RepositoryResult[]);
        } else {
          setResults(null);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load launcher sites.');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [uid, isAnonymous, env]);

  return { results, loading, error };
}
