export interface GitHubTokenDocument {
  // Currently stored fields
  token: string; // The literal PAT is stored here by the React client
  updatedAt: unknown; // Firebase FieldValue serverTimestamp

  // Note: 'id' is conventionally the doc name (e.g. 'default') and not inside the body.
  // Note: metadata like maskedToken, addedAt are not currently generated or required by the React form.

  // Anonymous Lifecycle fields (optional)
  createdAt?: string; // ISO-8601 creation timestamp
  expiresAt?: string; // ISO-8601 expiration timestamp
  lastSeenAt?: string; // ISO-8601 last activity timestamp
}

export interface AuditRunDocument {
  // Currently stored fields
  results: any[]; // The results array returned from the backend audit
  createdAt: unknown; // Firebase FieldValue serverTimestamp

  // Future/Ideal metadata below (not currently stored by Dashboard.tsx)
  /*
  id: string;
  startedAt: string;
  completedAt?: string;
  repositoryCount: number;
  pagesEnabledCount: number;
  customDomainCount: number;
  httpsProblemCount: number;
  */
}

export interface RepositoryResultDocument {
  // Currently, we don't store repositories in an isolated subcollection per repo, they are inside the audit run.
  // This is a placeholder for future iterations.
  [key: string]: any;
}

export interface AnonymousSessionDocument {
  // Currently we use anonymous sessions implicitly through Firebase Auth
  // We store tokens under `githubPagesAuditorV2/{environment}/anonymousSessions/{uid}/githubTokens/default`
  // We also save settings documents under `githubPagesAuditorV2/{environment}/anonymousSessions/{uid}/settings`
  [key: string]: any;
  createdAt?: string; // ISO-8601 creation timestamp
  expiresAt?: string; // ISO-8601 expiration timestamp
  lastSeenAt?: string; // ISO-8601 last activity timestamp
}

export interface NavigationSettingDocument {
  lastPath: string; // The last visited URL path
  updatedAt: unknown; // Firebase FieldValue serverTimestamp
  createdAt?: string; // ISO-8601 creation timestamp for anonymous users
  expiresAt?: string; // ISO-8601 expiration timestamp for anonymous users
  lastSeenAt?: string; // ISO-8601 last activity timestamp for anonymous users
}

export interface TokenMetadataSettingDocument {
  tokenType: 'classic' | 'fine_grained' | 'unknown'; // Derived PAT token type
  updatedAt: unknown; // Firebase FieldValue serverTimestamp
  createdAt?: string; // ISO-8601 creation timestamp for anonymous users
  expiresAt?: string; // ISO-8601 expiration timestamp for anonymous users
  lastSeenAt?: string; // ISO-8601 last activity timestamp for anonymous users
}

export interface LauncherLayoutSettingDocument {
  schemaVersion: string; // "github-pages-auditor.launcherLayout.v1"
  layoutMode: string; // "ordered_grid"
  orderedSiteIds: string[]; // Ordered list of repo ID or full_name strings
  hiddenSiteIds: string[]; // For filtering hidden tiles
  updatedAt: unknown; // Firebase FieldValue serverTimestamp
  createdAt?: string; // ISO-8601 creation timestamp for anonymous users
  expiresAt?: string; // ISO-8601 expiration timestamp for anonymous users
  lastSeenAt?: string; // ISO-8601 last activity timestamp for anonymous users
}
