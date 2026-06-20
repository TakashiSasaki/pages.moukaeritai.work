# GitHub Pages Auditor - Deferred Work, Future Roadmap, and Non-Goals
Version: `1.4.0` (Completed & Active)

This document maps out completed items in Milestone 1.4.0, deferred future work planned for later strides, and permanent architectural non-goals of the GitHub Pages Auditor.

---

## 1. Implemented in Milestone 1.4.0 (Recent Additions)

The following capabilities have been fully implemented, integrated, and verified:
- **Active Custom Domain Mapping**: Mapped `https://pages.moukaeritai.work` as the primary canonical production URL, keeping the original Cloud Run container address as a fallback endpoint.
- **Tenant Isolation**: Cleanly transitioned to and hardened the `githubPagesAuditorV2` Firestore namespace to isolate user settings, layout metadata, and audit records.
- **Site Metadata & Icon Scraper**: Added a bounded, timeout-guarded site parser to collect `faviconUrl`, `manifestUrl`, `isPwa`, `pwaIconUrl`, `pwaName`, and `pwaDisplayMode`.
- **Release Readiness Auditing**: Built a strict, non-networked script `releaseReadinessCheck.js` to ensure zero drift of versions, configurations, and paths.

---

## 2. Deferred Future Work (Post-1.4.0 Scope)

The following items are deferred from the current milestone and are planned for future baseline iterations:

### A. Automatic Anonymous Session Document Expiration & Cleanup
- **Goal**: Automatically clean up aged guest records under `githubPagesAuditorV2/{environment}/anonymousSessions/{uid}`.
- **Planned Implementation**: Utilize a scheduled Firebase Cloud Function (e.g. daily cron) or Firestore Time-to-Live (TTL) policies targeting an `expiresAt` timestamp field.

### B. Full Browser E2E Automation Regression Suite
- **Goal**: Establish automated visual and behavior regression testing under authentic browser contexts.
- **Planned Implementation**: Integrate a Playwright or Cypress framework workflow targeting `https://pages.moukaeritai.work` within a headless CI environment, following the templates in `docs/ui-regression-plan.md`.

### C. Optional Organization-Specific Repository Scan Mode
- **Goal**: Support auditing all repositories within an organization where the Personal Access Token is authorized.
- **Planned Implementation**: Implement the `GET /orgs/{org}/repos` endpoint inside our backend token-validation proxy flow, enabling organization audit scopes only when users explicitly toggle 'Scan Organization' in the workspace.

---

## 3. Explicit Non-Goals (Out of Scope Permanent Constraints)

The following integrations and architectures are **explicitly out of scope** now and in future versions. They must NOT be planned, documented as future work, or implemented:

- **Exclusion of GitHub OAuth**: We will remain strictly PAT-only (Personal Access Tokens). No GitHub OAuth authorization loops or client-side callback integrations are planned.
- **Exclusion of GitHub App Authentication**: Authentication is structured exclusively around user-supplied Personal Access Tokens.
- **Exclusion of Gemini / Generative AI / LLM Integration**: The Auditor is built strictly as client and backend procedural classification logic. No generative AI features or LLM-based summary engines will be added.
- **No GitHub Write Operations**: The execution scope is strictly read-only on Pages-specific configs. Writing or mutating repository settings (via `POST`, `PUT`, `DELETE` APIs) is strictly forbidden.
- **No GitHub Actions Workflow APIs**: Re-triggering actions, managing workflow YAML files, or querying GitHub Actions run telemetry is not supported.
- **No Generic GitHub API Proxying**: The backend implements a restricted allowlist proxy. Serving generic or arbitrary GitHub API proxy routes is prohibited to prevent token abuse.
