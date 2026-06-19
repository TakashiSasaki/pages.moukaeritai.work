# GitHub Pages Auditor
Version: `1.2.0` (External Consumer Trial Readiness Baseline)

GitHub Pages Auditor is a multi-user web application that audits GitHub Pages settings across repositories accessible to fine-grained or classic Personal Access Tokens (PATs). It displays custom domain configuration status, HTTPS certificate state, and Pages deployment methods securely without modifying any settings.

---

## Core Features & Milestone Status
- **Release Candidate & Pre-Production Baseline**: All core backend models, shared classification algorithms, and Firestore security layers are fully hardened and integrated under the latest Node.js test runner.
- **Secure Backend API Auditing**: Directly proxies standard GitHub API endpoints from the Express backend via safe GET methods. The browser manages its own copy of the PAT and persists it in Firestore under authenticated user isolation using the Firebase Client SDK. The backend only ever holds the PAT temporarily inside the `x-temp-pat` header for the lifetime of the request.
- **Classification Engine**: Pure shared classification models mapping GitHub Pages metadata into standardized custom domain and SSL status models.
- **Defense in Depth**: Escape patterns defend spreadsheet exports from formula injections; strict regex allowlists protect the proxy layers.
- **Authentication**: Integrates Firebase Authentication (Google persistent sign-in and temporary Anonymous guests); backend verification happens via ID Token bearer verification.

---

## Running the Application Locally

### 1. Prerequisites
- Node.js (v18+)
- npm

### 2. Environment Setup
Create a `.env` file at the root level of the project. Declare keys as defined in `.env.example`:

```env
# Optional: Set to 'true' to enable 'dummy-token' for local/integration testing
ALLOW_DUMMY_AUTH="true"

# App URL for absolute references and self-routing
APP_URL="http://localhost:3000"
```

### 3. Firebase Configuration & Startup Check
This application uses Firestore for PAT and audit cache storage. 
*   **Firebase Configuration file**: Client details are fetched dynamically from `firebase-applet-config.json` in the root (automatically created when provisioning via `set_up_firebase`).
*   **Graceful Degrade**: If Firebase is not provisioned or `firebase-applet-config.json` is missing, the frontend displays a red setup warning banner. The application does not crash, maintaining readability and guest mode for local development.

### 4. Installation
Install project dependencies:
```bash
npm install
```

### 5. Running the Development Server
To boot the full-stack system in development mode (Express server and Vite frontend pipeline concurrently):
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 6. Testing & Build Commands

Maintain absolute coverage using these verification commands:

| Command | Target | Action |
| :--- | :--- | :--- |
| `npm run lint` | Code Quality | Compiles TypeScript without emitting to check for syntax and type errors. |
| `npm test` | Complete Suite | Runs all automated test suites, including unit metrics and Firestore rules. |
| `npm run test:unit` | Classification & API Proxy | Runs core unit validation, JSON schemas, CSV defense, and mock client proxy limits. |
| `npm run test:rules` | Firestore Rules | Runs independent local simulation test cases verifying `firestore.rules` paths (does not require full Firebase Local Emulator). |
| `npm run schema:generate` | Schema Sync | Compiles TypeScript interface `src/schema/exportTypes.ts` (and V2 draft `src/schema/exportTypesV2.ts`) to output standard Export JSON Schema. |
| `npm run schema:check` | Schema Drift | Guarantees that built JSON schema matches types exactly. |
| `npm run build` | Production Compilation | Bundles Vite static assets and compiles the ES Express backend into self-contained `dist/server.cjs` via esbuild. |

For detailed metadata, properties, classification mappings, and future nested schema developments, consult:
* **docs/export-schema-vocabulary.md** — Property-by-property dictionary comparing V1 names to raw GitHub API counterparts.
* **docs/export-schema-v2-draft.md** — Conceptual design and draft structures for next-generation nested data schema records.

---

## Firestore Security Rules Specification

Security rules are codified in `firestore.rules` of the root folder:

1.  **Google user tokens**: Isolated to `githubPagesAuditorV1/{environment}/users/{uid}/githubTokens/default` via `request.auth.uid == uid`.
2.  **Google user audits**: Isolated to `githubPagesAuditorV1/{environment}/users/{uid}/audits/{auditId}` via `request.auth.uid == uid`.
3.  **Anonymous user tokens**: Isolated to `githubPagesAuditorV1/{environment}/anonymousSessions/{uid}/githubTokens/default` via `request.auth.uid == uid`.
4.  **Catch-all block**: All other top-level collection reads/writes (e.g. general `/users`, `/tokens`, `/audits`) are denied.

### Deployment of Rules
To push these rules live, make sure your Firebase project is configured, then run:
```bash
firebase use <your-firebase-project-id>
firebase deploy --only firestore:rules
```

---

## Production & Infrastructure Status

*   **Active Live Production URL**: [https://github-pages-auditor-1042140630327.asia-east1.run.app](https://github-pages-auditor-1042140630327.asia-east1.run.app)
*   **Active Production Region**: `asia-east1`
*   **Deployment Status**: Google Cloud Run is our active, live runtime.
*   **Custom Domain Status**: Planned but pending assignment (Current operational milestone is custom domain readiness).

---

## Production Deployment & Operational Controls
*   **Dockerization**: Includes a highly optimized, dual-stage production `Dockerfile` and custom `.dockerignore` for compact, secure, and fast deployment runs.
*   **Dynamic Ports**: Supports dynamic port injection via standard `PORT` environment variables (defaults to 3000), allowing seamless container ingress and routing under Cloud Run.
*   **Health Check Endpoint**: Exposes a secure, unauthenticated `/healthz` checkpoint returning `{ "ok": true }` with status `200` to support uptime probes without revealing system config or secrets.
*   **Firebase Hosting Restriction**: Deploying to static Firebase Hosting alone is **insufficient** as the application requires the Express API service to proxy PAT requests safely. Firebase Hosting alone cannot run the Express backend. It must be paired with Cloud Run via proxy rewrites matching `/api/*`.

---

## Non-Negotiable Rules & Exclusions
1.  **Exclusion of GitHub OAuth**: GitHub OAuth is not planned for this project. It is permanently out of scope.
2.  **Exclusion of GitHub App Authentication**: GitHub App authentication is not planned for this project. It is permanently out of scope.
3.  **Strictly PAT-Only**: GitHub API access is strictly PAT-only (Personal Access Tokens - classic or fine-grained).
4.  **Firebase Auth Purpose**: Firebase Auth is strictly for application user identity, never for GitHub workspace privileges or OAuth authorization.
5.  **No GitHub Write APIs**: Restricts all proxy calls to GET operations. No settings, repos, or workflows are ever modified.
6.  **No Workflow/Actions APIs**: Workflows and Actions routes are absolutely forbidden to safeguard repository CI/CD configurations.
7.  **No Cloud Functions**: Audit caches and transient records are read/written directly via the Firebase Client SDK.
8.  **No Gemini/AI Integration**: Google Gemini, `@google/genai` libraries, or any artificial intelligence models/SDKs are strictly out of scope. The application does not use artificial intelligence, LLM generation, or cognitive agents for auditing, authentication, persistence, deployment, or export. It is strictly client-and-backend procedural code.
