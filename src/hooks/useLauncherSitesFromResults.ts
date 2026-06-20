import { useMemo } from 'react';
import { extractLauncherSites, applySavedOrder, LauncherSite } from '../lib/launcherSites';
import { RepositoryResult } from '../types';

export function useLauncherSitesFromResults(results: RepositoryResult[] | null, orderedSiteIds: string[] | null) {
  return useMemo(() => {
    if (!results || !Array.isArray(results)) {
      return { sites: [], defaultOrderedSiteIds: [] };
    }

    const rawSites = extractLauncherSites(results);
    const sites = applySavedOrder(rawSites, orderedSiteIds || []);

    return {
      sites,
      defaultOrderedSiteIds: rawSites.map((s) => s.id)
    };
  }, [results, orderedSiteIds]);
}
