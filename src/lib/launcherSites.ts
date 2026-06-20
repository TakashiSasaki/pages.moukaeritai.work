import { RepositoryResult } from '../types';

export interface LauncherSite {
  id: string;
  name: string;
  ownerRepo: string;
  url: string;
  hostname: string;
  customDomain: string | null;
  httpsState: 'enforced' | 'not_enforced' | 'certificate_ok' | 'problem_or_unknown' | 'unknown';
  deploymentMethod: string;
  faviconUrl?: string | null;
  manifestUrl?: string | null;
  isPwa?: boolean;
  pwaIconUrl?: string | null;
}

export function getLauncherSiteId(repo: RepositoryResult): string {
  if (repo.id) return String(repo.id);
  return repo.fullName;
}

export function buildLauncherUrl(repo: RepositoryResult): string | null {
  if (!repo.hasPages) return null;

  const rawUrl = repo.pagesHtmlUrl || `https://${repo.ownerName}.github.io/${repo.repoName}/`;

  try {
    const urlObj = new URL(rawUrl);
    if (urlObj.protocol === 'http:' || urlObj.protocol === 'https:') {
      return urlObj.href;
    }
  } catch (e) {
    // Invalid URL
  }

  return null;
}

export function getDefaultLauncherOrder(sites: LauncherSite[]): string[] {
  return sites.map(s => s.id);
}

export function extractLauncherSites(repositories: RepositoryResult[]): LauncherSite[] {
  const sites: LauncherSite[] = [];

  for (const repo of repositories) {
    if (!repo.hasPages) continue;

    const url = buildLauncherUrl(repo);
    if (!url) continue;

    const hostname = new URL(url).hostname;

    let httpsState: LauncherSite['httpsState'] = 'unknown';
    if (repo.httpsEnforced) {
      httpsState = 'enforced';
    } else if (repo.httpsCertificateStatus === 'https_certificate_ok') {
      httpsState = 'certificate_ok';
    } else if (repo.httpsCertificateStatus === 'https_certificate_problem_or_unknown') {
      httpsState = 'problem_or_unknown';
    } else if (repo.httpsCertificateStatus === 'https_not_enforced') {
      httpsState = 'not_enforced';
    }

    sites.push({
      id: getLauncherSiteId(repo),
      name: repo.repoName,
      ownerRepo: repo.fullName,
      url,
      hostname,
      customDomain: repo.cname || null,
      httpsState,
      deploymentMethod: repo.deploymentMethod || 'unknown',
      faviconUrl: repo.faviconUrl,
      manifestUrl: repo.manifestUrl,
      isPwa: repo.isPwa,
      pwaIconUrl: repo.pwaIconUrl
    });
  }

  return sites;
}

export function applyLocalOrderChange(currentIds: string[], fromIndex: number, direction: -1 | 1): string[] {
  if (fromIndex < 0 || fromIndex >= currentIds.length) return currentIds;
  const toIndex = fromIndex + direction;
  if (toIndex < 0 || toIndex >= currentIds.length) return currentIds;

  const newIds = [...currentIds];
  const temp = newIds[fromIndex];
  newIds[fromIndex] = newIds[toIndex];
  newIds[toIndex] = temp;

  return newIds;
}

export function applySavedOrder(sites: LauncherSite[], savedIds: string[]): LauncherSite[] {
  if (!savedIds || savedIds.length === 0) return sites;
  
  const siteMap = new Map<string, LauncherSite>();
  for (const site of sites) {
    siteMap.set(site.id, site);
  }

  const ordered: LauncherSite[] = [];
  for (const id of savedIds) {
    if (siteMap.has(id)) {
      ordered.push(siteMap.get(id)!);
      siteMap.delete(id);
    }
  }

  // Append any remaining sites not in saved layout
  for (const site of Array.from(siteMap.values())) {
    ordered.push(site);
  }

  return ordered;
}
