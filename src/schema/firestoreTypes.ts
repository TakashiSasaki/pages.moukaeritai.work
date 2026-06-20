export interface GitHubTokenDocument {
  // Currently stored fields
  token: string; // The literal PAT is stored here by the React client
  updatedAt: unknown; // Firebase FieldValue serverTimestamp

  // Note: 'id' is conventionally the doc name (e.g. 'default') and not inside the body.
  // Note: metadata like maskedToken, addedAt are not currently generated or required by the React form.
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
  // We may store tokens under `githubPagesAuditorV2/{environment}/anonymousSessions/{uid}/githubTokens/default`
  // But a dedicated active session document is not yet automatically created.
  [key: string]: any;
}
