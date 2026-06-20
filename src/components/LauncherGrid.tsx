import React from 'react';
import { LauncherSite } from '../lib/launcherSites';
import { AlertCircle, ChevronLeft, ChevronRight, RotateCcw, ExternalLink, Database, Loader2, Maximize2, Minimize2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export interface LauncherGridProps {
  sites: LauncherSite[];
  saving?: boolean;
  saveWarning?: string | null;
  loading?: boolean;
  emptyTitle?: string;
  emptyMessage?: string;
  emptyActionLabel?: string;
  emptyActionTo?: string;
  showEmptyAction?: boolean;
  onMove?: (index: number, direction: -1 | 1) => void | Promise<void>;
  onReset?: () => void | Promise<void>;
  showReset?: boolean;
  readOnly?: boolean;
}

function LauncherSiteIcon({ site }: { site: LauncherSite }) {
  const [pwaError, setPwaError] = React.useState(false);
  const [favError, setFavError] = React.useState(false);

  const showPwa = !!(site.pwaIconUrl && !pwaError);
  const showFav = !!(site.faviconUrl && !favError);

  if (!showPwa && !showFav) {
    return (
      <div className="w-12 h-12 bg-slate-100 group-hover:bg-indigo-50 group-hover:text-indigo-600 rounded-xl flex items-center justify-center text-slate-600 font-bold text-xl uppercase tracking-wider select-none shrink-0 border border-slate-200 group-hover:border-indigo-200 transition-colors duration-300 group-hover:rotate-3">
        {site.name.charAt(0)}
      </div>
    );
  }

  return (
    <div className="flex items-end gap-2 shrink-0">
      {showPwa && (
        <div className="relative group/pwa">
          <img
            src={site.pwaIconUrl!}
            alt="PWA Icon"
            className="w-12 h-12 object-contain rounded-xl select-none shrink-0 border border-emerald-200 bg-white p-1 transition-all group-hover:scale-105 duration-300 shadow-xs"
            onError={() => setPwaError(true)}
            referrerPolicy="no-referrer"
          />
          <span className="absolute -bottom-1 -right-1 bg-emerald-600 text-white text-[8px] font-extrabold px-1 rounded-sm border border-white shadow-2xs select-none">
            PWA
          </span>
        </div>
      )}
      {showFav && (
        <div className="relative group/fav">
          <img
            src={site.faviconUrl!}
            alt="Favicon"
            className="w-12 h-12 object-contain rounded-xl select-none shrink-0 border border-slate-200 bg-white p-1 transition-all group-hover:scale-105 duration-300 shadow-xs"
            onError={() => setFavError(true)}
            referrerPolicy="no-referrer"
          />
          {showPwa && (
            <span className="absolute -bottom-1 -right-1 bg-indigo-500 text-white text-[7px] font-bold px-0.5 rounded-sm border border-white shadow-2xs select-none">
              FAV
            </span>
          )}
        </div>
      )}
    </div>
  );
}

interface LauncherCardItemProps {
  site: LauncherSite;
  index: number;
  sitesLength: number;
  saving: boolean;
  readOnly: boolean;
  onMove?: (index: number, direction: -1 | 1) => void | Promise<void>;
}

function LauncherCardItem({
  site,
  index,
  sitesLength,
  saving,
  readOnly,
  onMove
}: LauncherCardItemProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);

  if (!isExpanded) {
    // 縮小されたコンパクトカード (アイコン + ドメイン名だけの小さなもの、デフォルト)
    return (
      <div className="bg-white/80 backdrop-blur-sm border border-slate-200 rounded-xl shadow-xs hover:shadow-md hover:border-indigo-300/80 hover:bg-white transition-all duration-300 p-3.5 flex items-center group relative overflow-hidden min-h-[76px] w-full">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-50/0 via-transparent to-slate-50/0 group-hover:from-indigo-50/20 group-hover:to-purple-50/10 transition-colors duration-500 pointer-events-none"></div>
        
        <div className="flex items-center gap-3 w-full pr-8 relative z-10 min-w-0">
          <div className="shrink-0 transform scale-90 origin-left">
            <LauncherSiteIcon site={site} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-slate-800 text-sm truncate" title={site.name}>
              {site.name}
            </h3>
            <a
              href={site.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-500 hover:text-blue-700 font-medium hover:underline truncate mt-0.5 flex items-center gap-1 group/link max-w-full"
              title={site.url}
            >
              <span className="truncate">{site.hostname}</span>
              <ExternalLink className="w-3 h-3 opacity-0 group-hover/link:opacity-100 transition-opacity shrink-0" />
            </a>
          </div>
        </div>

        {/* 右上の隅に大きくするトグルボタン */}
        <button
          onClick={() => setIsExpanded(true)}
          className="absolute top-2.5 right-2.5 p-1 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 active:bg-slate-200 rounded-md transition-colors z-20"
          title="詳細を表示"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  // 展開されたフル情報カード (従来の全バッジ、並び替え、リッチな詳細)
  return (
    <div className="bg-white/90 backdrop-blur-sm border-2 border-indigo-200 rounded-2xl shadow-md hover:shadow-xl hover:border-indigo-300 transition-all duration-300 p-5 flex flex-col group relative overflow-hidden w-full">
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/20 via-transparent to-purple-50/10 group-hover:from-indigo-100/30 group-hover:to-purple-100/20 transition-colors duration-500 pointer-events-none"></div>
      
      <div className="flex justify-between items-start mb-4 relative z-10">
        <LauncherSiteIcon site={site} />
        
        <div className="flex items-center gap-1.5 z-20">
          {!readOnly && onMove && (
            <div className="flex gap-0.5 bg-slate-50 border border-slate-100 rounded-lg p-0.5">
              <button
                onClick={() => onMove(index, -1)}
                disabled={index === 0 || saving}
                className="p-1 text-slate-400 hover:text-slate-800 hover:bg-white rounded-md disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                title="Move earlier"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => onMove(index, 1)}
                disabled={index === sitesLength - 1 || saving}
                className="p-1 text-slate-400 hover:text-slate-800 hover:bg-white rounded-md disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                title="Move later"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* 右上の隅に小さくする (閉じる) ボタン */}
          <button
            onClick={() => setIsExpanded(false)}
            className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 active:bg-slate-200 rounded-md transition-colors"
            title="詳細を閉じる"
          >
            <Minimize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="mb-4 flex-grow relative z-10">
        <a
          href={site.url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-slate-900 text-lg hover:text-blue-600 transition-colors inline-block break-all group/link"
        >
          {site.name}
          <ExternalLink className="w-4 h-4 opacity-0 group-hover/link:opacity-100 transition-opacity inline ml-1 align-text-bottom" />
        </a>
        <p className="text-xs text-slate-500 break-all mt-1" title={site.ownerRepo}>{site.ownerRepo}</p>
      </div>

      <div className="flex flex-wrap gap-2 mt-auto pt-4 border-t border-slate-100 relative z-10">
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
        {site.isPwa ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100 shadow-2xs">
            PWA対応
          </span>
        ) : (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-400 border border-slate-200">
            PWA非対応
          </span>
        )}
        {site.pwaIconUrl ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-700 border border-purple-100" title={site.pwaIconUrl}>
            PWAアイコン
          </span>
        ) : site.faviconUrl ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100" title={site.faviconUrl}>
            ファビコン
          </span>
        ) : (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-normal bg-slate-100 text-slate-400 border border-slate-200">
            アイコン未検出
          </span>
        )}
      </div>
    </div>
  );
}

export default function LauncherGrid({
  sites,
  saving = false,
  saveWarning = null,
  loading = false,
  emptyTitle = "No GitHub Pages sites detected.",
  emptyMessage = "Run an audit from the dashboard to populate the launcher.",
  emptyActionLabel = "Go to Dashboard",
  emptyActionTo = "/",
  showEmptyAction = true,
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
        {showEmptyAction && (
          <Link to={emptyActionTo} className="px-6 py-2 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 transition-colors shadow-sm">
            {emptyActionLabel}
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-0 bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/30 p-6 md:p-10 font-sans h-full overflow-y-auto relative">
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.15] pointer-events-none mix-blend-multiply opacity-20 animate-[pulse_10s_ease-in-out_infinite]"></div>
      <div className="max-w-7xl mx-auto w-full relative z-10">
        {showReset && !readOnly && onReset && (
          <div className="flex justify-end mb-4">
            <button
              onClick={onReset}
              disabled={saving}
              className="group flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-indigo-600 transition-all duration-300 disabled:opacity-50 hover:bg-slate-100 px-3 py-1.5 rounded-full bg-white/50 backdrop-blur-sm"
            >
              <RotateCcw className="w-4 h-4 group-hover:-rotate-[360deg] transition-transform duration-700 ease-out" />
              <span className="hidden sm:inline">Reset Order</span>
            </button>
          </div>
        )}

        {saveWarning && (
          <div className="mb-6 bg-yellow-50 border border-yellow-200 text-yellow-800 p-3 rounded-lg text-sm flex items-center gap-2 shadow-sm">
            <AlertCircle className="w-4 h-4 shrink-0 text-yellow-600" />
            <p>{saveWarning}</p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 items-start">
          {sites.map((site, index) => (
            <LauncherCardItem
              key={site.id}
              site={site}
              index={index}
              sitesLength={sites.length}
              saving={saving}
              readOnly={readOnly}
              onMove={onMove}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
