# Launcher Icon Cache Guide (v1.7.32)

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
We resolve site custom icons server-side using our secure **Express Icon Resolver** (`server/iconResolver.ts`) via the `POST /api/icon/resolve` endpoint. This proxy fetches icon bytes, validates them against rigorous security constraints, and encodes them into Raw Base64 payloads. The frontend client then converts these raw Base64 payload blocks into standard `data:` URLs using the `toIconDataUrl` utility. These are then cached in **Firestore** using the user's authentic secure namespace, enabling instant, local-speed visual rendering next time.

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
- **Silent Failures**: Any error reading the Firestore cache document or contacting the resolver endpoint is logged silently context-wise. No modal alerts or error screens are displayed.
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
// Google Authenticated Users
match /githubPagesAuditorV2/{environment}/users/{uid}/launcherIconCache/{cacheId} {
  allow read, write: if request.auth != null && request.auth.uid == uid;
}

// Anonymous Session Guests
match /githubPagesAuditorV2/{environment}/anonymousSessions/{uid}/launcherIconCache/{cacheId} {
  allow read, write: if request.auth != null && request.auth.uid == uid;
}
```
These rules guarantee that User A cannot read or write User B's cache keys, establishing strict tenant-level isolation. Unauthenticated access is completely rejected.

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
   - Supports typical raster payloads (`image/png`, `image/jpeg`, `image/jpg`, `image/webp`, `image/x-icon`, `image/vnd.microsoft.icon`).
   - Rejects `text/html` and unsupported formats like `image/gif`.
   - Rejects `image/svg+xml`. **SVG body caching is intentionally excluded** from v1.7.x because SVG payload strings can run embedded JavaScript, posing a cross-site scripting (XSS) risk when loaded locally.
4. **Capacity Controls**: Content size is limited to **512 KB** via `Content-Length` header check and final read array buffer byte length validation.
5. **No Secret Forwarding**: Resolver queries are completely decoupled from credentials. No Personal Access Tokens (PATs), cookies, or Authorization headers are ever forwarded to target icon hosts.

---

## 6. Minimalist Visual Affordance Policy

In line with our clean, professional styling standards:
- **No Text Badges**: Production builds are completely free of tiny text tags (including `"CACHED"` and `"PWA"` labels overlaying launcher tiles).
- **Subtle Circular Border/Background Cue**:
  - **Cached Icon**: Rendered in a sleek circular outline with a subtle, soft indigo/blue-tinted circular background and border treatment (`border-2 border-indigo-500/30 bg-indigo-50/40 dark:border-indigo-500/20 dark:bg-indigo-950/30 p-1`). Represents "served from secure Firestore cache / data URL".
  - **Direct PWA Icon**: Rendered in a sleek circular outline with a subtle emerald-tinted circular background and border treatment (`border-2 border-emerald-500/30 bg-emerald-50/45 dark:border-emerald-500/20 dark:bg-emerald-950/25 p-1`). Represents "direct PWA icon fallback".
  - **Direct Favicon Icon**: Rendered in a sleek circular outline with a neutral slate circular background and border treatment (`border border-slate-300 bg-slate-50/50 dark:border-slate-700 dark:bg-slate-900/50 p-1`). Represents "direct favicon fallback".
  - **Generated Fallback**: Renders with warm amber backdrop initials (`bg-amber-500/10 dark:bg-amber-500/5 text-amber-700 dark:text-amber-400 border border-amber-500/20 dark:border-amber-500/10`), completely distinguishing fallback letters from cache or PWA statuses and keeping icon grids clean and legible.

This circular visual state contract ensures full consistency in both normal grid display and large detail views.

---

## 7. Release-Candidate Readiness Notes

As of the **v1.7.32** milestone, the server-side icon resolver and Firestore icon caching systems are fully finalized, tested, and ready for release-candidate production gates.

### What is Operational and Validated
- **Automated Rules Simulation**: Multi-tenant database security boundaries are verified via offline unit simulation routines. Unauthenticated or foreign tenant requests are fully blocked.
- **Secure Resolver Logic**: Content type limits, length restrictions, SSRF blocking (localhost, private network ranges, loopbacks), and exact raw Base64 streaming are fully operational.
- **Circular Visual Affordance Contract**: Standard grid surfaces and detailed card interfaces render with subtle, stylized halos according to status. No debug label stickers or persistent textual visual noise is exported.
- **Fallback Hierarchy Robustness**: Any resolve failure has zero user-facing friction. Launcher tiles silently default to immediate favicon, direct PWA paths, or custom warm initials in real-time.

### What Remains Manual or Operator-Controlled
- **Production Hosting Deployment**: Manual continuous integration setup or hosting target trigger commands are handled by the repository operators.
- **Launcher Manual Smoke Audits**: Inter-viewport order persistence, Drag-and-Drop visual verification, and initial profile caches must be verified periodically on live deployments using `/docs/launcher-smoke-checklist.md`.

### Intentionally Out of Scope
- **Real Authenticated Browser E2E**: Comprehensive browser automation tests (Selenium, Playwright) on authenticated accounts are deselected from development pipelines. Native Unit smoke assertions verify the static presentation templates instead.
- **SVG Body/Markup Caching**: SVG vector deserialization or script body caching is permanently out of scope because of client/server XSS vulnerabilities.
- **Socket-Level/DNS-Layer SSRF Resolution**: DNS-level resolve hijacking mitigation (re-resolving names inside client handshakes to prevent Time-of-Check to Time-of-Use DNS rebinding) is out of scope. Address evaluation and text-based parsing of IP ranges remain our robust boundaries.
- **Automatic Stale Anonymous Document Erasure**: Real-time Firestore deletion cron processes for expired anonymous guest sessions are deferred indefinitely until future operator audit expansions.

