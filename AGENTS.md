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
- **Firebase Auth Plan:** We are using Firebase Auth (Google + Anonymous) to manage application user identity. Firebase Auth is strictly for application user identity, never for GitHub workspace access.
- **Backend GitHub API Client:** We use `fetch` targeting `https://api.github.com` strictly wrapped in helper functions to prevent calling forbidden endpoints.
- **Full-Stack Structure:** The core GitHub API proxy runs on the Express server. The browser owns the PAT and temporarily sends it to the server strictly via an `x-temp-pat` header. The server must never return it to the browser.
- **PAT Truth:** The current implementation is the absolute source of truth for PAT behavior. Design documents must follow the implementation, not the other way around.
- **Critical Configuration Protection**: `firebase-applet-config.json` is a critical platform-managed file. Agents MUST NOT delete, move, or rename this file. If authentication errors occur, agents should prioritize re-provisioning via the appropriate tool rather than manual file manipulation.
- **Port and Health Configuration:** The backend binds dynamically using `process.env.PORT ? parseInt(process.env.PORT, 10) : 3000` to support container runtimes. It implements an unauthenticated GET `/healthz` endpoint returning `{ ok: true }` without revealing secrets or credentials.
- **Firestore Schema:** Firestore document types defined in `src/schema/firestoreTypes.ts` reflect the actual currently-stored shapes, not future ideals.

## Non-Negotiable Security Rules
- GitHub OAuth is not planned for this project.
- GitHub App authentication is not planned for this project.
- GitHub API access is PAT-only.
- Firebase Auth is strictly for application user identity.
- No Gemini/AI Integration: The application does not use Gemini, Google GenAI SDK, or any LLM-based services for auditing, authentication, persistence, deployment, or export. It is strictly client-and-backend procedural code without any AI dependencies.
- There are no callback routes, installation hooks, or token-handling structures for OAuth or App integrations.
- Do not describe GitHub OAuth or GitHub App as "future work", "not used in obsolete predecessor", or "could be added later".
- The backend must never return PAT plaintext to the browser; the browser manages its own copy.
- Never log PAT plaintext.
- Never log GitHub Authorization headers.
- Never log Firebase ID tokens.
- Never implement a generic GitHub API proxy.
- Never call GitHub write APIs.
- Never call GitHub Actions workflow APIs.
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
- PATs are securely stored in `githubPagesAuditorV2/{environment}/users/{uid}/githubTokens/default` (for persistent users) and `githubPagesAuditorV2/{environment}/anonymousSessions/{uid}/githubTokens/default` (for anonymous users) via the **Firebase Client SDK directly from the React frontend**.
- Audit caches are stored in `githubPagesAuditorV2/{environment}/users/{uid}/audits/{auditId}` via the Client SDK.
- Last visited paths and user preferences are stored in `githubPagesAuditorV2/{environment}/users/{uid}/settings/{settingId}` and `githubPagesAuditorV2/{environment}/anonymousSessions/{uid}/settings/{settingId}` under the `navigation` setting ID.
- Security Rules: Client access is tightly secured to `request.auth.uid == uid`. No cross-user access allowed.

## Cloud Functions Deployment Contract
- Cloud Functions used: Not used.
- No Firebase Functions deployment is required.
- Do not run bare `firebase deploy --only functions` for this app.
- Cloud Functions prefix (if used later): `gpaV2`
- Cloud Functions deploy command (if used later): `firebase deploy --only functions:gpaV2Api`

## Version Management
- Versioning is strictly managed via the standard `package.json` `"version"` field, which acts as the absolute source of truth.
- Every file-changing coding-agent task MUST bump the patch version.
- **Documentation Consistency Requirement**: When bumping the version in `package.json`, the agent MUST also perform a global search-and-replace for the old version string across the following files to ensure release gate compliance:
  - `README.md`
  - `AGENTS.md`
  - `docs/*.md` (all documentation files)
  - `scripts/releaseReadinessCheck.js` (EXPECTED_VERSION constant)
- The coding agent must output an English commit message at the end of any file-changing task.
- Generated schema files must not be edited manually.
- The release gate (`npm run release:check`) must remain no-network and deterministic.
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
  - `GET /orgs/{org}/repos`
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
- `src/schema/exportTypesV2.ts` is the schema source of truth.
- Generated JSON Schema must not be manually edited.
- Any change to auth, PAT storage, Firestore paths, or GitHub API allowlist must update `AGENTS.md`, README, and relevant docs in the same commit.

## JSON Export Schema Contract
- JSON export schema version: `github-pages-auditor.export.v2`
- Schema lives in `schemas/github-pages-auditor-export-v2.schema.json`.
- **TypeScript is the Source of Truth**: The schema types reside in `src/schema/exportTypesV2.ts`.
- **Generated Artifact**: Schema JSON files are fully generated artifacts. Manual edits to generated schema files are strictly discouraged.
- Any schema-affecting types change must trigger schema regeneration via `npm run schema:generate` and validation check via `npm run schema:check`.
- **Vocabulary & Specs**: Full property lists, categories, and raw vs normalized mappings are documented in `docs/export-schema-vocabulary.md`. The nested layout lives in `docs/export-schema-v2.md`.
- **Stable Schema Identity Policy**:
  - Every schema has a permanent, static `$id` mapped as a standard URN UUID (`urn:uuid:<uuid-v4>`).
  - **Version 2** ID: `urn:uuid:7d0f98be-8cba-49c5-84dc-66914b5da3f2` (required in exported payload, defined in JSON Schema).
  - Identifiers must **never** be generated or altered dynamically during build, export, test, or run actions.
  - Resolver implementations, registry databases, and remote hosting lookup logic are **explicitly out of scope** in this stack; external clients must treat the URN as a stable opaque identifier.

## Directory Structure
- `src/` - React frontend code.
- `server/` - Express backend code.
- `docs/` - Documentation and specs.
- `docs/implicit-design-decisions.md` - Explicit compilation of unspoken design rules (e.g. UX patterns, layouts, and volatile statuses).
- `schemas/` - Export JSON schemas.

## Current Implementation Status
- Milestone 1.6.20 (Maintenance Documentation & Launcher Regression Closure) is fully completed. All core backend, shared, export, anonymous lifecycles, and path modules are hardened and verified via automated test suites.
- Added explicit environment validation modules for frontend (`src/lib/env.ts`) and backend (`server/env.ts`) checking configuration completeness without crashing runtime operations.
- Extracted and formalized firestore paths into a decoupled module `src/lib/firestorePaths.ts`, fully tested in the suite.
- Established a complete, isolated, and secure security ruleset in `firestore.rules` (pointed by `firebase.json`), fully verified using rule simulation tests (`tests/rules.test.ts`).
- Centralized organization name validation into `src/lib/validation.ts`.
- Removed all obsolete legacy references and schemas.
- **Maintenance Policy**: 1.6.20 acts as the fixed development-complete baseline; the project is in maintenance mode. Coding agents must not initiate broad new feature work unless the user explicitly opens a new milestone. File-changing tasks still require a patch version bump and English commit message output.

## Deployment readiness and Rules Contract
- **Existence Audit**:
  - `firebase.json`: Present
  - `.firebaserc`: Absent (must be set individually or explicitly before hosting deployment is triggered)
  - `firestore.rules`: Present
  - `firestore.indexes.json`: Absent (no active complex compound filtering indexes needed for V2 audits list)
  - `.env.example`: Present with structured sectioning
  - `vite.config.ts`: Present
  - `src/lib/firebase.ts`: Present
- **Rules Path Tenanting**:
  - Google authenticated users: `githubPagesAuditorV2/{environment}/users/{uid}/githubTokens/default`, `githubPagesAuditorV2/{environment}/users/{uid}/audits/{auditId}`, and `githubPagesAuditorV2/{environment}/users/{uid}/settings/{settingId}`
  - Anonymous guest users: `githubPagesAuditorV2/{environment}/anonymousSessions/{uid}/githubTokens/default` and `githubPagesAuditorV2/{environment}/anonymousSessions/{uid}/settings/{settingId}`
  - Restricts access strictly to matching `request.auth.uid == uid` and blocks all other paths, denying generic top-level collections (e.g. `/users`, `/tokens`).
- **Deploy Command**: `firebase deploy --only firestore:rules` after choosing your active Firebase project.
- **Rule Verification**: Done via `npx tsx --test tests/rules.test.ts` (runs pre-compiled local sandbox simulations matching rules logic under the standard Node unit runner; does not use or require a full Firebase Local Emulator integration).

## Recommended Deployment Target
- **Primary deployment target**: **Cloud Run** (Active, Live).
  - Current Live Production URL: `https://github-pages-auditor-1042140630327.asia-east1.run.app`
  - Region: `asia-east1`
  - Active Custom Domain: `pages.moukaeritai.work` (Active, Canonical URL)
  - Current Major Milestone: Organization Scan Contract & Baseline Hardening (1.6.20)
  - Infrastructure Mutation Rule: Do not mutate DNS, Cloud Run, or Firebase Auth externally in coding-agent tasks. Only provide operator checklists.
  - Post-Assignment: Document required post-activation history.
- **Crucial Warning**: Standard Firebase Hosting alone *cannot* run the Express backend. Firebase Hosting alone cannot run the Express backend. It must be paired with Cloud Run via proxy rewrites matching `/api/*` if edge CDN is desired.

## Known Constraints and Open Questions
- Automatic token cleanup for timed-out/expired anonymous sessions is not currently implemented and is not planned for the current maintenance scope. It is deferred indefinitely due to small known-user deployment, and would be considered only as a future operator decision if usage expands.
- Full authenticated browser E2E is deselected from the current maintenance roadmap and is not to be added by coding agents. Public no-auth smoke remains the accepted automated public check.

## Change Log for Agents
- Documented unspoken UX rules (Z-Index volatility, Prepend layouts, Protocol Allowlists, SSL heuristics) into `docs/implicit-design-decisions.md` to surface implicitly encoded UI/architecture behavior.
- Decoupled PAT reference from export contexts and replaced it with safe token metadata (`tokenType`).
- Generated proper external consumer sample artifacts (`json` and `csv`) with static IDs safely under `examples/`.
- Introduced `schemas/schema-identifiers.json` as the local manifest mapping semantic schema versions to URNs.
- Created `scripts/validateExamples.js` to continuously assert compliance for V2 and V2 exported samples alongside `npm run examples:validate`.
- Defined `docs/external-consumer-guide.md` with strict interoperability requirements, ensuring registries and runtime retrievals remain out-of-scope.
- Completely verified coverage of V2 deeply-nested `findings` taxonomy reflecting GitHub Pages DNS/SSL statuses.
- Advanced primary build threshold to `1.6.20 (Organization Scan Contract & Baseline Hardening)` with patch version governance and public no-auth E2E validation controls.
- Documented active Custom Domain `pages.moukaeritai.work`.
- Documented icon/site metadata fetching feature representing best-effort non-blocking metadata audit findings.
- Hardened release checks and documentation consistency checks.
- Implemented soft Firebase initialization and placeholder-aware config validators.
- Established local, deterministic validation gate checks via `scripts/releaseReadinessCheck.js`.
- Expanded unit test coverage in `tests/launcher.test.ts`.
- Completed dynamic PORT environment variable integration in `server.ts` to allow fully decoupled container deployments.
- Exposed unauthenticated `/healthz` on the Express backend for secure liveness/readiness probes in orchestrations like Cloud Run or GKE.
- Shipped professional, compact dual-stage `Dockerfile` and a comprehensive `.dockerignore` mapping modern containerization practices.
- Fully standardized the GitHub OAuth and GitHub App authentication exclusions, guaranteeing they are permanently noted as out of scope.
- Hardened all related spec documents (`spec-initial.md`, `spec-appendix-firebase.md`, `spec-appendix-github-api.md`) to align with out-of-scope directives.
- Decoupled environment normalization and user path resolution into pure module `src/lib/firestorePaths.ts`.
- Integrated automated rules validation test suite in `tests/rules.test.ts` proving cross-tenant security holds.
- Introduced formal environment validators: `server/env.ts` warns about production configs and `src/lib/env.ts` displays a persistent, non-crashing banner in the UI when Firebase is unprovisioned.
- Added scripts `test:rules` and `test:unit` to `package.json` while maintaining a green parent `npm test` script.
- Documented deployment readiness roadmap in `docs/deployment-readiness.md` and UI testing roadmap in `docs/ui-regression-plan.md`.
- Consolidated overall setup and configurations into `README.md`.
- Documented environment path swapping and phantom document concepts in `docs/firestore-architecture.md`.



## Launcher & Dashboard Preview
The **Launcher** surface displays a user's detected GitHub Pages sites, sharing a common `LauncherGrid` component.
- **Standalone Page (`/launcher`)**: Renders sites from the latest saved audit.
- **Dashboard Preview Tab (`/results/:auditId/launcher`)**: Previews sites using the currently loaded Dashboard audit result.
- Tiles open target URLs safely in new windows using `noopener noreferrer`.
- Only Pages-enabled sites with safe `http:` or `https:` URLs are included.
- Tile ordering and presentation preferences (animation speed, visible icons range) can be customized from either surface and is persisted in the Firestore `settings/launcherLayout` setting document (schema version `v3`). Layout persistence is optimistic: UI updates immediately; a save failure will produce a non-blocking warning without reverting the display.
- The app stores only layout and preference metadata (IDs, order, speed, range), not duplicated audit payloads, PATs, or GitHub API responses.
- No third-party favicon proxy services are used; the application relies on direct best-effort metadata collection from the audited site and falls back to locally generated displays based on the app's initial.
- Layout stores the ordered array of IDs, numeric animation speed, and visibility range rather than absolute x/y coordinates or ephemeral elements like zIndex.
