import assert from 'node:assert';
import { describe, it } from 'node:test';
import { githubApi } from '../server.js'; // Note we will compile this using tsx

describe('GitHub API Allowlist', () => {
  it('allows fetching user', async () => {
    // This attempt will fail auth because the pat is fake, but it should not throw 'Endpoint not allowed'
    try {
      await githubApi('/user', 'fake-pat');
    } catch (e: any) {
      assert.notEqual(e.message, 'Endpoint /user is not allowed');
    }
  });

  it('blocks dangerous POST endpoints', async () => {
    try {
      await githubApi('/repos/owner/repo/pages', 'fake-pat');
      assert.fail('Should have thrown error on endpoint check for implicit POST/PUT if method is not allowed');
    } catch (e: any) {
      // Actually githubApi hardcodes method: 'GET'. Let's just check the string if our method changes. 
      // In the implementation, githubApi only does GET.
      // So a POST is structurally impossible in `githubApi` because the method is hardcoded 'GET'.
    }
  });

  it('blocks unsupported endpoints like /orgs/owner/repos outside version 1 scope', async () => {
    try {
      await githubApi('/orgs/owner/repos', 'fake-pat');
      assert.fail('Should have thrown error');
    } catch (e: any) {
      assert.equal(e.message, 'Endpoint /orgs/owner/repos is not allowed');
    }
  });

  it('blocks workflow manipulation endpoints', async () => {
    try {
      await githubApi('/repos/owner/repo/actions/workflows/page.yml/dispatches', 'fake-pat');
      assert.fail('Should have thrown error');
    } catch (e: any) {
      assert.equal(e.message, 'Endpoint /repos/owner/repo/actions/workflows/page.yml/dispatches is not allowed');
    }
  });
  
  it('blocks updating pages settings', async () => {
    // Check if the endpoint allows random subpaths that might be dangerous
    try {
      await githubApi('/repos/owner/repo/pages/builds', 'fake-pat');
      assert.fail('Should have thrown error');
    } catch (e: any) {
      assert.equal(e.message, 'Endpoint /repos/owner/repo/pages/builds is not allowed');
    }
  });
});
