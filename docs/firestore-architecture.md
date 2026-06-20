# Firestore Architecture and Path Management

This document details the strategies and constraints around Firestore pathing, environment segregation, and document provisioning patterns (including phantom documents) implemented in our application.

## 1. Environment Switching

The application shares a single Firebase project and Firestore database for both development and production. To securely and cleanly separate data, we employ an environment-based path segregation strategy.

The logic for determining the environment is centralized in `src/lib/firestorePaths.ts`. 

- When the application is built for production (`import.meta.env.MODE === 'production'`), data is written to paths beginning with `githubPagesAuditorV2/production/...`.
- When the application is run in development mode (`import.meta.env.MODE === 'development'` or any other value), data is written to paths beginning with `githubPagesAuditorV2/development/...`.

For example, a user's GitHub tokens will be written to:
`githubPagesAuditorV2/{environment}/users/{uid}/githubTokens/default`

This ensures that development builds and tests running locally or in development cloud contexts do not pollute production data.

## 2. Phantom Documents

In Firestore, documents are technically not required to exist for subcollections to exist beneath them. These are commonly referred to as **Phantom Documents**.

Because the Firebase Client SDK directly targets leaf node documents (such as token or setting documents deep within a nested hierarchy) without an explicit setup action for parent structures, the parent wrapper nodes may exist as phantom documents.

For example, when writing to:
`githubPagesAuditorV2/{environment}/users/{uid}/githubTokens/default`

The following "parent" documents might only exist as phantom documents (they appear italicized in the Firebase Console):
- The collection wrapper document: `githubPagesAuditorV2/{environment}`
- The user account document: `githubPagesAuditorV2/{environment}/users/{uid}`

### 2.1 Storage Implications
Phantom documents themselves consume no storage overhead and do not incur additional write costs because they aren't explicitly created.
If we query `doc(db, 'githubPagesAuditorV2', environment, 'users', uid).get()`, it will return a snapshot indicating that the document does not exist, even if subcollections under it do exist.

### 2.2 Security Rules Handling
Phantom documents present no routing issues for Firestore Security Rules. The `firestore.rules` can securely match and bind against `request.auth.uid == uid` natively because Firebase Security rules evaluate the requested path strings linearly regardless of whether the intermediate wrapper documents physically exist.

## 3. Reference Implementations

All path construction must be requested through `src/lib/firestorePaths.ts` natively. Direct path string manipulations inside React components are prohibited. 

**Valid Path Retrievers:**
- `getEnvironmentName(mode)`
- `getGithubTokenCollectionPath(environment, uid, isAnonymous)`
- `getGithubTokenDocPath(environment, uid, isAnonymous, tokenId)`
- `getAuditCollectionPath(environment, uid)`
- `getUserSettingsCollectionPath(environment, uid, isAnonymous)`
- `getUserSettingDocPath(environment, uid, isAnonymous, settingId)`
