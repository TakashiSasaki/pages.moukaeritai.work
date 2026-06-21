# Launcher Manual Smoke Verification Checklist (v1.7.5)

This helper document guides repository operators and QA engineers through manual visual validation steps for the **v1.7.5: Launcher Icon Cache** system on active staging/dev environments.

---

## Part 1: Authentication & Audit Execution

Verify core tenancy setups and data capture before entering Launcher preview interfaces:

### [A] Persistent Google Sign-in Path

1.  [ ] Launch the application and click **Sign in with Google**.
2.  [ ] Enter workspace credentials and confirm successful authentication state in the upper-right corner.
3.  [ ] Enter a valid temporary GitHub Personal Access Token (PAT) into the credentials panel.
4.  [ ] Specify a repository namespace (e.g. your username or organization) and run a full pages audit.
5.  [ ] Confirm that at least one repository matches a published GitHub Pages site.

### [B] Anonymous Guest Sign-in Path

1.  [ ] Sign out of the Google session.
2.  [ ] Select **Continue as Guest (In-Memory)** in the sign-in modal.
3.  [ ] Provide a valid temporary PAT, choose a target organization, and execute a fresh pages audit successfully.
4.  [ ] Confirm session persistence is flagged under the safe guest partition in memory.

---

## Part 2: First-Load Visual Fallbacks & Background Resolution

Analyze the initial rendering state, asynchronous caching process, and silent resolution capabilities:

1.  [ ] Open DevTools and navigate to the **Network** tab (filtered to `api/icon/resolve`).
2.  [ ] Navigate directly to the standalone launcher at `/launcher` or the dashboard launcher preview at `/results/:auditId/launcher`.
3.  [ ] **Observe Immediate Initial Rendering**:
    - Confirm the browser immediately displays the pages tiles without delay.
    - Because the secure Firestore cache does not yet contain custom Base64 icons, the tile should instantly load direct fallbacks inside their sleek circular wraps:
      - **Fallback 1 (PWA Direct Link)**: Subtle emerald outline/background (`border-2 border-emerald-500/30 bg-emerald-50/45 dark:border-emerald-500/20 dark:bg-emerald-950/25 p-1`).
      - **Fallback 2 (Direct Favicon)**: Neutral slate/white outline (`border border-slate-300 bg-slate-50/50 dark:border-slate-700 dark:bg-slate-900/50 p-1`).
      - **Fallback 3 (Generated Initial)**: Distinctive warm amber typography treatment (`bg-amber-500/10 dark:bg-amber-500/5 text-amber-700 dark:text-amber-400 border border-amber-500/20 dark:border-amber-500/10 p-1`), fully isolated from other statuses.
4.  [ ] **Asynchronous Cache Resolution**:
    - Confirm the network monitor registers a `POST /api/icon/resolve` request firing inside non-blocking background routines.
    - On backend resolution, check that the raw, filtered Base64 content is sent securely to the client, which converts it to a standard `data:` URL and writes it directly to the designated tenant partition in Firestore.
5.  [ ] **Resolver Resilience On Failure**:
    - If a target icon is missing, triggers a `404`, or exceeds capacity bounds (e.g., restricted SVG or files >512 KB), assert that the resolver fails gracefully.
    - Confirm that no modal error messages, toast popups, or terminal alarms are raised. The launcher tile must silently remain on its direct favicon/initial fallback.

---

## Part 3: Subsequent Render (Instant Caching Speed)

Verify the speed increase and visual alignment during subsequent page loads:

1.  [ ] With the background write complete, refresh the `/launcher` page completely.
2.  [ ] **Observe Instant Data URL Painting**:
    - Check that the tiles instantly mount using stored Base64 data URLs loaded directly from Firestore.
    - Verify that no flickering, network fetch wait periods, or client-side layout shifts occur.
3.  [ ] **Visual Affordance Contract**:
    - Look closely at matching cached tile icons.
    - Verify they render with a subtle, soft indigo border/backdrop ring (`border-2 border-indigo-500/30 bg-indigo-50/40 dark:border-indigo-500/20 dark:bg-indigo-950/30 p-1`).
4.  [ ] **Production Presentation Cleanliness Check**:
    - Check that no tiny debug badges or text labels (including `"CACHED"`, `"PWA"`, or `"RESOLVED"`) overlay the launcher tile frames.
    - The launcher workspace must remain pristine, communicative, and strictly minimal.

---

## Part 4: Secure Namespace Isolation Validation

Verify Firebase and Firestore multi-tenant security contracts remain robust:

1.  [ ] Log in as **User A (Google Auth)** and look up the generated cache document under:
    `githubPagesAuditorV2/{environment}/users/{uid}/launcherIconCache/{cacheId}`
2.  [ ] Attempt to read/write User A's cache document from a separate **User B (Anonymous Guest)** session.
3.  [ ] Assert that Firestore Security Rules systematically reject the query with a terminal `Missing or insufficient permissions` exception, proving secure tenant scopes are fully enforced.
