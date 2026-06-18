# Firebase, Firestore, and Cloud Functions Appendix

This document extends "docs/spec-initial.md".

The initial specification remains authoritative. This appendix provides Firebase Authentication, Firestore namespace, anonymous guest mode, and Cloud Functions deployment details.

1. Firebase Authentication Contract

Version 1 allows only these Firebase Authentication providers:

Google provider
Anonymous provider

Google provider is for persistent users.

Anonymous provider is for non-persistent guest mode.

Forbidden providers:

Firebase GitHub provider
email/password
email link
phone
Apple
Facebook
Microsoft
SAML
custom OIDC
any other persistent external provider

GitHub OAuth must not be implemented.

The app must not use Firebase Authentication to obtain GitHub API access.

GitHub API access is PAT-only.

2. Firebase ID Token Handling

Frontend obtains Firebase ID token after sign-in.

Backend protected APIs must receive:

Authorization: Bearer <Firebase ID Token>

Backend must verify:

token signature
token expiration
issuer
audience / Firebase project
uid
provider type

Use Firebase UID as tenant boundary.

Do not use email address as primary identity key.

Do not log Firebase ID tokens.

3. Google Persistent User Mode

Google-authenticated users may:

register persistent GitHub PAT records
list stored PAT metadata
validate stored PATs
delete stored PATs
create audit runs
store audit history
view past audit results
export CSV
export JSON

Google user data is keyed by Firebase UID.

Google account email may be displayed but must not be used as the primary key.

4. Anonymous Guest Mode

Anonymous users are non-persistent guest users.

Allowed by default:

one-shot audit execution
temporary in-browser result display
temporary server-side job state if necessary
CSV/JSON export download during active session

Not allowed by default:

persistent PAT storage
long-term audit history
scheduled audits
recurring audits
cross-device continuation
sharing saved results

Anonymous user PAT handling:

Anonymous user may input PAT for one-shot audit.
Do not create persistent GitHubToken records for anonymous users by default.
Do not store anonymous PAT plaintext.
If temporary server-side token retention is necessary, keep duration minimal.
Delete temporary token material after audit completion, failure, cancellation, or expiration.

Anonymous data must have expiration metadata if persisted.

Required field:

expiresAt

Anonymous cleanup strategy must be documented in "AGENTS.md".

Anonymous-to-Google upgrade or credential linking is not required in Version 1. Do not implement automatic migration unless the specification is updated.

5. Firestore as First-Choice Persistence

If server-side persistence is needed, Cloud Firestore is the first-choice database.

Firestore is not mandatory if the implementation has a strong reason to choose another persistence layer. If Firestore is not used, document the alternative and rationale in "AGENTS.md".

If Firestore is used, all collection paths must be app-specific.

Do not use generic top-level collections directly.

Forbidden examples:

users
tokens
jobs
logs
auditRuns
repositories
exports
settings

Recommended namespace:

githubPagesAuditorV1/{environment}/users/{uid}
githubPagesAuditorV1/{environment}/users/{uid}/githubTokens/{tokenId}
githubPagesAuditorV1/{environment}/users/{uid}/auditRuns/{auditRunId}
githubPagesAuditorV1/{environment}/users/{uid}/auditRuns/{auditRunId}/repositories/{repositoryResultId}
githubPagesAuditorV1/{environment}/users/{uid}/auditRuns/{auditRunId}/domainSummaries/{domainKey}
githubPagesAuditorV1/{environment}/anonymousSessions/{anonymousUid}
githubPagesAuditorV1/{environment}/anonymousSessions/{anonymousUid}/auditRuns/{auditRunId}
githubPagesAuditorV1/{environment}/appAuditLogs/{logId}

Allowed environments:

dev
staging
prod

The exact path may differ, but must satisfy:

app-specific namespace
environment separation
Firebase UID ownership
anonymous and persistent data separation
PAT storage protection
documented in AGENTS.md

6. Recommended Firestore Entities

User

Represents a persistent Google user.

Suggested fields:

{
  "uid": "firebase-auth-uid",
  "email": "user@example.com",
  "displayName": "User Name",
  "photoURL": "https://example.invalid/photo.png",
  "provider": "google.com",
  "createdAt": "timestamp",
  "updatedAt": "timestamp",
  "lastLoginAt": "timestamp",
  "disabledAt": null
}

AnonymousSession

Represents a temporary anonymous guest session.

Suggested fields:

{
  "anonymousUid": "firebase-anonymous-uid",
  "provider": "anonymous",
  "createdAt": "timestamp",
  "lastSeenAt": "timestamp",
  "expiresAt": "timestamp",
  "auditRunCount": 0,
  "status": "active | expired | deleted"
}

GitHubToken

Represents persistent PAT metadata for Google users only.

Must not contain PAT plaintext.

Suggested fields:

{
  "uid": "firebase-auth-uid",
  "name": "Main GitHub PAT",
  "tokenType": "fine_grained | classic | unknown",
  "githubLogin": "octocat",
  "githubUserId": 123456,
  "fingerprint": "display-safe-token-fingerprint",
  "encryptedToken": "implementation-defined-ciphertext-or-secret-reference",
  "tokenStorageVersion": "v1",
  "defaultAffiliation": "owner,collaborator,organization_member",
  "defaultVisibility": "all",
  "allowHealthCheck": false,
  "validationStatus": "valid | invalid | insufficient_permissions | unknown",
  "lastValidatedAt": "timestamp",
  "lastUsedAt": "timestamp",
  "createdAt": "timestamp",
  "updatedAt": "timestamp",
  "revokedAt": null
}

"encryptedToken" may be:

ciphertext stored in Firestore
secret reference to Secret Manager or another secure store
implementation-specific sealed token record

PAT plaintext is forbidden.

AuditRun

Represents one audit execution.

Suggested fields:

{
  "uid": "firebase-auth-uid",
  "userMode": "google | anonymous",
  "githubTokenId": "token-id-or-null",
  "status": "queued | running | completed | failed | paused | cancelled",
  "requestedOptions": {
    "affiliation": "owner,collaborator,organization_member",
    "visibility": "all",
    "includeArchived": true,
    "includeDisabled": true,
    "strictPagesCheck": false,
    "includeHealthCheck": false,
    "ownerFilter": null
  },
  "startedAt": "timestamp",
  "finishedAt": "timestamp",
  "expiresAt": "timestamp-or-null",
  "repoCount": 0,
  "successCount": 0,
  "errorCount": 0,
  "rateLimitUsed": 0,
  "rateLimitRemaining": null,
  "rateLimitResetAt": null,
  "errorSummary": {}
}

Anonymous audit runs must have "expiresAt".

RepositoryResult

Represents one repository result within an audit run.

Suggested fields:

{
  "uid": "firebase-auth-uid",
  "auditRunId": "audit-run-id",
  "githubRepoId": 123456789,
  "ownerLogin": "owner",
  "repoName": "repo",
  "fullName": "owner/repo",
  "private": false,
  "visibility": "public",
  "archived": false,
  "disabled": false,
  "fork": false,
  "defaultBranch": "main",
  "hasPages": true,
  "repositoryHtmlUrl": "https://github.com/owner/repo",
  "repositoryTopUrl": "https://github.com/owner/repo",
  "pagesSettingsUrl": "https://github.com/owner/repo/settings/pages",
  "createdAtGitHub": "timestamp",
  "updatedAtGitHub": "timestamp",
  "pushedAtGitHub": "timestamp",

  "pagesEnabled": true,
  "pagesStatus": "built",
  "pagesHtmlUrl": "https://owner.github.io/repo/",
  "buildType": "legacy",
  "deploymentMethod": "branch_root",
  "sourceBranch": "main",
  "sourcePath": "/",
  "publishingSourceSummary": "main:/",

  "customDomain": null,
  "customDomainConfigured": false,
  "protectedDomainState": null,
  "pendingDomainUnverifiedAt": null,
  "httpsCertificateState": "approved",
  "httpsCertificateDescription": null,
  "httpsCertificateDomains": [],
  "httpsCertificateExpiresAt": null,
  "httpsEnforced": true,

  "healthStatus": "not_requested",
  "classification": [
    "pages_enabled_no_custom_domain",
    "pages_deploy_method_branch_root"
  ],
  "errorClassification": null,
  "createdAt": "timestamp",
  "updatedAt": "timestamp",
  "expiresAt": "timestamp-or-null"
}

Anonymous results must have "expiresAt" if stored server-side.

DomainSummary

Represents aggregation by custom domain.

Suggested fields:

{
  "uid": "firebase-auth-uid",
  "auditRunId": "audit-run-id",
  "domain": "docs.example.com",
  "repositoryCount": 1,
  "repositories": [
    {
      "fullName": "owner/repo",
      "repositoryTopUrl": "https://github.com/owner/repo",
      "pagesSettingsUrl": "https://github.com/owner/repo/settings/pages"
    }
  ],
  "hasDuplicate": false,
  "hasUnverified": false,
  "hasHttpsProblem": false,
  "hasDnsProblem": false,
  "createdAt": "timestamp"
}

AppAuditLog

Stores application audit events.

Must not include:

PAT plaintext
GitHub Authorization header
Firebase ID token
encryption keys
session secrets

Suggested event types:

login_success
login_failure
anonymous_session_created
pat_registered
pat_validated
pat_deleted
audit_run_created
audit_run_completed
audit_run_failed
export_created
admin_action

7. Firestore Index Considerations

Repository result list may need composite indexes for:

auditRunId + ownerLogin
auditRunId + customDomainConfigured
auditRunId + protectedDomainState
auditRunId + deploymentMethod
auditRunId + buildType
auditRunId + sourceBranch
auditRunId + sourcePath
auditRunId + httpsCertificateState
auditRunId + errorClassification
auditRunId + updatedAt
uid + createdAt for audit runs

Document required indexes in "AGENTS.md".

8. Firestore Security Requirements

If frontend accesses Firestore directly, Security Rules must enforce UID ownership.

However, Version 1 should prefer backend-only access for sensitive data.

Mandatory:

PAT storage records must not be client-readable.
PAT storage records must not be client-writable unless encryption is explicitly client-side and documented.
User A must not read User B data.
Anonymous user must not read Google user data.
Google user must not read another anonymous user data.

If backend-only Admin SDK access is used, backend code must enforce the same ownership rules.

9. Cloud Functions Usage

Cloud Functions are optional.

If not used, write this in "AGENTS.md":

Cloud Functions are not used by this application.
No Firebase Functions deployment is required.
Do not run firebase deploy --only functions for this app.

If used, rules are mandatory.

Function prefix:

gpaV1

Allowed examples:

gpaV1Api
gpaV1RunAudit
gpaV1CleanupAnonymousSessions
gpaV1ExportAuditJson

Forbidden generic names:

api
runAudit
cleanup
exportJson
scheduledJob
webhook

Forbidden deploy commands against shared project:

firebase deploy
firebase deploy --only functions

Preferred deploy commands:

firebase deploy --only functions:gpaV1Api
firebase deploy --only functions:gpaV1Api,functions:gpaV1RunAudit,functions:gpaV1CleanupAnonymousSessions

Do not:

delete functions outside the app prefix
run functions:delete without target confirmation
use --force as a default operation
rename functions in a way that implicitly deletes existing functions
remove other apps' functions from source and deploy blindly

Document in "AGENTS.md":

Cloud Functions usage: used / not used
function source directory
codebase name if any
owned function names
deploy command
delete/rename/region-change procedure

10. Firebase-Related Test Requirements

Authentication tests:

Unauthenticated protected API returns 401.
Valid Firebase ID token is accepted.
Expired Firebase ID token is rejected.
Token from unexpected Firebase project is rejected.
Google user is accepted for persistent endpoints.
Anonymous user is accepted only for guest-mode endpoints.
GitHub OAuth flow does not exist.
Firebase GitHub provider is not used.

Tenant isolation tests:

User A cannot access User B tokens.
User A cannot access User B audit runs.
User A cannot access User B repository results.
Anonymous user cannot access Google user persistent data.
Google user cannot access another anonymous user's temporary data.

Firestore namespace tests:

Firestore paths use app-specific namespace.
No generic top-level users/tokens/auditRuns collections are used directly.
Persistent user data and anonymous temporary data are separated.
Anonymous temporary data has expiresAt.
PAT storage records are not client-readable.

Cloud Functions safety tests, if Cloud Functions are used:

All function names use app prefix.
Documented deploy command uses explicit --only function list.
No script runs bare firebase deploy against shared project.
No script runs firebase deploy --only functions without explicit approval.
No script deletes functions outside app prefix.
No script uses functions:delete --force as default operation.

11. AGENTS.md Required Updates

"AGENTS.md" must document:

Firebase project id
enabled Firebase Auth providers
Firestore used / not used
Firestore namespace root
environment document name
persistent user path
anonymous temporary path
PAT storage path or secret reference path
anonymous cleanup strategy
Cloud Functions used / not used
Cloud Functions prefix if used
Cloud Functions deploy command if used

Whenever these change, update "AGENTS.md" in the same commit.
