# Initial Specification Prompt: GitHub Pages Auditor Web App

You are implementing a web application named GitHub Pages Auditor.

This initial prompt defines the core product, architecture constraints, security rules, and MVP scope. Additional reference documents will be provided later for the complete GitHub API appendix, Firestore design details, JSON export schema, and extended test matrix. Do not invent behavior that conflicts with this prompt.

1. Product Goal

Build a multi-user web application that audits GitHub Pages settings across many repositories accessible to a user.

The application answers, for each repository:

- Is GitHub Pages enabled?
- Is a custom domain configured?
- What is the custom domain?
- What is the repository-level custom domain protection / verification state?
- Is there a pending unverified domain timestamp?
- What is the HTTPS certificate state?
- Is HTTPS enforcement enabled?
- How is GitHub Pages deployed?
  - GitHub Actions workflow-based deployment
  - branch root publishing
  - branch "/docs" publishing
  - unknown
- What GitHub repository URL should the user open?
- What GitHub Pages settings URL should the user open to make changes manually?

The application is an auditor, not a GitHub settings manager.

2. Absolute Non-Scope

Do not implement any feature that changes GitHub settings.

The application must not create, update, or delete:

- GitHub Pages settings
- custom domains
- HTTPS enforcement settings
- Pages source branch/path
- CNAME files
- DNS records
- repository settings
- GitHub verified domains
- GitHub Actions workflows

Do not scrape GitHub HTML settings pages. Do not submit GitHub settings forms.

The app may show links to GitHub, but all actual configuration changes must be done manually by the user on GitHub.

3. GitHub Authentication Model

GitHub API authentication is PAT-only.

Supported GitHub token types:

- fine-grained personal access token
- personal access token classic

Out of scope:

- GitHub OAuth
- GitHub OAuth callback flow
- GitHub OAuth device flow
- GitHub App
- GitHub App installation token
- GitHub App user token
- GitHub App JWT
- GitHub Actions "GITHUB_TOKEN"

Do not implement GitHub login.

The app’s user login is separate from GitHub API access. A logged-in app user manually registers a GitHub PAT. The backend uses that PAT to call GitHub API endpoints.

4. Application Authentication Model

Use Firebase Authentication as the first-choice authentication system.

Allowed Firebase Authentication providers:

- Google provider for persistent users
- Anonymous provider for non-persistent guest mode

Forbidden providers in Version 1:

- Firebase GitHub provider
- email/password
- phone
- Apple
- Facebook
- Microsoft
- SAML
- custom OIDC
- any other persistent external provider

Persistent Google users may store PAT records and audit history.

Anonymous users are allowed only for non-persistent guest mode. Anonymous users may run a temporary one-shot audit, but must not create persistent stored PATs by default. Any server-side data for anonymous users must be temporary and have expiration metadata.

Use Firebase UID as the tenant boundary. Do not use email address as the primary identity key.

Backend APIs must verify Firebase ID tokens.

5. Persistence

If server-side persistence is needed, use Cloud Firestore as the first-choice database.

Firestore must use an app-specific namespace to avoid conflicts with other applications in the same Firebase project.

Do not use generic top-level collections such as:

- "users"
- "tokens"
- "jobs"
- "logs"
- "auditRuns"
- "repositories"

Use a namespace similar to:

githubPagesAuditorV1/{environment}/users/{uid}
githubPagesAuditorV1/{environment}/users/{uid}/githubTokens/{tokenId}
githubPagesAuditorV1/{environment}/users/{uid}/auditRuns/{auditRunId}
githubPagesAuditorV1/{environment}/users/{uid}/auditRuns/{auditRunId}/repositories/{repositoryResultId}
githubPagesAuditorV1/{environment}/anonymousSessions/{anonymousUid}
githubPagesAuditorV1/{environment}/appAuditLogs/{logId}

"environment" should be one of:

dev
staging
prod

The exact collection design may be adjusted, but the chosen namespace and data model must be documented in "AGENTS.md".

PAT plaintext must never be stored in Firestore. The implementation may choose the PAT storage/encryption mechanism, but the method must be documented in "AGENTS.md".

6. Cloud Functions

Firebase Cloud Functions are optional.

If Cloud Functions are not used, document that in "AGENTS.md".

If Cloud Functions are used, they must not damage existing functions from other applications in the same Firebase project.

Rules if Cloud Functions are used:

- Use an app-specific function prefix, such as "gpaV1".
- Do not use generic function names like "api", "cleanup", "runAudit", or "exportJson".
- Do not run unrestricted deployment commands against a shared project.
- Avoid bare "firebase deploy".
- Avoid "firebase deploy --only functions" unless explicitly approved for this app.
- Prefer explicit deployment of owned functions only, for example:

firebase deploy --only functions:gpaV1Api
firebase deploy --only functions:gpaV1Api,functions:gpaV1RunAudit

The Cloud Functions usage, function names, codebase, and deploy commands must be documented in "AGENTS.md".

7. Backend GitHub API Allowlist

The backend must not be a generic GitHub API proxy.

Only these GitHub API endpoints are allowed in Version 1.

Standard endpoints:

GET /user
GET /user/repos
GET /repos/{owner}/{repo}/pages

Optional endpoints:

GET /repos/{owner}/{repo}/pages/health
GET /rate_limit
GET /orgs/{org}/repos

"GET /orgs/{org}/repos" may be used only if an organization-specific scan mode is implemented.

Forbidden endpoints include all GitHub write operations, especially:

POST /repos/{owner}/{repo}/pages
PUT /repos/{owner}/{repo}/pages
DELETE /repos/{owner}/{repo}/pages
POST /repos/{owner}/{repo}/pages/builds

Do not add GitHub Actions workflow API endpoints in Version 1. Version 1 may detect that Pages uses workflow-based deployment, but it must not identify the exact workflow YAML file.

8. GitHub API Request Headers

All GitHub REST API calls must be server-side and use headers equivalent to:

Accept: application/vnd.github+json
Authorization: Bearer <PAT>
X-GitHub-Api-Version: 2026-03-10
User-Agent: <application-name>

Do not expose the GitHub Authorization header to the browser.

Do not log PATs or Authorization headers.

9. Repository Enumeration

Use:

GET /user/repos

Recommended parameters:

visibility=all
affiliation=owner,collaborator,organization_member
sort=full_name
direction=asc
per_page=100
page=<page-number>

Store or display at least:

- repository id
- owner login
- repository name
- full name
- private / public / visibility
- archived
- disabled
- fork
- default branch
- has_pages
- html_url
- created_at
- updated_at
- pushed_at

Derived links:

repositoryTopUrl = repository.html_url
pagesSettingsUrl = https://github.com/{owner}/{repo}/settings/pages

Every repository row must show the GitHub repository top link.

10. GitHub Pages Audit

Use:

GET /repos/{owner}/{repo}/pages

Store or display at least:

- status
- cname
- html_url
- build_type
- source.branch
- source.path
- public
- pending_domain_unverified_at
- protected_domain_state
- https_certificate.state
- https_certificate.description
- https_certificate.domains
- https_certificate.expires_at
- https_enforced

Use these fields to classify custom domain status, HTTPS status, and Pages deployment method.

11. Pages Deployment Method Classification

Use "build_type", "source.branch", and "source.path".

Rules:

If build_type == "workflow":
  deploymentMethod = "workflow"
  classification includes "pages_deploy_method_workflow"

If build_type == "legacy" and source.path == "/":
  deploymentMethod = "branch_root"
  classification includes "pages_deploy_method_branch_root"

If build_type == "legacy" and source.path == "/docs":
  deploymentMethod = "branch_docs"
  classification includes "pages_deploy_method_branch_docs"

If build_type == "legacy" and source.path is neither "/" nor "/docs":
  deploymentMethod = "branch_unknown_path"
  classification includes "pages_deploy_method_branch_unknown_path"

If build_type is absent, null, or unknown:
  deploymentMethod = "unknown"
  classification includes "pages_deploy_method_unknown"

If Pages is disabled:
  deploymentMethod = "not_applicable"

Do not infer the workflow file name from "build_type".

Do not inspect GitHub Actions workflow files in Version 1.

Unknown enum values from GitHub must be preserved and surfaced, not discarded.

12. Custom Domain and HTTPS Classification

Classify at least the following states:

pages_disabled
pages_enabled_no_custom_domain
custom_domain_configured
custom_domain_verified
custom_domain_pending
custom_domain_unverified_or_unknown
https_certificate_ok
https_certificate_problem_or_unknown
https_not_enforced
insufficient_permissions
sso_required
rate_limited
api_error

Rules:

If Pages API returns 404 for a repository returned by /user/repos:
  pages_enabled = false

If cname is null or empty:
  customDomainConfigured = false

If cname is non-empty:
  customDomainConfigured = true

If protected_domain_state == "verified":
  custom domain is verified at repository-level API signal

If protected_domain_state is absent or not "verified":
  custom domain state is unverified or unknown

If pending_domain_unverified_at is non-null:
  surface a pending/unverified warning

If https_certificate.state == "approved":
  HTTPS certificate is OK

If https_certificate.state is absent or not "approved":
  HTTPS certificate is problem or unknown

If https_enforced == false:
  surface HTTPS not enforced warning

Do not claim to have enumerated all account-level verified domains. The repository-level Pages API response is the source of truth for this app.

13. Optional DNS/HTTPS Health Check

"GET /repos/{owner}/{repo}/pages/health" is optional and must be disabled by default.

Use it only when the user explicitly enables health check.

Call it only if Pages API returned a non-empty "cname".

This endpoint may require stronger permissions than normal read-only auditing. The UI must warn users before enabling it.

Even if the PAT has write-capable permissions, the application must not perform GitHub write operations.

14. UI Requirements

The UI should include:

- Login screen
  - Google sign-in for persistent use
  - Optional guest mode for anonymous non-persistent use
  - No GitHub login button
- Dashboard
  - repository count
  - Pages enabled count
  - custom domain count
  - verified / unverified / unknown counts
  - HTTPS problem count
  - deployment method counts
- PAT settings for Google users
  - add PAT
  - validate PAT
  - delete PAT
  - list stored PAT metadata
  - never display PAT plaintext
- One-shot PAT input for anonymous guest mode
  - no persistent PAT storage by default
- Audit run page
- Repository result table
- Repository detail drawer
- Domain summary page
- CSV export
- JSON export

Repository table must show:

- owner
- repo
- visibility
- archived
- disabled
- has_pages
- Pages status
- build type
- deployment method
- source branch
- source path
- publishing source summary
- custom domain
- protected domain state
- pending domain unverified timestamp
- HTTPS certificate state
- HTTPS enforced
- health status
- Repository link
- Pages link
- Settings link
- error classification

15. Export Requirements

CSV export must include repository URLs, settings URLs, Pages URLs, custom domain fields, HTTPS fields, and deployment method fields.

JSON export must have a schema.

Every JSON export must include:

{
  "schemaVersion": "github-pages-auditor.export.v1"
}

Create this schema file:

schemas/github-pages-auditor-export-v1.schema.json

Do not include in exports:

- GitHub PAT
- GitHub Authorization header
- Firebase ID token
- Firebase refresh token
- PAT ciphertext
- PAT storage reference
- internal secret key id
- raw request headers

The JSON export schema can be provided in a later reference document. For now, create the schema file with a placeholder structure and a TODO that it must be replaced by the full schema before export implementation is considered complete.

16. Security Rules

Mandatory rules:

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
- Handle 401, 403, 404, 422, 429, and 5xx GitHub API responses explicitly.
- Capture and respect GitHub rate limit headers.
- Do not continue aggressive requests while rate-limited.

17. Required Project Files

Create or update at least these files:

AGENTS.md
docs/spec-initial.md
schemas/github-pages-auditor-export-v1.schema.json
README.md

"docs/spec-initial.md" should contain this initial specification.

"AGENTS.md" must be treated as the operational source of truth for coding agents. It must be kept current.

18. Required AGENTS.md Content

Create "AGENTS.md" with these sections:

# AGENTS.md

## Project Summary
## Current Architecture
## Implementation Decisions
## Non-Negotiable Security Rules
## Firebase Authentication Contract
## Firestore Persistence Contract
## Cloud Functions Deployment Contract
## GitHub API Usage Contract
## PAT Storage Decision
## JSON Export Schema Contract
## Directory Structure
## Development Commands
## Test Commands
## Environment Variables
## Coding Conventions
## Current Implementation Status
## Known Constraints and Open Questions
## Change Log for Agents

"AGENTS.md" must document:

- whether Firestore is used
- Firestore namespace
- whether Cloud Functions are used
- Cloud Functions deploy command if used
- PAT storage approach
- Firebase Auth providers
- allowed GitHub API endpoints
- forbidden GitHub API endpoints
- JSON export schema version
- current implementation status

Whenever implementation choices change, update "AGENTS.md".

19. Initial Implementation Task

Do not attempt to implement every feature at once.

Start by creating a safe project foundation:

1. Create "AGENTS.md".
2. Create "docs/spec-initial.md".
3. Create placeholder "schemas/github-pages-auditor-export-v1.schema.json".
4. Set up the project structure.
5. Implement or stub Firebase Authentication verification on the backend.
6. Define typed models for:
   - user
   - GitHub token metadata
   - audit run
   - repository result
   - domain summary
   - JSON export
7. Implement a strict GitHub API client.
8. Implement token validation flow:
   - "GET /user"
   - "GET /user/repos?per_page=1"
9. Implement repository audit flow using:
   - "GET /user/repos"
   - "GET /repos/{owner}/{repo}/pages"
10. Implement repository result classification for:
    - custom domain status
    - HTTPS status
    - deployment method
11. Implement a minimal repository results UI.
12. Add tests proving forbidden GitHub APIs cannot be called.

Defer advanced health check, full JSON Schema, export polishing, Cloud Functions scheduling, and detailed Firestore indexing until after the foundation is in place.

20. Completion Criteria for First Milestone

The first milestone is complete when:

- "AGENTS.md" exists and matches the current implementation.
- The app has a clear Firebase Auth plan.
- Firestore usage or non-usage is documented.
- Cloud Functions usage or non-usage is documented.
- GitHub API client has an endpoint allowlist.
- GitHub write endpoints are not callable.
- GitHub OAuth and GitHub App are not implemented.
- Both classic PAT and fine-grained PAT are accepted as supported token types.
- PAT plaintext is never returned by backend APIs.
- Repository rows include repository top URL and Pages settings URL.
- Pages deployment method is classified from "build_type", "source.branch", and "source.path".
- JSON export schema placeholder exists.
- Tests cover the most important security boundaries.
