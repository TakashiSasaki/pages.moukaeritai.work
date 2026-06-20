# Firebase, Firestore, and Cloud Functions Appendix

This document extends "docs/spec-initial.md".

The initial specification remains authoritative. This appendix provides Firebase Authentication, Firestore namespace, anonymous guest mode, and Cloud Functions deployment details.

1. Firebase Authentication Contract

We support and allow only these Firebase Authentication providers:

Google provider
Anonymous provider

Google provider is for persistent users.
Anonymous provider is for non-persistent guest mode.

Explicitly forbidden and permanently out of scope:

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

GitHub OAuth and GitHub App authentication are not planned and must not be implemented.

The app must not use Firebase Authentication to obtain GitHub API access.

GitHub API access is PAT-only. Firebase Auth is strictly for application user identity, never for GitHub workspace access.

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
The app may store a session-scoped PAT under the anonymous session namespace if necessary.
Cleanup of anonymous PATs is a planned follow-up.

Anonymous data must have expiration metadata if persisted.

Required field:

expiresAt

Anonymous cleanup strategy must be documented in "AGENTS.md".

Anonymous-to-Google upgrade or credential linking is not required in Version 1. Do not implement automatic migration unless the specification is updated.

5. Firestore Persistence (V2 / MVP)

Firebase Firestore is used for persistent PAT storage and Audit cache persistence. 
The keys and documents are fully guarded strictly using standard Firebase Client SDK usage with `firestore.rules` where `request.auth.uid == uid`, completely locking it down securely per user.

6. Data Models for Pending/Future Firestore Implementation

(Note: See `src/schema/firestoreTypes.ts` for the current, provisional schema actually used.)


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

Represents persistent PAT metadata.

CURRENT implementation stores:

{
  "token": "stored natively by React client",
  "updatedAt": "timestamp"
}

FUTURE/IDEAL fields (Not Currently Implemented):

{
  "uid": "firebase-auth-uid",
  "name": "Main GitHub PAT",
  "tokenType": "fine_grained | classic | unknown",
  "githubLogin": "octocat",
  "githubUserId": 123456,
  "fingerprint": "display-safe-token-fingerprint",
  "encryptedToken": "implementation-defined-ciphertext-or-secret-reference",
  "tokenStorageVersion": "v2",
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

PAT is natively stored in Firestore by the React client. However, the backend proxy must never log or return the PAT in plaintext.

AuditRun

Represents one audit execution.

CURRENT implementation stores:

{
  "results": ["array of audit result objects"],
  "createdAt": "timestamp"
}

FUTURE/IDEAL fields (Not Currently Implemented):

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

Represents one repository result.

CURRENT IMPLEMENTATION: Repositories are stored inline within the `results` array of the AuditRun document. Repository subcollections are NOT currently implemented.

FUTURE/IDEAL fields (Not Currently Implemented standalone):

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

Firestore is accessed directly via the frontend Firebase Client SDK. The rules MUST strictly isolate data tenanting per-UID:
- Clients can exclusively read/write to `githubPagesAuditorV2/{environment}/users/{uid}` and `githubPagesAuditorV2/{environment}/anonymousSessions/{uid}` endpoints where `uid == request.auth.uid`.

The active `firestore.rules` implemented is:

```firestore
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    // Standard Google Authenticated Users
    match /githubPagesAuditorV2/{environment}/users/{uid}/githubTokens/default {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }

    match /githubPagesAuditorV2/{environment}/users/{uid}/audits/{auditId} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }

    // Anonymous/Guest Session Users 
    match /githubPagesAuditorV2/{environment}/anonymousSessions/{uid}/githubTokens/default {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }

    // Catch-all safety rule: deny all other paths by default
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

9. Cloud Functions Usage

Cloud Functions are optional.

If not used, write this in "AGENTS.md":

Cloud Functions are not used by this application.
No Firebase Functions deployment is required.
Do not run firebase deploy --only functions for this app.

If used, rules are mandatory.

Function prefix:

gpaV2

Allowed examples:

gpaV2Api
gpaV2RunAudit
gpaV2CleanupAnonymousSessions
gpaV2ExportAuditJson

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

firebase deploy --only functions:gpaV2Api
firebase deploy --only functions:gpaV2Api,functions:gpaV2RunAudit,functions:gpaV2CleanupAnonymousSessions

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

Documents confirm prefix 'githubPagesAuditorV2' and exact path routing respects `uid` checks perfectly under `rules`.

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
