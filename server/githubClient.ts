// Allowed Endpoints for Github API
export const ALLOWED_ENDPOINTS = [
  /^\/user$/,
  /^\/user\/repos$/,
  /^\/repos\/[^\/]+\/[^\/]+\/pages$/,
  /^\/repos\/[^\/]+\/[^\/]+\/pages\/health$/,
  /^\/orgs\/[^\/]+\/repos$/,
  /^\/rate_limit$/
];

export async function githubApi(endpoint: string, pat: string, queryParams: any = {}) {
  // Enforce allowlist
  const isAllowed = ALLOWED_ENDPOINTS.some(regex => regex.test(endpoint));
  if (!isAllowed) {
    throw new Error(`Endpoint ${endpoint} is not allowed`);
  }

  // Double safety: Reject endpoints with forbidden actions/manipulations (e.g., POST/PUT/DELETE patterns in endpoints or query params)
  const isForbiddenAction = endpoint.includes('/actions/') || endpoint.includes('/dispatches');
  if (isForbiddenAction) {
    throw new Error(`Endpoint ${endpoint} is not allowed`);
  }

  const url = new URL(`https://api.github.com${endpoint}`);
  for (const [key, value] of Object.entries(queryParams)) {
    url.searchParams.append(key, String(value));
  }

  const headers = {
    'Accept': 'application/vnd.github+json',
    'Authorization': `Bearer ${pat.trim()}`,
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'GitHub-Pages-Auditor'
  };

  const response = await fetch(url.toString(), {
    method: 'GET', // only GET is allowed
    headers
  });

  return response;
}

export function classifyError(status: number, isUserEndpoint: boolean, isReposEndpoint: boolean, hasPages: boolean): string {
  if (status === 401) return 'token_invalid_or_expired';
  if (status === 403) return 'insufficient_permissions'; // Or rate limited, SSO, etc. Could be refined.
  if (status === 404) {
    if (isUserEndpoint || isReposEndpoint) return 'repository_not_found_or_no_access';
    if (!hasPages) return 'pages_not_enabled';
    return 'pages_resource_not_found';
  }
  if (status === 422) return 'validation_failed';
  if (status === 429) return 'primary_rate_limited';
  if (status >= 500) return 'github_temporary_error';
  return 'unknown_error';
}

export function checkRateLimit(response: Response) {
  const remaining = response.headers.get('x-ratelimit-remaining');
  const retryAfter = response.headers.get('retry-after');
  
  if ((response.status === 403 || response.status === 429) && remaining === '0') {
    return 'primary_rate_limited';
  }
  if ((response.status === 403 || response.status === 429) && retryAfter) {
    return 'secondary_rate_limited';
  }
  return null;
}
