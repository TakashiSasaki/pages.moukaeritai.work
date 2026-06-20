import React from 'react';
import { LauncherSite } from '../lib/launcherSites';
import { AlertCircle, ChevronLeft, ChevronRight, RotateCcw, ExternalLink, Database, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export interface LauncherGridProps {
  sites: LauncherSite[];
  saving?: boolean;
  saveWarning?: boolean;
  loading?: boolean;
  emptyTitle?: string;
  emptyMessage?: string;
  onMove?: (index: number, direction: -1 | 1) => void | Promise<void>;
  onReset?: () => void | Promise<void>;
  showReset?: boolean;
  readOnly?: boolean;
}

export default function LauncherGrid({
  sites,
  saving = false,
  saveWarning = false,
  loading = false,
  emptyTitle = "No GitHub Pages sites detected.",
  emptyMessage = "Run an audit from the dashboard to populate the launcher.",
  onMove,
  onReset,
  showReset = true,
  readOnly = false
}: LauncherGridProps) {

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (sites.length === 0) {
    return (
      <div className="flex flex-col h-full bg-slate-50 text-slate-900 font-sans p-6 items-center justify-center">
        <div className="w-16 h-16 bg-slate-200 rounded-2xl flex items-center justify-center mb-6 text-slate-500 shadow-sm">
          <Database className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-semibold mb-2">{emptyTitle}</h2>
        <p className="text-slate-600 mb-6 text-center max-w-sm">
          {emptyMessage}
        </p>
        <Link to="/" className="px-6 py-2 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 transition-colors shadow-sm">
          Go to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-0 bg-slate-50 p-6 md:p-10 font-sans h-full overflow-y-auto">
      <div className="max-w-7xl mx-auto w-full">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Launcher</h1>
            <p className="text-sm text-slate-500">Launch detected GitHub Pages sites</p>
          </div>
          {showReset && !readOnly && onReset && (
            <button
              onClick={onReset}
              disabled={saving}
              className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 transition-colors disabled:opacity-50"
            >
              <RotateCcw className="w-4 h-4" />
              <span className="hidden sm:inline">Reset Order</span>
            </button>
          )}
        </div>

        {saveWarning && (
          <div className="mb-6 bg-yellow-50 border border-yellow-200 text-yellow-800 p-3 rounded-lg text-sm flex items-center gap-2 shadow-sm">
            <AlertCircle className="w-4 h-4 shrink-0 text-yellow-600" />
            <p>Could not save your layout to the server. Your changes are visible locally but will not persist.</p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {sites.map((site, index) => (
            <div key={site.id} className="bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col group relative">
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-600 font-bold text-xl uppercase tracking-wider select-none shrink-0 border border-slate-200">
                  {site.name.charAt(0)}
                </div>
                {!readOnly && onMove && (
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => onMove(index, -1)}
                      disabled={index === 0 || saving}
                      className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-md disabled:opacity-30 disabled:hover:bg-transparent"
                      title="Move earlier"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onMove(index, 1)}
                      disabled={index === sites.length - 1 || saving}
                      className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-md disabled:opacity-30 disabled:hover:bg-transparent"
                      title="Move later"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              <div className="mb-4 flex-grow">
                <a
                  href={site.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-slate-900 text-lg hover:text-blue-600 transition-colors line-clamp-1 inline-flex items-center gap-1 group/link"
                >
                  {site.name}
                  <ExternalLink className="w-4 h-4 opacity-0 group-hover/link:opacity-100 transition-opacity" />
                </a>
                <p className="text-xs text-slate-500 truncate" title={site.ownerRepo}>{site.ownerRepo}</p>
              </div>

              <div className="flex flex-wrap gap-2 mt-auto pt-4 border-t border-slate-100">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 truncate max-w-[140px]" title={site.hostname}>
                  {site.hostname}
                </span>
                {site.httpsState === 'enforced' && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700">
                    HTTPS
                  </span>
                )}
                {site.deploymentMethod === 'workflow' && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700">
                    Workflow
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
