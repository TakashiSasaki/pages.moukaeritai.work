# GitHub API Appendix

This document extends `docs/spec-initial.md`.

The initial specification remains authoritative. This appendix provides the detailed GitHub REST API contract for implementation. Do not add GitHub API endpoints outside this document unless the specification and "AGENTS.md" are both updated.

1. GitHub API Base URL and Required Headers

Base URL:

https://api.github.com

Every GitHub REST API request made by this application must be executed server-side and must include headers equivalent to:

Accept: application/vnd.github+json
Authorization: Bearer <PAT>
X-GitHub-Api-Version: 2026-03-10
User-Agent: <application-name>

"<PAT>" must be either:
- fine-grained personal access token
- personal access token classic

GitHub OAuth and GitHub App authentication are not planned for this project. They are permanently out of scope.

The application must not use and does not support:
- GitHub OAuth token
- GitHub App installation token
- GitHub App user access token
- GitHub App JWT
- GitHub Actions "GITHUB_TOKEN"

The browser owns the PAT copy. The React frontend stores PATs in Firestore using Firebase Client SDK. The backend receives the PAT temporarily through `x-temp-pat` only for the duration of GitHub API calls. The backend must not return PAT plaintext to the browser, and must never log the PAT in plaintext.

2. Endpoint Allowlist

Allowed standard endpoints:

GET /user
GET /user/repos
GET /repos/{owner}/{repo}/pages

Allowed optional endpoints:

GET /repos/{owner}/{repo}/pages/health
GET /rate_limit

Organization Enumeration endpoint:

GET /orgs/{org}/repos

Forbidden endpoint categories:

All GitHub write endpoints
All GitHub Pages write endpoints
All repository settings write endpoints
All GitHub Actions workflow endpoints
Any arbitrary user-supplied GitHub API URL

Explicitly forbidden examples:

POST /repos/{owner}/{repo}/pages
PUT /repos/{owner}/{repo}/pages
DELETE /repos/{owner}/{repo}/pages
POST /repos/{owner}/{repo}/pages/builds
POST /repos/{owner}/{repo}/pages/deployments
PATCH /repos/{owner}/{repo}
PUT /repos/{owner}/{repo}
DELETE /repos/{owner}/{repo}

The backend must not expose a generic GitHub API proxy.

3. Token Validation: GET /user

Purpose:

Validate that the submitted PAT is accepted by GitHub and obtain the GitHub user identity associated with the PAT.

Endpoint:

GET /user

Supported token types:

fine-grained personal access token
personal access token classic

Expected status codes:

200 OK
401 Requires authentication
403 Forbidden

Fields to store:

login
id
node_id
html_url
type
site_admin

Implementation rules:

Use this endpoint during PAT registration and revalidation.

Do not treat successful GET /user as proof that repository listing or Pages access will work.

After GET /user, call GET /user/repos?per_page=1 before marking the PAT usable for audit.

Store the user-selected token type as metadata.

Token string format may be used only as UI assistance. Authorization decisions must rely on actual API results.

4. Repository Enumeration: GET /user/repos

Purpose:

List repositories explicitly accessible to the authenticated GitHub user.

Endpoint:

GET /user/repos

Recommended query parameters:

visibility=all
affiliation=owner,collaborator,organization_member
sort=full_name
direction=asc
per_page=100
page=<page-number>

Allowed query parameters:

visibility: all | public | private
affiliation: comma-separated subset of owner, collaborator, organization_member
sort: created | updated | pushed | full_name
direction: asc | desc
per_page: integer, max 100
page: integer
since: ISO 8601 timestamp, YYYY-MM-DDTHH:MM:SSZ
before: ISO 8601 timestamp, YYYY-MM-DDTHH:MM:SSZ

Parameter constraint:

Do not combine type with visibility or affiliation.

Fine-grained PAT guidance:

Metadata repository permission: read
Repository access must include the target repositories.

Classic PAT guidance:

Use scopes sufficient to list the target repositories.
For private repository auditing, repo scope is the practical baseline.

Expected status codes:

200 OK
304 Not Modified
401 Requires authentication
403 Forbidden
422 Validation failed, or endpoint has been spammed

Repository fields to store or map:

id
node_id
name
full_name
owner.login
owner.id
owner.type
private
visibility
fork
archived
disabled
html_url
url
default_branch
has_pages
permissions.admin
permissions.push
permissions.pull
created_at
updated_at
pushed_at

Derived fields:

repositoryTopUrl = repository.html_url
pagesSettingsUrl = https://github.com/{owner.login}/{name}/settings/pages

Pagination rules:

Use Link header when available.
Continue until there is no rel="next" link.
Do not assume that fewer than per_page results is the only termination condition.

Implementation rules:

Use has_pages as a fast filter in standard mode.

In standard mode, call GET /repos/{owner}/{repo}/pages only if has_pages=true.

In strict mode, call GET /repos/{owner}/{repo}/pages for every returned repository and classify 404 explicitly.

Store repository metadata as a snapshot tied to the audit run.

Every repository row must include repositoryTopUrl and pagesSettingsUrl.

Do not expose repositories from one Firebase UID to another.

5. Organization Enumeration: GET /orgs/{org}/repos

Purpose:

List repositories for a specific Organization.

Endpoint:

GET /orgs/{org}/repos

Allowed query parameters:

type: all | public | private | forks | sources | member
sort: created | updated | pushed | full_name
direction: asc | desc
per_page: integer, max 100
page: integer

Recommended parameters:

type=all
sort=full_name
direction=asc
per_page=100
page=<page-number>

Implementation rules:

Use this endpoint only when the user explicitly chooses an organization-specific scan.

Do not replace GET /user/repos with this endpoint unless the workflow requires organization-specific enumeration.

Respect repository visibility and permissions returned by GitHub.

6. GitHub Pages Site Information: GET /repos/{owner}/{repo}/pages

Purpose:

Fetch GitHub Pages configuration for a repository, including custom domain state, HTTPS state, and deployment method fields.

Endpoint:

GET /repos/{owner}/{repo}/pages

Path parameters:

owner: repository owner login, case-insensitive
repo: repository name without .git, case-insensitive

Fine-grained PAT permission:

Pages repository permission: read

Classic PAT scope:

repo

Expected status codes:

200 OK
404 Resource not found

Response fields to store:

url
status
cname
custom_404
html_url
build_type
source.branch
source.path
public
pending_domain_unverified_at
protected_domain_state
https_certificate.state
https_certificate.description
https_certificate.domains
https_certificate.expires_at
https_enforced

Expected "build_type" values:

legacy
workflow

Expected "source.path" values:

/
/docs

Unknown values must be stored and surfaced.

7. Pages Classification Rules

Pages enabled:

If GET /repos/{owner}/{repo}/pages returns 200:
  pagesEnabled = true

If GET /repos/{owner}/{repo}/pages returns 404 for a repository returned by GET /user/repos:
  pagesEnabled = false
  deploymentMethod = "not_applicable"
  classification includes "pages_disabled_or_unavailable"

Custom domain:

If cname is null or empty:
  customDomainConfigured = false
  classification includes "pages_enabled_no_custom_domain"

If cname is non-empty:
  customDomainConfigured = true
  customDomain = cname
  classification includes "custom_domain_configured"

Domain verification/protection:

If protected_domain_state == "verified":
  classification includes "custom_domain_verified"

If protected_domain_state is absent or not "verified":
  classification includes "custom_domain_unverified_or_unknown"

If pending_domain_unverified_at is non-null:
  classification includes "custom_domain_pending"

HTTPS:

If https_certificate.state == "approved":
  classification includes "https_certificate_ok"

If https_certificate.state is absent or not "approved":
  classification includes "https_certificate_problem_or_unknown"

If https_enforced == false:
  classification includes "https_not_enforced"

Deployment method:

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

Publishing source summary:

If deploymentMethod == "workflow":
  publishingSourceSummary = "GitHub Actions workflow"

If deploymentMethod is branch-based:
  publishingSourceSummary = "{source.branch}:{source.path}"

If unknown:
  publishingSourceSummary = "Unknown Pages deployment method"

If not_applicable:
  publishingSourceSummary = null

8. Optional DNS/HTTPS Health Check

Endpoint:

GET /repos/{owner}/{repo}/pages/health

Purpose:

Fetch GitHub’s DNS health check for the CNAME configured for a GitHub Pages site.

This endpoint is optional and disabled by default.

Call only when:

User explicitly enabled health check.
Pages API returned non-empty cname.

Permission note:

This endpoint may require stronger permissions than standard read-only audit.
Fine-grained PAT may require Administration write and Pages write.
Classic PAT may require repo scope and appropriate repository role.

Expected status codes:

200 OK
202 Empty response; asynchronous health check started
400 Custom domains are not available for GitHub Pages
404 Resource not found
422 There is not a CNAME for this page

Polling rule:

If 202 is returned, retry with bounded polling.
Suggested default: wait 2 seconds, retry up to 5 times.
If still not 200, classify as health_pending.

Health classification:

health_ok if:
  dns_resolves == true
  is_valid_domain == true
  is_pointed_to_github_pages_ip == true
  is_served_by_pages == true
  responds_to_https == true
  https_error == null

health_dns_problem if any:
  dns_resolves == false
  is_valid_domain == false
  is_pointed_to_github_pages_ip == false
  is_non_github_pages_ip_present == true
  is_served_by_pages == false

health_https_problem if any:
  responds_to_https == false
  https_error is non-null
  is_https_eligible == false
  caa_error is non-null

health_https_not_enforced if:
  enforces_https == false

The application must remain read-only even if the token has write-capable permissions.

9. Optional Rate Limit Endpoint

Endpoint:

GET /rate_limit

Use only for diagnostics.

Prefer rate limit headers from normal GitHub API responses.

Do not poll this endpoint frequently.

10. Rate Limit Handling

Inspect these headers on every GitHub API response when present:

x-ratelimit-limit
x-ratelimit-remaining
x-ratelimit-used
x-ratelimit-reset
x-ratelimit-resource
retry-after

Rules:

If status is 403 or 429 and x-ratelimit-remaining == 0:
  classify as primary_rate_limited
  do not retry until x-ratelimit-reset

If status is 403 or 429 and retry-after is present:
  classify as secondary_rate_limited
  do not retry until retry-after seconds have elapsed

If status is 403 or 429 and response body indicates secondary rate limit:
  classify as secondary_rate_limited
  wait or pause the audit run

Do not continue aggressive requests while rate-limited.

Use bounded retries only.

Recommended concurrency:

Per-user active audit runs: 1
Per-user GitHub API concurrency within a run: low, e.g. 3
Global GitHub API concurrency: deployment-configured
Never approach 100 concurrent GitHub API requests.

11. Error Classification

Normalize GitHub API errors.

401:
  token_invalid_or_expired

403:
  insufficient_permissions
  sso_required
  classic_pat_sso_authorization_required
  fine_grained_pat_approval_required
  primary_rate_limited
  secondary_rate_limited
  forbidden_unknown

404:
  repository_not_found_or_no_access
  pages_not_enabled
  pages_resource_not_found
  classic_pat_sso_authorization_missing_possible

422:
  validation_failed
  health_no_cname
  endpoint_spam_or_abuse_protection

429:
  primary_rate_limited
  secondary_rate_limited

5xx:
  github_temporary_error

Disambiguation rules:

If GET /user fails with 401:
  PAT is invalid or expired.

If GET /user/repos fails with 403:
  inspect message and headers for rate limit, SSO, approval, or permission issue.

If classic PAT is used and Organization repositories are missing or 403/404 is returned:
  surface possible SAML SSO authorization issue.

If fine-grained PAT is used and Organization repositories are missing or 403 is returned:
  surface possible resource owner, repository selection, permission, or organization approval issue.

If repository was returned by GET /user/repos and Pages endpoint returns 404:
  treat as Pages disabled or Pages unavailable for that repository.

If repository was not returned by GET /user/repos and a repository-specific endpoint returns 404:
  treat as repository not found or no access.

12. Link Derivation Rules

Repository top link:

Prefer repository.html_url.
Fallback: https://github.com/{owner}/{repo}

GitHub Pages settings link:

https://github.com/{owner}/{repo}/settings/pages

Pages public link:

Prefer pages.html_url from GET /repos/{owner}/{repo}/pages.
Fallback only as display hint when necessary:
  https://{owner}.github.io/{repo}/

Rules:

Do not use settings link as an app-side write operation.
Do not assume the user can access settings link.
Do not scrape GitHub HTML settings pages.
Do not submit GitHub settings forms.

13. Forbidden GitHub API Usage Tests

Add tests proving:

POST /repos/{owner}/{repo}/pages cannot be called.
PUT /repos/{owner}/{repo}/pages cannot be called.
DELETE /repos/{owner}/{repo}/pages cannot be called.
POST /repos/{owner}/{repo}/pages/builds cannot be called.
GitHub Actions workflow API cannot be called.
Arbitrary user-supplied GitHub API URL cannot be called.
Frontend cannot pass Authorization header through to GitHub.

14. Best-Effort Site Metadata and Icon Fetching

During an audit session, when a repository has GitHub Pages enabled and provides a public "html_url", the backend performs a bounded, timeout-guarded site metadata collection to enrich visual displays:

### A. Collected Metadata Fields
- **faviconUrl**: The path/URL to the site's favicon, scanned from link tags (`rel="icon"`, `apple-touch-icon"`, or `shortcut icon"`).
- **manifestUrl**: The absolute URL to the site's web app manifest, defined in a `<link rel="manifest">` tag.
- **isPwa**: A boolean flag indicating whether the site qualifies as a Progressive Web App (PWA), determined by presence of icons and a standalone/fullscreen/minimal-ui display mode in its manifest.
- **pwaIconUrl**: Path to the preferred PWA icon (checks for 512x512, then 192x192, falling back to the first available) resolved relative to the manifest.
- **pwaName**: Standardized visual name retrieved from the manifest's name or short_name property.
- **pwaDisplayMode**: Display mode defined in the manifest (e.g., standalone, fullscreen, minimal-ui).

### B. Fallback & Best-Effort Resiliency
- If the HTTP fetch targeting the site HTML fails, or no custom icon is parsed, the backend falls back to resolving `"/favicon.ico"` against the page base URL.
- Manifest fetch or parse failures are handled silently, ensuring that manifest failures **never** fail the audit or repository classification.
- Metadata collection is treated as an optional, non-blocking visual enhancement.

### C. Security and Privacy Boundaries
- **No PAT leakage**: No personal access tokens or custom credentials are sent to the target GitHub Pages sites during these best-effort fetches.
- **Strictly Read-Only**: fetches utilize standard GET operations with a custom `User-Agent` (aligned with the package version, e.g., `GitHubPagesAuditor/1.6.19`) and have short timeouts (3.5s for HTML, 2.0s for Manifest).
- **Export Schema Isolation**: These fields are runtime/audit result presentation elements in the UI and are **not** present in the V2 JSON export schema or flat CSV export files.

