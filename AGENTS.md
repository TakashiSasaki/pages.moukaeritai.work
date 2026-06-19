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
- **Full-Stack Structure:** The core GitHub API proxy runs on the Express server. The browser owns the PAT and temporarily sends it to the server strictly via an `x-temp-pat` header. The server must never return it to the browser.
- **PAT Truth:** The current implementation is the absolute source of truth for PAT behavior. Design documents must follow the implementation, not the other way around.
- **Firestore Schema:** Firestore document types defined in `src/schema/firestoreTypes.ts` reflect the actual currently-stored shapes, not future ideals.

## Non-Negotiable Security Rules
- The backend must never return PAT plaintext to the browser; the browser manages its own copy.
- Never log PAT plaintext.
- Never log GitHub Authorization headers.
- Never log Firebase ID tokens.
- Never implement a generic GitHub API proxy.
- Never call GitHub write APIs in Version 1.
- Never call GitHub Actions workflow APIs in Version 1.
- Use Firebase UID as tenant boundary.
- Do not let users access other users’ data.
- Anonymous data must be temporary if persisted.
- PAT storage records must be strictly isolated using Firebase rules (`request.auth.uid == uid`).
- Escape GitHub-originated text in HTML.
- Escape CSV cells that can trigger spreadsheet formula execution.

## Firebase Authentication Contract
- Providers: Google (persistent), Anonymous (temporary).
- Backend APIs require `Authorization: Bearer <firebase-id-token>`.

## Firestore Persistence Contract
- Firestore used: Yes.
- PATs are securely stored in `githubPagesAuditorV1/{environment}/users/{uid}/githubTokens/default` (for persistent users) and `githubPagesAuditorV1/{environment}/anonymousSessions/{uid}/githubTokens/default` (for anonymous users) via the **Firebase Client SDK directly from the React frontend**.
- Audit caches are similarly stored in `githubPagesAuditorV1/{environment}/users/{uid}/audits/{auditId}` via the Client SDK.
- Security Rules: Client access is tightly secured to `request.auth.uid == uid`. No cross-user access allowed.

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
  - `GET /orgs/{org}/repos` (allowed by specification; currently NOT implemented in Version 1 backend allowlist)
- Forbidden:
  - All write operations (POST, PUT, DELETE, PATCH).
  - Any endpoint not on the allowed list.
  - All GitHub Actions workflow endpoints.
- Rate Limit Handling is fully integrated, evaluating headers (`x-ratelimit-remaining`, `retry-after`) and interrupting loops on `429` / `403`.

## PAT Storage Decision
- The browser owns the PAT copy.
- The React frontend stores PATs in Firestore using Firebase Client SDK.
- The backend receives the PAT temporarily through `x-temp-pat` only for the duration of GitHub API calls.
- The backend must not return PAT plaintext to the browser.
- Firestore Security Rules must isolate PAT records by Firebase UID.
- Anonymous guest mode is not a long-term account model. Anonymous guest data may be session-scoped and may be stored under the anonymous session namespace. Automatic cleanup / expiration enforcement is a known follow-up and not yet complete.

## Documentation Consistency Rules
- Implementation is the source of truth for PAT handling.
- `AGENTS.md` is the operational source of truth for agents.
- `src/schema/exportTypes.ts` is the schema source of truth.
- Generated JSON Schema must not be manually edited.
- Any change to auth, PAT storage, Firestore paths, or GitHub API allowlist must update `AGENTS.md`, README, and relevant docs in the same commit.

## JSON Export Schema Contract
- JSON export schema version: `github-pages-auditor.export.v1`
- Schema lives in `schemas/github-pages-auditor-export-v1.schema.json` (Full schema implemented).
- **TypeScript is the Source of Truth**: The schema types reside in `src/schema/exportTypes.ts`.
- **Generated Artifact**: Schema JSON files are fully generated artifacts. Manual edits to generated schema files are strictly discouraged.
- Any schema-affecting types change must trigger schema regeneration via `npm run schema:generate` and validation check via `npm run schema:check`.

## Directory Structure
- `src/` - React frontend code.
- `server/` - Express backend code.
- `docs/` - Documentation and specs.
- `schemas/` - Export JSON schemas.

## Current Implementation Status
- Pre-Production Validation Baseline. All core backend, shared, export and path modules are hardened and verified via automated test suites.
- Added explicit environment validation modules for frontend (`src/lib/env.ts`) and backend (`server/env.ts`) checking configuration completeness without crashing runtime operations.
- Extracted and formalized firestore paths into a decoupled module `src/lib/firestorePaths.ts`, fully tested in the suite.
- Established a complete, isolated, and secure security ruleset in `firestore.rules` (pointed by `firebase.json`), fully verified using rule simulation tests (`tests/rules.test.ts`).

## Deployment readiness and Rules Contract
- **Existence Audit**:
  - `firebase.json`: Present
  - `.firebaserc`: Absent (must be set individually or explicitly before hosting deployment is triggered)
  - `firestore.rules`: Present
  - `firestore.indexes.json`: Absent (no active complex compound filtering indexes needed for V1 audits list)
  - `.env.example`: Present with structured sectioning
  - `vite.config.ts`: Present
  - `src/lib/firebase.ts`: Present
- **Rules Path Tenanting**:
  - Google authenticated users: `githubPagesAuditorV1/{environment}/users/{uid}/githubTokens/default` and `githubPagesAuditorV1/{environment}/users/{uid}/audits/{auditId}`
  - Anonymous guest users: `githubPagesAuditorV1/{environment}/anonymousSessions/{uid}/githubTokens/default`
  - Restricts access strictly to matching `request.auth.uid == uid` and blocks all other paths, denying generic top-level collections (e.g. `/users`, `/tokens`).
- **Deploy Command**: `firebase deploy --only firestore:rules` after choosing your active Firebase project.
- **Rule Verification**: Done via `npx tsx --test tests/rules.test.ts` (runs pre-compiled simulations matching rules logic under the standard Node unit runner).

## Recommended Deployment Target
- **Primary recommendation**: **Cloud Run (Docker)** or **Firebase App Hosting**.
- **Crucial Warning**: Standard Firebase Hosting alone *cannot* run the Express backend. Firebase Hosting must be paired with Cloud Run via rewrites matching `/api/*` if edge CDN is desired.

## Known Constraints and Open Questions
- Automatic token cleanup for timed-out/expired anonymous sessions is currently not enforced and is recognized as a future serverless/scheduler capability.
- Full browser E2E automated regressions is a future roadmap milestone documented under `docs/ui-regression-plan.md`.

## Change Log for Agents
- Decoupled environment normalization and user path resolution into pure module `src/lib/firestorePaths.ts`.
- Integrated automated rules validation test suite in `tests/rules.test.ts` proving cross-tenant security holds.
- Introduced formal environment validators: `server/env.ts` warns about production configs and `src/lib/env.ts` displays a persistent, non-crashing banner in the UI when Firebase is unprovisioned.
- Added scripts `test:rules` and `test:unit` to `package.json` while maintaining a green parent `npm test` script.
- Documented deployment readiness roadmap in `docs/deployment-readiness.md` and UI testing roadmap in `docs/ui-regression-plan.md`.
- Consolidated overall setup and configurations into `README.md`.

