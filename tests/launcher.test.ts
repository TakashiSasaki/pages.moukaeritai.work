import { describe, it } from 'node:test';
import assert from 'assert';
import { extractLauncherSites, applySavedOrder, applyLocalOrderChange, buildLauncherUrl } from '../src/lib/launcherSites.js';
import { RepositoryResult } from '../src/types.js';
import { liveExportSampleRows } from './fixtures/liveExportRows.js';
import { validateFirebaseConfigObject } from '../src/lib/env.js';

describe('Launcher Functions', () => {
  it('excludes repositories with Pages disabled', () => {
    const repos: Partial<RepositoryResult>[] = [
      { id: 1, fullName: 'o/r1', repoName: 'r1', ownerName: 'o', hasPages: false },
      { id: 2, fullName: 'o/r2', repoName: 'r2', ownerName: 'o', hasPages: false },
      { id: 3, fullName: 'o/r3', repoName: 'r3', ownerName: 'o', hasPages: true, pagesHtmlUrl: 'https://o.github.io/r3/' }
    ];
    const sites = extractLauncherSites(repos as RepositoryResult[]);
    assert.strictEqual(sites.length, 1);
    assert.strictEqual(sites[0].id, '3');
  });

  it('prefers pagesHtmlUrl over fallback', () => {
    const repos: Partial<RepositoryResult>[] = [
      { id: 1, fullName: 'o/r', repoName: 'r', ownerName: 'o', hasPages: true, pagesHtmlUrl: 'https://custom.test/' }
    ];
    const sites = extractLauncherSites(repos as RepositoryResult[]);
    assert.strictEqual(sites[0].url, 'https://custom.test/');
  });

  it('uses fallback URL when pagesHtmlUrl is missing', () => {
    const repos: Partial<RepositoryResult>[] = [
      { id: 1, fullName: 'o/r', repoName: 'r', ownerName: 'o', hasPages: true, pagesHtmlUrl: null }
    ];
    const sites = extractLauncherSites(repos as RepositoryResult[]);
    assert.strictEqual(sites[0].url, 'https://o.github.io/r/');
  });

  it('rejects non-HTTP(S) URLs', () => {
    const repos: Partial<RepositoryResult>[] = [
      { id: 1, fullName: 'o/r', repoName: 'r', ownerName: 'o', hasPages: true, pagesHtmlUrl: 'javascript:alert(1)' }
    ];
    const sites = extractLauncherSites(repos as RepositoryResult[]);
    assert.strictEqual(sites.length, 0);
  });

  it('rejects invalid URLs', () => {
    const repos: Partial<RepositoryResult>[] = [
      { id: 1, fullName: 'o/r', repoName: 'r', ownerName: 'o', hasPages: true, pagesHtmlUrl: 'https:// this is not a url' }
    ];
    const sites = extractLauncherSites(repos as RepositoryResult[]);
    assert.strictEqual(sites.length, 0);
  });

  it('prefers GitHub repo ID string, falls back to full_name', () => {
    const repos: Partial<RepositoryResult>[] = [
      { fullName: 'o/r', repoName: 'r', ownerName: 'o', hasPages: true, pagesHtmlUrl: 'https://o.github.io/r/' }
    ];
    const sites = extractLauncherSites(repos as RepositoryResult[]);
    assert.strictEqual(sites[0].id, 'o/r');
  });

  it('applies saved order and prepends remaining', () => {
    const sites: any[] = [
      { id: '1', name: 'one' },
      { id: '2', name: 'two' },
      { id: '3', name: 'three' }
    ];
    const ordered = applySavedOrder(sites, ['3', '1']);
    assert.strictEqual(ordered[0].id, '2');
    assert.strictEqual(ordered[1].id, '3');
    assert.strictEqual(ordered[2].id, '1');
  });

  it('ignores saved IDs missing from current audit', () => {
    const sites: any[] = [
      { id: '1', name: 'one' }
    ];
    const ordered = applySavedOrder(sites, ['3', '1', '4']);
    assert.strictEqual(ordered.length, 1);
    assert.strictEqual(ordered[0].id, '1');
  });

  it('returns original if saved order is empty', () => {
    const sites: any[] = [
      { id: '1', name: 'one' },
      { id: '2', name: 'two' }
    ];
    const ordered = applySavedOrder(sites, []);
    assert.strictEqual(ordered[0].id, '1');
    assert.strictEqual(ordered[1].id, '2');
  });

  it('extracts correctly from live export fixtures', () => {
    const sites = extractLauncherSites(liveExportSampleRows);

    // Check it properly filtered out row ID 101 (pages disabled)
    assert.ok(sites.every(s => s.id !== '101'), 'Should not include pages disabled repos');

    const row102 = sites.find(s => s.id === '102');
    assert.ok(row102, 'Should find 102');
    assert.strictEqual(row102.url, 'https://takashisasaki.github.io/no-custom-domain/');
    assert.strictEqual(row102.hostname, 'takashisasaki.github.io');
    assert.strictEqual(row102.deploymentMethod, 'workflow');

    const row104 = sites.find(s => s.id === '104');
    assert.ok(row104, 'Should find 104');
    assert.strictEqual(row104.url, 'https://enforced.com/');
    assert.strictEqual(row104.hostname, 'enforced.com');
  });

  it('applyLocalOrderChange behaves functionally', () => {
    const currentIds = ['A', 'B', 'C'];

    // moving first left is a no-op
    assert.deepStrictEqual(applyLocalOrderChange(currentIds, 0, -1), currentIds);
    // moving last right is a no-op
    assert.deepStrictEqual(applyLocalOrderChange(currentIds, 2, 1), currentIds);

    // moving middle left
    assert.deepStrictEqual(applyLocalOrderChange(currentIds, 1, -1), ['B', 'A', 'C']);
    // moving middle right
    assert.deepStrictEqual(applyLocalOrderChange(currentIds, 1, 1), ['A', 'C', 'B']);
  });

  describe('Pure URL Construction & Strict Protocol Checks', () => {
    it('returns null if hasPages is false', () => {
      const repo = { hasPages: false, pagesHtmlUrl: 'https://foo.io' } as any;
      assert.strictEqual(buildLauncherUrl(repo), null);
    });

    it('rejects custom ftp, gopher, and mailto schemas', () => {
      const ftpRepo = { hasPages: true, pagesHtmlUrl: 'ftp://ftp.example.com' } as any;
      const mailtoRepo = { hasPages: true, pagesHtmlUrl: 'mailto:webmaster@example.com' } as any;
      const dataRepo = { hasPages: true, pagesHtmlUrl: 'data:text/html,<html></html>' } as any;
      
      assert.strictEqual(buildLauncherUrl(ftpRepo), null);
      assert.strictEqual(buildLauncherUrl(mailtoRepo), null);
      assert.strictEqual(buildLauncherUrl(dataRepo), null);
    });

    it('accepts valid http and https urls', () => {
      const httpRepo = { hasPages: true, pagesHtmlUrl: 'http://my-blog.com/' } as any;
      const httpsRepo = { hasPages: true, pagesHtmlUrl: 'https://secure-blog.com/' } as any;
      
      assert.strictEqual(buildLauncherUrl(httpRepo), 'http://my-blog.com/');
      assert.strictEqual(buildLauncherUrl(httpsRepo), 'https://secure-blog.com/');
    });
  });

  describe('Pure Firebase Config Validation Checks', () => {
    it('rejects null, undefined, or empty configurations list', () => {
      const nullRes = validateFirebaseConfigObject(null);
      const undefRes = validateFirebaseConfigObject(undefined);
      const strRes = validateFirebaseConfigObject("not-an-object");

      assert.strictEqual(nullRes.valid, false);
      assert.strictEqual(undefRes.valid, false);
      assert.strictEqual(strRes.valid, false);
    });

    it('rejects configurations with placeholder variables or unedited templates', () => {
      const placeholderConfig = {
        apiKey: "YOUR-API-KEY-PLACEHOLDER",
        authDomain: "YOUR-PROJECT-ID-PLACEHOLDER.firebaseapp.com",
        projectId: "YOUR-PROJECT-ID-PLACEHOLDER",
        appId: "YOUR-APP-ID-PLACEHOLDER"
      };

      const res = validateFirebaseConfigObject(placeholderConfig);
      assert.strictEqual(res.valid, false);
      // It should specifically identify the invalid placeholder fields as missing
      assert.ok(res.missingFields.includes('apiKey'), 'should detect key is placeholder');
      assert.ok(res.missingFields.includes('authDomain'), 'should detect authDomain is placeholder');
      assert.ok(res.missingFields.includes('projectId'), 'should detect projectId is placeholder');
      assert.ok(res.missingFields.includes('appId'), 'should detect appId is placeholder');
    });

    it('rejects empty configs or configs missing required parameters', () => {
      const incompleteConfig = {
        apiKey: "AIzaSyC-some-real-looking-key",
        authDomain: "my-valid-project.firebaseapp.com",
        // projectId is missing
        appId: "1:1234:web:abcd"
      };

      const res = validateFirebaseConfigObject(incompleteConfig);
      assert.strictEqual(res.valid, false);
      assert.deepStrictEqual(res.missingFields, ['projectId']);
    });

    it('accepts fully completed production-ready configurations without placeholders', () => {
      const validConfig = {
        apiKey: "AIzaSyC_valid_api_key_for_this_project",
        authDomain: "perfectlyvalid-999.firebaseapp.com",
        projectId: "perfectlyvalid-999",
        appId: "1:999999999:web:abcdefgh123456"
      };

      const res = validateFirebaseConfigObject(validConfig);
      assert.strictEqual(res.valid, true);
      assert.strictEqual(res.missingFields.length, 0);
    });
  });
});
