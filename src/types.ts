export interface User {
  uid: string;
  email: string | null;
  isAnonymous: boolean;
}

export interface GitHubTokenMetadata {
  id: string; // Internal id for PAT
  maskedToken: string; // e.g. "ghp_...XXXX"
  addedAt: string; // ISO timestamp
}

export type PagesDeploymentMethod = 
  | 'workflow'
  | 'branch_root'
  | 'branch_docs'
  | 'branch_unknown_path'
  | 'unknown'
  | 'not_applicable';

export type CustomDomainStatus = 
  | 'pages_disabled'
  | 'pages_enabled_no_custom_domain'
  | 'custom_domain_configured'
  | 'custom_domain_verified'
  | 'custom_domain_pending'
  | 'custom_domain_unverified_or_unknown';

export type HttpsCertificateStatus = 
  | 'https_certificate_ok'
  | 'https_certificate_problem_or_unknown'
  | 'https_not_enforced';

export interface RepositoryResult {
  id: number;
  ownerName: string;
  repoName: string;
  fullName: string;
  visibility: string;
  archived: boolean;
  disabled: boolean;
  isFork: boolean;
  defaultBranch: string;
  hasPages: boolean;
  htmlUrl: string;
  createdAt: string;
  updatedAt: string;
  pushedAt: string;

  // Pages specific details
  pagesStatus?: string;
  buildType?: string;
  deploymentMethod: PagesDeploymentMethod;
  sourceBranch?: string;
  sourcePath?: string;
  publishingSourceSummary?: string | null;
  
  cname?: string;
  protectedDomainState?: string;
  pendingDomainUnverifiedAt?: string | null;
  
  httpsCertificateState?: string;
  httpsCertificateDescription?: string;
  httpsCertificateDomains?: string[];
  httpsCertificateExpiresAt?: string;
  httpsEnforced?: boolean;

  customDomainStatus: CustomDomainStatus;
  httpsCertificateStatus: HttpsCertificateStatus;

  pagesSettingsUrl: string;
  
  // Potential Error state
  errorClassification?: string | null;
  healthStatus?: string | null;
}

export interface DomainSummary {
  verifiedCount: number;
  pendingCount: number;
  unverifiedCount: number;
}

export interface AuditRun {
  id: string;
  startedAt: string;
  completedAt: string;
  repositoryCount: number;
  pagesEnabledCount: number;
  customDomainCount: number;
  httpsProblemCount: number;
  results: RepositoryResult[];
}
