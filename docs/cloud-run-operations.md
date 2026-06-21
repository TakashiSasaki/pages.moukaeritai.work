# GitHub Pages Auditor - Cloud Run Operations Manual
Version: `1.6.11` (Organization Scan Contract & Baseline Hardening)

This document outlines standard operating procedures, architectural summaries, and verification guides for the production container runtime deployed on Google Cloud Run.

---

## 1. Environment Details

*   **Platform**: Google Cloud Run (Fully Managed Serverless Container Platform)
*   **Primary Canonical URL**: `https://pages.moukaeritai.work`
*   **Active Fallback Runtime URL**: `https://github-pages-auditor-1042140630327.asia-east1.run.app`
    *   *Note: Both URLs coexist safely, with pages.moukaeritai.work acting as the canonical entry point.*
*   **Primary Region**: `asia-east1`
*   **Runtime Architecture**: Full-stack Node.js Express server acting as both the API server for safe audits proxying and a static server for the compiled React + Vite + Tailwind CSS frontend.
*   **Startup Command**: `node dist/server.cjs`
*   **Dynamic Port Config**: Listens dynamically on the `PORT` environment variable supplied under Cloud Run ingress controls (defaults to `3000`).

---

## 2. Dockerfile Build Pipeline

The application features a compact, secure, and optimized dual-stage Alpine `Dockerfile`:

1.  **Stage 1: Build & compilation**
    *   Base: `node:20-alpine`
    *   Command: Copies absolute files, installs full dependencies (including `devDependencies`), and compiles React assets plus bundles the standalone Express `server.ts` into a CommonJS bundle at `dist/server.cjs` via `esbuild`.
2.  **Stage 2: Production runtime stage**
    *   Base: `node:20-alpine`
    *   Command: Installs strictly production-ready modules via `npm ci --only=production`, exposing container port `3000` for ingestion. This guarantees minimal image attack vectors and faster startup profiles.

---

## 3. Server Health Monitoring (`/healthz`)

The Express container implements an unauthenticated health check endpoint:
*   **Endpoint**: `GET /healthz`
*   **Expected Response**: `{ "ok": true }` with HTTP `200` status.
*   **Rules on Health Logs**: Never includes configuration info, secrets, or internal status tags in this response. It acts as an elite liveness and readiness probe under global Cloud Run container specifications.

---

## 4. Configuration & Environment Variables

### Required Variables
*   **`APP_URL`**: The complete canonical public host URL (e.g., `https://github-pages-auditor-1042140630327.asia-east1.run.app`). Must matches the active frontend address to validate referrers and deep links.
*   **`NODE_ENV`**: Must be set to `"production"`. This forces optimized, quiet builds and enforces correct safety validators.
*   **`PORT`**: Provided automatically by the Cloud Run runtime (typically `8080` internally, mapped to `443` public SSL).

### Optional / Testing Variables
*   **`ALLOW_DUMMY_AUTH`**: Must be set to `"false"`, `""`, or completely omitted in production to guarantee strict cryptographic authentication mapping. Only set to `"true"` in isolated mock integration suites or local test runs.

### Firebase Configuration & Security Rules
*   The application looks for client details in the bundled `firebase-applet-config.json` at root directory.
*   **Firestore Database rules** (`firestore.rules`) must be deployed successfully using the command:
    ```bash
    firebase deploy --only firestore:rules
    ```
    This secures all tenant metrics and PAT caches against cross-user reads/writes.

---

## 5. Security Logging & Protection Contract

To safeguard user credentials and protect administrative tokens, **the server must never log the following values**:
*   GitHub Personal Access Tokens (PATs) in plaintext.
*   GitHub HTTP `Authorization` headers.
*   Firebase Client ID tokens or Firebase refresh tokens.
*   Full client-origin headers or raw payload content containing credentials.

### Post-Custom-Domain Log Inspection Guidance
After domain cutover (`pages.moukaeritai.work`), inspect Cloud Run logs to confirm:
*   No `auth/unauthorized-domain` errors (indicates missing Firebase configuration).
*   No leaked secrets, PATs, GitHub Authorization headers, Firebase ID tokens, or raw credential-bearing headers.
*   The `origin` and `referer` headers appropriately reflect the new custom domain without breaking the proxy validations.

---

## 6. Verification & Rollback Guides

### Manual Smoke-Test Checklist
Execute these manual checks upon any container revision or configuration update:
1.  [ ] **Endpoint Access**: Visit `/healthz` directly in the browser and confirm it returns `{ "ok": true }` with status `200`.
2.  [ ] **Homepage Render**: Load the current Cloud Run URL (`https://github-pages-auditor-1042140630327.asia-east1.run.app`). Verify that the unauthenticated landing card loads, displaying descriptive styling with Inter typography.

3.  [ ] **Authentication Options**: Verify that "Sign in with Google" and fallback "Guest Mode" / "Use Temporary Guest Session" are fully interactable.
4.  [ ] **Sign-In Action**: Sign in as a temporary guest session or via Google.
5.  [ ] **Token Lifecycle**: Save a test GitHub Personal Access Token (PAT). Confirm the app validates it via `/api/pat/validate` and stores it securely in Firestore.
6.  [ ] **Audit Run**: Click "Start Audit Scan". Verify that repositories are loaded and custom domain/HTTPS characteristics are classified.
7.  [ ] **Export Formats**: Click "Export CSV" and "Export JSON". Verify that downloads are served cleanly.
8.  [ ] **Exclusion Check**: Confirm there is absolutely no GitHub OAuth or GitHub App installation button, or references to other unrequested modules.

### Custom-Domain Smoke Test Checklist
Once the custom domain is mapped:
1.  [ ] **Endpoint Access**: Visit `https://pages.moukaeritai.work/healthz` and confirm `{ "ok": true }`.
2.  [ ] **Homepage Render**: Load `https://pages.moukaeritai.work`.
3.  [ ] **Sign-In Options**: Verify Google sign-in and anonymous guest sign-in work without origin errors.
4.  [ ] **Core Auditing Workflow**: Verify PAT validation, audit run, and audit view logic operates correctly.
5.  [ ] **Export Generation**: Confirm all export outputs (CSV, JSON) generate successfully.
6.  [ ] **UI Elements**: Confirm no unauthorized environment banners or unexpected OAuth buttons appear.

### Rollback Strategy
If errors appear in Cloud Run logs or if the manual smoke-test checklist fails:
1.  **Immediate Reversion**: Under Cloud Run dashboard, redeploy the previous known-good revision tags instantly to prevent system outages.
2.  **DNS Fail-safe**: Maintain default Google-provided URLs till dns mappings are fully stabilized.
