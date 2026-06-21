import { describe, it, before, after } from 'node:test';
import assert from 'assert';
import crypto from 'crypto';
import { resolveExternalIcon, isUrlSafe } from '../server/iconResolver.js';

describe('Server Icon Resolver Hardening Tests', () => {
  let originalFetch: any;

  before(() => {
    originalFetch = global.fetch;
  });

  after(() => {
    global.fetch = originalFetch;
  });

  it('rejects non-http/non-https schemes', async () => {
    const result = await resolveExternalIcon('site1', 'https://page.com', 'ftp://unsafe.com/icon.png', 'pwa_icon');
    assert.strictEqual(result.ok, false);
    assert.ok(result.error?.includes('Disallowed or unsafe URL'));
  });

  it('rejects localhost', async () => {
    const result = await resolveExternalIcon('site1', 'https://page.com', 'http://localhost/icon.png', 'pwa_icon');
    assert.strictEqual(result.ok, false);
    assert.ok(result.error?.includes('Disallowed or unsafe URL'));
  });

  it('rejects metadata.google.internal and metadata', async () => {
    const res1 = await resolveExternalIcon('site1', 'https://page.com', 'http://metadata.google.internal/icon.png', 'pwa_icon');
    const res2 = await resolveExternalIcon('site1', 'https://page.com', 'http://metadata/icon.png', 'pwa_icon');
    assert.strictEqual(res1.ok, false);
    assert.strictEqual(res2.ok, false);
  });

  it('rejects IPv4 loopback/private/link-local/broadcast/unspecified ranges', async () => {
    const ips = [
      '127.0.0.1',
      '10.0.0.1',
      '172.16.5.4',
      '192.168.1.1',
      '169.254.169.254',
      '0.0.0.0',
      '255.255.255.255'
    ];
    for (const ip of ips) {
      const result = await resolveExternalIcon('site1', 'https://page.com', `http://${ip}/icon.png`, 'pwa_icon');
      assert.strictEqual(result.ok, false);
    }
  });

  it('rejects disallowed content types such as text/html and image/svg+xml', async () => {
    global.fetch = async (url: any, init: any) => {
      return {
        ok: true,
        status: 200,
        headers: {
          get: (headerName: string) => {
            if (headerName.toLowerCase() === 'content-type') return 'text/html';
            if (headerName.toLowerCase() === 'content-length') return '100';
            return null;
          }
        },
        arrayBuffer: async () => new ArrayBuffer(100)
      } as any;
    };

    const result = await resolveExternalIcon('site1', 'https://page.com', 'https://safe.com/icon.png', 'pwa_icon');
    assert.strictEqual(result.ok, false);
    assert.ok(result.error?.includes('Disallowed content-type'));
  });

  it('rejects missing Content-Type', async () => {
    global.fetch = async (url: any, init: any) => {
      return {
        ok: true,
        status: 200,
        headers: {
          get: (headerName: string) => {
            if (headerName.toLowerCase() === 'content-length') return '100';
            return null;
          }
        },
        arrayBuffer: async () => new ArrayBuffer(100)
      } as any;
    };

    const result = await resolveExternalIcon('site1', 'https://page.com', 'https://safe.com/icon.png', 'pwa_icon');
    assert.strictEqual(result.ok, false);
    assert.ok(result.error?.includes('missing Content-Type'));
  });

  it('rejects Content-Length larger than the cap', async () => {
    global.fetch = async (url: any, init: any) => {
      return {
        ok: true,
        status: 200,
        headers: {
          get: (headerName: string) => {
            if (headerName.toLowerCase() === 'content-type') return 'image/png';
            if (headerName.toLowerCase() === 'content-length') return '1000000'; // 1MB
            return null;
          }
        },
        arrayBuffer: async () => new ArrayBuffer(100)
      } as any;
    };

    const result = await resolveExternalIcon('site1', 'https://page.com', 'https://safe.com/icon.png', 'pwa_icon');
    assert.strictEqual(result.ok, false);
    assert.ok(result.error?.includes('Content size limit exceeded'));
  });

  it('rejects actual payload larger than the cap even without Content-Length', async () => {
    global.fetch = async (url: any, init: any) => {
      return {
        ok: true,
        status: 200,
        headers: {
          get: (headerName: string) => {
            if (headerName.toLowerCase() === 'content-type') return 'image/png';
            return null; // No Content-Length
          }
        },
        arrayBuffer: async () => new ArrayBuffer(600 * 1024) // 600KB
      } as any;
    };

    const result = await resolveExternalIcon('site1', 'https://page.com', 'https://safe.com/icon.png', 'pwa_icon');
    assert.strictEqual(result.ok, false);
    assert.ok(result.error?.includes('Content size limit exceeded'));
  });

  it('rejects empty payload', async () => {
    global.fetch = async (url: any, init: any) => {
      return {
        ok: true,
        status: 200,
        headers: {
          get: (headerName: string) => {
            if (headerName.toLowerCase() === 'content-type') return 'image/png';
            if (headerName.toLowerCase() === 'content-length') return '0';
            return null;
          }
        },
        arrayBuffer: async () => new ArrayBuffer(0)
      } as any;
    };

    const result = await resolveExternalIcon('site1', 'https://page.com', 'https://safe.com/icon.png', 'pwa_icon');
    assert.strictEqual(result.ok, false);
    assert.ok(result.error?.includes('payload is empty'));
  });

  it('handles safe redirects', async () => {
    let callCount = 0;
    global.fetch = async (url: any, init: any) => {
      callCount++;
      if (callCount === 1) {
        return {
          status: 301,
          headers: {
            get: (headerName: string) => {
              if (headerName.toLowerCase() === 'location') return 'https://safe.com/redirected.png';
              return null;
            }
          }
        } as any;
      }
      return {
        ok: true,
        status: 200,
        headers: {
          get: (headerName: string) => {
            if (headerName.toLowerCase() === 'content-type') return 'image/png';
            if (headerName.toLowerCase() === 'content-length') return '10';
            return null;
          }
        },
        arrayBuffer: async () => new ArrayBuffer(10)
      } as any;
    };

    const result = await resolveExternalIcon('site1', 'https://page.com', 'https://safe.com/icon.png', 'pwa_icon');
    assert.strictEqual(result.ok, true);
    assert.strictEqual(callCount, 2);
    if (result.ok) {
      assert.strictEqual(result.sourceIconUrl, 'https://safe.com/icon.png');
      assert.strictEqual(result.contentType, 'image/png');
    }
  });

  it('rejects unsafe redirect targets', async () => {
    let callCount = 0;
    global.fetch = async (url: any, init: any) => {
      callCount++;
      if (callCount === 1) {
        return {
          status: 302,
          headers: {
            get: (headerName: string) => {
              if (headerName.toLowerCase() === 'location') return 'http://127.0.0.1/unsafe-redirect.png';
              return null;
            }
          }
        } as any;
      }
      return {
        ok: true,
        status: 200,
        headers: {
          get: (headerName: string) => {
            if (headerName.toLowerCase() === 'content-type') return 'image/png';
            if (headerName.toLowerCase() === 'content-length') return '10';
            return null;
          }
        },
        arrayBuffer: async () => new ArrayBuffer(10)
      } as any;
    };

    const result = await resolveExternalIcon('site1', 'https://page.com', 'https://safe.com/icon.png', 'pwa_icon');
    assert.strictEqual(result.ok, false);
    assert.ok(result.error?.includes('Disallowed or unsafe URL'));
  });

  it('rejects excessive redirects', async () => {
    let callCount = 0;
    global.fetch = async (url: any, init: any) => {
      callCount++;
      return {
        status: 302,
        headers: {
          get: (headerName: string) => {
            if (headerName.toLowerCase() === 'location') return `https://safe.com/redirect-${callCount}.png`;
            return null;
          }
        }
      } as any;
    };

    const result = await resolveExternalIcon('site1', 'https://page.com', 'https://safe.com/icon.png', 'pwa_icon');
    assert.strictEqual(result.ok, false);
    assert.ok(result.error?.includes('Exceeded safe maximum redirects'));
  });

  it('returns the expected success shape with base64, byteLength, sha256, contentType, sourceKind, sourceIconUrl, fetchedAt', async () => {
    global.fetch = async (url: any, init: any) => {
      return {
        ok: true,
        status: 200,
        headers: {
          get: (headerName: string) => {
            if (headerName.toLowerCase() === 'content-type') return 'image/webp';
            if (headerName.toLowerCase() === 'content-length') return '4';
            return null;
          }
        },
        arrayBuffer: async () => {
          const buf = new ArrayBuffer(4);
          const view = new Uint8Array(buf);
          view[0] = 116;
          view[1] = 101;
          view[2] = 115;
          view[3] = 116; // "test"
          return buf;
        }
      } as any;
    };

    const result = await resolveExternalIcon('site1', 'https://page.com', 'https://safe.com/icon.webp', 'pwa_icon');
    assert.strictEqual(result.ok, true);
    if (result.ok) {
      assert.strictEqual(result.sourceIconUrl, 'https://safe.com/icon.webp');
      assert.strictEqual(result.sourceKind, 'pwa_icon');
      assert.strictEqual(result.contentType, 'image/webp');
      assert.strictEqual(result.encoding, 'base64');
      assert.strictEqual(result.dataBase64, Buffer.from('test').toString('base64'));
      assert.strictEqual(result.byteLength, 4);
      assert.strictEqual(result.sha256, crypto.createHash('sha256').update(Buffer.from('test')).digest('hex'));
      assert.ok(result.fetchedAt);
    }
  });

  describe('Additional IPv6, redirects, empty validation arguments and SVG rejection coverage', () => {
    it('rejects unsafe IPv6 ranges', () => {
      assert.strictEqual(isUrlSafe('http://[::1]/icon.png'), false);
      assert.strictEqual(isUrlSafe('http://[0:0:0:0:0:0:0:1]/icon.png'), false);
      assert.strictEqual(isUrlSafe('http://[fe80::1]/icon.png'), false);
      assert.strictEqual(isUrlSafe('http://[fd00::100]/icon.png'), false);
      assert.strictEqual(isUrlSafe('http://[fc00::ab]/icon.png'), false);
      assert.strictEqual(isUrlSafe('http://[fec0::3]/icon.png'), false);
      assert.strictEqual(isUrlSafe('https://[2001:db8::1]/icon.png'), true); // global unicast (safe)
    });

    it('rejects image/svg+xml explicitly', async () => {
      global.fetch = async (url: any, init: any) => {
        return {
          ok: true,
          status: 200,
          headers: {
            get: (headerName: string) => {
              if (headerName.toLowerCase() === 'content-type') return 'image/svg+xml';
              if (headerName.toLowerCase() === 'content-length') return '100';
              return null;
            }
          },
          arrayBuffer: async () => new ArrayBuffer(100)
        } as any;
      };
      
      const result = await resolveExternalIcon('site1', 'https://page.com', 'https://safe.com/icon.svg', 'pwa_icon');
      assert.strictEqual(result.ok, false);
      assert.ok(result.error?.includes('Disallowed content-type'));
    });

    it('rejects if required parameters are missing or empty', async () => {
      const res1 = await resolveExternalIcon('', 'https://page.com', 'https://safe.com/icon.png', 'pwa_icon');
      const res2 = await resolveExternalIcon('site1', '', 'https://safe.com/icon.png', 'pwa_icon');
      const res3 = await resolveExternalIcon('site1', 'https://page.com', '', 'pwa_icon');
      const res4 = await resolveExternalIcon('site1', 'https://page.com', 'https://safe.com/icon.png', '');
      assert.strictEqual(res1.ok, false);
      assert.strictEqual(res2.ok, false);
      assert.strictEqual(res3.ok, false);
      assert.strictEqual(res4.ok, false);
      assert.ok(res1.error?.includes('Missing required validation arguments'));
    });

    it('resolves safe relative redirects correctly', async () => {
      let callCount = 0;
      global.fetch = async (url: any, init: any) => {
        callCount++;
        if (callCount === 1) {
          assert.strictEqual(url, 'https://safe.com/icon.png');
          return {
            status: 301,
            headers: {
              get: (headerName: string) => {
                if (headerName.toLowerCase() === 'location') return '/images/sub-icon.png';
                return null;
              }
            }
          } as any;
        }
        assert.strictEqual(url, 'https://safe.com/images/sub-icon.png');
        return {
          ok: true,
          status: 200,
          headers: {
            get: (headerName: string) => {
              if (headerName.toLowerCase() === 'content-type') return 'image/png';
              if (headerName.toLowerCase() === 'content-length') return '15';
              return null;
            }
          },
          arrayBuffer: async () => new ArrayBuffer(15)
        } as any;
      };

      const result = await resolveExternalIcon('site1', 'https://safe.com', 'https://safe.com/icon.png', 'pwa_icon');
      assert.strictEqual(result.ok, true);
      assert.strictEqual(callCount, 2);
    });
  });
});
