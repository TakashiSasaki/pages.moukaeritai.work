# Release-Candidate Readiness Checklist (v1.7.5)

This document establishes the verification procedures, manual auditing boundaries, and non-negotiable architectural boundaries for **v1.7.5: Release Candidate Smoke & Manual Verification**.

---

## 1. Automated Verification Commands

Before declaring readiness, the local verification suite must be fully executed and verified green:

```bash
# 1. Validation for TypeScript compilation and ESLint syntax compliance
npm run lint

# 2. Complete backend, unit, and static frontend pattern assertions
npm test

# 3. Firestore Rules Simulation Diagnostics ensuring cross-tenant boundaries
npm run test:rules

# 4. Strict security, namespace, and document version verification
npm run release:check
```

---

## 2. Manual Launcher Icon Cache Smoke Steps

Detailed, visual step-by-step auditing instructions are maintained in `/docs/launcher-smoke-checklist.md`. The core operations verify:

- **Sign-in Flow Access**: Complete authentication through a Google account or as an Anonymous Session guest.
- **Audit Implementation**: Run a read-only audit using a valid temporary GitHub PAT.
- **Immediate Fallback Render**: Confirm first-load rendering matches appropriate fallback outlines (Favicon, PWA direct URL, or warm amber typography initials) instantly before cache-writing completes.
- **Background Resolution**: Verify that the backend `/api/icon/resolve` endpoint fetches, validates, and stores raw base64 fragments without blocking UI rendering.
- **Instant Local Load**: Assert subsequent displays immediately paint circular, indigo-tinted, cached data URL halos safely avoiding network latency or client-side layout shifts.

---

## 3. Public No-Auth Smoke Verification

Operators can evaluate active container deployments without authenticating or providing credentials:

- **Backend Liveness Probe**: Fetch GET `/healthz` from the primary address to confirm Express-side readiness. Returns `{"ok":true}` securely without disclosing variables.
- **Static Ingress Router**: Visit the base route `/` in a standard browser container to assert that initial React HTML templates load safely with dynamic compilation mappings operational.

---

## 4. Operational Boundaries & Rules of Engagement

The following guidelines specify the exact distribution of responsibilities between automated systems and operator actions:

- **Production Hosting Deployments**: Retained strictly as manual operator-controlled events. Automated pipelines never auto-deploy code or trigger Cloud Run updates.
- **Firebase Security Rules Updates**: Database permissions are updated manually using `firebase deploy --only firestore:rules` by designated project maintainers.
- **Authenticated Browser E2E Tests**: Frameworks such as Playwright, Puppeteer or Selenium are explicitly **out of scope** for this repository. Visual regression coverage is managed through localized static template analysis.
- **Real PAT-Based Audits**: Scanning live repositories requires actual temporary tokens, which must be executed manually by human operators. Automated suites utilize mocked loopbacks strictly.
- **SVG Body/Markup Caching Exclusions**: SVG vector caching is permanently **out of scope** to exclude client injection vulnerabilities.
- **DNS-Resolution-Level SSRF Protections**: Advanced DNS hijacking controls are **out of scope**. Secure routing relies robustly on IP range text evaluations.
- **Non-Blocking Best-Effort Failures**: Icon resolvers operate as a safe, best-effort convenience layer. Any network, caching, or payload parse issue must decay silently, rendering direct fallbacks immediately without blocking page loads or modal alerts.
