import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import * as admin from 'firebase-admin';
import { getAuth } from 'firebase-admin/auth';

// Initialize Firebase Admin (this requires correct environment variables or default service account in production)
try {
  admin.initializeApp();
} catch (error) {
  console.warn("Firebase Admin Initialization missing config. Warning only for Dev environments.");
}

const app = express();
app.use(express.json());

const PORT = 3000;

// Temporary in-memory state for user PATs (MVP)
const userPats: Record<string, string> = {};

// Middleware to verify Firebase ID Token
async function verifyAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const idToken = authHeader.split('Bearer ')[1];
  
  // STUB for MVP - allow dummy-token to simulate Anonymous Guest Mode
  if (idToken === 'dummy-token') {
    (req as any).user = { uid: 'anonymous-guest', isAnonymous: true };
    return next();
  }

  try {
    const decodedToken = await getAuth().verifyIdToken(idToken);
    (req as any).user = decodedToken;
    next();
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    // In strict env, we return 401. 
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

// Allowed Endpoints for Github API
export const ALLOWED_ENDPOINTS = [
  /^\/user$/,
  /^\/user\/repos$/,
  /^\/repos\/[^\/]+\/[^\/]+\/pages$/,
  /^\/repos\/[^\/]+\/[^\/]+\/pages\/health$/,
  /^\/rate_limit$/
];

export async function githubApi(endpoint: string, pat: string, queryParams: any = {}) {
  // Enforce allowlist
  const isAllowed = ALLOWED_ENDPOINTS.some(regex => regex.test(endpoint));
  if (!isAllowed) {
    throw new Error(`Endpoint ${endpoint} is not allowed`);
  }

  const url = new URL(`https://api.github.com${endpoint}`);
  for (const [key, value] of Object.entries(queryParams)) {
    url.searchParams.append(key, String(value));
  }

  const headers = {
    'Accept': 'application/vnd.github+json',
    'Authorization': `Bearer ${pat}`,
    'X-GitHub-Api-Version': '2026-03-10',
    'User-Agent': 'GitHub-Pages-Auditor'
  };

  const response = await fetch(url.toString(), {
    method: 'GET', // only GET is allowed
    headers
  });

  return response;
}

function classifyError(status: number, isUserEndpoint: boolean, isReposEndpoint: boolean, hasPages: boolean): string {
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

function checkRateLimit(response: Response) {
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

// --- API ROUTES ---

// 1. PAT Management
app.post('/api/pat/validate', verifyAuth, async (req, res) => {
  const { pat } = req.body;
  if (!pat) return res.status(400).json({ error: 'PAT is required' });

  try {
    const userResp = await githubApi('/user', pat);
    if (!userResp.ok) {
      return res.status(userResp.status).json({ valid: false, error: 'Failed to access /user', details: await userResp.text() });
    }

    const reposResp = await githubApi('/user/repos', pat, { per_page: 1 });
    if (!reposResp.ok) {
      return res.status(reposResp.status).json({ valid: false, error: 'Failed to access /user/repos', details: await reposResp.text() });
    }

    res.json({ valid: true });
  } catch (error: any) {
    res.status(500).json({ valid: false, error: error.message });
  }
});

app.post('/api/pat', verifyAuth, (req, res) => {
  const uid = (req as any).user.uid;
  const { pat } = req.body;
  if (!pat) return res.status(400).json({ error: 'PAT is required' });
  
  userPats[uid] = pat;
  res.json({ success: true });
});

app.get('/api/pat/status', verifyAuth, (req, res) => {
  const uid = (req as any).user.uid;
  const pat = userPats[uid];
  res.json({ hasPat: !!pat });
});

app.delete('/api/pat', verifyAuth, (req, res) => {
  const uid = (req as any).user.uid;
  delete userPats[uid];
  res.json({ success: true });
});

// 2. Audit Endpoints
app.get('/api/audit/user', verifyAuth, async (req, res) => {
  const uid = (req as any).user.uid;
  const pat = userPats[uid] || req.headers['x-temp-pat'];
  if (!pat) return res.status(400).json({ error: 'No GitHub PAT provided' });

  try {
    const response = await githubApi('/user', pat as string);
    if (!response.ok) {
      return res.status(response.status).json({ error: 'GitHub API error', details: await response.text() });
    }
    const data = await response.json();
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/audit/run', verifyAuth, async (req, res) => {
  const uid = (req as any).user.uid;
  // Fallback to header based PAT for Anonymous transient sessions
  const pat = userPats[uid] || req.headers['x-temp-pat'];
  if (!pat) return res.status(400).json({ error: 'No GitHub PAT provided' });

  try {
    // 1. Fetch repositories with pagination
    let repos: any[] = [];
    let page = 1;
    let hasNextPage = true;

    while (hasNextPage) {
      const reposResponse = await githubApi('/user/repos', pat as string, { page, per_page: 100, visibility: 'all', affiliation: 'owner,collaborator,organization_member' });
      
      const rateLimitError = checkRateLimit(reposResponse);
      if (rateLimitError) {
        return res.status(429).json({ error: rateLimitError, details: 'Rate limited while fetching repositories.' });
      }

      if (!reposResponse.ok) {
        return res.status(reposResponse.status).json({ 
          error: classifyError(reposResponse.status, false, true, false), 
          details: await reposResponse.text() 
        });
      }
      
      const pageRepos = await reposResponse.json();
      repos = repos.concat(pageRepos);

      // Check for pagination link
      const linkHeader = reposResponse.headers.get('link');
      if (linkHeader && linkHeader.includes('rel="next"')) {
        page++;
      } else {
        hasNextPage = false;
      }
    }

    const results = [];

    // 2. Audit each repo
    for (const repo of repos) {
      const repoResult: any = {
        id: repo.id,
        ownerName: repo.owner.login,
        repoName: repo.name,
        fullName: repo.full_name,
        visibility: repo.visibility,
        archived: repo.archived,
        disabled: repo.disabled,
        isFork: repo.fork,
        defaultBranch: repo.default_branch,
        hasPages: repo.has_pages,
        htmlUrl: repo.html_url,
        createdAt: repo.created_at,
        updatedAt: repo.updated_at,
        pushedAt: repo.pushed_at,
        pagesSettingsUrl: `https://github.com/${repo.owner.login}/${repo.name}/settings/pages`,
        deploymentMethod: 'unknown',
        customDomainStatus: 'pages_disabled',
        httpsCertificateStatus: 'https_certificate_problem_or_unknown'
      };

      if (!repo.has_pages) {
        repoResult.deploymentMethod = 'not_applicable';
        results.push(repoResult);
        continue;
      }

      const pagesResponse = await githubApi(`/repos/${repo.owner.login}/${repo.name}/pages`, pat as string);
      
      const pagesRateLimitError = checkRateLimit(pagesResponse);
      if (pagesRateLimitError) {
         repoResult.errorClassification = pagesRateLimitError;
         results.push(repoResult);
         continue; // Stop trying to fetch further details for this repo if rate limited
      }

      if (pagesResponse.status === 404) {
        repoResult.hasPages = false;
        repoResult.customDomainStatus = 'pages_disabled';
        repoResult.deploymentMethod = 'not_applicable';
        repoResult.errorClassification = 'pages_disabled_or_unavailable';
      } else if (pagesResponse.ok) {
        const pagesData = await pagesResponse.json();
        repoResult.pagesStatus = pagesData.status;
        repoResult.buildType = pagesData.build_type;
        repoResult.sourceBranch = pagesData.source?.branch;
        repoResult.sourcePath = pagesData.source?.path;
        repoResult.cname = pagesData.cname;
        repoResult.protectedDomainState = pagesData.protected_domain_state;
        repoResult.pendingDomainUnverifiedAt = pagesData.pending_domain_unverified_at;
        repoResult.httpsCertificateState = pagesData.https_certificate?.state;
        repoResult.httpsEnforced = pagesData.https_enforced;

        // Classify deployment method
        if (pagesData.build_type === 'workflow') {
          repoResult.deploymentMethod = 'workflow';
          repoResult.publishingSourceSummary = 'GitHub Actions workflow';
        } else if (pagesData.build_type === 'legacy' && pagesData.source?.path === '/') {
          repoResult.deploymentMethod = 'branch_root';
          repoResult.publishingSourceSummary = `${pagesData.source?.branch}:/`;
        } else if (pagesData.build_type === 'legacy' && pagesData.source?.path === '/docs') {
          repoResult.deploymentMethod = 'branch_docs';
          repoResult.publishingSourceSummary = `${pagesData.source?.branch}:/docs`;
        } else if (pagesData.build_type === 'legacy') {
          repoResult.deploymentMethod = 'branch_unknown_path';
          repoResult.publishingSourceSummary = `${pagesData.source?.branch}:${pagesData.source?.path}`;
        } else {
          repoResult.deploymentMethod = 'unknown';
          repoResult.publishingSourceSummary = 'Unknown Pages deployment method';
        }

        // Classify domain status
        if (!pagesData.cname) {
          repoResult.customDomainStatus = 'pages_enabled_no_custom_domain';
        } else if (pagesData.protected_domain_state === 'verified') {
          repoResult.customDomainStatus = 'custom_domain_verified';
        } else if (pagesData.pending_domain_unverified_at) {
          repoResult.customDomainStatus = 'custom_domain_pending';
        } else {
          repoResult.customDomainStatus = 'custom_domain_unverified_or_unknown';
        }

        // Classify HTTPS
        if (pagesData.https_certificate?.state === 'approved') {
          repoResult.httpsCertificateStatus = pagesData.https_enforced ? 'https_certificate_ok' : 'https_not_enforced';
        } else {
          repoResult.httpsCertificateStatus = 'https_certificate_problem_or_unknown';
        }

      } else {
        repoResult.errorClassification = classifyError(pagesResponse.status, false, false, repo.has_pages);
      }
      
      results.push(repoResult);
    }

    res.json({ results });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

if (process.env.NODE_ENV !== 'test') {
  startServer();
}
