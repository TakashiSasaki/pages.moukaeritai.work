# GitHub Pages Auditor

GitHub Pages Auditor is a multi-user web application that audits GitHub Pages settings across repositories accessible to fine-grained or classic Personal Access Tokens (PATs). It displays custom domain configuration status, HTTPS certificate state, and Pages deployment methods securely without modifying any settings.

## Core Features & Release Candidate (RC) Status
- **Release Candidate Baseline**: Internal UI types and interchange types (JSON schema) are successfully decoupled. The UI is stabilized.
- **Secure Backend API Auditing**: Directly proxies standard GitHub API endpoints from the Express backend, keeping the PAT invisible to the browser.
- **Classification Engine**: Pure shared classification models mapping Github Pages metadata into standardized custom domain and SSL status models.
- **Defense in Depth**: Escape patterns defend spreadsheet exports from formula injections; strict allowlists protect the proxy layers.
- **Authentication**: Integrates Firebase Authentication (Google persistent sign-in and temporary Anonymous guests), verification happens via ID Token bearer verification.

## Running the Application Locally

### 1. Prerequisites
- Node.js (v18+)
- npm

### 2. Environment Setup
Create a `.env` file at the root level of the project. Declare keys as defined in `.env.example`:

```env
# Required for any Gemini API calls and AI Studio environment configs
GEMINI_API_KEY="your-gemini-key"

# App URL for absolute references and self-routing
APP_URL="http://localhost:3000"

# Optional: Set to 'true' to enable 'dummy-token' for local/integration testing
ALLOW_DUMMY_AUTH="true"
```

### 3. Installation
Install project dependencies:
```bash
npm install
```

### 4. Running the Development Server
To boot the full-stack system in development mode (Express server and Vite frontend pipeline concurrent):
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Running the Automated Tests
Run the comprehensive synchronous test suite:
```bash
npm test
```

### 6. TypeScript-First JSON Schema Pipeline
The data model for JSON exports (interchangeable result assets) is maintained using TypeScript types (`src/schema/exportTypes.ts`) as the absolute Source of Truth. The JSON Schema is a generated artifact.

- **Generate Schema**: Recompile and generate the schemas from TypeScript source types:
  ```bash
  npm run schema:generate
  ```
- **Check Schema Freshness**: Test and verify if compiled JSON schemas have drifted compared to the TypeScript declarations:
  ```bash
  npm run schema:check
  ```

## Non-Negotiable Security Rules & Constraints (RC)
- **PAT-Only Authentication**: The application remains strictly PAT-only. No GitHub OAuth or GitHub Apps are implemented.
- **Read-Only Proxy**: The backend only allowlists exact `GET` endpoints. The system will never support write actions (e.g., POST/PUT/DELETE pages settings or repository metadata).
- **Actions Workflow Shield**: Action dispatching and workflow modification endpoints are strictly blocked under absolute regex boundaries to protect automation setups.
- **Firestore Usage**: PAT storage and audit cache persistence are managed using the Firebase Client SDK to Firestore. Cloud Functions are **not used** in this iteration.
