# JSON Export Schema and Detailed Test Matrix

This document extends `docs/spec-initial.md`.

The initial specification remains authoritative. This appendix provides the JSON export schema, schema maintenance rules, and detailed test matrix.

1. JSON Export Contract

JSON export must be a validation-friendly document.

Every JSON export must include:
```json
{
  "schemaVersion": "github-pages-auditor.export.v2"
}
```
Schema file path: `schemas/github-pages-auditor-export-v2.schema.json`

JSON export must not include:
- GitHub PAT
- GitHub Authorization header
- Firebase ID token
- Firebase refresh token
- PAT ciphertext
- PAT storage reference
- internal secret key id
- server session secret
- raw request headers

JSON export should include:
- schemaVersion
- exportedAt
- application metadata
- auditRun metadata
- summary
- repositories
- domains

*(The raw schema definitions live in `schemas/github-pages-auditor-export-v2.schema.json`)*

## Schema Maintenance Rules

- TypeScript types in `src/schema/exportTypesV2.ts` are the source of truth for the export schema.
- The file `schemas/github-pages-auditor-export-v2.schema.json` is a generated artifact.
- Manual edits to the generated schema file are strongly discouraged.
- Any schema-affecting changes (modifying export interfaces) must trigger regeneration and validation via:
  - `npm run schema:generate`
  - `npm run schema:check`

Breaking changes require a new schema version.
Examples: `github-pages-auditor.export.v2`, `github-pages-auditor.export.v2`

For comprehensive structural layouts, see:
* **docs/export-schema-vocabulary.md** for a complete 1:1 mapping table of all fields.
* **docs/export-schema-v2.md** for the nested structures layout specification.

### V2 Backwards-Compatible Extensions
To support high-integrity domain reviews without introducing breaking changes, we added optional, V2-compatible fields to the schema:
* `customDomainVerificationState`: Provides precise granular states (`verified`, `pending`, `unverified`, `unknown`, `not_applicable`), isolating blank raw protected states specifically into `"unknown"` to prevent conflation with true `"unverified"` statuses.
* Advanced Summary Fields:
  - `httpsNotEnforcedCount`
  - `approvedCertButHttpsNotEnforcedCount`
  - `customDomainHttpsNotEnforcedCount`

### Stable Schema Identity Policy (URN UUIDs)
To guarantee clean mechanical interchange of reports across third-party environments, every schema version has a stable, globally unique machine identifier:
* **Identification scheme**: Each `$id` is defined as a static `urn:uuid:<uuid-v4>`.
* **Permanent Identifiers Assigned**:
  - **Version 1 (Flat)**: `urn:uuid:ef46fd93-424a-4e2a-8f5b-df97e28b2be1`
  - **Version 2 (Current)**: `urn:uuid:7d0f98be-8cba-49c5-84dc-66914b5da3f2`
* **Static Generation Contract**: These identities are declared statically within the typescript definitions and applied during build steps. They must **never** be generated or altered dynamically based on run-specific indices (e.g. audit ID, timestamps).
* **Resolver Behavior is Peerless/Opaque**: External consumers must treat these URNs as opaque stable identifier matchers. There is no active remote resolver database, lookup API, schema registry, or dereferencing server implemented.

When schemaVersion changes, update in the same change set:
- JSON export generator
- JSON export tests
- schema file
- documentation
- AGENTS.md
- import/validation tools, if any

A JSON export implementation is not complete until:
- Generated JSON validates against schema.
- schemaVersion is present.
- No forbidden secrets are included.
- Repository URLs are present.
- Pages settings URLs are present.
- Deployment method fields are present.

## CSV Export Contract

CSV export must include at least:
audit_run_id, exported_at, owner, repo, full_name, repository_top_url, pages_settings_url, pages_url, visibility, archived, disabled, has_pages, pages_enabled, build_type, deployment_method, source_branch, source_path, publishing_source_summary, custom_domain, custom_domain_configured, protected_domain_state, pending_domain_unverified_at, https_certificate_state, https_enforced, health_status, classification, error_classification

CSV export must not include secrets.
CSV injection defense: If a cell begins with any of the following characters, escape or prefix it safely: `=`, `+`, `-`, `@`.

## Detailed Test Matrix

Current implemented test coverage includes:
- **Unit tests for classification**: Verifies domain logic and Pages deployment mappings.
- **GitHub API allowlist tests**: Asserts that only explicitly allowed endpoints can be proxied.
- **githubApi mock fetch tests**: Exercises backend API client logic without hitting standard networks.
- **JSON schema validation tests**: Compares actual exports with the generated JSON schema using ajv.
- **Secret leakage tests**: Ensures JSON payloads do not bleed Firestore paths or Authorization headers.
- **CSV injection tests**: Validates that fields with formula starters (`=`, `+`, `-`, `@`) fall back safely.

*(See original prompt for full historical intent detail)*

First Export Example (Minimal):
```json
{
  "schemaVersion": "github-pages-auditor.export.v2",
  "exportedAt": "2026-01-01T00:00:00Z",
  "application": {
    "name": "GitHub Pages Auditor",
    "version": "0.1.0",
    "environment": "dev"
  },
  "auditRun": {
    "id": "audit-run-1",
    "status": "completed",
    "startedAt": "2026-01-01T00:00:00Z",
    "finishedAt": "2026-01-01T00:01:00Z",
    "userMode": "google",
    "tokenType": "classic",
    ...
  }
}
```

## Launcher & Dashboard Preview
The **Launcher** surface displays a user's detected GitHub Pages sites, sharing a common `LauncherGrid` component.
- **Standalone Page (`/launcher`)**: Renders sites from the latest saved audit.
- **Dashboard Preview Tab (`/results/:auditId/launcher`)**: Previews sites using the currently loaded Dashboard audit result.
- Tiles open target URLs safely in new windows using `noopener noreferrer`.
- Only Pages-enabled sites with safe `http:` or `https:` URLs are included.
- Tile ordering can be customized from either surface and is persisted in Firestore under `settings/launcherLayout`. Layout persistence is optimistic: UI updates immediately upon moving a tile; a save failure will produce a non-blocking warning without reverting the display.
- The app stores only layout metadata (IDs and order), not duplicated audit payloads.
- No third-party favicon proxy services are used; the application relies on direct best-effort metadata collection from the audited site and falls back to locally generated displays based on the app's initial.
- Layout stores the ordered array of IDs rather than absolute x/y coordinates.
