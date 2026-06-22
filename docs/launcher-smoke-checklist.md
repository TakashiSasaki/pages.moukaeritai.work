# Launcher Manual Smoke Verification Checklist (v1.7.24)

This helper document guides repository operators and QA engineers through manual visual validation steps for the **v1.7.24: Launcher Icon Cache** system on active staging/dev environments.

---

## 1. Authentication Paths

Verify core tenancy setups and data capture before entering Launcher preview interfaces:

### [A] Persistent Google Sign-in Path (Primary Verification)

1.  [ ] Launch the application and click **Sign in with Google**.
2.  [ ] Enter workspace credentials and confirm successful authentication state in the upper-right corner.
3.  [ ] Provide a valid temporary GitHub PAT and run a full pages audit.
4.  [ ] Confirm that at least one repository matches a published GitHub Pages site.
5.  [ ] **Goal**: This path validates full Firestore cache persistent (write and subsequent read).

### [B] Anonymous Guest Sign-in Path (Graceful Behavior)

1.  [ ] Sign out of the Google session.
2.  [ ] Select **Continue as Guest (In-Memory)** in the sign-in modal.
3.  [ ] Execute a fresh pages audit successfully using a temporary PAT.
4.  [ ] **Observation**: Verify that the launcher renders fallbacks or direct icons correctly.
5.  [ ] **Limitation Check**: Confirm that in-memory guest mode does not crash or raise errors if Firestore cache writes are restricted or scoped to ephemeral sessions. Permanent Firestore artifact retention is not required for this path.

---

## 2. Visual State & Fallback Contract

Detailed visual contract for launcher icons:

- [ ] **Cached Icon (Persistent User)**: Subtle soft indigo/blue circular treatment (`border-2 border-indigo-500/30 bg-indigo-50/40 dark:border-indigo-500/20 dark:bg-indigo-950/30 p-1`).
- [ ] **Direct PWA Icon**: Subtle emerald outline/background (`border-2 border-emerald-500/30 bg-emerald-50/45 dark:border-emerald-500/20 dark:bg-emerald-950/25 p-1`).
- [ ] **Direct Favicon**: Neutral slate/white outline (`border border-slate-300 bg-slate-50/50 dark:border-slate-700 dark:bg-slate-900/50 p-1`).
- [ ] **Generated Initial**: Warm amber typography treatment (`bg-amber-500/10 dark:bg-amber-500/5 text-amber-700 dark:text-amber-400 border border-amber-500/20 dark:border-amber-500/10 p-1`).
- [ ] **Cleanliness**: ZERO tiny text badges (no "CACHED", "PWA", "RESOLVED" labels).

---

## 3. Asynchronous Resolution & Persistence

Verify the background resolution and client-led caching:

1.  [ ] **Monitor Resolution**: With DevTools open, verify that `POST /api/icon/resolve` returns successfully for valid sites.
2.  [ ] **Client-Side Cache Write**: Confirm the frontend receives raw base64 data and attempts to write to the Firestore document: `githubPagesAuditorV2/{environment}/users/{uid}/launcherIconCache/{cacheId}`.
3.  [ ] **Silent Decay**: If resolution fails (404, oversized raster, or unsupported SVG), confirm the tile silently remains on a fallback (Favicon/Initial) without error popups.
4.  [ ] **Performance**: Refresh the page (for a Google persistent user) and observe instant painting of the cached icon halo without network round-trips to the resolver.

---

## 4. Firestore Tenant Isolation (Manual Inspection)

This section requires access to the Firebase Console or an administrative session to verify security boundaries:

1.  [ ] **Cross-User Leak Check**: Verify that `User A` cannot view `User B`'s cached icons.
2.  [ ] **Anonymous Isolation**: Verify that anonymous session cache documents (if persisted) are stored under the `anonymousSessions/{uid}` namespace, isolated from Google-authenticated users.
3.  [ ] **Rule Enforcement**: Assert that any attempt to query the top-level collection or another user's sub-collection results in a Firestore `Permission Denied` error.

---

## 5. Visual Regression & UI Affordance

1.  [ ] **Icon Clarity**: Ensure icons are centered and padded correctly within the circular frame.
2.  [ ] **Responsive Grid**: Resize the window and confirm tiles reflow and maintain consistent vertical/horizontal rhythm.
3.  [ ] **Link Safety**: Clicking an icon opens the target URL in a new tab with `noopener noreferrer` headers.
4.  [ ] **Physics Cleanup**: If drag-and-drop or reordering is active, verify that long-press states are cleaned up correctly on pointer release.
