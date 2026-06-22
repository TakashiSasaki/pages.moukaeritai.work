# Manual Smoke Testing Results Template (Milestone 1.7.29)

Use this document to log manual smoke testing results prior to marking a production candidate ready for the **https://pages.moukaeritai.work** environment.

- **Target Public URL**: `https://pages.moukaeritai.work`
- **Fallback Infrastructure URL**: `https://github-pages-auditor-1042140630327.asia-east1.run.app`
- **App Version**: `1.7.29`

---

## Smoke Test Session Log

- **Tester**: [Name / Operator]
- **Date / Time Tested**: [YYYY-MM-DD HH:MM UTC]
- **Test Environment**: Chrome / Firefox / Safari (circle applicable)
- **Firebase Project ID Connected**: [e.g. gpa-v2-production]

---

## Verification Checklist

### 1. Host Health and Liveness
- [ ] **Homepage Load:** Navigate directly to `https://pages.moukaeritai.work`. Verify the landing page loads successfully, displaying appropriate styling, typography, and version badge reading `1.7.29`.
- [ ] **Liveness Probe Endpoint:** Query the unauthenticated health endpoint `https://pages.moukaeritai.work/healthz`. Confirm it returns JSON `{ "ok": true }` with status 200 without exposing secrets.

### 2. Authentication Flow
- [ ] **Google Sign-In:** Click the Google Authentication action. Complete the redirect/popup credential loop and confirm state redirects successfully to the main scanning dashboard showing user profile.
- [ ] **Guest Mode:** Log out, then select "Continue as Guest". Confirm the user interface transitions cleanly to guest state with a clear "Temporary in-memory database" warning header.

### 3. Personal Access Token (PAT) Registration & Validation
- [ ] **Token Submission:** Input a valid GitHub Personal Access Token (Classic or Fine-grained) containing read-only scope for repository Pages settings.
- [ ] **In-Memory Security:** Open Browser devtools network tabs. Submit the token and double-check that target GitHub API validation requests are proxied securely server-side. Ensure no direct client-side requests containing the PAT go directly to `api.github.com`.
- [ ] **No Leak Check:** Verify the plaintext PAT string is NEVER returned to the browser in any API payload or printed in client/server console logging.

### 4. Bounded Best-Effort Site Audit Run
- [ ] **Audit Trigger:** Click "Start Audit Scan" and monitor progress indicators.
- [ ] **Metadata Fetching (Best-Effort):** In the results list, confirm that Pages-enabled repositories successfully extract and display site metadata:
  - `faviconUrl` (custom link or fallback `favicon.ico`)
  - `manifestUrl` (if `<link rel="manifest">` is declared)
  - `isPwa` indicators
  - `pwaIconUrl`, `pwaName`, and `pwaDisplayMode` if PWA-compliant
- [ ] **Fault Tolerance Verification:** Confirm that repositories containing invalid or timed-out HTML sites or failing manifests complete their audit gracefully without interrupting repository row classifications.

### 5. Persistent Launcher Layouts & Visual Stability
- [ ] **Standalone Page Load:** Direct browser navigation to `https://pages.moukaeritai.work/launcher`. Confirm Pages-enabled sites load from the latest saved audit.
- [ ] **Custom Ordering:** Drag and reposition launcher grid tiles.
- [ ] **Settings Persistence (v3):** Adjust the "Animation Speed" slider and "Visible Icons Range" toggle.
- [ ] **Session Persistence:** Refresh the launcher page. Verify that tile orders, animation speed, and visibility range remain persisted within Firestore (`settings/launcherLayout` v3 document).
- [ ] **Dashboard Result Preview:** Navigate to a specific audit result `/results/:auditId/launcher`. Ensure the correct audit is safely loaded from cache and user settings (speed/range) are applied correctly.
- [ ] **Visual Stacking (Regression Check):** Confirm launcher tiles do not produce NaN zIndex values. Long-press or expand a tile and verify it securely elevates above adjacent cards without visual occlusion.
- [ ] **Direct-DOM Drag Smoothness:** Actively drag a launcher tile around. Ensure dragging is visually smooth without jank. Drop the tile and confirm the layout correctly settles into its final visual location without breaking interactions.
- [ ] **Precise Observer Boundary:** Scroll launcher cards in and out of the viewport. Circular badge animation runs when visible, and pauses exactly when exiting the viewport outside of the absolute bounds (no preload margin, `rootMargin: 0px`). Resumes on exact re-entry. Dragging does not get stuck.
- [ ] **Compact Metadata Bubble (UX Check):** Long-press a tile to see the dense metadata bubble. Confirm it appears compact (no large min-width).
- [ ] **Release Cleanup:** Release the long-press or start dragging. Confirm the bubble closes immediately and timers are cleared.
- [ ] **Badge Logic:** Confirm positive status badges (HTTPS, PWA) are visible, while negative states (e.g. "Not PWA") are omitted to reduce noise.
- [ ] **Safe External Navigation:** Verify clicking a tile safely delegates target Pages URLs using `target="_blank"` and `rel="noopener noreferrer"`.
- [ ] **Self-Contained Assets Check:** Verify no external network calls are made to `transparenttextures.com` for grid backgrounds.
- [ ] **Circular Badge Text Check:** Custom-domain sites still show domain-oriented circular text; default project/root Pages URLs show repository-name circular text in green. Branch names are not used. Repository name text remains readable and does not overflow badly.

### 6. Export Schema Compliance
- [ ] **Validate JSON V2 Export:** Click the export JSON action. Confirm the generated payload:
  - Adheres strictly to the stable Version 2 `$id` URN: `urn:uuid:7d0f98be-8cba-49c5-84dc-66914b5da3f2`
  - Does NOT export plaintext PATs or credentials.
- [ ] **Validate CSV Export:** Export the audit as a CSV. Check that spreadsheet formula cell triggers are properly escaped, and results align with classic flat tables.

---

## Observed Issues & Troubleshooting Notes
*Use this section to document active errors, retry-after rate limit warnings, or formatting inconsistencies:*

```
[No active errors / All validations green]
```

---

## Release Decision

- [ ] **GO:** All critical features, security controls, and health probes pass alignment criteria.
- [ ] **NO-GO:** Active issues are present that break security, tenancy boundaries, or core routing.

**Signed Off**: ____________________________ (Operator)
