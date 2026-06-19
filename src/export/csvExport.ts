import { RepositoryResult } from '../types';
import { ExportBuildContext } from './exportContext';

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

  const auditRunId = context?.auditRunId || "export-${Date.now()}";
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
