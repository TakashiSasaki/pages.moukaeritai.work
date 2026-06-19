import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { describe, it } from 'node:test';

describe('Documentation Consistency Diagnostics', () => {
  it('README.md should contain the planned custom domain', () => {
    const content = fs.readFileSync(path.join(process.cwd(), 'README.md'), 'utf-8');
    assert.ok(content.includes('pages.moukaeritai.work'), 'README.md does not contain pages.moukaeritai.work');
  });

  it('AGENTS.md should contain the planned custom domain', () => {
    const content = fs.readFileSync(path.join(process.cwd(), 'AGENTS.md'), 'utf-8');
    assert.ok(content.includes('pages.moukaeritai.work'), 'AGENTS.md does not contain pages.moukaeritai.work');
  });

  it('docs/custom-domain-readiness.md should contain the planned custom domain', () => {
    const content = fs.readFileSync(path.join(process.cwd(), 'docs', 'custom-domain-readiness.md'), 'utf-8');
    assert.ok(content.includes('pages.moukaeritai.work'), 'docs/custom-domain-readiness.md does not contain pages.moukaeritai.work');
  });

  it('docs/cloud-run-operations.md should contain the planned custom domain', () => {
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
});
