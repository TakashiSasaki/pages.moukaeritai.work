# GitHub Pages Auditor - Deferred Work, Future Roadmap, and Non-Goals
Version: `1.6.17` (Maintenance Documentation & Launcher Regression Closure)

This document maps out completed items, deferred future work planned for later strides, and permanent architectural non-goals of the GitHub Pages Auditor.

**Maintenance Mode Declaration**: The project is now in a development-complete maintenance state. Broad feature development has ceased. The items outlined in section 2 below represent potential operational infrastructure follow-ups that could be undertaken by an operator standalone, but active feature strides are no longer pursued.

---

## 1. Recent Accomplishments

### Implemented in Milestone 1.6.17 & Prior
- **Launcher Regression Stabilized**: Resolved LauncherGrid render stacking bugs by aligning base Index zIndex layers in 1.6.17.
- **Unified Organization Scan Mode**: The `GET /orgs/{org}/repos` endpoint has been finalized and validated via a centralized validation helper.
- **V1 Erasure**: All obsolete predecessor references and schemas have been removed from the operational baseline.
- **Development-Complete Baseline**: This milestone establishes the final feature-complete state before transitioning to maintenance mode.
- **Anonymous Session TTL-Ready Lifecycle Foundation**: Implemented a pure, robust lifecycle utility `src/lib/anonymousSessionLifecycle.ts` with complete unit testing. Extended the Firestore `GitHubTokenDocument` and `AnonymousSessionDocument` data models to record `createdAt`, `expiresAt` (default 7-day TTL), and `lastSeenAt`. Integrated active injections during guest token saves.
- **Lightweight Operational Public Smoke Verification**: Shipped a lightweight public smoke checker (`scripts/publicSmokeCheck.js` and `npm run smoke:public`) to quickly assert the liveness of canonical vs fallback endpoint routes without requiring credentials.

## 2. Deferred Future Work (Post-1.6.17 Scope)

The following items are deferred from the current milestone and are planned for future baseline iterations:

### A. Automatic Firestore TTL Policy or Scheduled Cleanup Deployment
- **Goal**: Automatically clean up aged guest records under `githubPagesAuditorV2/{environment}/anonymousSessions/{uid}` on a database level.
- **Current Status**: Data models and client-side lifecycle calculations are fully implemented and verified in 1.6.17 (with complete unit testing).
- **Maintenance Decision**: Active implementation of automatic cleanup is **deferred indefinitely**. The application is currently used by a limited group of stakeholders, making the storage overhead of expired guest sessions negligible. Manual purges can be performed if necessary.
- **Future Re-evaluation**: TTL field policies or serverless cleanup functions may be reintroduced if usage patterns expand significantly beyond the current scope.

### B. Full Browser E2E Automation Regression Suite
- **Goal**: Establish automated visual and behavior regression testing under authentic browser contexts.
- **Maintenance Decision**: Full authenticated browser E2E (Playwright/Cypress) is **deselected** from the current maintenance roadmap. The current lightweight public smoke checker (`npm run smoke:public`) provides sufficient coverage for production liveness and route availability for the baseline.
- **Testing Strategy**: All complex user-authenticated behaviors are verified through the manual smoke test templates in `docs/manual-smoke-results-template.md` before major baseline revisions.

---

## 3. Explicit Non-Goals (Out of Scope Permanent Constraints)

The following integrations and architectures are **explicitly out of scope** now and in future versions. They must NOT be planned, documented as future work, or implemented:

- **Exclusion of GitHub OAuth**: We will remain strictly PAT-only (Personal Access Tokens). No GitHub OAuth authorization loops or client-side callback integrations are planned.
- **Exclusion of GitHub App Authentication**: Authentication is structured exclusively around user-supplied Personal Access Tokens.
- **Exclusion of Gemini / Generative AI / LLM Integration**: The Auditor is built strictly as client and backend procedural classification logic. No generative AI features or LLM-based summary engines will be added.
- **No GitHub Write Operations**: The execution scope is strictly read-only on Pages-specific configs. Writing or mutating repository settings (via `POST`, `PUT`, `DELETE` APIs) is strictly forbidden.
- **No GitHub Actions Workflow APIs**: Re-triggering actions, managing workflow YAML files, or querying GitHub Actions run telemetry is not supported.
- **No Generic GitHub API Proxying**: The backend implements a restricted allowlist proxy. Serving generic or arbitrary GitHub API proxy routes is prohibited to prevent token abuse.
