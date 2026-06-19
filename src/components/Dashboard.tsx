import React, { useState, useEffect } from 'react';
import { RepositoryResult } from '../types';
import { buildJsonExport, buildCsvExport } from '../export/exportBuilders';
import { useAuth } from '../AuthContext';
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
  Clock,
  Save
} from 'lucide-react';

export default function Dashboard() {
  const { user, hasStoredPat } = useAuth();
  const [isAuditing, setIsAuditing] = useState(false);
  const [results, setResults] = useState<RepositoryResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);

  // Filtering & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'enabled' | 'disabled'>('all');
  const [domainFilter, setDomainFilter] = useState<'all' | 'custom' | 'none' | 'unverified' | 'pending'>('all');
  const [httpsFilter, setHttpsFilter] = useState<'all' | 'ok' | 'not_enforced' | 'problem'>('all');

  // Stats
  const pagesEnabledList = results?.filter(r => r.hasPages) || [];
  const customDomainList = pagesEnabledList.filter(r => r.cname);

  const runAudit = async () => {
    if (!hasStoredPat) {
      setError('Please configure your GitHub Personal Access Token in the profile menu.');
      return;
    }

    setError(null);
    setIsAuditing(true);
    setResults(null);

    try {
      const token = await user?.getIdToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      };

      const res = await fetch('/api/audit/run', {
        method: 'POST',
        headers
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
    
    const exportData = buildJsonExport(results, "");

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
    
    const csvContent = buildCsvExport(results);
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
      
      {/* Mini top utilities to show the app details dialog */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowInfoModal(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-slate-200"
        >
          <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
          What's this app?
        </button>
      </div>

      {/* Dialog / Modal for Info */}
      {showInfoModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          {/* Backdrop wrapper */}
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div 
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity" 
              aria-hidden="true"
              onClick={() => setShowInfoModal(false)}
            ></div>

            {/* Centering element */}
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

            {/* Modal panel */}
            <div className="relative inline-block align-bottom bg-slate-950 text-white rounded-2xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-xl sm:w-full border border-slate-800">
              {/* Close button */}
              <button 
                type="button" 
                onClick={() => setShowInfoModal(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <span className="sr-only">Close</span>
                <XCircle className="w-6 h-6" />
              </button>

              {/* Banner visual */}
              <div className="p-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
                  <Database className="w-40 h-40" />
                </div>
                <div className="relative z-10 space-y-4">
                  <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                    GitHub Pages Security Auditing
                  </div>
                  <h3 className="text-2xl font-semibold tracking-tight" id="modal-title">
                    Security & Custom Domain Auditor
                  </h3>
                  <p className="text-slate-300 text-sm leading-relaxed">
                    Audit GitHub Pages status, custom domains, HTTPS status, and deployment configurations across all your repositories in one click. Completely read-only and processed dynamically in browser guest memory.
                  </p>
                  <p className="text-slate-400 text-xs">
                    This is a secure application. All checks are performed backend-to-backend or inside secure sandboxed scripts to ensure your data stays private and safe.
                  </p>
                  
                  <div className="pt-4 border-t border-slate-800 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setShowInfoModal(false)}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                    >
                      Got it
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Control Section */}
      <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center">
          {hasStoredPat ? (
            <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              <CheckCircle className="w-4 h-4 mr-1.5" />
              Secure Token Loaded from Cloud
            </span>
          ) : (
            <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-amber-50 text-amber-700 border border-amber-200">
              <Key className="w-4 h-4 mr-1.5" />
              Token Not Configured (Set in Profile Menu)
            </span>
          )}
        </div>
        
        <button 
          onClick={runAudit}
          disabled={isAuditing || !hasStoredPat}
          className="w-full sm:w-auto px-8 py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 flex items-center justify-center font-medium shadow-sm transition-all text-sm cursor-pointer"
        >
          {isAuditing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Auditing...
            </>
          ) : (
            <>
              <Play className="w-4 h-4 mr-2 fill-current" />
              Launch Audit
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start text-red-800 shadow-xs animate-fade-in text-sm">
          <AlertCircle className="w-5 h-5 mr-3 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-semibold text-red-900">Request Unsuccessful</span>
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

