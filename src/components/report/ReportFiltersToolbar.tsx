import React from 'react';
import { Search, HelpCircle, X, XCircle } from 'lucide-react';

interface ReportFiltersToolbarProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  statusFilter: 'all' | 'enabled' | 'built' | 'building' | 'errored' | 'disabled';
  setStatusFilter: (status: 'all' | 'enabled' | 'built' | 'building' | 'errored' | 'disabled') => void;
  domainFilter: 'all' | 'custom' | 'none' | 'unverified' | 'pending';
  setDomainFilter: (domain: 'all' | 'custom' | 'none' | 'unverified' | 'pending') => void;
  httpsFilter: 'all' | 'ok' | 'not_enforced' | 'problem';
  setHttpsFilter: (https: 'all' | 'ok' | 'not_enforced' | 'problem') => void;
  filteredCount: number;
  totalCount: number;
  setColumnGuideModal: (column: string | null) => void;
}

export const ReportFiltersToolbar: React.FC<ReportFiltersToolbarProps> = ({
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter,
  domainFilter,
  setDomainFilter,
  httpsFilter,
  setHttpsFilter,
  filteredCount,
  totalCount,
  setColumnGuideModal,
}) => {
  const hasActiveFilters = searchQuery !== '' || statusFilter !== 'all' || domainFilter !== 'all' || httpsFilter !== 'all';

  const handleClearFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setDomainFilter('all');
    setHttpsFilter('all');
  };

  return (
    <div className="bg-slate-50 border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2.5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Filters Group */}
          <div className="flex flex-wrap items-end gap-2.5 flex-1 min-w-0">
            {/* Search */}
            <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
              <div className="flex items-center gap-1">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider font-sans">Search repositories</span>
                <button
                  type="button"
                  onClick={() => setColumnGuideModal('repository')}
                  className="text-slate-400 hover:text-indigo-500 focus:outline-none transition-colors cursor-pointer"
                  title="View Search Filter details"
                  aria-label="Explain Search filter"
                >
                  <HelpCircle className="w-3 h-3" />
                </button>
              </div>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                <input 
                  type="text" 
                  placeholder="Search repo/domain..."
                  className="w-full min-w-0 pl-8 pr-8 py-1 border border-slate-200 rounded text-xs font-sans bg-white outline-none focus:border-slate-800 focus:ring-1 focus:ring-slate-800 transition-all font-normal"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full p-0.5 top-1.5 transition-colors cursor-pointer border-0 bg-transparent"
                    title="Clear search"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Status */}
            <div className="flex flex-col gap-1 min-w-[120px] flex-1 sm:flex-initial">
              <div className="flex items-center gap-1">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider font-sans">Pages Status</span>
                <button
                  type="button"
                  onClick={() => setColumnGuideModal('pagesStatus')}
                  className="text-slate-400 hover:text-indigo-500 focus:outline-none transition-colors cursor-pointer"
                  title="View Pages Status details"
                  aria-label="Explain Pages Status filter"
                >
                  <HelpCircle className="w-3 h-3" />
                </button>
              </div>
              <select 
                className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs outline-none focus:border-slate-800 cursor-pointer font-sans font-normal"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
              >
                <option value="all">All Pages</option>
                <option value="enabled">Enabled (Any)</option>
                <option value="built">Active (Built)</option>
                <option value="building">Building</option>
                <option value="errored">Errored</option>
                <option value="disabled">Disabled</option>
              </select>
            </div>

            {/* Domain */}
            <div className="flex flex-col gap-1 min-w-[120px] flex-1 sm:flex-initial">
              <div className="flex items-center gap-1">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider font-sans">Custom Domain</span>
                <button
                  type="button"
                  onClick={() => setColumnGuideModal('customDomain')}
                  className="text-slate-400 hover:text-indigo-500 focus:outline-none transition-colors cursor-pointer"
                  title="View Custom Domain details"
                  aria-label="Explain Custom Domain filter"
                >
                  <HelpCircle className="w-3 h-3" />
                </button>
              </div>
              <select 
                className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs outline-none focus:border-slate-800 cursor-pointer font-sans font-normal"
                value={domainFilter}
                onChange={(e) => setDomainFilter(e.target.value as any)}
              >
                <option value="all">All Domains</option>
                <option value="custom">Configured</option>
                <option value="none">No Custom</option>
                <option value="unverified">Unverified/Unknown</option>
                <option value="pending">Pending Verif.</option>
              </select>
            </div>

            {/* HTTPS */}
            <div className="flex flex-col gap-1 min-w-[120px] flex-1 sm:flex-initial">
              <div className="flex items-center gap-1">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider font-sans">HTTPS/Security</span>
                <button
                  type="button"
                  onClick={() => setColumnGuideModal('https')}
                  className="text-slate-400 hover:text-indigo-500 focus:outline-none transition-colors cursor-pointer"
                  title="View HTTPS & Security details"
                  aria-label="Explain HTTPS & Security filter"
                >
                  <HelpCircle className="w-3 h-3" />
                </button>
              </div>
              <select 
                className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs outline-none focus:border-slate-800 cursor-pointer font-sans font-normal"
                value={httpsFilter}
                onChange={(e) => setHttpsFilter(e.target.value as any)}
              >
                <option value="all">All HTTPS</option>
                <option value="ok">Approved & Enforced</option>
                <option value="not_enforced">Not Enforced</option>
                <option value="problem">Problem/Unknown</option>
              </select>
            </div>
          </div>

          {/* Meta Action & Showing Count */}
          <div className="flex items-center justify-between lg:justify-end gap-3 lg:border-l lg:border-slate-200 lg:pl-3">
            {hasActiveFilters && (
              <button
                onClick={handleClearFilters}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded text-xs font-semibold transition-colors cursor-pointer font-sans"
                title="Clear all filters"
              >
                <XCircle className="w-3.5 h-3.5 text-red-500" />
                Clear Filters
              </button>
            )}
            <div className="text-right whitespace-nowrap hidden lg:block">
              <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wider font-sans leading-none">Results</p>
              <p className="text-xs font-mono text-slate-700 font-semibold mt-1 leading-none">
                {filteredCount} / {totalCount}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
