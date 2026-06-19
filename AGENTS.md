# AGENTS.md

## Project Summary
GitHub Pages Auditor is a multi-user web application that audits GitHub Pages settings across many repositories accessible to a user. It reads GitHub Pages configurations and displays custom domain status, HTTPS status, and Pages deployment method without modifying settings.

## Current Architecture
- Full-stack web application.
- Frontend: React + TypeScript + Vite + Tailwind CSS.
- Backend: Express.js + Node.js (TypeScript).
- Database: Firestore (via `firebase-applet-config.json` when configured via `set_up_firebase`).
- Authentication: Firebase Authentication (Google provider for persistent use, Anonymous for guest mode). Backend verification of Firebase ID tokens.

## Implementation Decisions
- **Firebase Auth Plan:** We are using Firebase Auth (Google + Anonymous) to manage application user identity.
- **Backend GitHub API Client:** We use `fetch` targeting `https://api.github.com` strictly wrapped in helper functions to prevent calling forbidden endpoints.
- **Full-Stack Structure:** The core GitHub API proxy runs on the Express server to keep the GitHub PAT secure.

## Non-Negotiable Security Rules
- Never return PAT plaintext to the browser.
- Never log PAT plaintext.
- Never log GitHub Authorization headers.
- Never log Firebase ID tokens.
- Never implement a generic GitHub API proxy.
- Never call GitHub write APIs in Version 1.
- Never call GitHub Actions workflow APIs in Version 1.
- Use Firebase UID as tenant boundary.
- Do not let users access other users’ data.
- Anonymous data must be temporary if persisted.
- PAT storage records must not be client-readable.
- Escape GitHub-originated text in HTML.
- Escape CSV cells that can trigger spreadsheet formula execution.

## Firebase Authentication Contract
- Providers: Google (persistent), Anonymous (temporary).
- Backend APIs require `Authorization: Bearer <firebase-id-token>`.

## Firestore Persistence Contract
- Firestore used: Yes. (Migrated from in-memory).
- PATs are securely stored in `/githubPagesAuditorV1/{environment}/users/{uid}/githubTokens/default`.
- Security Rules: Client access strictly denied (`allow read, write: if false`). Only accessible via backend Firebase Admin SDK.

## Cloud Functions Deployment Contract
- Cloud Functions used: Not used.
- No Firebase Functions deployment is required.
- Do not run bare `firebase deploy --only functions` for this app.
- Cloud Functions prefix (if used later): `gpaV1`
- Cloud Functions deploy command (if used later): `firebase deploy --only functions:gpaV1Api`

## Version Management
- Versioning is strictly managed via the standard `package.json` `"version"` field.
- The version string (e.g. `1.0.0`) is exported dynamically in the project build pipeline via Vite plugin definitions (`__APP_VERSION__` mapping).
- Before each major baseline or feature completion, the package version should be explicitly bumped.
- UI elements (like headers, footers) read the current version dynamically rather than hardcoding it.

## GitHub API Usage Contract
- Allowed endpoints:
  - `GET /user`
  - `GET /user/repos`
  - `GET /repos/{owner}/{repo}/pages`
  - `GET /rate_limit` (optional)
  - `GET /repos/{owner}/{repo}/pages/health` (optional)
  - `GET /orgs/{org}/repos` (optional)
- Forbidden:
  - All write operations (POST, PUT, DELETE, PATCH).
  - Any endpoint not on the allowed list.
  - All GitHub Actions workflow endpoints.
- Rate Limit Handling is fully integrated, evaluating headers (`x-ratelimit-remaining`, `retry-after`) and interrupting loops on `429` / `403`.

## PAT Storage Decision
- For Version 1, PAT storage originally used in-memory maps, but has now been migrated to Firestore to ensure persistence across server restarts over development iterations. The tokens are securely constrained to backend fetch contexts only, completely denying read-access from the client side using Firestore `rules`.

## JSON Export Schema Contract
- JSON export schema version: `github-pages-auditor.export.v1`
- Schema lives in `schemas/github-pages-auditor-export-v1.schema.json` (Full schema implemented).

## Directory Structure
- `src/` - React frontend code.
- `server/` - Express backend code.
- `docs/` - Documentation and specs.
- `schemas/` - Export JSON schemas.

## Current Implementation Status
- Modular Safe Refactoring and Testing Phase Completed. Secure endpoints separation, pure shared classification models, defensive CSV and fully-compliant JSON exporters are verified under comprehensive automated tests.

## Known Constraints and Open Questions
- Automatic token cleanup for timed-out/expired anonymous sessions will be handled by a scheduled Cloud Function in a future iteration.

## Change Log for Agents
- Updated specifications docs (, , ) to formally codify the in-memory fallback strategy for PATs and the simplification of the UI storage flows due to sandbox limits on Firestore.
- Initialized `AGENTS.md` to track project architecture and constraints.
- Processed `docs/spec-appendix-github-api.md`. Used explicit Endpoint allowlist string checks.
- Implemented pagination parsing on `/user/repos`.
- Implemented `x-ratelimit-remaining` and error classification.
- Fixed `publishSourceSummary` inside `types.ts` and `server.ts`.
- Processed `docs/spec-appendix-firebase.md` and updated Firestore / Cloud Functions contracts.
- Processed JSON Export Schema and created complete `schemas/github-pages-auditor-export-v1.schema.json`.
- Refactored `server.ts` to separate raw endpoint fetches and allowlist matching into `server/githubClient.ts`.
- Subdivided domain, SSL certificate, and deployment methods logic into pure shared classification module `src/audit/classification.ts`.
- Moved JSON/CSV exporters out of components into pure builders under `src/export/exportBuilders.ts`, fully validating schema properties (fixed `'fine_grained'` tokenType enum and filtered out invalid classifications).
- Implemented active double-guard on Express start bindings allowing sync automated tests execution without hangs.
- Auth stub security strengthened behind `ALLOW_DUMMY_AUTH` gating.
- Added systematic test coverage in `tests/comprehensive.test.ts` matching 23 assertions for API subpath restricts, classification engines, schema outputs, and CSV defenses.
- Simplified log-in screen and authenticated layout, completely eliminating redundant headlines (like "Sign in to Auditor" and verbose descriptive subtitles) and permanent dashboards banner elements to prevent UI clutter.
- Introduced a minimalist "What's this app?" help-modal feature on the logged-in dashboard workspace, hosting full application detail and security parameters gracefully on request.

