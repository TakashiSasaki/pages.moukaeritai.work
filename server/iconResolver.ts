import { URL } from 'url';
import crypto from 'crypto';
import { APP_USER_AGENT } from './constants';

/**
 * Checks if a URL is safe from SSRF. Rejects loopbacks, private IPs, link-local, broadcast,
 * and known cloud metadata endpoints.
 */
export function isUrlSafe(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }
    const host = parsed.hostname.toLowerCase();
    
    // 1. Exact unsafe/private host lists or generic blocklist
    const unsafeHosts = [
      'localhost',
      'metadata.google.internal',
      'metadata',
    ];
    if (unsafeHosts.includes(host)) {
      return false;
    }

    // 2. IPv4 format check and block private IP address ranges
    const ipv4Regex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
    if (ipv4Regex.test(host)) {
      const parts = host.split('.').map(p => parseInt(p, 10));
      if (parts.some(isNaN) || parts.some(p => p < 0 || p > 255)) {
        return false;
      }
      
      // Loopback 127.0.0.0/8
      if (parts[0] === 127) return false;
      // Class A private: 10.0.0.0/8
      if (parts[0] === 10) return false;
      // Class B private: 172.16.0.0/12
      if (parts[0] === 172 && (parts[1] >= 16 && parts[1] <= 31)) return false;
      // Class C private: 192.168.0.0/16
      if (parts[0] === 192 && parts[1] === 168) return false;
      // Link-local: 169.254.0.0/16 (includes 169.254.169.254)
      if (parts[0] === 169 && parts[1] === 254) return false;
      // Broadcast/unspecified: 0.0.0.0 or 255.255.255.255
      if (parts[0] === 0 || (parts[0] === 255 && parts[1] === 255 && parts[2] === 255 && parts[3] === 255)) return false;
    }

    // 3. IPv6 format checks for loopback and unique/link-local blocks
    if (host.startsWith('[') && host.endsWith(']')) {
      const ipv6 = host.slice(1, -1).trim().toLowerCase();
      if (ipv6 === '::1' || ipv6 === '0:0:0:0:0:0:0:1') return false;
      if (ipv6.startsWith('fe80:') || ipv6.startsWith('fe80::')) return false;
      if (ipv6.startsWith('fc00:') || ipv6.startsWith('fc00::') || ipv6.startsWith('fd00:') || ipv6.startsWith('fd00::')) return false;
      if (ipv6.startsWith('fec0:') || ipv6.startsWith('fec0::')) return false;
    }

    return true;
  } catch {
    return false;
  }
}

export interface IdealResolveResult {
  ok: true;
  sourceIconUrl: string;
  sourceKind: string;
  contentType: string;
  encoding: 'base64';
  dataBase64: string;
  byteLength: number;
  sha256: string;
  fetchedAt: string;
}

export interface ResolveErrorResult {
  ok: false;
  error: string;
}

/**
 * Resolves an external icon, fetches its bytes, and converts it to Base64 in a secure manner.
 */
export async function resolveExternalIcon(
  siteId: string,
  pageUrl: string,
  iconUrl: string,
  sourceKind: string
): Promise<IdealResolveResult | ResolveErrorResult> {
  let currentUrl = iconUrl;
  let redirectsRemaining = 3;
  const timeoutMs = 4000;
  const contentCapBytes = 512 * 1024; // 512KB maximum icon size

  // Scope 2: Only allow raster images for v1.7.24, reject SVG explicitly.
  const allowedTypes = [
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/webp',
    'image/x-icon',
    'image/vnd.microsoft.icon'
  ];

  if (!siteId || !pageUrl || !iconUrl || !sourceKind) {
    return { ok: false, error: 'Missing required validation arguments (siteId, pageUrl, iconUrl or sourceKind)' };
  }

  while (redirectsRemaining >= 0) {
    if (!isUrlSafe(currentUrl)) {
      return { ok: false, error: `Disallowed or unsafe URL: ${currentUrl}` };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      // Do NOT forward credentials, cookies, tokens or keys. Use anonymous clean fetch.
      const response = await fetch(currentUrl, {
        method: 'GET',
        redirect: 'manual', // Manual handling prevents hidden redirect SSRF loops
        signal: controller.signal,
        headers: {
          'User-Agent': APP_USER_AGENT,
        }
      });

      clearTimeout(timeoutId);

      // Handle custom manually verified redirections safely
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const locationHeader = response.headers.get('Location');
        if (!locationHeader) {
          return { ok: false, error: `Redirect response with empty Location header at ${currentUrl}` };
        }
        
        let nextUrl: string;
        try {
          nextUrl = new URL(locationHeader, currentUrl).href;
        } catch {
          return { ok: false, error: `Could not parse Location redirection header from ${currentUrl}` };
        }

        currentUrl = nextUrl;
        redirectsRemaining--;
        continue;
      }

      if (!response.ok) {
        return { ok: false, error: `Fetch failed with status ${response.status} at ${currentUrl}` };
      }

      // Assert Content-Type matches raster images
      const contentTypeRaw = response.headers.get('Content-Type');
      if (!contentTypeRaw) {
        return { ok: false, error: 'Response headers missing Content-Type declaration' };
      }
      const contentType = contentTypeRaw.split(';')[0].trim().toLowerCase();
      if (!allowedTypes.includes(contentType)) {
        return { ok: false, error: `Disallowed content-type: ${contentType}. Milestones only permit stable raster images, rejecting SVGs or HTML.` };
      }

      // Assert Content-Length limit prior to fully consuming response
      const contentLengthHeader = response.headers.get('Content-Length');
      if (contentLengthHeader) {
        const parsedLength = parseInt(contentLengthHeader, 10);
        if (!isNaN(parsedLength) && parsedLength > contentCapBytes) {
          return { ok: false, error: `Content size limit exceeded. Header indicates ${parsedLength} bytes, threshold is ${contentCapBytes} bytes.` };
        }
      }

      // Read response content
      const buffer = await response.arrayBuffer();
      const byteLength = buffer.byteLength;
      
      if (byteLength > contentCapBytes) {
        return { ok: false, error: `Content size limit exceeded. Retreived ${byteLength} bytes, threshold is ${contentCapBytes} bytes.` };
      }

      if (byteLength === 0) {
        return { ok: false, error: 'Resolved image payload is empty' };
      }

      const nodeBuf = Buffer.from(buffer);
      const dataBase64 = nodeBuf.toString('base64');
      const sha256 = crypto.createHash('sha256').update(nodeBuf).digest('hex');

      return {
        ok: true,
        sourceIconUrl: iconUrl,
        sourceKind,
        contentType,
        encoding: 'base64',
        dataBase64,
        byteLength,
        sha256,
        fetchedAt: new Date().toISOString()
      };

    } catch (err: any) {
      return { ok: false, error: `Socket/IO fetch error resolver: ${err.message || String(err)}` };
    }
  }

  return { ok: false, error: 'Exceeded safe maximum redirects (3) for resolving external icon' };
}
