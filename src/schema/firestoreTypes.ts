export interface GitHubTokenDocument {
  id: string; // The type is a guid or static identifier like 'default'
  maskedToken: string; // e.g. "ghp_...XXXX" or "github_pat_...XXXX"
  addedAt: string; // ISO timestamp
}

export interface AuditRunDocument {
  id: string; // The Audit Run idi
  startedAt: string; // ISO 8601 string
  completedAt?: string; // ISO 8601 string
  repositoryCount: number;
  pagesEnabledCount: number;
  customDomainCount: number;
  httpsProblemCount: number;
  results: any[]; // The results are stored inside this doc, currently not fully matching the internal RepositoryResult model. Note: this is provisional.
}

export interface RepositoryResultDocument {
  // Currently, we don't store repositories in an isolated subcollection per repo, they are inside the audit run.
  // This is a placeholder for future iterations.
  [key: string]: any;
}

export interface AnonymousSessionDocument {
  createdAt: string; // ISO timestamp.
  lastAccess: string;
}
