import React from 'react';

interface ReportTableHeaderProps {
  setColumnGuideModal: (column: string | null) => void;
  filteredCount?: number;
  totalCount?: number;
}

export const ReportTableHeader: React.FC<ReportTableHeaderProps> = ({ 
  setColumnGuideModal,
  filteredCount,
  totalCount
}) => {
  return (
    <thead className="bg-slate-50 font-mono">
      <tr>
        <th scope="col" className="sticky top-0 z-50 bg-slate-50 px-1 py-1.5 text-center font-bold text-slate-400 uppercase text-[10px] border-r border-b border-slate-200 shadow-[0_1px_0_0_rgba(226,232,240,1)]">
          <div className="flex flex-col items-center justify-center leading-none">
            <span className="text-[10px] leading-tight mb-0.5">#</span>
            {filteredCount !== undefined && totalCount !== undefined && (
              <span className="inline-block lg:hidden text-[7.5px] scale-95 origin-center font-mono text-slate-500 font-semibold leading-none whitespace-nowrap tracking-tighter">
                {filteredCount}/{totalCount}
              </span>
            )}
          </div>
        </th>
        <th 
          scope="col" 
          onClick={() => setColumnGuideModal('repository')}
          className="sticky top-0 z-50 bg-slate-50 px-3 py-2 text-left font-semibold text-slate-600 uppercase tracking-wider text-[11px] border-r border-b border-slate-200 shadow-[0_1px_0_0_rgba(226,232,240,1)] cursor-pointer hover:bg-slate-100 hover:text-indigo-600 transition-colors select-none"
          title="Explain Repository column"
        >
          <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-1 min-w-0">
            <span className="whitespace-normal break-words [overflow-wrap:anywhere] leading-tight font-sans">
              Repository
            </span>
          </div>
        </th>
        <th 
          scope="col" 
          onClick={() => setColumnGuideModal('pagesStatus')}
          className="sticky top-0 z-40 bg-slate-50 px-3 py-2 text-left font-semibold text-slate-600 uppercase tracking-wider text-[11px] border-b border-slate-200 shadow-[0_1px_0_0_rgba(226,232,240,1)] cursor-pointer hover:bg-slate-100 hover:text-indigo-600 transition-colors select-none"
          title="Explain Pages Status column"
        >
          <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-1 min-w-0">
            <span className="whitespace-normal break-words [overflow-wrap:anywhere] leading-tight font-sans">
              Pages Status
            </span>
          </div>
        </th>
        <th 
          scope="col" 
          onClick={() => setColumnGuideModal('deploySource')}
          className="sticky top-0 z-40 bg-slate-50 px-3 py-2 text-left font-semibold text-slate-600 uppercase tracking-wider text-[11px] border-b border-slate-200 shadow-[0_1px_0_0_rgba(226,232,240,1)] cursor-pointer hover:bg-slate-100 hover:text-indigo-600 transition-colors select-none"
          title="Explain Deploy Source column"
        >
          <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-1 min-w-0">
            <span className="whitespace-normal break-words [overflow-wrap:anywhere] leading-tight font-sans">
              Deploy Source
            </span>
          </div>
        </th>
        <th 
          scope="col" 
          onClick={() => setColumnGuideModal('customDomain')}
          className="sticky top-0 z-40 bg-slate-50 px-3 py-2 text-left font-semibold text-slate-600 uppercase tracking-wider text-[11px] border-b border-slate-200 shadow-[0_1px_0_0_rgba(226,232,240,1)] cursor-pointer hover:bg-slate-100 hover:text-indigo-600 transition-colors select-none"
          title="Explain Custom Domain column"
        >
          <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-1 min-w-0">
            <span className="whitespace-normal break-words [overflow-wrap:anywhere] leading-tight font-sans">
              Custom Domain
            </span>
          </div>
        </th>
        <th 
          scope="col" 
          onClick={() => setColumnGuideModal('https')}
          className="sticky top-0 z-40 bg-slate-50 px-3 py-2 text-left font-semibold text-slate-600 uppercase tracking-wider text-[11px] border-b border-slate-200 shadow-[0_1px_0_0_rgba(226,232,240,1)] cursor-pointer hover:bg-slate-100 hover:text-indigo-600 transition-colors select-none"
          title="Explain HTTPS & Security column"
        >
          <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-1 min-w-0">
            <span className="whitespace-normal break-words [overflow-wrap:anywhere] leading-tight font-sans">
              HTTPS & Security
            </span>
          </div>
        </th>
      </tr>
    </thead>
  );
};
