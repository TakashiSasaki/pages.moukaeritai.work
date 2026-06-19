# GitHub Pages Auditor - Export Schema Vocabulary (V1)

This volume provides a rigorous, property-by-property dictionary of the application's V1 JSON export schema. It defines the origin, semantics, and recommended standard V2 naming maps for all keys to ensure high-fidelity data interchange across auditing pipelines.

V1 is the current default schema optimized for both flat tabular JSON rendering and CSV generation. External consumers can find sample payloads for evaluation under `examples/github-pages-auditor-export-v1.sample.json` and its corresponding CSV generation in the same folder.


---

## Part 1: Architecture Intent & Sources Breakdown
Each property represents a logical value originating from one of the following classification domains:
*   `github_repository_api_raw`: Unaltered properties directly from the GitHub repositories GET endpoint payload.
*   `github_pages_api_raw`: Direct fields yielded by the GitHub repository Pages configuration API endpoint.
*   `github_pages_health_api_raw`: Domain DNS and SSL health parameters reported by the GitHub Pages health validation subsystem.
*   `app_normalized`: Standardized fields computed by the local application for cross-environment consistency.
*   `app_display`: Freeform readable text intended exclusively for end-user visual rendering (not machine-readable).
*   `export_metadata`: High-level envelope auditing headers containing execution state descriptors.
*   `derived_summary`: Aggregate indices computed dynamically over the full audit run list.

---

## Part 2: Export Elements and Domain Vocabulary

### 1. Application Envelope Metadata (`application`)
| JSON Path | Current V1 Name | Category | Nullable? | Readability | GitHub Source Field | Meaning / Intended Semantics | Recommended V2 Name |
| :--- | :--- | :--- | :---: | :---: | :--- | :--- | :--- |
| `application.name` | `name` | `export_metadata` | No | Machine | N/A | Human-readable app name identifier. | `name` |
| `application.version` | `version` | `export_metadata` | No | Machine | N/A | Dynamic package version reading `package.json` compilation context. | `version` |
| `application.environment` | `environment` | `export_metadata` | Yes | Machine | N/A | Active operational deployment stage (`production` or `dev`). | `environment` |

---

### 2. Audit Run execution Headers (`auditRun`)
| JSON Path | Current V1 Name | Category | Nullable? | Readability | GitHub Source Field | Meaning / Intended Semantics | Recommended V2 Name |
| :--- | :--- | :--- | :---: | :---: | :--- | :--- | :--- |
| `auditRun.id` | `id` | `export_metadata` | No | Machine | N/A | UID of the audit run (corresponds to real Firestore ID or session container export descriptor). | `id` |
| `auditRun.status` | `status` | `export_metadata` | No | Machine | N/A | Verification completion state enum mapping. | `status` |
| `auditRun.startedAt` | `startedAt` | `export_metadata` | Yes | Machine | N/A | ISO-8601 timestamp logging when the verification process started. | `startedAt` |
| `auditRun.finishedAt` | `finishedAt` | `export_metadata` | Yes | Machine | N/A | ISO-8601 timestamp logging when the verification finished. | `finishedAt` |
| `auditRun.userMode` | `userMode` | `export_metadata` | Yes | Machine | N/A | Active tenant mode (`google` for persistent, `anonymous` for session guests). | `userMode` |
| `auditRun.tokenType` | `tokenType` | `export_metadata` | Yes | Machine | N/A | Format identifier representing the used GitHub credential type (`classic` or `fine_grained`). | `tokenType` |
| `auditRun.githubLogin` | `githubLogin` | `export_metadata` | Yes | Machine | `login` | Authenticated username from primary PAT retrieval. | `githubLogin` |
| `auditRun.options` | `options` | `export_metadata` | No | Machine | N/A | Struct of options filters used during auditing. | `options` |

---

### 3. Aggregate Statistical summary (`summary`)
| JSON Path | Current V1 Name | Category | Nullable? | Readability | GitHub Source Field | Meaning / Intended Semantics | Recommended V2 Name |
| :--- | :--- | :--- | :---: | :---: | :--- | :--- | :--- |
| `summary.repositoryCount` | `repositoryCount` | `derived_summary` | No | Machine | N/A | Total number of evaluated repositories. | `repositoryCount` |
| `summary.pagesEnabledCount` | `pagesEnabledCount` | `derived_summary` | No | Machine | N/A | Number of repositories containing active Pages publishing settings. | `pagesEnabledCount` |
| `summary.customDomainCount` | `customDomainCount` | `derived_summary` | No | Machine | N/A | Count of sites mapping a non-empty `cname` domain descriptor. | `customDomainCount` |
| `summary.customDomainVerifiedCount` | `customDomainVerifiedCount` | `derived_summary` | No | Machine | N/A | Sites where DNS ownership handshake matches `verified`. | `customDomainVerifiedCount` |
| `summary.customDomainUnverifiedOrUnknownCount` | `customDomainUnverifiedOrUnknownCount` | `derived_summary` | No | Machine | N/A | Count of custom domains matching pending or unverified ownership states. | `customDomainUnverifiedOrUnknownCount` |
| `summary.httpsProblemCount` | `httpsProblemCount` | `derived_summary` | No | Machine | N/A | Count of sites experiencing certificate issues or having disabled SSL enforcement. | `httpsProblemCount` |
| `summary.dnsHealthProblemCount` | `dnsHealthProblemCount` | `derived_summary` | No | Machine | N/A | Count of custom domains failing low-level network resolution probes. | `dnsHealthProblemCount` |
| `summary.errorCount` | `errorCount` | `derived_summary` | No | Machine | N/A | Sum of audits affected by execution faults (permissions/SSO roadblocks). | `errorCount` |
| `summary.deploymentWorkflowCount` | `deploymentWorkflowCount` | `derived_summary` | No | Machine | N/A | Count of Pages deployed via GitHub Actions workflow structures. | `deploymentWorkflowCount` |
| `summary.deploymentBranchRootCount` | `deploymentBranchRootCount` | `derived_summary` | No | Machine | N/A | Count of Pages deploying the classical root branch folder (`/`). | `deploymentBranchRootCount` |
| `summary.deploymentBranchDocsCount` | `deploymentBranchDocsCount` | `derived_summary` | No | Machine | N/A | Count of Pages deploying folders matching the `/docs` path pattern. | `deploymentBranchDocsCount` |
| `summary.deploymentUnknownCount` | `deploymentUnknownCount` | `derived_summary` | No | Machine | N/A | Count of Pages deploying unrecognized folders or invalid paths. | `deploymentUnknownCount` |
| `summary.httpsNotEnforcedCount` | `httpsNotEnforcedCount` | `derived_summary` | No | Machine | N/A | Total configurations where `https_enforced` is false (or certificate is un-enforced). | `httpsNotEnforcedCount` |
| `summary.approvedCertButHttpsNotEnforcedCount` | `approvedCertButHttpsNotEnforcedCount` | `derived_summary` | No | Machine | N/A | Repositories with an active approved SSL certificate but missing enforcement. | `approvedCertButHttpsNotEnforcedCount` |
| `summary.customDomainHttpsNotEnforcedCount` | `customDomainHttpsNotEnforcedCount` | `derived_summary` | No | Machine | N/A | Custom-domain configured sites where `https_enforced` is false. | `customDomainHttpsNotEnforcedCount` |

---

### 4. Repository-Level Record Struct (`repositories[]`)
| JSON Path | Current V1 Name | Category | Nullable? | Readability | GitHub Source Field | Meaning / Intended Semantics | Recommended V2 Name |
| :--- | :--- | :--- | :---: | :---: | :--- | :--- | :--- |
| `repositories[].githubRepoId` | `githubRepoId` | `github_repository_api_raw` | Yes | Machine | `id` | Unique raw database integer index assigned by GitHub representing the repository. | `repository.id` |
| `repositories[].owner` | `owner` | `github_repository_api_raw` | No | Machine | `owner.login` | Organization or personal account identity text owning the target code base. | `repository.ownerLogin` |
| `repositories[].repo` | `repo` | `github_repository_api_raw` | No | Machine | `name` | Code repository slug name. | `repository.name` |
| `repositories[].fullName` | `fullName` | `github_repository_api_raw` | No | Machine | `full_name` | Combined `owner/repo` namespace. | `repository.fullName` |
| `repositories[].repositoryTopUrl` | `repositoryTopUrl` | `github_repository_api_raw` | No | Machine | `html_url` | Browser hyper-link pointing directly to the root source tree. | `repository.htmlUrl` |
| `repositories[].pagesSettingsUrl` | `pagesSettingsUrl` | `app_normalized` | No | Machine | N/A | Computed settings landing subpath to quickly navigate administrators. | `pages.settingsUrl` |
| `repositories[].pagesUrl` | `pagesUrl` | `github_pages_api_raw` | Yes | Machine | `html_url` | Public target domain hosting compiled static files. | `pages.htmlUrl` |
| `repositories[].private` | `private` | `github_repository_api_raw` | No | Machine | `private` | Booleans representing core repository visibility state. | `repository.isPrivate` |
| `repositories[].visibility` | `visibility` | `github_repository_api_raw` | Yes | Machine | `visibility` | Repository accessibility level (`public`, `private`, `internal`). | `repository.visibility` |
| `repositories[].archived` | `archived` | `github_repository_api_raw` | No | Machine | `archived` | Flag denoting whether the repository is frozen. | `repository.isArchived` |
| `repositories[].disabled` | `disabled` | `github_repository_api_raw` | No | Machine | `disabled` | Flag denoting whether the repository has been disabled by GitHub. | `repository.isDisabled` |
| `repositories[].fork` | `fork` | `github_repository_api_raw` | No | Machine | `fork` | Flag declaring if this repository is a copy/downstream fork. | `repository.isFork` |
| `repositories[].defaultBranch` | `defaultBranch` | `github_repository_api_raw` | Yes | Machine | `default_branch` | Primary branch slug name. | `repository.defaultBranch` |
| `repositories[].hasPages` | `hasPages` | `github_repository_api_raw` | Yes | Machine | `has_pages` | Initial general indicator marking if Pages feature is enabled in general settings. | `repository.githubHasPagesRaw` |
| `repositories[].createdAtGitHub` | `createdAtGitHub` | `github_repository_api_raw` | Yes | Machine | `created_at` | RFC-3339 timestamp logging repository creation. | `repository.createdAt` |
| `repositories[].updatedAtGitHub` | `updatedAtGitHub` | `github_repository_api_raw` | Yes | Machine | `updated_at` | RFC-3339 timestamp logging settings catalog modification. | `repository.updatedAt` |
| `repositories[].pushedAtGitHub` | `pushedAtGitHub` | `github_repository_api_raw` | Yes | Machine | `pushed_at` | RFC-3339 timestamp logging commits delivery. | `repository.pushedAt` |
| `repositories[].pagesEnabled` | `pagesEnabled` | `app_normalized` | No | Machine | `has_pages` | Normalized active flag reflecting true Pages configuration availability. | `pages.enabled` |
| `repositories[].pagesStatus` | `pagesStatus` | `github_pages_api_raw` | Yes | Machine | `status` | Direct configuration state from GitHub Pages API (`built`, etc.). | `pages.statusRaw` |
| `repositories[].buildType` | `buildType` | `github_pages_api_raw` | Yes | Machine | `build_type` | Build strategy representing classical branch configs (`legacy`) vs Actions (`workflow`). | `pages.deployment.githubBuildTypeRaw` |
| `repositories[].deploymentMethod` | `deploymentMethod` | `app_normalized` | No | Machine | N/A | App-normalized publication state (`workflow`, `branch_root`, `branch_docs`, `unknown`, `not_applicable`). | `pages.deployment.method` |
| `repositories[].sourceBranch` | `sourceBranch` | `github_pages_api_raw` | Yes | Machine | `source.branch` | GitHub Pages direct file sync branch. | `pages.deployment.sourceBranch` |
| `repositories[].sourcePath` | `sourcePath` | `github_pages_api_raw` | Yes | Machine | `source.path` | Base directory of compiled documents (`/` or `/docs`). | `pages.deployment.sourcePath` |
| `repositories[].publishingSourceSummary` | `publishingSourceSummary` | `app_display` | Yes | Display | N/A | Freeform text summarizing Pages source for the client frontend UI. | `pages.deployment.displaySummary` |
| `repositories[].pagesPublic` | `pagesPublic` | `github_pages_api_raw` | Yes | Machine | `public` | GitHub Pages restriction level denoting if files are public or require SSO session maps. | `pages.publicRaw` |
| `repositories[].customDomain` | `customDomain` | `github_pages_api_raw` | Yes | Machine | `cname` | Configured active custom URL mapping string. | `pages.customDomain.cnameRaw` |
| `repositories[].customDomainConfigured` | `customDomainConfigured` | `app_normalized` | No | Machine | N/A | Helper boolean signifying if are active custom domains present. | `pages.customDomain.configured` |
| `repositories[].protectedDomainState` | `protectedDomainState` | `github_pages_api_raw` | Yes | Machine | `protected_domain_state` | Detailed domain ownership validation handshake state. | `pages.customDomain.githubProtectedDomainStateRaw` |
| `repositories[].pendingDomainUnverifiedAt` | `pendingDomainUnverifiedAt` | `github_pages_api_raw` | Yes | Machine | `pending_domain_unverified_at` | Timestamp marking expiration of custom-domain unverified verification hold. | `pages.customDomain.pendingUnverifiedAt` |
| `repositories[].httpsCertificateState` | `httpsCertificateState` | `github_pages_api_raw` | Yes | Machine | `https_certificate.state` | GitHub Pages SSL certificate provisioning status. | `pages.https.certificate.stateRaw` |
| `repositories[].httpsCertificateDescription` | `httpsCertificateDescription` | `github_pages_api_raw` | Yes | Machine | `https_certificate.description` | Text details reflecting certificate diagnostic outputs. | `pages.https.certificate.description` |
| `repositories[].httpsCertificateDomains` | `httpsCertificateDomains` | `github_pages_api_raw` | No | Machine | `https_certificate.domains` | Array of domains represented inside active TLS layers. | `pages.https.certificate.domains` |
| `repositories[].httpsCertificateExpiresAt` | `httpsCertificateExpiresAt` | `github_pages_api_raw` | Yes | Machine | `https_certificate.expires_at` | Timestamp logging expiration of static security certificates. | `pages.https.certificate.expiresAt` |
| `repositories[].httpsEnforced` | `httpsEnforced` | `github_pages_api_raw` | Yes | Machine | `https_enforced` | Active redirect to HTTPS enforcement setting flag. | `pages.https.enforced` |
| `repositories[].healthStatus` | `healthStatus` | `app_normalized` | Yes | Machine | N/A | Application assessment of Pages verification context. | `pages.healthCheck.status` |
| `repositories[].classification` | `classification` | `app_normalized` | No | Machine | N/A | Categorized status string array highlighting key findings and states. | `findings` (mapped to nested finding arrays) |
| `repositories[].errorClassification` | `errorClassification` | `app_normalized` | Yes | Machine | N/A | Error details if retrieval failed. | `findings` |
| `repositories[].customDomainVerificationState` | `customDomainVerificationState` | `app_normalized` | Yes | Machine | N/A | Granular domain check state mapping (`verified`, `pending`, `unverified`, `unknown`, `not_applicable`). | `pages.customDomain.verificationState` |
| `repositories[].diagnostics` | `diagnostics` | `app_normalized` | Yes | Machine | N/A | Reserved placeholder for custom telemetry parameters. | `diagnostics` |

---

### 5. Multi-Domain Verification Indexes (`domains[]`)
| JSON Path | Current V1 Name | Category | Nullable? | Readability | Meaning / Intended Semantics | Recommended V2 Name |
| :--- | :--- | :--- | :---: | :---: | :--- | :--- |
| `domains[].domain` | `domain` | `app_normalized` | No | Machine | Target custom cname string. | `domain` |
| `domains[].repositoryCount` | `repositoryCount` | `derived_summary` | No | Machine | Count of repositories mapping to the exact identical custom domain (revealing duplicates). | `repositoryCount` |
| `domains[].repositories[]` | `repositories` | `derived_summary` | No | Machine | Namespaces mapping of duplicate repository URLs. | `repositories` |
| `domains[].hasDuplicate` | `hasDuplicate` | `derived_summary` | No | Machine | Flag denoting if multiple repositories share this identical CNAME descriptor. | `hasDuplicate` |
| `domains[].hasUnverified` | `hasUnverified` | `derived_summary` | No | Machine | Flag reflecting custom domains experiencing verification ownership hold conditions. | `hasUnverified` |
| `domains[].hasHttpsProblem` | `hasHttpsProblem` | `derived_summary` | No | Machine | Flag asserting active certificate issues. | `hasHttpsProblem` |
| `domains[].hasDnsProblem` | `hasDnsProblem` | `derived_summary` | No | Machine | Flag indicating active routing issues. | `hasDnsProblem` |

---

## Part 3: Semantic Analysis & Name Ambiguity Reviews

This section details the formal conclusions reached regarding current property mappings inside the V1 structure to prevent systematic logic drift:

### 1. Repository Identity & State
*   `disabled`: **Must be understood exclusively as a repository-level attribute** signifying general repository freeze. It is not associated with Pages-specific enablement.
*   `fork`: **Indicates repository-wide fork status** and is unaffected by specific static publishing rules inside the repository settings.
*   `hasPages`: Maps directly to GitHub Repositories API property `has_pages`, signifying the user simply enabled static files capability in settings.
*   `pagesEnabled`: **App-normalized value representing true Pages viability**. It filters out repositories mapping `hasPages: false` and confirms configurations can be queried.

### 2. Pages Publishing Characteristics
*   `buildType`: Matches GitHub Pages raw setting `build_type` representing standard legacy branches (`legacy`) versus Actions (`workflow`).
*   `deploymentMethod`: **App-normalized categorization** that cleanly translates legacy folder paths and formats (`workflow`, `branch_root`, `branch_docs`, `branch_unknown_path`) to clear machine-readable tokens.
*   `sourceBranch` & `sourcePath`: **Refer exclusively to Pages publishing configurations** (e.g., `main` and `/docs`). They must never be treated as repository-wide default branches or typical repository physical layouts.
*   `publishingSourceSummary`: Strictly a **display string** aggregating branch and directories to construct simple visual labels. Never parse this in machine workflows.
*   `pagesPublic`: Raw Pages privacy parameter representing authorization restrictions.

### 3. Custom Domain State Handling
*   `protectedDomainState`: **Corresponds strictly to GitHub Pages custom-domain ownership security settings** rather than generic SSL dns protections.
*   `pendingDomainUnverifiedAt`: Explicit unverified hold timestamp value.

### 4. Direct HTTPS Semantics
*   `httpsEnforced`: GitHub Pages specific redirect setting defining if HTTP calls automatically shift to TLS/SSL.

### 5. Health Check parameters
*   `healthStatus`: **Indicates Pages target-domain DNS/SSL routing health check results**. It must never be conflated with the application Express server healthz probes (`/healthz`).

---

## Part 4: Findings, Classifications, & Diagnostics

### 1. Status Classifications (`classification`)
Classifications represent a multi-tag array documenting state outcomes:
*   `pages_disabled`: Static pages hosting is not configured on this repository.
*   `pages_disabled_or_unavailable`: Pages settings cannot be resolved.
*   `pages_enabled_no_custom_domain`: Pages is working, utilizing standard `*.github.io` names.
*   `custom_domain_configured`: Custom CNAME registered but verification is unconfirmed.
*   `custom_domain_verified`: DNS handshake passed.
*   `custom_domain_pending`: Domain on lock queue.
*   `custom_domain_unverified_or_unknown`: Verification state is unconfirmed or not reported.
*   `https_certificate_ok`: Approved certificate, https redirection is active.
*   `https_certificate_problem_or_unknown`: Provisioning error or unknown cert validation.
*   `https_not_enforced`: Valid cert is present but redirect enforcement is disabled.

### 2. Failure Classifications (`errorClassification`)
Determines the reason behind fetch audit blockers:
*   `token_invalid_or_expired`: Clear credentials validation issue.
*   `insufficient_permissions`: Missing required repository/pages scopes.
*   `sso_required`: Single-Sign-On authorization has not been granted.
*   `repository_not_found_or_no_access`: Private repo blocked or resource deleted.
*   `pages_not_enabled`: Standard raw endpoints returned 404 Pages deactivated.

---

## Part 5: Schema Identity Policy & URN UUIDs

To allow third-party integrations and automatic pipelines to parse auditor reports safely without structural ambiguity, this project adopts a strict **Schema Identity Policy**.

### 1. Unified Urn Identifier Specification (`schemaId`)
Each published JSON Schema is bound permanently to a stable, unique machine ID `$id` using the UUIDv4 standard:
- **Identifier format**: `urn:uuid:<uuid-v4>`

The identification boundaries assigned are:
*   **V1 Schema (Flat Layout)**:
    - `schemaVersion`: `github-pages-auditor.export.v1`
    - `schemaId` / JSON Schema `$id`: `urn:uuid:ef46fd93-424a-4e2a-8f5b-df97e28b2be1`
*   **V2 Schema (Nested Layout)**:
    - `schemaVersion`: `github-pages-auditor.export.v2`
    - `schemaId` / JSON Schema `$id`: `urn:uuid:7d0f98be-8cba-49c5-84dc-66914b5da3f2`

### 2. Rigorous Non-Negotiable Rules
*   **Opaque and Stable**: External systems must treat the URN as a globally stable, opaque schema identifier. Do not attempt to derive or extract meaning from the UUID value.
*   **Explicitly Out of Scope**: Resolving, dereferencing, or looking up schemas via remote host endpoints is **explicitly out of scope**. No remote hosting, lookup endpoints, or server-side mapping mechanisms are implemented.
*   **Strict Generation Guard**: These identifiers are generated once per version and committed. They must **never** be generated or altered dynamically based on audit identifiers, session tokens, version updates, or execution timestamps.

