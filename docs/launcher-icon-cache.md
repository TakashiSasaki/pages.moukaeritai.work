# Launcher Icon Cache Guide (v1.7.3)

This document details the architecture, design decisions, data lifecycle, and security rules for the Launcher custom icon caching mechanism introduced in the `1.7.x` development run.

---

## 1. Problem Statement & Motivation

The **Launcher** displays interactive tiles representing audited GitHub Pages sites. To provide a highly polished, branded experience, the Launcher attempts to display the site's custom icons (either custom favicons or Progressive Web App (PWA) icons).

### The CORS Problem
When rendering custom icons directly from their native external boundaries, the following problems occur:
1. **CORS Restrictions**: Browser-side Javascript cannot reliably fetch and read third-party cross-origin image bytes because of CORS (Cross-Origin Resource Sharing) or opaque responses.
2. **Slow/Transient Connections**: Directly loading individual external favicons on demand can lead to significant rendering latency, flickers, and multiple outgoing connection footprints.
3. **Tracking & Privacy**: Directly loading images exposes user browser headers to the host site on every launcher display.

### The Solution
We resolve site custom icons server-side using our secure **Express Icon Resolver** (`server/iconResolver.ts`) via the `POST /api/icon/resolve` endpoint. This proxy fetches icon bytes, validates them against rigorous security constraints, and encodes them into standard base64 data URLs. These are then cached in **Firestore** using the user's authentic secure namespace, enabling instant, local-speed visual rendering next time.

---

## 2. Best-Effort Caching & Fallback Chain

Under no circumstances is the icon cache or the `/api/icon/resolve` service a blocking dependency of the core GitHub Pages audit. If the cache is empty, takes too long to load, or encounters server errors, the UI falls back gracefully down the chain without interrupting any visual layouts or logging noisy errors.

```
+----------------------------------------+
| 1. Cached Base64 Data URL (Firestore)  |
+-------------------+--------------------+
                    | (Not cached / stale background check)
                    v
+-------------------+--------------------+
|   2. Direct PWA Icon URL (pwaIconUrl)  |
+-------------------+--------------------+
                    | (Fails or missing)
                    v
+-------------------+--------------------+
|  3. Direct Favicon URL (faviconUrl)    |
+-------------------+--------------------+
                    | (Fails or missing)
                    v
+-------------------+--------------------+
| 4. Generated Fallback Initial Badge     | (Guaranteed local rendering)
+----------------------------------------+
```

### Fallback Robustness
- **Silent Failures**: Any error reading the FireStore cache document or contacting the resolver endpoint is logged silently context-wise. No modal alerts or error screens are displayed.
- **Background Resolution**: If a cache document is stale (older than 30 days), the current stale icon is rendered immediately while a non-blocking background request to the backend updates the cache for future sessions.

---

## 3. Firestore Document Paths & Security Boundaries

The icon cache documents are strictly isolated within matching Firebase Authentication boundaries. Users can *only* write/read cache values under their own authentic User IDs (`uid`).

### Target Storage Namespaces
- **Google Authenticated Users**:
  `githubPagesAuditorV2/{environment}/users/{uid}/launcherIconCache/{cacheId}`
- **Anonymous Guests**:
  `githubPagesAuditorV2/{environment}/anonymousSessions/{uid}/launcherIconCache/{cacheId}`

### Firestore Security Rules (`firestore.rules`)
```javascript
match /launcherIconCache/{cacheId} {
  allow read, write: if request.auth != null && request.auth.uid == uid;
}
```
This rule guarantees that User A cannot read or write User B's cache keys, establishing strict tenant-level isolation. Unauthenticated access is completely rejected.

---

## 4. Cache Document Schema

Documents in the `launcherIconCache` collection adhere strictly to the following TypeScript interface (`src/lib/launcherIconCachePure.ts`):

```typescript
export interface LauncherIconCacheDoc {
  siteId: string;         // Unique reference of the audited site
  sourceIconUrl: string;  // Original fetched external URL
  sourceKind: 'pwa_icon' | 'favicon';
  contentType: string;    // MIME type (e.g., 'image/png', 'image/webp')
  dataBase64: string;     // Base64-encoded binary payload
  byteLength: number;     // Size of the binary payload
  sha256: string;         // SHA-256 integrity hash of the binary payload
  fetchedAt: string;      // ISO 8601 Timestamp of resolution
  expiresAt: string;      // ISO 8601 Timestamp of cache expiration (fetchedAt + 30 days)
}
```

---

## 5. Security & Protection Constraints (SSRF & SVG Exclusions)

To protect the server from Server-Side Request Forgery (SSRF) and malicious script injection, the backend resolver mandates rigorous gate checks:

1. **Protocol Restriction**: Only `http:` and `https:` URL protocols are permitted. Absolute relative schemes or database loopback protocols are rejected.
2. **Localhost & Metadata Block**: Any URLs targeting loopbacks (`localhost`, `127.0.0.1`, `[::1]`), metadata servers (`metadata.google.internal`), or internal IP ranges are explicitly rejected.
3. **MIME-Type Restrictions**: 
   - Supports typical raster payloads (`image/png`, `image/jpeg`, `image/webp`, `image/gif`, `image/x-icon`).
   - Rejects `text/html`.
   - Rejects `image/svg+xml`. **SVG body caching is intentionally excluded** from v1.7.x because SVG payload strings can run embedded JavaScript, posing a cross-site scripting (XSS) risk when loaded locally.
4. **Capacity Controls**: Content size is limited to **512 KB** via `Content-Length` analysis and actual incoming stream byte chunking bounds.
5. **No Secret Forwarding**: Resolver queries are completely decoupled from credentials. No Personal Access Tokens (PATs), cookies, or Authorization headers are ever forwarded to target icon hosts.

---

## 6. Minimalist Visual Affordance Policy

In line with our clean, professional styling standards:
- **No Text Badges**: Production builds are completely free of tiny text tags (e.g., `"CACHED"` labels).
- **Subtle Circular Border/Background Cue**:
  - **Cached Icon Grid View**: Rendered with a subtle, color-neutral wrapper containing a soft indigo/blue-tinted circular border treatment (`border-indigo-200/50` or similar).
  - **Uncached Icon Grid View**: Rendered with a white or simple neutral border context.
  - **Generated Fallback**: Green emerald initials, preserving the original classic baseline look.
