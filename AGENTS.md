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
- Firestore used: Not used (Current MVP uses strictly in-memory storage).
- Rationale: We are in the MVP phase building a safe foundation. Cloud Firestore will be introduced when persistent user audit history is required.
- Firebase project id: Pending configuration.
- Enabled Firebase Auth providers: Google provider, Anonymous provider.
- Firestore namespace root: `githubPagesAuditorV1` (when implemented).
- Environment document name: `dev` / `staging` / `prod`.
- Persistent user path: `githubPagesAuditorV1/{environment}/users/{uid}`
- Anonymous temporary path: `githubPagesAuditorV1/{environment}/anonymousSessions/{anonymousUid}`
- PAT storage path: `githubPagesAuditorV1/{environment}/users/{uid}/githubTokens/{tokenId}` (Stored securely, no plaintext)
- Anonymous cleanup strategy: Delete temporary session and token data upon audit completion or via scheduled cleanup using `expiresAt`.

## Cloud Functions Deployment Contract
- Cloud Functions used: Not used.
- No Firebase Functions deployment is required.
- Do not run bare `firebase deploy --only functions` for this app.
- Cloud Functions prefix (if used later): `gpaV1`
- Cloud Functions deploy command (if used later): `firebase deploy --only functions:gpaV1Api`

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
- For Version 1, PAT storage can be strictly in-memory or securely encrypted if persisted to Firestore. (Currently in-memory for MVP).

## JSON Export Schema Contract
- JSON export schema version: `github-pages-auditor.export.v1`
- Schema lives in `schemas/github-pages-auditor-export-v1.schema.json` (Full schema implemented).

## Directory Structure
- `src/` - React frontend code.
- `server/` - Express backend code.
- `docs/` - Documentation and specs.
- `schemas/` - Export JSON schemas.

## Current Implementation Status
- Initializing the safe project foundation according to "Initial Implementation Task" phase.

## Known Constraints and Open Questions
- PAT encryption strategy for persistent storage logic in Firestore needs to be defined if we switch to persisted PATs.

## Change Log for Agents
- Initialized `AGENTS.md` to track project architecture and constraints.
- Processed `docs/spec-appendix-github-api.md`. Used explicit Endpoint allowlist string checks.
- Implemented pagination parsing on `/user/repos`.
- Implemented `x-ratelimit-remaining` and error classification.
- Fixed `publishSourceSummary` inside `types.ts` and `server.ts`.
- Processed `docs/spec-appendix-firebase.md` and updated Firestore / Cloud Functions contracts.
- Processed JSON Export Schema and created complete `schemas/github-pages-auditor-export-v1.schema.json`.
