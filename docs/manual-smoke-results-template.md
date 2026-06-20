# Manual Smoke Testing Results Template (Milestone 1.5.2)

Use this document to log manual smoke testing results prior to marking a production candidate ready for the **https://pages.moukaeritai.work** environment.

- **Target Public URL**: `https://pages.moukaeritai.work`
- **Fallback Infrastructure URL**: `https://github-pages-auditor-1042140630327.asia-east1.run.app`
- **App Version**: `1.5.2`

---

## Smoke Test Session Log

- **Tester**: [Name / Operator]
- **Date / Time Tested**: [YYYY-MM-DD HH:MM UTC]
- **Test Environment**: Chrome / Firefox / Safari (circle applicable)
- **Firebase Project ID Connected**: [e.g. gpa-v2-production]

---

## Verification Checklist

### 1. Host Health and Liveness
- [ ] **Homepage Load:** Navigate directly to `https://pages.moukaeritai.work`. Verify the landing page loads successfully, displaying appropriate styling, typography, and version badge reading `1.5.2`.
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

### 5. Persistent Launcher Layouts
- [ ] **Standalone Page Load:** Direct browser navigation to `https://pages.moukaeritai.work/launcher`. Confirm Pages-enabled sites load from the latest saved audit.
- [ ] **Custom Ordering:** Drag and reposition launcher grid tiles.
- [ ] **Session Persistence:** Refresh the launcher page. Verify that tile orders remain persisted within Firestore (`settings/launcherLayout` document).
- [ ] **Dashboard Result Preview:** Navigate to a specific audit result `/results/:auditId/launcher`. Ensure the correct audit is safely loaded from `data.results` and tiles can be viewed in order.

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
