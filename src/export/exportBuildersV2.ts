import { RepositoryResult } from '../types';
import { ExportBuildContext } from './exportContext';
import {
  GitHubPagesAuditorExportV2,
  V2AuditRepositoryRecord,
  V2RepositoryMeta,
  V2PagesMeta,
  V2Finding,
  V2DeploymentMethod,
  V2VerificationState,
  V2Summary
} from '../schema/exportTypesV2';

export function toExportRepositoryRecordV2(r: RepositoryResult): V2AuditRepositoryRecord {
  const isPrivate = r.visibility === 'private';
  const visibilityValue = (r.visibility === 'public' || r.visibility === 'private' || r.visibility === 'internal')
    ? r.visibility
    : 'unknown';

  const repository: V2RepositoryMeta = {
    githubId: String(r.id),
    githubIdNumber: r.id,
    ownerLogin: r.ownerName,
    name: r.repoName,
    fullName: r.fullName,
    htmlUrl: r.htmlUrl,
    visibility: visibilityValue,
    isPrivate,
    isArchived: r.archived,
    isDisabled: r.disabled,
    isFork: r.isFork,
    defaultBranch: r.defaultBranch || null,
    githubHasPagesRaw: r.hasPages,
    createdAt: r.createdAt || null,
    updatedAt: r.updatedAt || null,
    pushedAt: r.pushedAt || null
  };

  const deploymentMethodMapped: V2DeploymentMethod = (r.deploymentMethod === 'workflow' ||
    r.deploymentMethod === 'branch_root' ||
    r.deploymentMethod === 'branch_docs' ||
    r.deploymentMethod === 'branch_unknown_path' ||
    r.deploymentMethod === 'unknown' ||
    r.deploymentMethod === 'not_applicable')
    ? r.deploymentMethod
    : 'unknown';

  const verificationStateComputed: V2VerificationState = !r.hasPages || !r.cname
    ? 'not_applicable'
    : r.protectedDomainState === 'verified'
      ? 'verified'
      : r.protectedDomainState === 'pending' || r.pendingDomainUnverifiedAt
        ? 'pending'
        : r.protectedDomainState === undefined || r.protectedDomainState === null || r.protectedDomainState === ''
          ? 'unknown'
          : 'unverified';

  const stateSourceComputed = !r.hasPages || !r.cname
    ? 'not_reported'
    : r.protectedDomainState
      ? 'github_pages_api'
      : 'derived';

  const pages: V2PagesMeta = {
    enabled: !!r.hasPages,
    statusRaw: r.pagesStatus || null,
    htmlUrl: r.hasPages ? (r.pagesHtmlUrl || `https://${r.ownerName}.github.io/${r.repoName}/`) : null,
    settingsUrl: r.pagesSettingsUrl,
    publicRaw: null,
    deployment: {
      method: deploymentMethodMapped,
      githubBuildTypeRaw: r.buildType || null,
      sourceBranch: r.sourceBranch || null,
      sourcePath: r.sourcePath || null,
      displaySummary: r.publishingSourceSummary || null
    },
    customDomain: {
      configured: !!r.cname,
      cnameRaw: r.cname || null,
      hostname: r.cname || null,
      githubProtectedDomainStateRaw: r.protectedDomainState || null,
      verificationState: verificationStateComputed,
      pendingUnverifiedAt: r.pendingDomainUnverifiedAt || null,
      stateSource: stateSourceComputed
    },
    https: {
      enforced: r.httpsEnforced ?? null,
      certificate: {
        stateRaw: r.httpsCertificateState || null,
        description: r.httpsCertificateDescription || null,
        domains: r.httpsCertificateDomains || [],
        expiresAt: r.httpsCertificateExpiresAt || null
      }
    },
    healthCheck: {
      requested: false,
      status: null
    }
  };

  const findings: V2Finding[] = [];

  if (!r.hasPages) {
    findings.push({
      code: 'pages_disabled',
      category: 'pages',
      severity: 'info',
      source: 'github_repository_api',
      message: 'GitHub Pages is disabled or not configured for this repository.',
      evidence: {}
    });
  } else {
    // Pages is enabled
    if (!r.cname) {
      findings.push({
        code: 'pages_enabled_no_custom_domain',
        category: 'custom_domain',
        severity: 'info',
        source: 'github_pages_api',
        message: 'Pages is enabled under the standard github.io domain, with no custom domain configured.',
        evidence: {}
      });
    } else {
      // Custom domain is configured
      if (verificationStateComputed === 'verified') {
        findings.push({
          code: 'custom_domain_verified',
          category: 'custom_domain',
          severity: 'info',
          source: 'github_pages_api',
          message: 'The custom domain ownership has been successfully verified by GitHub.',
          evidence: { cname: r.cname }
        });
      } else if (verificationStateComputed === 'pending') {
        findings.push({
          code: 'custom_domain_pending',
          category: 'custom_domain',
          severity: 'warning',
          source: 'github_pages_api',
          message: 'The custom domain verification is pending.',
          evidence: { cname: r.cname, pendingUnverifiedAt: r.pendingDomainUnverifiedAt || null }
        });
      } else if (verificationStateComputed === 'unverified') {
        findings.push({
          code: 'custom_domain_unverified',
          category: 'custom_domain',
          severity: 'error',
          source: 'github_pages_api',
          message: 'The custom domain is unverified.',
          evidence: { cname: r.cname }
        });
      } else if (verificationStateComputed === 'unknown') {
        findings.push({
          code: 'custom_domain_unknown',
          category: 'custom_domain',
          severity: 'warning',
          source: 'app_derived',
          message: 'The custom domain verification state is unknown.',
          evidence: { cname: r.cname }
        });
      }
    }

    // HTTPS Checks
    if (r.httpsEnforced === false || r.httpsCertificateStatus === 'https_not_enforced') {
      findings.push({
        code: 'pages_https_not_enforced',
        category: 'https',
        severity: 'error',
        source: 'github_pages_api',
        message: 'HTTPS redirection is not enforced despite having an active static Pages site configuration.',
        evidence: {
          github_https_enforced_raw: r.httpsEnforced ?? false
        }
      });
    }

    if (r.cname && r.httpsEnforced === false) {
      findings.push({
        code: 'custom_domain_https_not_enforced',
        category: 'custom_domain',
        severity: 'error',
        source: 'app_derived',
        message: 'Custom domain is registered but HTTPS transport redirection is disabled.',
        evidence: {
          cname: r.cname,
          https_enforced: false
        }
      });
    }

    if (r.httpsCertificateStatus === 'https_certificate_problem_or_unknown' || r.httpsCertificateState === 'errored' || r.httpsCertificateState === 'bad_dns_or_unauthorized') {
      findings.push({
        code: 'pages_https_certificate_problem',
        category: 'https',
        severity: 'error',
        source: 'github_pages_api',
        message: 'We detected a problem or an unauthorized state with the HTTPS SSL certificate configuration.',
        evidence: {
          https_certificate_state: r.httpsCertificateState || null,
          description: r.httpsCertificateDescription || null
        }
      });
    }

    // Deployment Method Checks
    if (deploymentMethodMapped === 'workflow') {
      findings.push({
        code: 'pages_deploy_method_workflow',
        category: 'deployment',
        severity: 'info',
        source: 'github_pages_api',
        message: 'Pages is deployed via Git Actions Workflow.',
        evidence: { buildType: r.buildType || null }
      });
    } else if (deploymentMethodMapped === 'branch_root') {
      findings.push({
        code: 'pages_deploy_method_branch_root',
        category: 'deployment',
        severity: 'info',
        source: 'github_pages_api',
        message: 'Pages is deployed using a Git branch from "/" root path.',
        evidence: { branch: r.sourceBranch || null, path: r.sourcePath || null }
      });
    } else if (deploymentMethodMapped === 'branch_docs') {
      findings.push({
        code: 'pages_deploy_method_branch_docs',
        category: 'deployment',
        severity: 'info',
        source: 'github_pages_api',
        message: 'Pages is deployed using a Git branch from "/docs" folder.',
        evidence: { branch: r.sourceBranch || null, path: r.sourcePath || null }
      });
    } else if (deploymentMethodMapped === 'unknown' || deploymentMethodMapped === 'branch_unknown_path') {
      findings.push({
        code: 'pages_deploy_method_unknown',
        category: 'deployment',
        severity: 'warning',
        source: 'github_pages_api',
        message: 'The deployment method for this Pages configuration is unknown or unsupported.',
        evidence: { buildType: r.buildType || null, branch: r.sourceBranch || null }
      });
    }
  }

  return {
    repository,
    pages,
    findings
  };
}

export function buildJsonExportV2(results: RepositoryResult[], context?: ExportBuildContext): GitHubPagesAuditorExportV2 {
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
    version: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.4.0',
    environment: finalContext.appEnvironment || 'dev'
  };

  const auditRunId = finalContext.auditRunId || `export-${Date.now()}`;

  const auditRunDataAny: any = {
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
    auditRunDataAny.userMode = finalContext.userMode;
  }

  return {
    schemaVersion: 'github-pages-auditor.export.v2',
    schemaId: 'urn:uuid:7d0f98be-8cba-49c5-84dc-66914b5da3f2',
    exportedAt: exportedAtStr,
    application: appMeta,
    auditRun: auditRunDataAny,
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
    repositories: results.map(toExportRepositoryRecordV2),
    domains: []
  };
}
