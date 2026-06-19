import assert from 'node:assert';
import { describe, it, before, after } from 'node:test';
import * as fs from 'fs';
import * as path from 'path';
import Ajv from 'ajv';
import { githubApi, ALLOWED_ENDPOINTS, app } from '../server.js';
import { 
  classifyDeploymentMethod, 
  classifyCustomDomainStatus, 
  classifyHttpsCertificateStatus 
} from '../src/audit/classification.js';
import { 
  buildJsonExport, 
  buildCsvExport, 
  escapeCsvCell 
} from '../src/export/exportBuilders.js';
import { buildJsonExportV2 } from '../src/export/exportBuildersV2.js';
import { RepositoryResult } from '../src/types.js';
import { ExportBuildContext } from '../src/schema/exportTypes.js';
import { getEnvironmentName, getGithubTokenDocPath, getAuditCollectionPath } from '../src/lib/firestorePaths.js';
import { liveExportSampleRows } from './fixtures/liveExportRows.js';

describe('GitHub API Allowlist and Subpaths', () => {
  it('allows allowlisted endpoints', () => {
    const valid = [
      '/user',
      '/user/repos',
      '/repos/test-owner/test-repo/pages',
      '/repos/test-owner/test-repo/pages/health',
      '/rate_limit'
    ];
    for (const ep of valid) {
      assert.ok(
        ALLOWED_ENDPOINTS.some(regex => regex.test(ep)),
        `Endpoint ${ep} should be allowed`
      );
    }
  });

  it('rejects forbidden or arbitrary write and actions endpoints', () => {
    const invalid = [
      '/user/emails',
      '/repos/test-owner/test-repo/dispatches',
      '/repos/test-owner/test-repo/actions/workflows',
      '/repos/test-owner/test-repo/actions/runs',
      '/repos/test-owner/test-repo/pages/builds',
      '/repos/test-owner/test-repo',
      '/orgs/my-org/repos',
      '/repos/test-owner/test-repo/contents/CNAME',
      '/repos/test-owner/test-repo/key',
      '/orgs/test/outside'
    ];
    for (const ep of invalid) {
      assert.ok(
        ALLOWED_ENDPOINTS.some(regex => regex.test(ep)) === false,
        `Endpoint ${ep} should be disallowed`
      );
    }
  });
});


describe('Deployment Method Classification Engine', () => {
  it('handles build_type=workflow correctly', () => {
    const res = classifyDeploymentMethod({
      hasPages: true,
      buildType: 'workflow'
    });
    assert.equal(res.deploymentMethod, 'workflow');
    assert.equal(res.publishingSourceSummary, 'GitHub Actions workflow');
  });

  it('handles legacy with root path correctly', () => {
    const res = classifyDeploymentMethod({
      hasPages: true,
      buildType: 'legacy',
      sourceBranch: 'main',
      sourcePath: '/'
    });
    assert.equal(res.deploymentMethod, 'branch_root');
    assert.equal(res.publishingSourceSummary, 'main:/');
  });

  it('handles legacy with docs path correctly', () => {
    const res = classifyDeploymentMethod({
      hasPages: true,
      buildType: 'legacy',
      sourceBranch: 'gh-pages',
      sourcePath: '/docs'
    });
    assert.equal(res.deploymentMethod, 'branch_docs');
    assert.equal(res.publishingSourceSummary, 'gh-pages:/docs');
  });

  it('handles legacy with unknown path correctly', () => {
    const res = classifyDeploymentMethod({
      hasPages: true,
      buildType: 'legacy',
      sourceBranch: 'assets',
      sourcePath: '/dist'
    });
    assert.equal(res.deploymentMethod, 'branch_unknown_path');
    assert.equal(res.publishingSourceSummary, 'assets:/dist');
  });

  it('handles unknown build_type correctly', () => {
    const res = classifyDeploymentMethod({
      hasPages: true,
      buildType: 'magic-deploy'
    });
    assert.equal(res.deploymentMethod, 'unknown');
    assert.equal(res.publishingSourceSummary, 'Unknown Pages deployment method');
  });

  it('handles pages.hasPages = false gracefully', () => {
    const res = classifyDeploymentMethod({
      hasPages: false
    });
    assert.equal(res.deploymentMethod, 'not_applicable');
    assert.equal(res.publishingSourceSummary, null);
  });
});

describe('Custom Domain and HTTPS Classification Engine', () => {
  it('classifies normal no-custom-domain setups', () => {
    const res = classifyCustomDomainStatus({
      hasPages: true,
      cname: null
    });
    assert.equal(res, 'pages_enabled_no_custom_domain');
  });

  it('classifies verified custom domains', () => {
    const res = classifyCustomDomainStatus({
      hasPages: true,
      cname: 'example.com',
      protectedDomainState: 'verified'
    });
    assert.equal(res, 'custom_domain_verified');
  });

  it('classifies pending custom domains', () => {
    const res = classifyCustomDomainStatus({
      hasPages: true,
      cname: 'example.com',
      protectedDomainState: 'pending',
      pendingDomainUnverifiedAt: '2026-06-18T20:00:00Z'
    });
    assert.equal(res, 'custom_domain_pending');
  });

  it('classifies non-approved/problematic SSL certificates', () => {
    const res = classifyHttpsCertificateStatus({
      hasPages: true,
      httpsCertificateState: 'new'
    });
    assert.equal(res, 'https_certificate_problem_or_unknown');
  });

  it('classifies approved certificate but not enforced', () => {
    const res = classifyHttpsCertificateStatus({
      hasPages: true,
      httpsCertificateState: 'approved',
      httpsEnforced: false
    });
    assert.equal(res, 'https_not_enforced');
  });

  it('classifies approved and enforced HTTPS', () => {
    const res = classifyHttpsCertificateStatus({
      hasPages: true,
      httpsCertificateState: 'approved',
      httpsEnforced: true
    });
    assert.equal(res, 'https_certificate_ok');
  });
});

describe('JSON Export and Schema Structure Check', () => {
  const dummyResults: RepositoryResult[] = [
    {
      id: 123456,
      ownerName: 'TakashiSasaki',
      repoName: 'gpa-test',
      fullName: 'TakashiSasaki/gpa-test',
      visibility: 'public',
      archived: false,
      disabled: false,
      isFork: false,
      defaultBranch: 'main',
      hasPages: true,
      htmlUrl: 'https://github.com/TakashiSasaki/gpa-test',
      pagesSettingsUrl: 'https://github.com/TakashiSasaki/gpa-test/settings/pages',
      pagesHtmlUrl: 'https://takashisasaki.github.io/gpa-test/',
      pagesStatus: 'built',
      buildType: 'workflow',
      deploymentMethod: 'workflow',
      customDomainStatus: 'pages_enabled_no_custom_domain',
      httpsCertificateStatus: 'https_certificate_ok',
      cname: '',
      httpsEnforced: true,
      protectedDomainState: 'none',
      pendingDomainUnverifiedAt: null,
      httpsCertificateState: 'approved',
      httpsCertificateDescription: 'Certificate is secure',
      httpsCertificateDomains: ['takashisasaki.github.io'],
      httpsCertificateExpiresAt: '2026-12-31T23:59:59Z',
      createdAt: '2026-06-18T00:00:00Z',
      updatedAt: '2026-06-18T12:00:00Z',
      pushedAt: '2026-06-18T18:00:00Z'
    },
    {
      id: 789012,
      ownerName: 'TakashiSasaki',
      repoName: 'no-pages-repo',
      fullName: 'TakashiSasaki/no-pages-repo',
      visibility: 'private',
      archived: false,
      disabled: false,
      isFork: false,
      defaultBranch: 'main',
      hasPages: false,
      htmlUrl: 'https://github.com/TakashiSasaki/no-pages-repo',
      pagesSettingsUrl: 'https://github.com/TakashiSasaki/no-pages-repo/settings/pages',
      deploymentMethod: 'not_applicable',
      customDomainStatus: 'pages_disabled',
      httpsCertificateStatus: 'https_certificate_problem_or_unknown',
      pagesHtmlUrl: null,
      createdAt: '2026-06-18T00:00:00Z',
      updatedAt: '2026-06-18T12:00:00Z',
      pushedAt: '2026-06-18T18:00:00Z'
    }
  ];

  it('produces valid tokenType mapped format', () => {
    const ghpJson = buildJsonExport(dummyResults, { tokenType: 'classic' });
    assert.equal(ghpJson.auditRun.tokenType, 'classic');

    const patJson = buildJsonExport(dummyResults, { tokenType: 'fine_grained' });
    assert.equal(patJson.auditRun.tokenType, 'fine_grained');
    assert.notEqual(patJson.auditRun.tokenType, 'fine-grained');
  });

  it('guarantees layout maps authentic pages.html_url and standard fields matching schema spec', () => {
    const json = buildJsonExport(dummyResults, { tokenType: 'classic' });
    
    assert.equal(json.schemaVersion, 'github-pages-auditor.export.v1');
    assert.equal(json.summary.repositoryCount, 2);
    
    const repoWithPages = json.repositories.find(r => r.githubRepoId === 123456);
    assert.ok(repoWithPages);
    assert.equal(repoWithPages.pagesUrl, 'https://takashisasaki.github.io/gpa-test/');
    assert.deepEqual(repoWithPages.httpsCertificateDomains, ['takashisasaki.github.io']);
    assert.equal(repoWithPages.httpsCertificateExpiresAt, '2026-12-31T23:59:59Z');
    
    // Classifications check
    assert.ok(repoWithPages.classification.includes('pages_enabled_no_custom_domain'));
    assert.ok(repoWithPages.classification.includes('pages_deploy_method_workflow'));
    
    // Validate classification never contains invalid "pages_deploy_method_not_applicable"
    const repoWithNoPages = json.repositories.find(r => r.githubRepoId === 789012);
    assert.ok(repoWithNoPages);
    assert.ok(!repoWithNoPages.classification.includes('pages_deploy_method_not_applicable' as any));
  });

  it('validates generated export data against the generated JSON schema', () => {
    const json = buildJsonExport(dummyResults, { tokenType: 'classic' });
    const schemaContent = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), 'schemas/github-pages-auditor-export-v1.schema.json'), 'utf-8')
    );
    
    // Create Ajv instance with standard options. Allow dual union schemas.
    const ajv = new Ajv({ strict: false });
    const validate = ajv.compile(schemaContent);
    const valid = validate(json);
    
    if (!valid) {
      console.error('Validation errors:', validate.errors);
    }
    assert.ok(valid, 'The built export data must strictly pass the JSON schema layout specification validated by Ajv.');
  });

  it('ensures json export does not leak secrets when build context contains metadata', () => {
    const context: ExportBuildContext = {
      tokenType: 'classic',
      githubLogin: 'TakashiSasaki',
      auditRunId: 'audit-run-id-example',
      appEnvironment: 'production'
    };
    const jsonStr = JSON.stringify(buildJsonExport(dummyResults, context));
    // Check that we never see actual raw secret variables
    assert.ok(!jsonStr.includes('ghp_'), 'JSON export must not contain PAT prefix ghp_');
    assert.ok(!jsonStr.includes('github_pat_'), 'JSON export must not contain PAT prefix github_pat_');
    assert.ok(!jsonStr.includes('Authorization'), 'JSON export must not contain Authorization headers');
    assert.ok(!jsonStr.includes('githubTokens'), 'JSON export must not contain Firestore path details');
  });

  it('ensures CSV export does not leak secrets', () => {
    const context: ExportBuildContext = {
      tokenType: 'classic',
      githubLogin: 'TakashiSasaki',
      auditRunId: 'audit-run-id-example',
      appEnvironment: 'production'
    };
    const csvStr = buildCsvExport(dummyResults, context);
    assert.ok(!csvStr.includes('ghp_'), 'CSV export must not contain PAT prefix ghp_');
    assert.ok(!csvStr.includes('github_pat_'), 'CSV export must not contain PAT prefix github_pat_');
    assert.ok(!csvStr.includes('Authorization'), 'CSV export must not contain Authorization headers');
    assert.ok(!csvStr.includes('githubTokens'), 'CSV export must not contain Firestore path details');
  });

  it('exports dynamic version not hardcoded', () => {
    const json = buildJsonExport(dummyResults, { tokenType: 'classic' });
    assert.ok(json.application.version);
    assert.ok(json.application.version !== '1.0.0' || typeof __APP_VERSION__ !== 'undefined', 'Version should not be hardcoded to 1.0.0');
    if (typeof __APP_VERSION__ !== 'undefined') {
      assert.strictEqual(json.application.version, __APP_VERSION__);
    }
  });
});

describe('GitHub API Security & Proxy Shield', () => {
  let originalFetch: typeof globalThis.fetch;

  before(() => {
    originalFetch = globalThis.fetch;
  });

  after(() => {
    globalThis.fetch = originalFetch;
  });

  it('rejects forbidden endpoints without making a network request', async () => {
    let fetchCalled = false;
    globalThis.fetch = async () => {
      fetchCalled = true;
      return new Response();
    };

    const invalid = [
      '/user/emails',
      '/repos/test-owner/test-repo/actions/workflows',
      '/repos/test-owner/test-repo/actions/runs',
      '/repos/test-owner/test-repo/pages/builds',
      '/repos/test-owner/test-repo/contents/CNAME',
      '/repos/owner/repo/pulls',
      '/orgs/my-org/repos'
    ];

    for (const ep of invalid) {
      fetchCalled = false; // reset
      try {
        await githubApi(ep, 'ghp_dummy_token');
        assert.fail(`githubApi should have rejected ${ep}`);
      } catch (err: any) {
        assert.match(err.message, /Endpoint .* is not allowed/i, `Expected forbidden error for ${ep}`);
      }
      assert.strictEqual(fetchCalled, false, `Fetch must not be called inside githubApi for ${ep}`);
    }
  });

  it('makes correct GET request for allowed endpoints', async () => {
    let capturedReq: Request | null = null;
    globalThis.fetch = async (req, init) => {
      capturedReq = req instanceof Request ? req : new Request('' + req, init);
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    };

    const res = await githubApi('/user', 'ghp_secret_test_token');
    assert.strictEqual(res.ok, true);
    assert.ok(capturedReq, 'Fetch should have been called');

    const method = capturedReq.method;
    assert.strictEqual(method, 'GET', 'GitHub API wrapper must force GET in Version 1');
    assert.strictEqual(capturedReq.url, 'https://api.github.com/user');
    assert.strictEqual(capturedReq.headers.get('Authorization'), 'Bearer ghp_secret_test_token');
    assert.strictEqual(capturedReq.headers.get('Accept'), 'application/vnd.github+json');
    assert.strictEqual(capturedReq.headers.get('X-GitHub-Api-Version'), '2026-03-10');
  });
});
describe('CSV formulas injection defense', () => {
  it('escapes cells starting with formula trigger chars (=, +, -, @)', () => {
    const triggerVals = [
      '=1+2',
      '+123',
      '-456',
      '@something'
    ];
    for (const val of triggerVals) {
      const escaped = escapeCsvCell(val);
      assert.ok(escaped.startsWith("'"), `Cell value "${val}" should be prefixed with a single quote for injection defense`);
    }
  });

  it('keeps normal text and URLs clean and unquoted unless containing separator commas', () => {
    assert.equal(escapeCsvCell('my-repo'), 'my-repo');
    assert.equal(escapeCsvCell('https://github.com'), 'https://github.com');
    // contains comma
    assert.equal(escapeCsvCell('some,text'), '"some,text"');
  });
});

describe('Firestore Path Helpers', () => {
  it('correctly builds standard and anonymous user Firestore paths', () => {
    const environmentDev = getEnvironmentName('development');
    const environmentProd = getEnvironmentName('production');

    assert.strictEqual(environmentDev, 'development');
    assert.strictEqual(environmentProd, 'production');

    // 1. Google user PAT path matches specification
    const patPathGoogle = getGithubTokenDocPath('development', 'user123', false);
    assert.strictEqual(patPathGoogle, 'githubPagesAuditorV1/development/users/user123/githubTokens/default');

    // 2. Anonymous PAT path matches specification under anonymous session namespace
    const patPathAnon = getGithubTokenDocPath('development', 'anon456', true);
    assert.strictEqual(patPathAnon, 'githubPagesAuditorV1/development/anonymousSessions/anon456/githubTokens/default');

    // 3. Audit cache path matches specification under tenancy
    const auditPath = getAuditCollectionPath('development', 'user123');
    assert.strictEqual(auditPath, 'githubPagesAuditorV1/development/users/user123/audits');

    // 4. Paths do not use generic top-level collections
    assert.ok(!patPathGoogle.startsWith('users/'), 'Paths must not use generic top-level collections');
    assert.ok(!patPathGoogle.startsWith('tokens/'), 'Paths must not use generic top-level collections');
    assert.ok(!patPathAnon.startsWith('anonymousSessions/'), 'Paths must not use generic top-level collections');
    assert.ok(!auditPath.startsWith('audits/'), 'Paths must not use generic top-level collections');
  });
});

describe('Express Server Contracts and Boundary Defenses', () => {
  it('defines a secure and unauthenticated /healthz endpoint', () => {
    // Inspect Express stack routes to ensure /healthz is registered correctly
    const routes = app._router.stack
      .filter((layer: any) => layer.route)
      .map((layer: any) => ({
        path: layer.route.path,
        methods: layer.route.methods
      }));
    
    const healthzRoute = routes.find((r: any) => r.path === '/healthz');
    assert.ok(healthzRoute, '/healthz endpoint must be registered on the Express router');
    assert.ok(healthzRoute.methods.get, '/healthz endpoint must respond to GET requests');
  });

  it('prohibits any OAuth/App callback or installation routes in the routing table', () => {
    // Ensure absolutely NO routes matching OAuth, github-app, callback or installation exist
    // Express stack contains route layers. Let's inspect paths.
    const routes = app._router.stack
      .filter((layer: any) => layer.route)
      .map((layer: any) => layer.route.path);

    const forbiddenSubstrings = ['oauth', 'callback', 'github-app', 'install', 'webhook'];
    for (const routePath of routes) {
      for (const forbidden of forbiddenSubstrings) {
        assert.ok(
          !routePath.toLowerCase().includes(forbidden),
          `Production security security constraint: found forbidden routes mapping URL "${routePath}" containing string "${forbidden}". All third-party callback routes are strictly out of scope!`
        );
      }
    }
  });

  it('guarantees key audit and validation APIs require auth middleware headers', () => {
    // Verify that /api/pat/validate is protected by auth barriers in the stack
    const patRouteLayer = app._router.stack.find(
      (layer: any) => layer.route && layer.route.path === '/api/pat/validate'
    );
    assert.ok(patRouteLayer, '/api/pat/validate route must be defined');
    
    // Stack length is at least 2: verifyAuth middleware + endpoint callback handler
    assert.ok(
      patRouteLayer.route.stack.length >= 2,
      '/api/pat/validate must possess authentic middleware protection (such as verifyAuth) preceding the callback handler'
    );
  });
});

describe('CSV Export Regression and Live Data Diagnostics', () => {
  it('guarantees header stability and correct column count', () => {
    const csvContent = buildCsvExport(liveExportSampleRows, {
      auditRunId: 'test-audit-456',
      exportedAt: '2026-06-19T13:00:00Z',
      userMode: 'google'
    });

    const lines = csvContent.split('\n');
    assert.ok(lines.length > 1, 'CSV must contain headers and at least some rows');

    const headers = lines[0].split(',');
    assert.strictEqual(headers.length, 27, 'CSV must provide precisely 27 headers');

    // Confirm core headers exist in the exact required layout
    assert.strictEqual(headers[0], 'audit_run_id');
    assert.strictEqual(headers[1], 'exported_at');
    assert.strictEqual(headers[26], 'error_classification');

    // Verify all rows have precisely 27 columns
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;
      
      // Simple parse for commas that are not wrapped in quotes
      const columns = [];
      let current = '';
      let inQuotes = false;
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          columns.push(current);
          current = '';
        } else {
          current += char;
        }
      }
      columns.push(current);

      assert.strictEqual(
        columns.length, 
        27, 
        `Row ${i} must have precisely 27 elements. Actual column count: ${columns.length}. Line content: "${line}"`
      );

      // Verify that audit_run_id corresponds to the supplied context
      assert.strictEqual(columns[0], 'test-audit-456', 'Row must reflect context auditRunId');
      assert.strictEqual(columns[1], '2026-06-19T13:00:00Z', 'Row must reflect context timestamp');
    }
  });

  it('verifies custom domain status mappings and HTTPS enforcement findings in CSV output', () => {
    const csvContent = buildCsvExport(liveExportSampleRows, {
      auditRunId: 'test-audit-123',
      exportedAt: '2026-06-19T13:00:00Z'
    });

    const lines = csvContent.split('\n');
    
    // Find row with id 103 (custom-domain-blank-protected)
    const line103 = lines.find(l => l.includes('custom-domain-blank-protected'));
    assert.ok(line103, 'Row 103 must exist');
    assert.ok(line103.includes('custom_domain_configured'), 'Blank protected state must default to custom_domain_configured');

    // Find row with id 104 (enforced)
    const line104 = lines.find(l => l.includes('custom-domain-enforced'));
    assert.ok(line104, 'Row 104 must exist');
    assert.ok(line104.includes('custom_domain_verified'), 'Verified state must map to custom_domain_verified');

    // Find row with id 105 (unenforced)
    const line105 = lines.find(l => l.includes('custom-domain-unenforced'));
    assert.ok(line105, 'Row 105 must exist');
    assert.ok(line105.includes('https_not_enforced'), 'Unenforced HTTPS must map to include https_not_enforced in the classifications column');
  });

  it('validates JSON export summary indicators reflect correct unenforced HTTPS statistics', () => {
    const jsonExport = buildJsonExport(liveExportSampleRows, {
      auditRunId: 'test-json-run',
      exportedAt: '2026-06-19T13:00:00Z',
      userMode: 'google'
    });

    assert.strictEqual(jsonExport.summary.repositoryCount, 5, 'Must contain 5 repositories');
    assert.strictEqual(jsonExport.summary.httpsNotEnforcedCount, 1, 'Only row id 105 has unenforced HTTPS');
    assert.strictEqual(jsonExport.summary.approvedCertButHttpsNotEnforcedCount, 1, 'Row 105 has approved certificate but false enforcement');
    assert.strictEqual(jsonExport.summary.customDomainHttpsNotEnforcedCount, 1, 'Row 105 is custom-domain-configured and unenforced');

    // Make sure JSON is correct against the Ajv validator
    const schemaContent = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), 'schemas/github-pages-auditor-export-v1.schema.json'), 'utf-8')
    );
    const ajv = new Ajv({ strict: false });
    const validate = ajv.compile(schemaContent);
    const valid = validate(jsonExport);
    assert.ok(valid, 'The updated JSON export (including new summary fields) must strictly validate against the regenerated schema');
  });

  it('guarantees custom-domain blank protection translates specifically to unknown verification state', () => {
    const jsonExport = buildJsonExport(liveExportSampleRows, {
      auditRunId: 'test-unknown-handshake'
    });

    // Row id 103 has undefined/blank protectedDomainState. It must be mapped to 'unknown'.
    const repo103 = jsonExport.repositories.find(r => r.githubRepoId === 103);
    assert.ok(repo103, 'Repo 103 must be present in JSON export');
    assert.strictEqual(repo103.customDomainVerificationState, 'unknown', 'Blank/undefined protectedDomainState must map to customDomainVerificationState unknown');

    // Row id 104 has verified state
    const repo104 = jsonExport.repositories.find(r => r.githubRepoId === 104);
    assert.ok(repo104);
    assert.strictEqual(repo104.customDomainVerificationState, 'verified', 'Verified protectedDomainState must map to customDomainVerificationState verified');

    // Row id 101 has no pages
    const repo101 = jsonExport.repositories.find(r => r.githubRepoId === 101);
    assert.ok(repo101);
    assert.strictEqual(repo101.customDomainVerificationState, 'not_applicable', 'Deactivated Pages must map to customDomainVerificationState not_applicable');
  });

  it('proves that export context controls auditRun metadata and does not leak raw tokens or database paths', () => {
    const context = {
      auditRunId: 'system-verified-audit-999',
      exportedAt: '2026-06-19T23:59:59Z',
      userMode: 'google' as const,
      githubLogin: 'TakashiSasaki',
      appEnvironment: 'production'
    };

    const jsonExport = buildJsonExport(liveExportSampleRows, context);
    const csvContent = buildCsvExport(liveExportSampleRows, context);

    // Verify context overrides auditRun identifiers
    assert.strictEqual(jsonExport.auditRun.id, 'system-verified-audit-999');
    assert.strictEqual(jsonExport.exportedAt, '2026-06-19T23:59:59Z');
    assert.strictEqual(jsonExport.auditRun.userMode, 'google');
    assert.strictEqual(jsonExport.application.environment, 'production');

    // Verify CSV aligns with JSON on context IDs and dates
    const csvLines = csvContent.split('\n');
    assert.ok(csvLines.length > 1);
    const firstDataRow = csvLines[1].split(',');
    assert.strictEqual(firstDataRow[0], 'system-verified-audit-999', 'CSV audit_run_id must match context');
    assert.strictEqual(firstDataRow[1], '2026-06-19T23:59:59Z', 'CSV exported_at must match context');

    // Strict security shield: Verify no secrets or config files exist anywhere in the export payloads
    const jsonStr = JSON.stringify(jsonExport);
    const forbiddenPatterns = [
      'ghp_', 'github_pat_', 'Bearer', 'githubPagesAuditorV1', 'users/', 'anonymousSessions/'
    ];

    for (const forbidden of forbiddenPatterns) {
      assert.ok(!jsonStr.includes(forbidden), `JSON export must not leak configuration paths or tokens matching "${forbidden}"`);
      assert.ok(!csvContent.includes(forbidden), `CSV export must not leak configuration paths or tokens matching "${forbidden}"`);
    }
  });

  it('produces valid guest export scope IDs when no persisted audit ID parameter is loaded', () => {
    // Audit context without auditRunId
    const jsonExport = buildJsonExport(liveExportSampleRows, {
      exportedAt: '2026-06-19T13:00:00Z',
      userMode: 'anonymous'
    });

    assert.ok(jsonExport.auditRun.id.startsWith('export-'), 'Guest/anonymous exports without loaded audit IDs must generate safe dynamic export scope IDs');
  });

  it('asserts that the generated v1 and v2 schemas contain valid urn:uuid:uuid-v4 $id values', () => {
    const v1Schema = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'schemas/github-pages-auditor-export-v1.schema.json'), 'utf-8'));
    const v2Schema = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'schemas/github-pages-auditor-export-v2.schema.json'), 'utf-8'));

    assert.ok(v1Schema.$id, 'V1 schema must contain an $id field');
    assert.match(v1Schema.$id, /^urn:uuid:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'V1 $id must have standard urn:uuid:v4 formatting');

    assert.ok(v2Schema.$id, 'V2 schema must contain an $id field');
    assert.match(v2Schema.$id, /^urn:uuid:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'V2 $id must have standard urn:uuid:v4 formatting');
  });

  it('asserts that schema $id values are stable and not regenerated dynamically', () => {
    const v1Schema = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'schemas/github-pages-auditor-export-v1.schema.json'), 'utf-8'));
    const v2Schema = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'schemas/github-pages-auditor-export-v2.schema.json'), 'utf-8'));

    // Assert the exact hardcoded stable UUID values chosen for schema identity are preserved exactly
    assert.strictEqual(v1Schema.$id, 'urn:uuid:ef46fd93-424a-4e2a-8f5b-df97e28b2be1', 'V1 $id must remain stable across generation runs');
    assert.strictEqual(v2Schema.$id, 'urn:uuid:7d0f98be-8cba-49c5-84dc-66914b5da3f2', 'V2 $id must remain stable across generation runs');
  });

  it('validates the complete V2 JSON export structure and asserts schema compliance', () => {
    const context = {
      auditRunId: 'v2-audit-run-id-99',
      auditCreatedAt: '2026-06-19T10:00:00Z',
      exportedAt: '2026-06-19T11:00:00Z',
      userMode: 'google' as const,
      githubLogin: 'TakashiSasaki',
      appEnvironment: 'production'
    };

    const v2Export = buildJsonExportV2(liveExportSampleRows, context);

    // Validate using AJV against the V2 JSON Schema
    const v2SchemaContent = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), 'schemas/github-pages-auditor-export-v2.schema.json'), 'utf-8')
    );
    const ajv = new Ajv({ strict: false });
    const validate = ajv.compile(v2SchemaContent);
    const valid = validate(v2Export);

    if (!valid) {
      console.error('AJV V2 validation failures:', validate.errors);
    }
    assert.ok(valid, 'The generated V2 payload must strictly comply with the schemas/github-pages-auditor-export-v2.schema.json specifications.');

    // Assert V2 top-level schemaId matches schema $id
    assert.strictEqual(v2Export.schemaId, v2SchemaContent.$id, 'V2 export schemaId must exactly match schema $id');
    assert.strictEqual(v2Export.schemaId, 'urn:uuid:7d0f98be-8cba-49c5-84dc-66914b5da3f2', 'V2 export schemaId must match the stable UUID constant');

    // Assert schemaVersion and schemaId are distinct concepts
    assert.notStrictEqual(v2Export.schemaVersion, v2Export.schemaId, 'schemaVersion and schemaId must be distinct fields having distinct contents');
    assert.strictEqual(v2Export.schemaVersion, 'github-pages-auditor.export.v2');

    // Assert nesting layers
    assert.ok(Array.isArray(v2Export.repositories), 'v2Export.repositories must be an array');
    const firstRepRecord = v2Export.repositories[0];
    assert.ok(firstRepRecord.repository, 'must contain nested repository block');
    assert.ok(firstRepRecord.pages, 'must contain nested pages block');
    assert.ok(Array.isArray(firstRepRecord.findings), 'must contain findings array');

    // Assert specific fields
    const targetRecord = v2Export.repositories.find(
      r => r.repository.fullName === 'TakashiSasaki/custom-domain-unenforced'
    );
    assert.ok(targetRecord, 'custom-domain-unenforced must exist in the V2 repositories list');
    assert.strictEqual(typeof targetRecord.repository.githubId, 'string', 'repository.githubId must be string');

    // Assert deployment block
    assert.ok(targetRecord.pages.deployment, 'must contain deployment block');
    assert.strictEqual(targetRecord.pages.deployment.githubBuildTypeRaw, 'legacy', 'raw buildType must be preserved under pages.deployment.githubBuildTypeRaw');

    // Assert custom domain block
    assert.ok(targetRecord.pages.customDomain, 'must contain customDomain block');
    assert.strictEqual(targetRecord.pages.customDomain.cnameRaw, 'unenforced.com', 'raw customDomain cname must match cnameRaw');
    assert.strictEqual(targetRecord.pages.customDomain.githubProtectedDomainStateRaw, 'verified', 'raw protected state must be preserved under customDomain.githubProtectedDomainStateRaw');
    assert.strictEqual(targetRecord.pages.customDomain.verificationState, 'verified', 'normalized verificationState must map correctly');

    // Assert findings and check for the pages_https_not_enforced findings
    // TakashiSasaki/custom-domain-unenforced in liveExportSampleRows has httpsCertificateStatus = 'https_not_enforced' and httpsEnforced = false
    const httpsFindings = targetRecord.findings.filter(f => f.code === 'pages_https_not_enforced');
    assert.ok(httpsFindings.length >= 1, 'HTTPS not enforced must be represented in findings[]');
    assert.strictEqual(httpsFindings[0].category, 'https', 'finding category must match');
    assert.strictEqual(httpsFindings[0].severity, 'error', 'finding severity must match');
    assert.strictEqual(httpsFindings[0].source, 'github_pages_api', 'finding source must match');

    // Check custom_domain_https_not_enforced finding on custom-domain-unenforced
    const customHttpsFindings = targetRecord.findings.filter(f => f.code === 'custom_domain_https_not_enforced');
    assert.ok(customHttpsFindings.length >= 1, 'Custom domain HTTPS not enforced must be represented in findings[]');
    assert.strictEqual(customHttpsFindings[0].category, 'custom_domain', 'custom domain finding category must match');

    // Assert no secret leakages
    const v2Str = JSON.stringify(v2Export);
    const forbiddenPatterns = [
      'ghp_', 'github_pat_', 'Bearer', 'githubPagesAuditorV1', 'users/', 'anonymousSessions/'
    ];
    for (const pattern of forbiddenPatterns) {
      assert.ok(!v2Str.includes(pattern), `V2 JSON export must not contain forbidden pattern: ${pattern}`);
    }
  });

  it('proves that schema IDs are stable and not generated dynamically by calling builders multiple times', () => {
    const v1Ex1 = buildJsonExport(liveExportSampleRows);
    const v1Ex2 = buildJsonExport(liveExportSampleRows);
    assert.strictEqual(v1Ex1.schemaId, v1Ex2.schemaId, 'V1 schemaId must be identical across invocations');
    assert.strictEqual(v1Ex1.schemaId, 'urn:uuid:ef46fd93-424a-4e2a-8f5b-df97e28b2be1', 'V1 schemaId must match static constant');

    const v2Ex1 = buildJsonExportV2(liveExportSampleRows);
    const v2Ex2 = buildJsonExportV2(liveExportSampleRows);
    assert.strictEqual(v2Ex1.schemaId, v2Ex2.schemaId, 'V2 schemaId must be identical across invocations');
    assert.strictEqual(v2Ex1.schemaId, 'urn:uuid:7d0f98be-8cba-49c5-84dc-66914b5da3f2', 'V2 schemaId must match static constant');
  });
});

describe('External Consumer Sample File Validation Check', () => {
  it('validates generated sample files under examples/ folder against their corresponding schemas', () => {
    // 1. Read v1 schema and sample
    const v1Schema: any = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), 'schemas/github-pages-auditor-export-v1.schema.json'), 'utf-8')
    );
    const v1Sample: any = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), 'examples/github-pages-auditor-export-v1.sample.json'), 'utf-8')
    );

    const ajv = new Ajv({ strict: false });
    const validateV1 = ajv.compile(v1Schema);
    const validV1 = validateV1(v1Sample);
    if (!validV1) {
      console.error('V1 sample validation errors:', validateV1.errors);
    }
    assert.ok(validV1, 'Default V1 sample JSON must validate against schemas/github-pages-auditor-export-v1.schema.json');

    // 2. Read v2 schema and sample
    const v2Schema: any = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), 'schemas/github-pages-auditor-export-v2.schema.json'), 'utf-8')
    );
    const v2Sample: any = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), 'examples/github-pages-auditor-export-v2.sample.json'), 'utf-8')
    );

    const validateV2 = ajv.compile(v2Schema);
    const validV2 = validateV2(v2Sample);
    if (!validV2) {
      console.error('V2 sample validation errors:', validateV2.errors);
    }
    assert.ok(validV2, 'Interchange candidate V2 sample JSON must validate against schemas/github-pages-auditor-export-v2.schema.json');

    // 3. Assert schemaId values are stable and aligned with active stable URN identifiers
    assert.strictEqual((v1Sample as any).schemaId, v1Schema.$id, 'V1 sample schemaId matches V1 schema ID');
    assert.strictEqual((v1Sample as any).schemaId, 'urn:uuid:ef46fd93-424a-4e2a-8f5b-df97e28b2be1', 'V1 stable schema ID constant');
    assert.strictEqual((v2Sample as any).schemaId, v2Schema.$id, 'V2 sample schemaId matches V2 schema ID');
    assert.strictEqual((v2Sample as any).schemaId, 'urn:uuid:7d0f98be-8cba-49c5-84dc-66914b5da3f2', 'V2 stable schema ID constant');

    // 4. Assert nesting blocks with repositories, pages, findings are correctly represented on V2 sample
    assert.ok(Array.isArray((v2Sample as any).repositories), 'V2 sample repositories is array');
    const firstObj = (v2Sample as any).repositories[0];
    assert.ok(firstObj.repository, 'V2 sample contains repositories[0].repository');
    assert.ok(firstObj.pages, 'V2 sample contains repositories[0].pages');
    assert.ok(Array.isArray(firstObj.findings), 'V2 sample contains repositories[0].findings as array');

    // 5. Assert unknown protectedState maps to unverified verification state cleanly in V2
    const blankDomainObj = (v2Sample as any).repositories.find((r: any) => r.repository.name === 'custom-domain-blank-protected');
    assert.ok(blankDomainObj);
    assert.strictEqual(blankDomainObj.pages.customDomain.verificationState, 'unknown', 'V2 sample unknown protectedState should fall back to unknown verificationState');

    // 6. Assert secret minimization holds for both JSON sample files
    const v1Text = JSON.stringify(v1Sample);
    const v2Text = JSON.stringify(v2Sample);
    const csvContent = fs.readFileSync(path.join(process.cwd(), 'examples/github-pages-auditor-export.sample.csv'), 'utf-8');

    const secretShieldPatterns = [
      'ghp_', 'github_pat_', 'Bearer', 'githubPagesAuditorV1', 'users/', 'anonymousSessions/'
    ];

    for (const secret of secretShieldPatterns) {
      assert.ok(!v1Text.includes(secret), `V1 sample must not leak pattern ${secret}`);
      assert.ok(!v2Text.includes(secret), `V2 sample must not leak pattern ${secret}`);
      assert.ok(!csvContent.includes(secret), `CSV sample must not leak pattern ${secret}`);
    }

    // 7. Assert stable 27 columns CSV structure
    const csvLines = csvContent.split('\n').filter(Boolean);
    const headers = csvLines[0].split(',');
    assert.strictEqual(headers.length, 27, 'CSV sample must possess exactly 27-column layout');
    for (let i = 1; i < csvLines.length; i++) {
      const line = csvLines[i];
      // simplified column count parse
      let columns = 0;
      let inQuotes = false;
      for (const char of line) {
        if (char === '"') inQuotes = !inQuotes;
        if (char === ',' && !inQuotes) columns++;
      }
      assert.strictEqual(columns + 1, 27, `CSV row ${i} must have exactly 27 elements`);
    }
  });
});


