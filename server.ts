import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import fs from 'fs';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

import { validateBackendEnv } from './server/env';

// Validate runtime environment
const backendEnv = validateBackendEnv();

import { 
  githubApi, 
  classifyError, 
  checkRateLimit 
} from './server/githubClient';

import { 
  classifyDeploymentMethod, 
  classifyCustomDomainStatus, 
  classifyHttpsCertificateStatus 
} from './src/audit/classification';

import { fetchSiteMetadata } from './server/siteMetadata';

// Initialize Firebase Admin using validated settings
try {
  if (!getApps().length) {
    if (backendEnv.hasFirebaseConfig && backendEnv.projectId) {
      initializeApp({
        projectId: backendEnv.projectId
      });
    } else {
      initializeApp();
    }
  }
} catch (error) {
  console.warn("Firebase Admin Initialization missing config. Warning only for Dev environments.", error);
}

const app = express();
app.use(express.json());

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Middleware to verify Firebase ID Token
async function verifyAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const idToken = authHeader.split('Bearer ')[1];
  
  // STUB for MVP - allow dummy-token to simulate Anonymous Guest Mode only if explicitly enabled
  if (idToken === 'dummy-token' && process.env.ALLOW_DUMMY_AUTH === 'true') {
    (req as any).user = { uid: 'anonymous-guest', isAnonymous: true };
    return next();
  }

  try {
    const decodedToken = await getAuth().verifyIdToken(idToken);
    (req as any).user = decodedToken;
    next();
  } catch (error: any) {
    // SECURITY: Do not log Firebase ID tokens plaintext
    console.error('Error verifying Firebase ID token signature/expiration:', error);
    return res.status(401).json({ error: 'Unauthorized', details: error.message });
  }
}

// --- API ROUTES ---

// 1. PAT Management (Client directly uses Firestore now)
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

// 2. Audit Endpoints
app.post('/api/audit/run', verifyAuth, async (req, res) => {
  const user = (req as any).user;
  const pat = req.headers['x-temp-pat'];
  if (!pat || typeof pat !== 'string') return res.status(400).json({ error: 'No GitHub PAT provided' });

  const scanMode = req.body.scanMode || 'user';
  const orgName = req.body.organizationName || '';

  if (scanMode === 'org') {
    if (!orgName || typeof orgName !== 'string' || !/^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/.test(orgName)) {
      return res.status(400).json({ error: 'Invalid organization name' });
    }
  }

  // Set headers for NDJSON streaming immediately to enable chunked transfer
  res.setHeader('Content-Type', 'application/x-ndjson');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    // Stage 1: Fetching repositories
    res.write(JSON.stringify({ type: 'progress', current: 0, total: 0, repo: 'Connecting to GitHub and initializing...' }) + '\n');

    let repos: any[] = [];
    let page = 1;
    let hasNextPage = true;

    const repoFetchEndpoint = scanMode === 'org' ? `/orgs/${orgName}/repos` : '/user/repos';
    // For user repos, affiliation helps. For orgs, it might not be supported but doesn't hurt, or we can use default (all).
    // Actually orgs/repos does not take visibility/affiliation the same way user/repos does. Let's adjust params.
    const queryParams: any = { page, per_page: 100 };
    if (scanMode === 'user') {
      queryParams.visibility = 'all';
      queryParams.affiliation = 'owner,collaborator,organization_member';
    }

    while (hasNextPage) {
      res.write(JSON.stringify({ type: 'progress', current: 0, total: 0, repo: `Retrieving repository metadata (page ${page})...` }) + '\n');
      
      queryParams.page = page;
      const reposResponse = await githubApi(repoFetchEndpoint, pat as string, queryParams);
      
      const rateLimitError = checkRateLimit(reposResponse);
      if (rateLimitError) {
        res.write(JSON.stringify({ type: 'error', error: rateLimitError, details: 'Rate limited while fetching repositories.' }) + '\n');
        res.end();
        return;
      }

      if (!reposResponse.ok) {
        res.write(JSON.stringify({ 
          type: 'error',
          error: classifyError(reposResponse.status, scanMode === 'user', true, false), 
          details: await reposResponse.text() 
        }) + '\n');
        res.end();
        return;
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
    const total = repos.length;

    // Stage 2: Audit repositories
    for (let i = 0; i < total; i++) {
      const repo = repos[i];
      
      // Update client-side progress bar
      res.write(JSON.stringify({ type: 'progress', current: i + 1, total, repo: repo.full_name }) + '\n');

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
        
        // Use standard pure classification
        const buildInfo = classifyDeploymentMethod({ hasPages: false });
        repoResult.deploymentMethod = buildInfo.deploymentMethod;
        repoResult.publishingSourceSummary = buildInfo.publishingSourceSummary;

        repoResult.customDomainStatus = classifyCustomDomainStatus({ hasPages: false });
        repoResult.httpsCertificateStatus = classifyHttpsCertificateStatus({ hasPages: false });
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
        repoResult.httpsCertificateDescription = pagesData.https_certificate?.description || null;
        repoResult.httpsCertificateDomains = pagesData.https_certificate?.domains || [];
        repoResult.httpsCertificateExpiresAt = pagesData.https_certificate?.expires_at || null;
        repoResult.httpsEnforced = pagesData.https_enforced;
        repoResult.pagesHtmlUrl = pagesData.html_url || null;

        if (pagesData.html_url) {
          try {
            const meta = await fetchSiteMetadata(pagesData.html_url);
            repoResult.faviconUrl = meta.faviconUrl;
            repoResult.manifestUrl = meta.manifestUrl;
            repoResult.isPwa = meta.isPwa;
            repoResult.pwaIconUrl = meta.pwaIconUrl;
            repoResult.pwaName = meta.pwaName;
            repoResult.pwaDisplayMode = meta.pwaDisplayMode;
          } catch (e) {
            console.warn(`Failed to collect site metadata for ${pagesData.html_url}:`, e);
          }
        }

        const classificationInputs = {
          hasPages: true,
          buildType: pagesData.build_type,
          sourceBranch: pagesData.source?.branch,
          sourcePath: pagesData.source?.path,
          cname: pagesData.cname,
          protectedDomainState: pagesData.protected_domain_state,
          pendingDomainUnverifiedAt: pagesData.pending_domain_unverified_at,
          httpsCertificateState: pagesData.https_certificate?.state,
          httpsEnforced: pagesData.https_enforced
        };

        // Classify deployment method using shared function
        const buildInfo = classifyDeploymentMethod(classificationInputs);
        repoResult.deploymentMethod = buildInfo.deploymentMethod;
        repoResult.publishingSourceSummary = buildInfo.publishingSourceSummary;

        // Classify domain status using shared function
        repoResult.customDomainStatus = classifyCustomDomainStatus(classificationInputs);

        // Classify HTTPS status using shared function
        repoResult.httpsCertificateStatus = classifyHttpsCertificateStatus(classificationInputs);

      } else {
        repoResult.errorClassification = classifyError(pagesResponse.status, false, false, repo.has_pages);
      }
      
      results.push(repoResult);
    }

    const auditId = 'aud_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);

    res.write(JSON.stringify({ type: 'done', results, auditId, createdAt: new Date().toISOString() }) + '\n');
    res.end();
  } catch (error: any) {
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    } else {
      res.write(JSON.stringify({ type: 'error', error: error.message }) + '\n');
      res.end();
    }
  }
});

// 3. Unauthenticated Health Check
app.get('/healthz', (req, res) => {
  res.json({ ok: true });
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
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

if (process.env.NODE_ENV !== 'test' && !process.argv.some(arg => arg.includes('test'))) {
  startServer();
}

// Re-export from server for easier consumption in tests
export { githubApi, ALLOWED_ENDPOINTS } from './server/githubClient';
export { app };
