import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { describe, it } from 'node:test';

describe('Documentation Consistency Diagnostics', () => {
  it('README.md should contain the active custom domain', () => {
    const content = fs.readFileSync(path.join(process.cwd(), 'README.md'), 'utf-8');
    assert.ok(content.includes('pages.moukaeritai.work'), 'README.md does not contain pages.moukaeritai.work');
  });

  it('AGENTS.md should contain the active custom domain', () => {
    const content = fs.readFileSync(path.join(process.cwd(), 'AGENTS.md'), 'utf-8');
    assert.ok(content.includes('pages.moukaeritai.work'), 'AGENTS.md does not contain pages.moukaeritai.work');
  });

  it('docs/custom-domain-readiness.md should contain the active custom domain', () => {
    const content = fs.readFileSync(path.join(process.cwd(), 'docs', 'custom-domain-readiness.md'), 'utf-8');
    assert.ok(content.includes('pages.moukaeritai.work'), 'docs/custom-domain-readiness.md does not contain pages.moukaeritai.work');
  });

  it('docs/cloud-run-operations.md should contain the active custom domain', () => {
    const content = fs.readFileSync(path.join(process.cwd(), 'docs', 'cloud-run-operations.md'), 'utf-8');
    assert.ok(content.includes('pages.moukaeritai.work'), 'docs/cloud-run-operations.md does not contain pages.moukaeritai.work');
  });

  it('No generic placeholders like <target-domain-placeholder> remain in docs/', () => {
    const docsDir = path.join(process.cwd(), 'docs');
    const files = fs.readdirSync(docsDir);

    for (const file of files) {
      if (file.endsWith('.md')) {
        const content = fs.readFileSync(path.join(docsDir, file), 'utf-8');
        assert.ok(!content.includes('<target-domain-placeholder>'), `Placeholder found in ${file}`);
        assert.ok(!content.includes('gpa-auditor.yourdomain.com'), `Placeholder found in ${file}`);
      }
    }
  });

  it('README.md should contain launcher documentation', () => {
    const content = fs.readFileSync(path.join(process.cwd(), 'README.md'), 'utf-8');
    assert.ok(content.includes('/launcher'), 'README.md does not contain /launcher');
    assert.ok(content.includes('/results/:auditId/launcher'), 'README.md does not contain /results/:auditId/launcher');
    assert.ok(content.includes('settings/launcherLayout'), 'README.md does not contain settings/launcherLayout');
    assert.ok(content.includes('external favicon'), 'README.md does not contain external favicon mention');
  });

  it('App routes must contain Launcher routes', () => {
    const content = fs.readFileSync(path.join(process.cwd(), 'src/App.tsx'), 'utf-8');
    assert.ok(content.includes('/launcher'), 'App.tsx does not contain /launcher');
    assert.ok(content.includes('/results/:auditId/launcher'), 'App.tsx does not contain /results/:auditId/launcher');
  });

  it('Dashboard should contain the label Launcher', () => {
    const content = fs.readFileSync(path.join(process.cwd(), 'src/components/Dashboard.tsx'), 'utf-8');
    assert.ok(content.includes('Launcher'), 'Dashboard.tsx does not contain Launcher label');
  });

  it('useLatestAuditResults should be safely loading from data.results', () => {
    const content = fs.readFileSync(path.join(process.cwd(), 'src/hooks/useLatestAuditResults.ts'), 'utf-8');
    assert.ok(!content.includes("getAuditCollectionPath('production'"), 'Must not hardcode production environment');
    assert.ok(!content.includes("data.repositories"), 'Must read from results, not data.repositories');
    assert.ok(content.includes("data.results"), 'Must read from data.results');
  });


  it('LauncherGrid.tsx must contain strict safe external linking attributes and no data fetching', () => {
    const content = fs.readFileSync(path.join(process.cwd(), 'src/components/LauncherGrid.tsx'), 'utf-8');
    assert.ok(content.includes('rel="noopener noreferrer"'), 'LauncherGrid must use rel="noopener noreferrer"');
    assert.ok(content.includes('target="_blank"'), 'LauncherGrid must use target="_blank"');
    assert.ok(!content.includes('firebase/firestore'), 'LauncherGrid must not fetch data from Firestore directly');
  });

  it('No stale V1 or draft V2 wording remains in code, docs, tests, and scripts', () => {
    const checkDir = (dirPath) => {
      const files = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const file of files) {
        if (file.name === 'node_modules' || file.name === '.git' || file.name === 'dist') continue;
        const fullPath = path.join(dirPath, file.name);
        
        if (file.name === 'docs-consistency.test.ts') continue;
        if (file.isDirectory()) {
          checkDir(fullPath);
        } else if (file.name.endsWith('.ts') || file.name.endsWith('.tsx') || file.name.endsWith('.md') || file.name.endsWith('.json') || file.name.endsWith('.js')) {
          const content = fs.readFileSync(fullPath, 'utf-8');
          const isDocs = fullPath.includes('/docs/') || fullPath.includes('/README.md') || fullPath.includes('/AGENTS.md');
          
          assert.ok(!content.includes('github-pages-auditor.export.v1'), `Forbidden identifier github-pages-auditor.export.v1 found in ${fullPath}`);
          assert.ok(!content.includes('github-pages-auditor-export-v1.schema.json'), `Forbidden filename github-pages-auditor-export-v1.schema.json found in ${fullPath}`);
          assert.ok(!content.includes('examples/github-pages-auditor-export-v1.sample.json'), `Forbidden filename examples/github-pages-auditor-export-v1.sample.json found in ${fullPath}`);
          
          if (isDocs) {
            assert.ok(!content.includes('V2 draft'), `Forbidden wording V2 draft found in ${fullPath}`);
            assert.ok(!content.includes('v2 draft'), `Forbidden wording v2 draft found in ${fullPath}`);
            assert.ok(!content.includes('Interchange Draft'), `Forbidden wording Interchange Draft found in ${fullPath}`);
            assert.ok(!content.includes('V1 default'), `Forbidden wording V1 default found in ${fullPath}`);
            assert.ok(!content.includes('v1 JSON export'), `Forbidden wording v1 JSON export found in ${fullPath}`);
            assert.ok(!content.includes('v1 CSV export'), `Forbidden wording v1 CSV export found in ${fullPath}`);
          }
        }
      }
    };
    checkDir(process.cwd());
  });

  it('schemas/schema-identifiers.json has exactly one schema entry and it is V2 current', () => {
    const idPath = path.join(process.cwd(), 'schemas/schema-identifiers.json');
    if (fs.existsSync(idPath)) {
      const identifiers = JSON.parse(fs.readFileSync(idPath, 'utf-8'));
      const schemas = identifiers.schemas;
      assert.strictEqual(schemas.length, 1, 'Should have exactly one schema entry');
      assert.strictEqual(schemas[0].schemaVersion, 'github-pages-auditor.export.v2', 'Should be V2');
      assert.strictEqual(schemas[0].status, 'current', 'Should be current status');
    }
  });

  it('should enforce active custom domain "https://pages.moukaeritai.work" and no stale planned-domain phrases', () => {
    const readme = fs.readFileSync(path.join(process.cwd(), 'README.md'), 'utf-8');
    const agents = fs.readFileSync(path.join(process.cwd(), 'AGENTS.md'), 'utf-8');

    // Assert "https://pages.moukaeritai.work" is active/canonical
    assert.ok(readme.includes('https://pages.moukaeritai.work'), 'README should contain active URL');
    assert.ok(agents.includes('pages.moukaeritai.work'), 'AGENTS should contain active URL');

    // Assert stale planned-domain phrases are absent from crucial docs
    const filesToCheck = ['README.md', 'AGENTS.md', 'docs/deployment-readiness.md', 'docs/custom-domain-readiness.md'];
    for (const f of filesToCheck) {
      const content = fs.readFileSync(path.join(process.cwd(), f), 'utf-8');
      assert.ok(!content.includes('Planned Custom Domain') || f === 'docs/deployment-readiness.md', `Pending custom domain wording "Planned Custom Domain" found in ${f}`);
      assert.ok(!content.includes('planned, not yet assigned'), `Pending custom domain wording "planned, not yet assigned" found in ${f}`);
      assert.ok(!content.includes('Custom Domain Assignment Readiness'), `Pending custom domain wording "Custom Domain Assignment Readiness" found in ${f}`);
    }
  });

  it('should verify document version consistency with 1.5.2', () => {
    const packageJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf-8'));
    assert.strictEqual(packageJson.version, '1.5.2', 'package.json version must be 1.5.2');

    const agents = fs.readFileSync(path.join(process.cwd(), 'AGENTS.md'), 'utf-8');
    assert.ok(agents.includes('1.5.2'), 'AGENTS.md must refer to 1.5.2');

    const deploymentReadiness = fs.readFileSync(path.join(process.cwd(), 'docs/deployment-readiness.md'), 'utf-8');
    assert.ok(deploymentReadiness.includes('1.5.2'), 'deployment-readiness.md must refer to 1.5.2');
  });

  it('should verify icon/site metadata scanning features are documented', () => {
    const specWeb = fs.readFileSync(path.join(process.cwd(), 'docs/spec-appendix-github-api.md'), 'utf-8');
    assert.ok(specWeb.includes('faviconUrl'), 'spec-appendix-github-api.md must mention faviconUrl');
    assert.ok(specWeb.includes('manifestUrl'), 'spec-appendix-github-api.md must mention manifestUrl');
    assert.ok(specWeb.includes('isPwa'), 'spec-appendix-github-api.md must mention isPwa');
    assert.ok(specWeb.includes('pwaIconUrl'), 'spec-appendix-github-api.md must mention pwaIconUrl');
    assert.ok(specWeb.includes('pwaName'), 'spec-appendix-github-api.md must mention pwaName');
    assert.ok(specWeb.includes('pwaDisplayMode'), 'spec-appendix-github-api.md must mention pwaDisplayMode');
    assert.ok(specWeb.includes('best-effort'), 'spec-appendix-github-api.md must detail best-effort nature of site metadata');
    assert.ok(specWeb.includes('No PAT leakage'), 'spec-appendix-github-api.md must document PAT security boundaries');
  });

  it('enforces exclusion flags and out-of-scope constraints', () => {
    const readme = fs.readFileSync(path.join(process.cwd(), 'README.md'), 'utf-8');
    assert.ok(readme.includes('Exclusion of GitHub OAuth'), 'Out-of-scope guidelines must exclude GitHub OAuth');
    assert.ok(readme.includes('Exclusion of GitHub App Authentication'), 'Out-of-scope guidelines must exclude GitHub App authentication');
  });
});