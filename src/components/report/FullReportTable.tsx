import React from 'react';
import { AlertCircle, XCircle } from 'lucide-react';
import { RepositoryResult } from '../../types';
import { ReportFiltersToolbar } from './ReportFiltersToolbar';
import { ReportTableHeader } from './ReportTableHeader';
import { ReportRow } from './ReportRow';
import { buildReportTableStyle, REPORT_TABLE_COLUMN_COUNT } from './reportTableLayout';

interface FullReportTableProps {
  results: RepositoryResult[] | null;
  filteredResults: RepositoryResult[];
  visibleResults: RepositoryResult[];
  topPadding: number;
  bottomPadding: number;
  startIndex: number;
  currentPage: number;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>> | ((page: number | ((prev: number) => number)) => void);
  pageSize: number;
  setPageSize: React.Dispatch<React.SetStateAction<number>> | ((size: number) => void);
  totalPages: number;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  setColumnGuideModal: (column: string | null) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  statusFilter: 'all' | 'enabled' | 'built' | 'building' | 'errored' | 'disabled';
  setStatusFilter: (status: 'all' | 'enabled' | 'built' | 'building' | 'errored' | 'disabled') => void;
  domainFilter: 'all' | 'custom' | 'none' | 'unverified' | 'pending';
  setDomainFilter: (domain: 'all' | 'custom' | 'none' | 'unverified' | 'pending') => void;
  httpsFilter: 'all' | 'ok' | 'not_enforced' | 'problem';
  setHttpsFilter: (https: 'all' | 'ok' | 'not_enforced' | 'problem') => void;
}

export const FullReportTable: React.FC<FullReportTableProps> = ({
  results,
  filteredResults,
  visibleResults,
  topPadding,
  bottomPadding,
  startIndex,
  currentPage,
  setCurrentPage,
  pageSize,
  setPageSize,
  totalPages,
  scrollContainerRef,
  setColumnGuideModal,
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter,
  domainFilter,
  setDomainFilter,
  httpsFilter,
  setHttpsFilter,
}) => {
  const tableStyle = buildReportTableStyle();

  const handleClearFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setDomainFilter('all');
    setHttpsFilter('all');
  };

  return (
    <>
      {results && (
        <ReportFiltersToolbar
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          domainFilter={domainFilter}
          setDomainFilter={setDomainFilter}
          httpsFilter={httpsFilter}
          setHttpsFilter={setHttpsFilter}
          filteredCount={filteredResults.length}
          totalCount={results.length}
          setColumnGuideModal={setColumnGuideModal}
        />
      )}

      {/* Results Table view - Seamless Flat High-Density Layout */}
      <div 
        ref={scrollContainerRef as any} 
        className="flex-1 overflow-auto border-b border-gray-200 bg-white mt-1 animate-fade-in relative font-sans"
      >
        <div className="min-h-full">
          <table 
            className="divide-y divide-gray-200 font-sans text-xs border-separate border-spacing-0 table-fixed"
            style={tableStyle}
          >
            <colgroup>
              <col style={{ width: 'var(--report-col-index)' }} />
              <col style={{ width: 'var(--report-col-repository)' }} />
              <col style={{ width: 'var(--report-col-pages)' }} />
              <col style={{ width: 'var(--report-col-deploy)' }} />
              <col style={{ width: 'var(--report-col-domain)' }} />
              <col style={{ width: 'var(--report-col-https)' }} />
            </colgroup>
            <ReportTableHeader 
              setColumnGuideModal={setColumnGuideModal} 
              filteredCount={filteredResults.length}
              totalCount={results ? results.length : 0}
            />
            <tbody className="bg-white divide-y divide-gray-100 font-mono text-xs">
              {filteredResults.length === 0 ? (
                <tr>
                  <td colSpan={REPORT_TABLE_COLUMN_COUNT} className="px-3 py-6 text-center text-gray-500 bg-gray-25">
                    <div className="max-w-md mx-auto space-y-3.5 text-center flex flex-col items-center">
                      <AlertCircle className="w-6 h-6 text-gray-300 mx-auto" />
                      <div className="space-y-1">
                        <p className="font-medium text-slate-800 text-xs font-sans">No matching repositories found</p>
                        <p className="text-[10px] text-gray-400 font-sans">Try loosening your search query or adjusting active filtering options above.</p>
                      </div>
                      <button
                        onClick={handleClearFilters}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-white border border-slate-300 hover:border-slate-400 text-slate-700 hover:text-slate-900 rounded font-sans text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                      >
                        <XCircle className="w-3.5 h-3.5 text-slate-500" />
                        すべてのフィルタを解除
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                <>
                  {topPadding > 0 && (
                    <tr>
                      <td colSpan={REPORT_TABLE_COLUMN_COUNT} style={{ height: `${topPadding}px`, padding: 0 }} className="border-0 bg-transparent" />
                    </tr>
                  )}
                  {visibleResults.map((repo, index) => (
                    <ReportRow 
                      key={repo.id} 
                      repo={repo} 
                      serialNumber={(currentPage - 1) * pageSize + startIndex + index + 1} 
                    />
                  ))}
                  {bottomPadding > 0 && (
                    <tr>
                      <td colSpan={REPORT_TABLE_COLUMN_COUNT} style={{ height: `${bottomPadding}px`, padding: 0 }} className="border-0 bg-transparent" />
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Controls */}
      <div className="py-2.5 px-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600 font-sans">
        <div className="flex items-center gap-2">
          <span>ページごとの表示数:</span>
          <select
            value={pageSize === 100000 ? 'all' : pageSize}
            onChange={(e) => {
              const val = e.target.value;
              const newSize = val === 'all' ? 100000 : Number(val);
              setPageSize(newSize);
              setCurrentPage(1);
            }}
            className="bg-white border border-slate-200 rounded px-2 py-1 text-slate-700 outline-none focus:border-slate-800 text-xs font-semibold"
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={250}>250</option>
            <option value="all">すべて</option>
          </select>
          <span className="text-slate-400">|</span>
          <span>
            {filteredResults.length > 0 ? (
              <>
                全 <strong>{filteredResults.length}</strong> 件中 <strong>{(currentPage - 1) * pageSize + 1}</strong> - <strong>{Math.min(currentPage * pageSize, filteredResults.length)}</strong> 件を表示
              </>
            ) : (
              '該当するリポジトリはありません'
            )}
          </span>
        </div>
        
        {totalPages > 1 && (
          <div className="flex items-center gap-1.5 font-sans">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="px-2 py-1 border border-slate-200 rounded bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white text-xs font-semibold transition-colors cursor-pointer"
              title="最初"
            >
              &laquo;
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, typeof prev === 'number' ? prev - 1 : 1))}
              disabled={currentPage === 1}
              className="px-2.5 py-1 border border-slate-200 rounded bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white text-xs font-semibold transition-colors cursor-pointer"
              title="戻る"
            >
              前へ
            </button>

            <span className="text-slate-505 mx-1 font-mono text-[11px]">
              ページ <strong>{currentPage}</strong> / <strong>{totalPages}</strong>
            </span>

            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, typeof prev === 'number' ? prev + 1 : totalPages))}
              disabled={currentPage === totalPages}
              className="px-2.5 py-1 border border-slate-200 rounded bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white text-xs font-semibold transition-colors cursor-pointer"
              title="次へ"
            >
              次へ
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="px-2 py-1 border border-slate-200 rounded bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white text-xs font-semibold transition-colors cursor-pointer"
              title="最後"
            >
              &raquo;
            </button>
          </div>
        )}
      </div>
    </>
  );
};
