import { RepositoryResult } from '../types';
import { 
  GitHubPagesAuditorExport, 
  ExportRepositoryResult, 
  ExportClassification, 
  ExportErrorClassification,
  ExportBuildContext
} from '../schema/exportTypes';

export function toExportRepositoryResult(r: RepositoryResult): ExportRepositoryResult {
  const classification: ExportClassification[] = [];
  if (r.customDomainStatus) {
    classification.push(r.customDomainStatus as ExportClassification);
  }
  if (r.deploymentMethod && r.deploymentMethod !== 'not_applicable') {
    classification.push(`pages_deploy_method_${r.deploymentMethod}` as ExportClassification);
  }
  if (r.httpsEnforced === false || r.httpsCertificateStatus === 'https_not_enforced') {
    classification.push('https_not_enforced');
  }

  const visibilityValue = (r.visibility === 'public' || r.visibility === 'private' || r.visibility === 'internal') 
    ? r.visibility 
    : null;

  return {
    githubRepoId: r.id,
    owner: r.ownerName,
    repo: r.repoName,
    fullName: r.fullName,
    repositoryTopUrl: r.htmlUrl,
    pagesSettingsUrl: r.pagesSettingsUrl,
    pagesUrl: r.hasPages ? (r.pagesHtmlUrl || `https://${r.ownerName}.github.io/${r.repoName}/`) : null,
    private: r.visibility === 'private',
    visibility: visibilityValue,
    archived: r.archived,
    disabled: r.disabled,
    fork: r.isFork,
    defaultBranch: r.defaultBranch,
    hasPages: r.hasPages,
    createdAtGitHub: r.createdAt,
    updatedAtGitHub: r.updatedAt,
    pushedAtGitHub: r.pushedAt,
    pagesEnabled: !!r.hasPages,
    pagesStatus: r.pagesStatus || null,
    buildType: r.buildType || null,
    deploymentMethod: r.deploymentMethod,
    sourceBranch: r.sourceBranch || null,
    sourcePath: r.sourcePath || null,
    publishingSourceSummary: r.publishingSourceSummary || null,
    pagesPublic: null,
    customDomain: r.cname || null,
    customDomainConfigured: !!r.cname,
    protectedDomainState: r.protectedDomainState || null,
    pendingDomainUnverifiedAt: r.pendingDomainUnverifiedAt || null,
    httpsCertificateState: r.httpsCertificateState || null,
    httpsCertificateDescription: r.httpsCertificateDescription || null,
    httpsCertificateDomains: r.httpsCertificateDomains || [],
    httpsCertificateExpiresAt: r.httpsCertificateExpiresAt || null,
    httpsEnforced: r.httpsEnforced ?? null,
    healthStatus: 'not_requested',
    classification,
    errorClassification: (r.errorClassification || null) as ExportErrorClassification,
    customDomainVerificationState: !r.hasPages || !r.cname
      ? 'not_applicable'
      : r.protectedDomainState === 'verified'
        ? 'verified'
        : r.protectedDomainState === 'pending' || r.pendingDomainUnverifiedAt
          ? 'pending'
          : r.protectedDomainState === undefined || r.protectedDomainState === null || r.protectedDomainState === ''
            ? 'unknown'
            : 'unverified',
    diagnostics: {}
  };
}

/**
 * Builds the official V1 JSON audit export.
 * Accepts only a structured ExportBuildContext to define audit metadata,
 * with no internal PAT-based token checks or string-inference on parameters.
 */
export function buildJsonExport(results: RepositoryResult[], context?: ExportBuildContext): GitHubPagesAuditorExport {
  const pagesEnabledList = results.filter(r => r.hasPages);
  const customDomainList = pagesEnabledList.filter(r => r.cname);

  const finalContext = context || {};
  const finalTokenType = finalContext.tokenType ?? null;

  const httpsNotEnforcedList = pagesEnabledList.filter(r => r.httpsCertificateStatus === 'https_not_enforced' || r.httpsEnforced === false);
  const approvedCertButHttpsNotEnforcedList = pagesEnabledList.filter(r => r.httpsCertificateState === 'approved' && r.httpsEnforced === false);
  const customDomainHttpsNotEnforcedList = customDomainList.filter(r => r.httpsEnforced === false);

  const exportedAtStr = finalContext.exportedAt || new Date().toISOString();
  const startedAtStr = finalContext.auditCreatedAt || exportedAtStr;
  const finishedAtStr = finalContext.auditCreatedAt || exportedAtStr;

  const appMeta = {
    name: 'GitHub Pages Auditor',
    version: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.2.0',
    environment: finalContext.appEnvironment || 'dev'
  };

  const auditRunId = finalContext.auditRunId || `export-${Date.now()}`;

  const auditRunData: any = {
    id: auditRunId,
    status: 'completed',
    startedAt: startedAtStr,
    finishedAt: finishedAtStr,
    tokenType: finalTokenType,
    githubLogin: finalContext.githubLogin || null,
    options: {
      affiliation: 'owner,collaborator,organization_member',
      visibility: 'all',
      includeArchived: true,
      includeDisabled: true,
      strictPagesCheck: false,
      includeHealthCheck: false,
      ownerFilter: null
    }
  };

  if (finalContext.userMode === 'google' || finalContext.userMode === 'anonymous') {
    auditRunData.userMode = finalContext.userMode;
  }

  return {
    schemaVersion: 'github-pages-auditor.export.v1',
    schemaId: 'urn:uuid:ef46fd93-424a-4e2a-8f5b-df97e28b2be1',
    exportedAt: exportedAtStr,
    application: appMeta,
    auditRun: auditRunData,
    summary: {
      repositoryCount: results.length,
      pagesEnabledCount: pagesEnabledList.length,
      customDomainCount: customDomainList.length,
      customDomainVerifiedCount: results.filter(r => r.customDomainStatus === 'custom_domain_verified').length,
      customDomainUnverifiedOrUnknownCount: results.filter(r => ['custom_domain_unverified_or_unknown', 'custom_domain_pending'].includes(r.customDomainStatus)).length,
      httpsProblemCount: results.filter(r => ['https_certificate_problem_or_unknown', 'https_not_enforced'].includes(r.httpsCertificateStatus)).length,
      dnsHealthProblemCount: 0,
      errorCount: results.filter(r => r.errorClassification).length,
      deploymentWorkflowCount: results.filter(r => r.deploymentMethod === 'workflow').length,
      deploymentBranchRootCount: results.filter(r => r.deploymentMethod === 'branch_root').length,
      deploymentBranchDocsCount: results.filter(r => r.deploymentMethod === 'branch_docs').length,
      deploymentUnknownCount: results.filter(r => r.deploymentMethod === 'unknown' || r.deploymentMethod === 'branch_unknown_path').length,
      httpsNotEnforcedCount: httpsNotEnforcedList.length,
      approvedCertButHttpsNotEnforcedCount: approvedCertButHttpsNotEnforcedList.length,
      customDomainHttpsNotEnforcedCount: customDomainHttpsNotEnforcedList.length
    },
    repositories: results.map(toExportRepositoryResult),
    domains: []
  };
}

export function escapeCsvCell(val: any): string {
  if (val === null || val === undefined) {
    return '';
  }
  let str = String(val);
  
  // Defense against CSV Formula Injection: literal character escape or single prepended quote
  // If a cell begins with '=', '+', '-', or '@', prepend a single quote so spreadsheet engines treat it as text
  if (/^[=+\-@]/.test(str)) {
    str = `'${str}`;
  }

  // Escape standard CSV structure
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Builds the official CSV audit export.
 * Accepts only a structured ExportBuildContext to define audit metadata,
 * with no internal PAT-based token checks or string-inference on parameters.
 */
export function buildCsvExport(results: RepositoryResult[], context?: ExportBuildContext): string {
  const headers = [
    'audit_run_id', 'exported_at', 'owner', 'repo', 'full_name', 'repository_top_url', 
    'pages_settings_url', 'pages_url', 'visibility', 'archived', 'disabled', 'has_pages', 
    'pages_enabled', 'build_type', 'deployment_method', 'source_branch', 'source_path', 
    'publishing_source_summary', 'custom_domain', 'custom_domain_configured', 
    'protected_domain_state', 'pending_domain_unverified_at', 'https_certificate_state', 
    'https_enforced', 'health_status', 'classification', 'error_classification'
  ];

  const auditRunId = context?.auditRunId || `export-${Date.now()}`;
  const nowStr = context?.exportedAt || new Date().toISOString();

  const rows = results.map(r => {
    const classificationList = [];
    if (r.customDomainStatus) {
      classificationList.push(r.customDomainStatus);
    }
    if (r.deploymentMethod && r.deploymentMethod !== 'not_applicable') {
      classificationList.push(`pages_deploy_method_${r.deploymentMethod}`);
    }
    if (r.httpsEnforced === false || r.httpsCertificateStatus === 'https_not_enforced') {
      classificationList.push('https_not_enforced');
    }
    const classificationStr = classificationList.join('; ');

    return [
      auditRunId,
      nowStr,
      r.ownerName,
      r.repoName,
      r.fullName,
      r.htmlUrl,
      r.pagesSettingsUrl,
      r.hasPages ? (r.pagesHtmlUrl || `https://${r.ownerName}.github.io/${r.repoName}/`) : '',
      r.visibility,
      r.archived,
      r.disabled,
      r.hasPages,
      !!r.hasPages,
      r.buildType || '',
      r.deploymentMethod,
      r.sourceBranch || '',
      r.sourcePath || '',
      r.publishingSourceSummary || '',
      r.cname || '',
      !!r.cname,
      r.protectedDomainState || '',
      r.pendingDomainUnverifiedAt || '',
      r.httpsCertificateState || '',
      r.httpsEnforced ?? '',
      'not_requested',
      classificationStr,
      r.errorClassification || ''
    ];
  });

  const lines = [
    headers.join(','),
    ...rows.map(row => row.map(escapeCsvCell).join(','))
  ];

  return lines.join('\n');
}
