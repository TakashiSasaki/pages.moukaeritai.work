export interface ExportBuildContext {
  auditRunId?: string | null;
  auditCreatedAt?: string | null;
  exportedAt?: string;
  userMode?: 'google' | 'anonymous' | 'unknown' | null;
  githubLogin?: string | null;
  appEnvironment?: string;
  tokenType?: 'classic' | 'fine_grained' | 'unknown' | null;
}
