# Anonymous Session Lifecycle Management Wording & Operator Runbook
Version: `1.6.20` (Organization Scan Contract & Baseline Hardening)

## 1. Overview
The GitHub Pages Auditor provides an unauthenticated guest mode allowing users to perform non-persistent baseline audits using temporary Anonymous Sessions created directly via Firebase Authentication. 

Since these anonymous guest accounts accumulate temporary token settings and navigation preferences, managing their lifecycle prevents garbage documents from polluting the Firestore database.

In **Milestone 1.6.20**, the data structures have been fully upgraded to be **TTL-Ready**. All guest-created documents carry clean, standardized lifecycle fields.

---

## 2. The TTL-Ready Data Model
When an anonymous guest registers or saves a Personal Access Token (PAT) or settings, the payload is automatically annotated with explicit lifecycle values generated via `src/lib/anonymousSessionLifecycle.ts`.

### A. Lifecycle Fields
- **`createdAt`** (ISO-8601 String): The exact date and time the anonymous session resource was generated.
- **`lastSeenAt`** (ISO-8601 String): The last recorded active user transaction or write operation on the document.
- **`expiresAt`** (ISO-8601 String): The designated expiration time, calculated as `createdAt + ANONYMOUS_SESSION_TTL_MS` (Default TTL: **7 Days**).

### B. Impacted Firestore Collections & Documents
1. **GitHub PAT Configuration Document**
   - Path Template: `githubPagesAuditorV2/{environment}/anonymousSessions/{uid}/githubTokens/default`
   - Payload Additions:
     ```json
     {
       "token": "...",
       "updatedAt": { "seconds": 1718870400, "nanoseconds": 0 },
       "createdAt": "2026-06-20T12:00:00.000Z",
       "expiresAt": "2026-06-27T12:00:00.000Z",
       "lastSeenAt": "2026-06-20T12:00:00.000Z"
     }
     ```

2. **GitHub PAT Metadata settings Document**
   - Path Template: `githubPagesAuditorV2/{environment}/anonymousSessions/{uid}/settings/tokenMetadata`
   - Payload Additions: Matches layout of PAT configuration document.

---

## 3. Strict Security Boundaries
To preserve absolute zero-trust tenant isolation, the actual purging of expired records is strictly restricted.

### Why Client-Side Cleanup is Prohibited
Clients are completely denied broad querying or scanning permissions. The Firestore security rules enforce:
```javascript
match /githubPagesAuditorV2/{environment}/anonymousSessions/{uid}/{document=**} {
  allow read, write: if request.auth != null && request.auth.uid == uid;
}
```
Because a guest can only see their own records matching their exact `uid`, **clients cannot see, count, query, or delete other users' expired documents**. Global cleanups must run strictly as a privileged administrative process on the server side.

---

## 4. Operator Checklist: Enabling Automatic Purging
An operator can enable automatic physical purging of expired documents using Firestore's native Time-to-Live (TTL) feature or an administrative Cloud Function.

### Option A: Firestore Time-to-Live (TTL) Policy (Recommended)
Firestore can automatically delete documents of a given schema when a designated timestamp field is exceeded.

- [ ] **Step 1: Open Google Cloud Console**
  Navigate to the Google Cloud Console or Firebase Console for your project.
- [ ] **Step 2: Access TTL settings**
  Go to **Firestore > settings > Time-to-live (TTL)**.
- [ ] **Step 3: Enable TTL on target collections**
  Create a TTL rule with the following parameters:
  - Collection Group: `githubTokens`
  - Timestamp Field: `expiresAt`
- [ ] **Step 4: Repeat for Settings**
  Create a TTL rule for:
  - Collection Group: `settings`
  - Timestamp Field: `expiresAt`
- [ ] **Step 5: Verify Deletion Performance**
  Note that Firestore deletes expired documents best-effort (often within 72 hours of expiration without consuming write capacity).

### Option B: Scheduled Cleanup Cloud Function (Alternative)
For immediate, deterministic cleanup:
- [ ] Deploy a scheduled Node.js Cloud Function running daily (e.g. at `03:00 UTC`).
- [ ] Utilize the Firebase Admin SDK to bypass security rules.
- [ ] Query for all files under the path group `githubPagesAuditorV2/*/anonymousSessions/*` where `expiresAt <= now`.
- [ ] Delete matched documents in batches of 500.

---

## 5. Rollback Considerations
If the anonymous session lifecycle features introduce unwanted behavior, operators can safely revert:
- **Disabling Firestore TTL**: Deleting the TTL policy in the Firestore administrative console stops all automatically scheduled deletes immediately. No code deploy is required.
- **Client Fallbacks**: The frontend safely treats `createdAt`, `expiresAt`, and `lastSeenAt` as optional fields (guarded by type annotations); removing them has zero functional impact on persistent user account paths.
