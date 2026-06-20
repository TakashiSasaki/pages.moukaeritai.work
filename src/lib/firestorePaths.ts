/**
 * Normalizes the environment name.
 * @param mode Vite environment mode (e.g., import.meta.env.MODE)
 */
export function getEnvironmentName(mode: string): string {
  // Guard: If we are on the known production custom domain, always return production
  if (typeof window !== 'undefined' && 
      (window.location.hostname === 'pages.moukaeritai.work' || 
       window.location.hostname === 'github-pages-auditor-1042140630327.asia-east1.run.app')) {
    return 'production';
  }
  return mode === 'production' ? 'production' : 'development';
}

/**
 * Returns the collection path for GitHub tokens.
 */
export function getGithubTokenCollectionPath(environment: string, uid: string, isAnonymous: boolean): string {
  const env = environment === 'production' ? 'production' : 'development';
  return isAnonymous
    ? `githubPagesAuditorV2/${env}/anonymousSessions/${uid}/githubTokens`
    : `githubPagesAuditorV2/${env}/users/${uid}/githubTokens`;
}

/**
 * Returns the full document path for a GitHub token.
 */
export function getGithubTokenDocPath(environment: string, uid: string, isAnonymous: boolean, tokenId: string = 'default'): string {
  return `${getGithubTokenCollectionPath(environment, uid, isAnonymous)}/${tokenId}`;
}

/**
 * Returns the collection path for audits.
 */
export function getAuditCollectionPath(environment: string, uid: string): string {
  const env = environment === 'production' ? 'production' : 'development';
  return `githubPagesAuditorV2/${env}/users/${uid}/audits`;
}

/**
 * Returns the collection path for user settings.
 */
export function getUserSettingsCollectionPath(environment: string, uid: string, isAnonymous: boolean): string {
  const env = environment === 'production' ? 'production' : 'development';
  return isAnonymous
    ? `githubPagesAuditorV2/${env}/anonymousSessions/${uid}/settings`
    : `githubPagesAuditorV2/${env}/users/${uid}/settings`;
}

/**
 * Returns the document path for a specific user setting.
 */
export function getUserSettingDocPath(environment: string, uid: string, isAnonymous: boolean, settingId: string): string {
  return `${getUserSettingsCollectionPath(environment, uid, isAnonymous)}/${settingId}`;
}

