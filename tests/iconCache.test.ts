import { describe, it } from 'node:test';
import assert from 'assert';
import { isUrlSafe } from '../server/iconResolver.js';
import { getCacheId, isCacheExpired } from '../src/lib/launcherIconCachePure.js';
import { getLauncherIconCacheCollectionPath, getLauncherIconCacheDocPath } from '../src/lib/firestorePaths.js';

describe('Launcher Icon Cache Unit and Path Diagnostics', () => {
  describe('isUrlSafe SSRF Protections', () => {
    it('accepts valid, safe public URLs', () => {
      assert.strictEqual(isUrlSafe('https://takashisasaki.github.io/assets/pwa-icon.png'), true);
      assert.strictEqual(isUrlSafe('http://example.com/favicon.ico'), true);
    });

    it('rejects loopback and localhost interfaces', () => {
      assert.strictEqual(isUrlSafe('http://localhost/icon.png'), false);
      assert.strictEqual(isUrlSafe('http://127.0.0.1/icon.png'), false);
      assert.strictEqual(isUrlSafe('http://127.255.0.1/icon.png'), false);
      assert.strictEqual(isUrlSafe('http://[::1]/icon.png'), false);
    });

    it('rejects known cloud metadata servers', () => {
      assert.strictEqual(isUrlSafe('http://metadata.google.internal/some-secret'), false);
      assert.strictEqual(isUrlSafe('http://169.254.169.254/latest/meta-data'), false);
      assert.strictEqual(isUrlSafe('http://169.254.25.25/meta'), false);
    });

    it('rejects private IPv4 subnets', () => {
      assert.strictEqual(isUrlSafe('http://10.0.1.5/icon.png'), false);
      assert.strictEqual(isUrlSafe('http://172.16.88.2/icon.png'), false);
      assert.strictEqual(isUrlSafe('http://172.31.254.254/icon.png'), false);
      assert.strictEqual(isUrlSafe('http://192.168.1.100/icon.png'), false);
    });

    it('rejects illegal protocols', () => {
      assert.strictEqual(isUrlSafe('ftp://unsafe.com/icon.png'), false);
      assert.strictEqual(isUrlSafe('javascript:alert(1)'), false);
      assert.strictEqual(isUrlSafe('data:image/svg+xml;utf8,<svg></svg>'), false);
    });

    it('rejects malformed hosts and garbage input', () => {
      assert.strictEqual(isUrlSafe('not-a-valid-url'), false);
      assert.strictEqual(isUrlSafe('http://[fe80::1/'), false);
    });
  });

  describe('Deterministic Icon Cache Key Generator', () => {
    it('produces a deterministic string for identical inputs', async () => {
      const key1 = await getCacheId('siteA', 'https://takashisasaki.github.io/icon.png');
      const key2 = await getCacheId('siteA', 'https://takashisasaki.github.io/icon.png');
      assert.strictEqual(typeof key1, 'string');
      assert.ok(key1.length > 5);
      assert.strictEqual(key1, key2);
    });

    it('produces distinct strings for different inputs', async () => {
      const keyA = await getCacheId('siteA', 'https://takashisasaki.github.io/icon.png');
      const keyB = await getCacheId('siteB', 'https://takashisasaki.github.io/icon.png');
      const keyC = await getCacheId('siteA', 'https://takashisasaki.github.io/another.png');
      
      assert.notStrictEqual(keyA, keyB);
      assert.notStrictEqual(keyA, keyC);
    });

    it('behaves case-insensitively and handles whitespace trim', async () => {
      const key1 = await getCacheId('siteA', 'https://TAKASHISASAKI.github.io/icon.png ');
      const key2 = await getCacheId('siteA', 'https://takashisasaki.github.io/icon.png');
      assert.strictEqual(key1, key2);
    });
  });

  describe('Cache Expiration isCacheExpired', () => {
    it('marks future expiration fields as valid (not expired)', () => {
      const docData: any = {
        expiresAt: new Date(Date.now() + 1000 * 60 * 60).toISOString(), // 1 hour in future
      };
      assert.strictEqual(isCacheExpired(docData), false);
    });

    it('marks past expiration fields as expired', () => {
      const docData: any = {
        expiresAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(), // 1 hour in past
      };
      assert.strictEqual(isCacheExpired(docData), true);
    });

    it('gracefully handles missing or malformed ISO dates by returning true (expired)', () => {
      const badDoc: any = { expiresAt: 'garbage-date' };
      assert.strictEqual(isCacheExpired(badDoc), true);
    });
  });

  describe('Firestore Icon Cache Path Generators', () => {
    it('creates matching paths for standard Google signed-in users', () => {
      const colPath = getLauncherIconCacheCollectionPath('production', 'userX', false);
      const docPath = getLauncherIconCacheDocPath('production', 'userX', false, 'cacheKey1');
      assert.strictEqual(colPath, 'githubPagesAuditorV2/production/users/userX/launcherIconCache');
      assert.strictEqual(docPath, 'githubPagesAuditorV2/production/users/userX/launcherIconCache/cacheKey1');
    });

    it('creates matching paths for anonymous guest users', () => {
      const colPath = getLauncherIconCacheCollectionPath('development', 'anonY', true);
      const docPath = getLauncherIconCacheDocPath('development', 'anonY', true, 'cacheKey2');
      assert.strictEqual(colPath, 'githubPagesAuditorV2/development/anonymousSessions/anonY/launcherIconCache');
      assert.strictEqual(docPath, 'githubPagesAuditorV2/development/anonymousSessions/anonY/launcherIconCache/cacheKey2');
    });
  });
});
