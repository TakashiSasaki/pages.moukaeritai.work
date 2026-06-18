import React, { useState } from 'react';
import { RepositoryResult } from '../types';
import { 
  Play, 
  Key, 
  AlertCircle, 
  Loader2, 
  Download, 
  Search, 
  Filter, 
  ShieldCheck, 
  HelpCircle, 
  ExternalLink,
  CheckCircle,
  XCircle,
  Globe,
  Lock,
  GitBranch,
  Settings,
  Database,
  RefreshCw,
  Clock
} from 'lucide-react';

export default function Dashboard() {
  const [pat, setPat] = useState('');
  const [isAuditing, setIsAuditing] = useState(false);
  const [results, setResults] = useState<RepositoryResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  
  // Filtering & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'enabled' | 'disabled'>('all');
  const [domainFilter, setDomainFilter] = useState<'all' | 'custom' | 'none' | 'unverified' | 'pending'>('all');
  const [httpsFilter, setHttpsFilter] = useState<'all' | 'ok' | 'not_enforced' | 'problem'>('all');

  // Stats
  const pagesEnabledList = results?.filter(r => r.hasPages) || [];
  const customDomainList = pagesEnabledList.filter(r => r.cname);

  const runAudit = async () => {
    if (!pat) {
      setError('Please provide your GitHub Personal Access Token.');
      return;
    }
    
    // PAT formatting basic sanity check to help user
    const isClassic = pat.startsWith('ghp_');
    const isFineGrained = pat.startsWith('github_pat_');
    if (!isClassic && !isFineGrained && pat.length < 20) {
      setError('The token you entered does not match standard GitHub Classic (ghp_...) or Fine-grained (github_pat_...) formats. Please double check.');
      return;
    }

    setError(null);
    setIsAuditing(true);
    setResults(null);

    try {
      const res = await fetch('/api/audit/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-temp-pat': pat,
          'Authorization': 'Bearer dummy-token'
        }
      });
      
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to start audit');
      }

      setResults(data.results);
    } catch (err: any) {
      setError(err.message || 'An error occurred during safety audit.');
    } finally {
      setIsAuditing(false);
    }
  };

  const exportJson = () => {
    if (!results) return;
    
    const exportData = {
      schemaVersion: 'github-pages-auditor.export.v1',
      exportedAt: new Date().toISOString(),
      application: {
        name: 'GitHub Pages Auditor',
        version: '1.0.0',
        environment: 'dev'
      },
      auditRun: {
        id: `audit-run-${Date.now()}`,
        status: 'completed',
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        userMode: 'anonymous',
        tokenType: pat.startsWith('github_pat_') ? 'fine-grained' : 'classic',
        githubLogin: null,
        options: {
          affiliation: 'owner,collaborator,organization_member',
          visibility: 'all',
          includeArchived: true,
          includeDisabled: true,
          strictPagesCheck: false,
          includeHealthCheck: false,
          ownerFilter: null
        }
      },
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
        deploymentUnknownCount: results.filter(r => r.deploymentMethod === 'unknown' || r.deploymentMethod === 'branch_unknown_path').length
      },
      repositories: results.map(r => ({
        githubRepoId: r.id,
        owner: r.ownerName,
        repo: r.repoName,
        fullName: r.fullName,
        repositoryTopUrl: r.htmlUrl,
        pagesSettingsUrl: r.pagesSettingsUrl,
        pagesUrl: r.hasPages ? `https://${r.ownerName}.github.io/${r.repoName}/` : null,
        private: r.visibility === 'private',
        visibility: r.visibility,
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
        classification: [r.customDomainStatus, `pages_deploy_method_${r.deploymentMethod}`].filter(Boolean),
        errorClassification: r.errorClassification || null,
        diagnostics: {}
      })),
      domains: []
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `github-pages-audit-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportCsv = () => {
    if (!results) return;
    
    const headers = [
      'audit_run_id', 'exported_at', 'owner', 'repo', 'full_name', 'repository_top_url', 
      'pages_settings_url', 'pages_url', 'visibility', 'archived', 'disabled', 'has_pages', 
      'pages_enabled', 'build_type', 'deployment_method', 'source_branch', 'source_path', 
      'publishing_source_summary', 'custom_domain', 'custom_domain_configured', 
      'protected_domain_state', 'pending_domain_unverified_at', 'https_certificate_state', 
      'https_enforced', 'health_status', 'classification', 'error_classification'
    ];

    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (/^[=+\-@]/.test(str)) {
        return `"'${str.replace(/"/g, '""')}"`;
      }
      if (str.includes(',') || str.includes('"') || str.includes('\\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = results.map(r => [
      'audit-run-1', new Date().toISOString(), r.ownerName, r.repoName, r.fullName, r.htmlUrl,
      r.pagesSettingsUrl, r.hasPages ? `https://${r.ownerName}.github.io/${r.repoName}/` : '',
      r.visibility, r.archived, r.disabled, r.hasPages, !!r.hasPages, r.buildType || '',
      r.deploymentMethod, r.sourceBranch || '', r.sourcePath || '', r.publishingSourceSummary || '',
      r.cname || '', !!r.cname, r.protectedDomainState || '', r.pendingDomainUnverifiedAt || '',
      r.httpsCertificateState || '', r.httpsEnforced ?? '', 'not_requested',
      [r.customDomainStatus, `pages_deploy_method_${r.deploymentMethod}`].filter(Boolean).join('; '),
      r.errorClassification || ''
    ]);

    const csvContent = [headers.join(','), ...rows.map(row => row.map(escapeCsv).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `github-pages-audit-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Filter & Search Logic on the results
  const filteredResults = results?.filter(r => {
    // 1. Search Query
    const matchesSearch = r.fullName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (r.cname && r.cname.toLowerCase().includes(searchQuery.toLowerCase()));

    // 2. Status Filter
    const matchesStatus = statusFilter === 'all' || 
                          (statusFilter === 'enabled' && r.hasPages) || 
                          (statusFilter === 'disabled' && !r.hasPages);

    // 3. Domain Filter
    const matchesDomain = domainFilter === 'all' ||
                          (domainFilter === 'custom' && r.cname) ||
                          (domainFilter === 'none' && !r.cname && r.hasPages) ||
                          (domainFilter === 'unverified' && r.customDomainStatus === 'custom_domain_unverified_or_unknown') ||
                          (domainFilter === 'pending' && r.customDomainStatus === 'custom_domain_pending');

    // 4. HTTPS Filter
    const matchesHttps = httpsFilter === 'all' ||
                         (httpsFilter === 'ok' && r.httpsCertificateStatus === 'https_certificate_ok') ||
                         (httpsFilter === 'not_enforced' && r.httpsCertificateStatus === 'https_not_enforced') ||
                         (httpsFilter === 'problem' && r.httpsCertificateStatus === 'https_certificate_problem_or_unknown');

    return matchesSearch && matchesStatus && matchesDomain && matchesHttps;
  }) || [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      
      {/* Visual Identity Hero */}
      <div className="bg-slate-900 text-white rounded-2xl p-8 border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Database className="w-48 h-48" />
        </div>
        <div className="relative z-10 space-y-3 max-w-3xl">
          <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <ShieldCheck className="w-3.5 h-3.5 mr-1" />
            GitHub Pages Security Auditing
          </div>
          <h2 className="text-3xl font-semibold tracking-tight">
            Security & Custom Domain Auditor
          </h2>
          <p className="text-slate-300 text-base leading-relaxed">
            Audit GitHub Pages status, custom domains, HTTPS status, and deployment configurations across all your repositories in one click. Completely read-only and processed dynamically in browser guest memory.
          </p>
          <div className="flex flex-wrap gap-4 pt-2">
            <button 
              onClick={() => setShowGuide(!showGuide)}
              className="inline-flex items-center text-sm font-medium text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              <HelpCircle className="w-4 h-4 mr-1.5" />
              {showGuide ? 'Hide Token Guide' : 'How to obtain a safe Token?'}
            </button>
          </div>
        </div>
      </div>

      {/* Guide Section */}
      {showGuide && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-6 shadow-sm text-blue-900 space-y-4">
          <h3 className="text-base font-semibold flex items-center">
            <ShieldCheck className="w-5 h-5 mr-2 text-blue-600" />
            Creating a Safe Read-Only GitHub PAT
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
            <div className="space-y-2">
              <h4 className="font-medium text-blue-800">Option A: Fine-Grained Token (Recommended)</h4>
              <ol className="list-decimal pl-5 space-y-1 text-blue-700">
                <li>Go to GitHub → Settings → Developer Settings → Personal Access Tokens → Fine-grained tokens.</li>
                <li>Give the token a name and set expiration.</li>
                <li>Under Repository access, choose <strong>Only select repositories</strong> or All.</li>
                <li>Under Permissions → Repository permissions, grant:
                  <ul className="list-disc pl-5 mt-1 space-y-0.5">
                    <li><strong>Metadata</strong>: Read-only (auto-selected)</li>
                    <li><strong>Pages</strong>: Read-only</li>
                  </ul>
                </li>
                <li>Generate and paste the token below.</li>
              </ol>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium text-blue-800">Option B: Classic Token</h4>
              <ol className="list-decimal pl-5 space-y-1 text-blue-700">
                <li>Go to Settings → Developer Settings → Personal Access Tokens → Tokens (classic).</li>
                <li>Generate new token.</li>
                <li>Select the <strong>repo</strong> scope if some repositories are private, or simply <strong>read:project</strong> for public repos.</li>
                <li>Ensure NO write scopes are selected.</li>
              </ol>
            </div>
          </div>
          <div className="text-xs bg-blue-100/60 p-3 rounded-lg border border-blue-200/50 flex items-start text-blue-800">
            <AlertCircle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
            <span><strong>No Write Capability:</strong> This applet is designed to never call any write, dispatch, or delete endpoints. The auditor restricts its actions strictly to page settings and metadata gathering.</span>
          </div>
        </div>
      )}

      {/* Configuration Section for MVP Guest Mode */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
        <h2 className="text-base font-medium text-gray-950 flex items-center">
          <Key className="w-4 h-4 mr-2 text-slate-500" />
          Personal Access Token Settings (In-Memory Processing)
        </h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <input 
              type="password" 
              placeholder="Paste your Classic (ghp_...) or Fine-grained (github_pat_...) token here..."
              className="w-full pl-4 pr-12 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-slate-900 focus:border-slate-900 outline-none transition-shadow text-sm"
              value={pat}
              onChange={(e) => setPat(e.target.value)}
            />
            {pat && (
              <span className="absolute right-3 top-3 text-xs font-mono text-gray-400 select-none">
                {pat.length} chars
              </span>
            )}
          </div>
          <button 
            onClick={runAudit}
            disabled={isAuditing}
            className="px-6 py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 flex items-center justify-center font-medium shadow-sm transition-all text-sm cursor-pointer"
          >
            {isAuditing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Auditing Repositories...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2 fill-current" />
                Launch Pages Audit
              </>
            )}
          </button>
        </div>
        <p className="text-xs text-gray-500">
          Your token is processed strictly transiently in volatile server-side process memory and browser state. It is never logged, printed, or saved of any kind.
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start text-red-800 shadow-xs animate-fade-in text-sm">
          <AlertCircle className="w-5 h-5 mr-3 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-semibold text-red-900">Audit Request Unsuccessful</span>
            <p>{error}</p>
          </div>
        </div>
      )}

      {/* Dashboard Stats & Results visualization */}
      {results && (
        <div className="space-y-6 animate-fade-in">
          
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs hover:border-gray-300 transition-colors">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wider block">Total Audited</span>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-3xl font-semibold text-gray-900">{results.length}</span>
                <span className="text-xs text-gray-400">Repositories</span>
              </div>
            </div>
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs hover:border-gray-300 transition-colors">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wider block">Pages Enabled</span>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-3xl font-semibold text-gray-900">{pagesEnabledList.length}</span>
                <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                  {results.length ? Math.round((pagesEnabledList.length / results.length) * 100) : 0}%
                </span>
              </div>
            </div>
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs hover:border-gray-300 transition-colors">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wider block">Verified Custom Domains</span>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-3xl font-semibold text-gray-900">
                  {results.filter(r => r.customDomainStatus === 'custom_domain_verified').length}
                </span>
                <span className="text-xs text-gray-400">Active domains</span>
              </div>
            </div>
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs hover:border-gray-300 transition-colors">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wider block">Action Flow Deploy</span>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-3xl font-semibold text-gray-900">
                  {results.filter(r => r.deploymentMethod === 'workflow').length}
                </span>
                <span className="text-xs text-gray-400">Modern build</span>
              </div>
            </div>
          </div>

          {/* Table Toolbar (Search and Filter controls) */}
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs space-y-3">
            <div className="flex flex-col md:flex-row gap-3">
              {/* Search Bar */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
                <input 
                  type="text" 
                  placeholder="Filter by repository name or custom domain..."
                  className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-slate-900 focus:border-slate-900 outline-none text-sm"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 flex-wrap">
                <button 
                  onClick={exportCsv} 
                  className="px-4 py-2 bg-white text-gray-700 rounded-lg hover:bg-gray-50 flex items-center border border-gray-300 shadow-xs text-sm font-medium transition-colors cursor-pointer"
                >
                  <Download className="w-4 h-4 mr-2 text-gray-500" />
                  CSV
                </button>
                <button 
                  onClick={exportJson} 
                  className="px-4 py-2 bg-white text-gray-700 rounded-lg hover:bg-gray-50 flex items-center border border-gray-300 shadow-xs text-sm font-medium transition-colors cursor-pointer"
                >
                  <Download className="w-4 h-4 mr-2 text-gray-500" />
                  JSON
                </button>
                <button 
                  onClick={runAudit}
                  loading={isAuditing}
                  className="px-4 py-2 bg-gray-100 text-slate-800 rounded-lg hover:bg-gray-250 flex items-center border border-gray-300 shadow-xs text-sm font-medium transition-all cursor-pointer"
                >
                  <RefreshCw className={`w-4 h-4 mr-2 text-slate-500 ${isAuditing ? 'animate-spin' : ''}`} />
                  Rescan
                </button>
              </div>
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-4 text-xs pt-1 border-t border-gray-100">
              <div className="flex items-center text-gray-400 bg-gray-50 px-2 py-1 rounded border border-gray-100">
                <Filter className="w-3 h-3 mr-1" />
                <span>Filters</span>
              </div>
              
              {/* Pages status */}
              <div className="flex items-center space-x-1.5">
                <span className="text-gray-500">Pages:</span>
                <select 
                  className="bg-white border border-gray-300 rounded px-2 py-1 outline-none focus:border-slate-900"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                >
                  <option value="all">All</option>
                  <option value="enabled">Enabled</option>
                  <option value="disabled">Disabled</option>
                </select>
              </div>

              {/* Custom Domain status */}
              <div className="flex items-center space-x-1.5">
                <span className="text-gray-500">Domain:</span>
                <select 
                  className="bg-white border border-gray-300 rounded px-2 py-1 outline-none focus:border-slate-900"
                  value={domainFilter}
                  onChange={(e) => setDomainFilter(e.target.value as any)}
                >
                  <option value="all">All</option>
                  <option value="custom">Configured</option>
                  <option value="none">No Custom Domain</option>
                  <option value="unverified">Unverified/Unknown</option>
                  <option value="pending">Pending Verification</option>
                </select>
              </div>

              {/* HTTPS status */}
              <div className="flex items-center space-x-1.5">
                <span className="text-gray-500">HTTPS:</span>
                <select 
                  className="bg-white border border-gray-300 rounded px-2 py-1 outline-none focus:border-slate-900"
                  value={httpsFilter}
                  onChange={(e) => setHttpsFilter(e.target.value as any)}
                >
                  <option value="all">All</option>
                  <option value="ok">Approved & Enforced</option>
                  <option value="not_enforced">Not Enforced</option>
                  <option value="problem">Problem/Unknown</option>
                </select>
              </div>

              {results && (
                <div className="ml-auto text-gray-400 font-mono">
                  Showing {filteredResults.length} of {results.length} results
                </div>
              )}
            </div>
          </div>

          {/* Results Table view */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 font-sans text-sm">
                <thead className="bg-gray-50 border-b border-gray-200 font-mono">
                  <tr>
                    <th scope="col" className="px-6 py-4 text-left font-medium text-gray-500 uppercase tracking-wider text-xs">Repository</th>
                    <th scope="col" className="px-6 py-4 text-left font-medium text-gray-500 uppercase tracking-wider text-xs">Pages Status</th>
                    <th scope="col" className="px-6 py-4 text-left font-medium text-gray-500 uppercase tracking-wider text-xs">Deploy Source</th>
                    <th scope="col" className="px-6 py-4 text-left font-medium text-gray-500 uppercase tracking-wider text-xs">Custom Domain</th>
                    <th scope="col" className="px-6 py-4 text-left font-medium text-gray-500 uppercase tracking-wider text-xs">HTTPS & Security</th>
                    <th scope="col" className="px-6 py-4 text-right font-medium text-gray-500 uppercase tracking-wider text-xs">Link</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100 font-mono text-sm">
                  {filteredResults.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-gray-500 bg-gray-25">
                        <div className="max-w-md mx-auto space-y-2 text-center">
                          <AlertCircle className="w-8 h-8 text-gray-300 mx-auto" />
                          <p className="font-medium text-slate-800">No matching repositories found</p>
                          <p className="text-xs text-gray-400">Try loosening your search query or adjusting active filtering options above.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredResults.map((repo) => (
                      <tr key={repo.id} className="hover:bg-slate-25/50 transition-colors">
                        
                        {/* Repository name with fork badge */}
                        <td className="px-6 py-4.5 whitespace-nowrap">
                          <div className="flex flex-col">
                            <a href={repo.htmlUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-600 hover:text-blue-850 hover:underline inline-flex items-center leading-5 gap-1 font-sans">
                              {repo.fullName}
                              <ExternalLink className="w-3 h-3 flex-shrink-0 opacity-70" />
                            </a>
                            <div className="flex items-center space-x-2 mt-1">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider leading-none ${repo.visibility === 'public' ? 'bg-sky-50 text-sky-700 border border-sky-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                                {repo.visibility}
                              </span>
                              {repo.isFork && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider leading-none bg-slate-100 text-slate-500 border border-slate-200">
                                  Fork
                                </span>
                              )}
                              {repo.archived && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider leading-none bg-orange-50 text-orange-600 border border-orange-200">
                                  Archived
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Pages Status badge */}
                        <td className="px-6 py-4.5 whitespace-nowrap">
                          {repo.hasPages ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-1.5 animate-pulse"></span>
                              Active ({repo.pagesStatus || 'configured'})
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-50 text-gray-500 border border-gray-200">
                              <span className="w-1.5 h-1.5 bg-gray-300 rounded-full mr-1.5"></span>
                              Disabled
                            </span>
                          )}
                          {repo.errorClassification && (
                            <div className="text-[10px] text-red-500 mt-1 flex items-center gap-1 font-sans">
                              <AlertCircle className="w-3 h-3 text-red-400 flex-shrink-0" />
                              <span>{repo.errorClassification}</span>
                            </div>
                          )}
                        </td>

                        {/* Deployment method & publishing branch */}
                        <td className="px-6 py-4.5 whitespace-nowrap">
                          {repo.hasPages ? (
                            <div className="space-y-1">
                              <div className="flex items-center text-gray-700 text-xs gap-1">
                                <GitBranch className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                                <span className="font-sans font-medium">{repo.deploymentMethod}</span>
                              </div>
                              {repo.publishingSourceSummary && (
                                <div className="text-[10px] text-gray-400 select-all font-mono">
                                  {repo.publishingSourceSummary}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>

                        {/* Custom Domain and Verification Status */}
                        <td className="px-6 py-4.5 whitespace-nowrap">
                          {repo.cname ? (
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-1.5 text-gray-800 font-sans leading-none">
                                <Globe className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                                <span className="font-semibold">{repo.cname}</span>
                              </div>
                              
                              {/* Better colored domain statuses */}
                              {repo.customDomainStatus === 'custom_domain_verified' ? (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider leading-none uppercase bg-green-50 text-green-700 border border-green-150">
                                  Verified
                                </span>
                              ) : repo.customDomainStatus === 'custom_domain_pending' ? (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider leading-none uppercase bg-amber-50 text-amber-700 border border-amber-200">
                                  Pending Verification
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider leading-none uppercase bg-gray-50 text-gray-500 border border-gray-200">
                                  Unverified / Unknown
                                </span>
                              )}
                            </div>
                          ) : repo.hasPages ? (
                            <span className="text-xs text-gray-400 font-normal font-sans">GitHub standard URL</span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>

                        {/* HTTPS and Enforcement */}
                        <td className="px-6 py-4.5 whitespace-nowrap text-gray-500">
                          {repo.hasPages ? (
                            <div className="space-y-1.5">
                              {repo.httpsCertificateStatus === 'https_certificate_ok' ? (
                                <div className="flex items-center gap-1 text-emerald-700 text-xs font-sans">
                                  <Lock className="w-3.5 h-3.5 text-emerald-500" />
                                  <span>HTTPS Enforced & SSL OK</span>
                                </div>
                              ) : repo.httpsCertificateStatus === 'https_not_enforced' ? (
                                <div className="flex items-center gap-1 text-amber-600 text-xs font-sans">
                                  <UnlockWarningIcon className="w-3.5 h-3.5 text-amber-500" />
                                  <span>Approved but Not Enforced</span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1 text-red-650 text-xs font-sans">
                                  <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                                  <span>SSL Configuration Issue</span>
                                </div>
                              )}
                              
                              {repo.httpsCertificateState && (
                                <div className="text-[10px] text-gray-400 font-sans">
                                  Cert status: <span className="font-mono text-gray-500 select-all">{repo.httpsCertificateState}</span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>

                        {/* Link to settings */}
                        <td className="px-6 py-4.5 whitespace-nowrap text-right font-medium">
                          <a 
                            href={repo.pagesSettingsUrl} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="inline-flex items-center text-xs text-slate-800 bg-slate-50 hover:bg-slate-100 hover:text-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 font-sans shadow-2xs cursor-pointer transition-colors"
                          >
                            <Settings className="w-3 h-3 mr-1" />
                            Settings
                          </a>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// Help component to render unlock icon gracefully
function UnlockWarningIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className}
      {...props}
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 9.9-1" />
    </svg>
  );
}

