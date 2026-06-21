# Launcher Smoke Checklist

Use this developer-facing checklist to manually verify the shared launcher behavior across standalone and dashboard preview surfaces.

## General Flow
- [ ] Sign in with Google.
- [ ] Run audit.
- [ ] Open `/launcher`.
- [ ] Confirm Pages-enabled sites appear.
- [ ] Move a tile.
- [ ] Refresh the page.
- [ ] Confirm persisted order remains.

## Dashboard Preview Flow
- [ ] Open a Dashboard result (e.g. latest audit).
- [ ] Open the "Launcher" tab.
- [ ] Confirm the exact same order from the standalone page appears.
- [ ] Open `/results/:auditId/launcher` directly.
- [ ] Confirm saved audit preview appears.
- [ ] Move a tile in the dashboard preview.
- [ ] Refresh `/launcher`. Confirm order synced.

## Edge Cases
- [ ] Confirm clicking a tile opens in a new tab (`target="_blank"`, `rel="noopener noreferrer"`).
- [ ] Sign out and select "Continue as Guest (In-Memory)".
- [ ] Run an audit as guest.
- [ ] Open the Launcher tab in Dashboard.
- [ ] Confirm the anonymous user sees the expected "Guest launcher is available after a persisted audit..." limitation message.
- [ ] Open Network DevTools and confirm no external favicon service requests are expected (icons should be generated locally).
- [ ] Inspect Firestore `settings/launcherLayout` document and confirm it contains only ordered IDs / metadata, not audit payloads or secrets.

## Launcher Icon Caching & Fallback Visual Affordances
- [ ] **Observe Rendering Priority Sequence**:
  1. High: Instantly loads secure Base64 data URLs from the Firestore `launcherIconCache` collection.
  2. Medium: Falls back to direct `pwaIconUrl` if loaded and cached is empty.
  3. Low: Falls back to direct `faviconUrl` if PWA icon is absent/failing.
  4. Full Fallback: Renders the circular emerald fallback initial badge.
- [ ] **Verify No Tiny Text Labels**: Confirm that no tiny `"CACHED"` text stickers or badges are overlayed on cached launcher tiles.
- [ ] **Subtle Visual Cues**: Inspect elements or visually observe the tile wrappers:
  - **Cached Icons**: Displayed with a subtle indigo/blue-tinted background and border treatment (`border-2 border-indigo-200/50` or similar).
  - **Non-Cached Icons**: Displayed with standard neutral borders and layouts.
  - **Generated Fallback**: Green emerald backdrop initials.

