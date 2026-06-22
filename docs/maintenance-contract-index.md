# Maintenance Contract Index

This document serves as the authoritative index of all major maintenance contracts for the GitHub Pages Auditor application. Milestone `v1.6.22` acts as the stable release baseline representing the completed initial maintenance phase. The renewed `v1.7.x` development run (commencing with `1.7.44`) references these established contracts to define the boundaries of accepted runtime behavior, security, and UI optimizations.

## Version Governance
- **Source of Truth**: The `package.json` version string is the absolute source of truth.
- **Enforcement**: Must be consistently mirrored in documentation, headers, User-Agent, and `scripts/releaseReadinessCheck.js`.

## GitHub API Scope
- **Contract**: PAT-only access. Full read-only GET proxy behavior.
- **Non-Goals**: No GitHub OAuth. No GitHub App authentication. No generic GitHub API proxy. No GitHub write APIs. No workflow/Actions APIs.
- **Enforcement**: `server/githubClient.ts`, `tests/launcher.test.ts`.

## Authentication and PAT Handling
- **Contract**: The browser owns the PAT and supplies it via `x-temp-pat` headers. Server must never return it in plaintext or log it.
- **Enforcement**: `server.ts`, `AGENTS.md`.

## Firebase Auth Purpose
- **Contract**: Strictly for application user identity and cross-tenant data isolation. Never for GitHub workspace access.
- **Enforcement**: `src/lib/firebase.ts`, `AGENTS.md`.

## Firestore Persistence Boundaries
- **Contract**: User persistence and Anonymous guest persistence are completely isolated (`request.auth.uid == uid`). No general top-level collections.
- **Enforcement**: `firestore.rules`, `src/lib/firestorePaths.ts`, `tests/rules.test.ts`.

## Anonymous Session Cleanup Decision
- **Contract**: Automatic anonymous cleanup (TTL logic/Cloud Scheduler) is not currently implemented in the maintenance scope.
- **Enforcement**: `docs/deferred-work.md`, `docs/anonymous-session-lifecycle.md`.

## Public No-Auth Smoke Scope
- **Contract**: public no-auth smoke is the accepted automated test scope. Full authenticated browser E2E is not planned for the current maintenance scope.
- **Enforcement**: `scripts/publicSmokeCheck.js`, `docs/deferred-work.md`.

## Export Schema Stability
- **Contract**: Stable URN static IDs for export schema V2. Generated artifacts must match `src/schema/exportTypesV2.ts`.
- **Enforcement**: `scripts/schemaCheck.js`, `scripts/validateExamples.js`.

## Launcher Persistence
- **Contract**: Persistence handled under `github-pages-auditor.launcherLayout.v3` schema (`settings/launcherLayout`). Does not persist ephemeral state like zIndex.
- **Enforcement**: `src/lib/launcherLayout.ts`.

## Launcher Visual/UI Contracts
- **Repository-Name Default Pages Badge**: Uses repository name explicitly for default Pages project URLs.
- **Compact Metadata Bubble**: Condensed popover behavior without large min-width.
- **Direct-DOM**: Direct DOM `transform` mutations for high-frequency dragged items.
- **Precise IntersectionObserver boundary**: Uses exactly `rootMargin: '0px'` and `threshold: 0` to pause circular text animation softly strictly.
- **zIndex**: Kept purely ephemeral and not serialized to Firestore.
- **transparenttextures.com**: No Third-Party UI Asset URLs strictly forbids unapproved asset domains.
- **Enforcement**: `src/components/LauncherGrid.tsx`, `docs/implicit-design-decisions.md`.

## Site Metadata Fetching
- **Contract**: Credential-free and PAT-free fetch from public frontend endpoints, injecting APP_USER_AGENT.
- **Enforcement**: `server/siteMetadata.ts`.

## Runtime/Deployment Non-Mutation Boundaries
- **Contract**: External systems (DNS, Cloud Run configs, Google Cloud settings, Firestore production data) are out-of-bounds for agent mutation.
- **Enforcement**: `AGENTS.md`, `README.md`.

## Additional Non-Goals & Security
- No Gemini, AI, LLM integrations.
- No CI secrets addition.
