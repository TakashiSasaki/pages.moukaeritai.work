export interface SiteMetadata {
  faviconUrl: string | null;
  manifestUrl: string | null;
  isPwa: boolean;
  pwaIconUrl: string | null;
  pwaName: string | null;
  pwaDisplayMode: string | null;
}

/**
 * Parses <link> tags in the HTML body to extract relative/absolute favicons and manifests.
 */
function parseLinkTags(html: string): Array<{ rel: string; href: string }> {
  const links: Array<{ rel: string; href: string }> = [];
  const linkRegExp = /<link\s+([^>]+)>/gi;
  let match;
  while ((match = linkRegExp.exec(html)) !== null) {
    const attrsText = match[1];
    const relMatch = attrsText.match(/rel=(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i);
    const hrefMatch = attrsText.match(/href=(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i);
    
    if (relMatch && hrefMatch) {
      const rel = (relMatch[1] || relMatch[2] || relMatch[3]).toLowerCase();
      const href = hrefMatch[1] || hrefMatch[2] || hrefMatch[3];
      links.push({ rel, href });
    }
  }
  return links;
}

/**
 * Resolves a relative link path against a base URL.
 */
function resolveUrl(base: string, relative: string): string {
  try {
    return new URL(relative, base).href;
  } catch (e) {
    return relative;
  }
}

/**
 * Fetches the site HTML and manifest in a resilient, timeout-guarded manner.
 */
export async function fetchSiteMetadata(pageUrl: string): Promise<SiteMetadata> {
  const result: SiteMetadata = {
    faviconUrl: null,
    manifestUrl: null,
    isPwa: false,
    pwaIconUrl: null,
    pwaName: null,
    pwaDisplayMode: null
  };

  if (!pageUrl) return result;

  try {
    // Stage 1: Fetch HTML
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const response = await fetch(pageUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) GitHubPagesAuditor/1.3.0'
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      // If direct fetch fails (e.g. 404, authorization required on private page, redirect loops), return fallback favicon
      result.faviconUrl = resolveUrl(pageUrl, '/favicon.ico');
      return result;
    }

    const html = await response.text();
    const links = parseLinkTags(html);

    // Extract Favicon
    // Order of preference: 'apple-touch-icon', 'icon', 'shortcut icon'
    const appleTouchIcon = links.find(l => l.rel.includes('apple-touch-icon'));
    const standardIcon = links.find(l => l.rel === 'icon');
    const shortcutIcon = links.find(l => l.rel.includes('shortcut icon') || l.rel === 'shortcut');

    const chosenFavicon = appleTouchIcon || standardIcon || shortcutIcon;
    if (chosenFavicon) {
      result.faviconUrl = resolveUrl(pageUrl, chosenFavicon.href);
    } else {
      result.faviconUrl = resolveUrl(pageUrl, '/favicon.ico');
    }

    // Extract Manifest
    const manifestLink = links.find(l => l.rel === 'manifest');
    if (manifestLink) {
      const absManifestUrl = resolveUrl(pageUrl, manifestLink.href);
      result.manifestUrl = absManifestUrl;

      // Stage 2: Fetch and Parse Manifest
      try {
        const manifestController = new AbortController();
        const manifestTimeoutId = setTimeout(() => manifestController.abort(), 2000);

        const manifestResponse = await fetch(absManifestUrl, {
          signal: manifestController.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) GitHubPagesAuditor/1.3.0'
          }
        });

        clearTimeout(manifestTimeoutId);

        if (manifestResponse.ok) {
          const manifestData = await manifestResponse.json();

          result.pwaName = manifestData.name || manifestData.short_name || null;
          result.pwaDisplayMode = manifestData.display || null;

          const icons = manifestData.icons;
          const displayMode = (manifestData.display || '').toLowerCase();

          // Standard installable check: defines display standalone/fullscreen/minimal-ui and has icons
          const hasIcons = Array.isArray(icons) && icons.length > 0;
          const hasInstallableDisplay = ['standalone', 'fullscreen', 'minimal-ui'].includes(displayMode);

          if (hasIcons && hasInstallableDisplay) {
            result.isPwa = true;
          }

          if (hasIcons) {
            // Find the best icon (prefer 512x512, then 192x192, else first available)
            let chosenIcon = icons.find((i: any) => i.sizes === '512x512');
            if (!chosenIcon) chosenIcon = icons.find((i: any) => i.sizes === '192x192');
            if (!chosenIcon) chosenIcon = icons[0];

            if (chosenIcon && chosenIcon.src) {
              // Path in manifest icons are resolved relative to the manifest file URL
              result.pwaIconUrl = resolveUrl(absManifestUrl, chosenIcon.src);
            }
          }
        }
      } catch (err: any) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.info(`Manifest fetch skipped for ${pageUrl} at ${absManifestUrl} (${errMsg})`);
      }
    }
  } catch (error: any) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.info(`Metadata fetch skipped for ${pageUrl} (${errMsg})`);
    // Graceful fallback to default favicon path
    result.faviconUrl = resolveUrl(pageUrl, '/favicon.ico');
  }

  return result;
}
