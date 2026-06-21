# GitHub Pages Auditor - Custom Domain Assignment Runbook Summary (pages.moukaeritai.work)
Version: `1.6.21` (Organization Scan Contract & Baseline Hardening)

This runbook outlines the operational steps that have been successfully executed to assign the production custom domain `pages.moukaeritai.work` to the existing Cloud Run service.

---

## 1. Current State (Active & Canonical)
*   Custom domain (`pages.moukaeritai.work`) is fully active and serves as the primary canonical URL.
*   Cloud Run URL (`https://github-pages-auditor-1042140630327.asia-east1.run.app`) remains active and serves as a reliable fallback.
*   The system has achieved Milestone 1.6.21.

## 2. Target State achieved
*   `https://pages.moukaeritai.work` successfully serves the React SPA and Express API.
*   Firebase Auth fully allowlists and authorizes `pages.moukaeritai.work`.
*   API routes work from the custom domain.
*   CSV and JSON exports work.
*   Default Cloud Run URL remains available as fallback unless explicitly disabled later.

## 3. Prerequisites
*   Access to the Google Cloud Console for the project.
*   Access to the domain registrar/DNS provider for `moukaeritai.work`.
*   Access to the Firebase Console for the project.
*   All required code and documentation updates for the active custom domain mapping for pages.moukaeritai.work are merged into the main branch.

## 4. Pre-assignment checks
Run the following checks locally or via CI to ensure the application is healthy before mapping the domain:
*   [ ] `npm run lint`
*   [ ] `npm test`
*   [ ] `npm run test:unit`
*   [ ] `npm run test:rules`
*   [ ] `npm run test:examples`
*   [ ] `npm run schema:check`
*   [ ] `npm run build`
*   [ ] Verify `/healthz` on current Cloud Run URL (`https://github-pages-auditor-1042140630327.asia-east1.run.app/healthz`).
*   [ ] Verify current sign-in flow on default Cloud Run URL.
*   [ ] Verify PAT validation and audit run on default Cloud Run URL.
*   [ ] Verify CSV export.
*   [ ] Verify JSON V2 export.

## 5. Cloud Run domain mapping checklist
*   [ ] Navigate to the Google Cloud Console -> Cloud Run.
*   [ ] Select the `github-pages-auditor` service.
*   [ ] Go to "Manage Custom Domains" -> "Add Mapping".
*   [ ] Bind `pages.moukaeritai.work` directly to the live service in `asia-east1`.
*   [ ] Copy the required DNS records provided by the Cloud Run setup wizard.

## 6. DNS checklist
*   State that exact DNS record values should be taken from the Cloud Run domain mapping UI / command output at assignment time.
*   Do not hardcode unverifiable DNS target assumptions as mandatory truth unless confirmed by Cloud Run.
*   Provide placeholder-free examples for `pages.moukaeritai.work`, but mark exact DNS values as operator-confirmed.

**Example DNS Record Setup** (Must be confirmed via Cloud Run):
*   **NAME:** `pages`
*   **TYPE:** `CNAME`
*   **VALUE:** `ghs.googlehosted.com.` (or the value provided by Cloud Run)
*   **TTL:** `3600` (or default)

## 7. Firebase Auth authorized domain checklist
*   [ ] Add `pages.moukaeritai.work` to Firebase Auth authorized domains (Authentication -> Settings -> Authorized Domains).
*   [ ] Do not add GitHub OAuth provider.
*   [ ] Do not add GitHub App auth.
*   [ ] Firebase Auth remains application identity only.

## 8. APP_URL update checklist
*   [ ] Before assignment, current `APP_URL` may remain the default Cloud Run URL.
*   [ ] After domain is confirmed active, update Cloud Run environment variable:
    `APP_URL=https://pages.moukaeritai.work`
*   [ ] Redeploy or roll a new Cloud Run revision according to the existing deployment process.
*   [ ] Do not store secrets in `APP_URL`.

## 9. Post-assignment smoke test
*   [ ] Open `https://pages.moukaeritai.work`
*   [ ] Open `https://pages.moukaeritai.work/healthz`
*   [ ] Confirm static UI loads.
*   [ ] Confirm Google sign-in works.
*   [ ] Confirm anonymous sign-in works.
*   [ ] Confirm PAT save / validation works.
*   [ ] Confirm audit run works.
*   [ ] Confirm cached audit view works for Google user.
*   [ ] Confirm CSV export downloads.
*   [ ] Confirm JSON tab schema validation export downloads.
*   [ ] Confirm schema tab / JSON preview works if present.
*   [ ] Confirm no GitHub OAuth / GitHub App login appears.
*   [ ] Confirm browser console has no Firebase unauthorized-domain error.
*   [ ] Confirm server logs do not contain PATs, GitHub Authorization headers, Firebase ID tokens, or raw credential-bearing headers.

## 10. Rollback plan
*   [ ] Use the default Cloud Run URL as fallback.
*   [ ] Revert `APP_URL` to the default Cloud Run URL if needed.
*   [ ] Remove or ignore the custom domain mapping if DNS/auth issues persist.
*   [ ] Keep Firestore data intact.
*   [ ] Do not alter PAT storage or Firestore paths during rollback.

## 11. Documentation updates after activation
Once the domain `pages.moukaeritai.work` is active, verified, and stable:
*   Update `README.md` to indicate the domain is actively serving.
*   Update `docs/custom-domain-readiness.md` to reflect active status.
*   Update `docs/deployment-readiness.md` to mark the milestone complete.

## 12. Known non-goals
*   Implementing GitHub OAuth or GitHub App authentication (permanently out of scope).
*   Adding AI/Gemini dependencies.
*   Modifying PAT storage strategies or Firestore isolation layers.
*   Creating a schema registry or remote schema lookup endpoint.
