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

function LauncherSiteIcon({ site, sizeClass = "w-12 h-12" }: { site: LauncherSite; sizeClass?: string }) {
  const [pwaError, setPwaError] = React.useState(false);
  const [favError, setFavError] = React.useState(false);

  const showPwa = !!(site.pwaIconUrl && !pwaError);
  // PWA優先で1つのアイコンのみを表示させる
  const showFav = !showPwa && !!(site.faviconUrl && !favError);

  const isLarge = sizeClass.includes('68') || sizeClass.includes('16');
  const textClass = isLarge ? 'text-2xl' : 'text-xl';

  if (!showPwa && !showFav) {
    return (
      <div className={`${sizeClass} bg-slate-100 group-hover:bg-indigo-50 group-hover:text-indigo-600 rounded-xl flex items-center justify-center text-slate-600 font-bold ${textClass} uppercase tracking-wider select-none shrink-0 border border-slate-200 group-hover:border-indigo-200 transition-colors duration-300 group-hover:rotate-3`}>
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
            className={`${sizeClass} object-contain rounded-xl select-none shrink-0 border border-emerald-200 bg-white p-1 transition-all group-hover:scale-105 duration-300 shadow-xs`}
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
            className={`${sizeClass} object-contain rounded-xl select-none shrink-0 border border-slate-200 bg-white p-1 transition-all group-hover:scale-105 duration-300 shadow-xs`}
            onError={() => setFavError(true)}
            referrerPolicy="no-referrer"
          />
        </div>
      )}
    </div>
  );
}

function CircularDomainBadge({ site }: { site: LauncherSite }) {
  const [isHovered, setIsHovered] = React.useState(false);
  const pathId = `circle-path-${site.id}`;
  const rawText = site.hostname || '';
  
  // Pad/repeat the domain text to look great on a circular path (adjusted for 1.5x larger font size to prevent overlapping)
  let displayText = rawText;
  if (rawText.length < 8) {
    displayText = `${rawText} • ${rawText} • ${rawText} •`;
  } else if (rawText.length < 16) {
    displayText = `${rawText} • ${rawText} •`;
  } else {
    displayText = `${rawText} •`;
  }

  return (
    <div 
      className="relative w-28 h-28 shrink-0 flex items-center justify-center group/circle"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Central Icon - size scaled to 1.4x (w-12 -> w-[68px], which is 48px * 1.41 = 68px) */}
      <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
        <div className="w-[68px] h-[68px] rounded-full bg-white shadow-sm border border-slate-100 flex items-center justify-center overflow-hidden transition-all duration-350 group-hover/circle:scale-110 group-hover/circle:shadow-md">
          <LauncherSiteIcon site={site} sizeClass="w-[68px] h-[68px]" />
        </div>
      </div>

      {/* SVG Circular Text - rotating slowly on hover, font size scaled to 1.5x (~16px) and crystal clear text-slate-800 */}
      <svg
        viewBox="0 0 112 112"
        className="w-full h-full text-slate-800 group-hover/circle:text-indigo-700 fill-current pointer-events-none transition-colors duration-300"
        style={{ 
          animation: `spin ${isHovered ? '8s' : '18s'} linear infinite`,
        }}
      >
        <defs>
          {/* circle centered at 56, 56 with radius 42 starting at top-center */}
          <path
            id={pathId}
            d="M 56,14 A 42,42 0 1,1 55.9,14"
            fill="none"
          />
        </defs>
        <text className="font-mono text-[16px] font-bold tracking-[0.08em] uppercase">
          <textPath href={`#${pathId}`} startOffset="0%">
            {displayText}
          </textPath>
        </text>
      </svg>
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
  const [isPressed, setIsPressed] = React.useState(false);
  const [bubblePlacement, setBubblePlacement] = React.useState<'top' | 'left' | 'right'>('top');
  const containerRef = React.useRef<HTMLDivElement>(null);
  const pressTimer = React.useRef<any>(null);
  const wasHeld = React.useRef(false);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    
    wasHeld.current = false;
    if (pressTimer.current) clearTimeout(pressTimer.current);

    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceTop = rect.top;
      const spaceRight = window.innerWidth - rect.right;
      const spaceLeft = rect.left;

      // Select layout dynamically based on available screen bounds (above, right, or left)
      if (spaceTop > 240) {
        setBubblePlacement('top');
      } else if (spaceRight > 320) {
        setBubblePlacement('right');
      } else if (spaceLeft > 320) {
        setBubblePlacement('left');
      } else {
        // Fallback placement (choose side with more screen real-estate)
        if (spaceRight >= spaceLeft) {
          setBubblePlacement('right');
        } else {
          setBubblePlacement('left');
        }
      }
    }

    // Active holding-mode after 150ms to verify user is active pressing to inspect details
    pressTimer.current = setTimeout(() => {
      setIsPressed(true);
      wasHeld.current = true;
    }, 150);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }

    if (isPressed) {
      setIsPressed(false);
    }
  };

  const handlePointerLeave = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
    setIsPressed(false);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
  };

  // Define speech bubble positioning classes and arrow vectors depending on calculated placement
  let placementClasses = '';
  let arrowBorderClasses = '';
  let arrowBodyClasses = '';

  if (bubblePlacement === 'top') {
    placementClasses = 'bottom-full left-1/2 -translate-x-1/2 mb-4';
    arrowBorderClasses = 'absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[9px] border-r-[9px] border-t-[9px] border-l-transparent border-r-transparent border-t-indigo-600 -z-10 translate-y-[-1px]';
    arrowBodyClasses = 'absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[8px] border-r-[8px] border-t-[8px] border-l-transparent border-r-transparent border-t-white z-50';
  } else if (bubblePlacement === 'left') {
    placementClasses = 'right-full top-1/2 -translate-y-1/2 mr-4';
    arrowBorderClasses = 'absolute left-full top-1/2 -translate-y-1/2 w-0 h-0 border-t-[9px] border-b-[9px] border-l-[9px] border-t-transparent border-b-transparent border-l-indigo-600 -z-10 translate-x-[-1px]';
    arrowBodyClasses = 'absolute left-full top-1/2 -translate-y-1/2 w-0 h-0 border-t-[8px] border-b-[8px] border-l-[8px] border-t-transparent border-b-transparent border-l-white z-50';
  } else if (bubblePlacement === 'right') {
    placementClasses = 'left-full top-1/2 -translate-y-1/2 ml-4';
    arrowBorderClasses = 'absolute right-full top-1/2 -translate-y-1/2 w-0 h-0 border-t-[9px] border-b-[9px] border-r-[9px] border-t-transparent border-b-transparent border-r-indigo-600 -z-10 translate-x-[1px]';
    arrowBodyClasses = 'absolute right-full top-1/2 -translate-y-1/2 w-0 h-0 border-t-[8px] border-b-[8px] border-r-[8px] border-t-transparent border-b-transparent border-r-white z-50';
  }

  return (
    <div 
      ref={containerRef}
      className="relative flex flex-col items-center justify-center p-4"
      onContextMenu={handleContextMenu}
    >
      {/* Bare SVG Icon & Rotating domain text - No surround borders/cards layout ("露出したままでいいです") */}
      <a
        href={site.url}
        target="_blank"
        rel="noopener noreferrer"
        className="cursor-pointer active:scale-95 transition-all duration-200 select-none touch-none"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onPointerCancel={handlePointerLeave}
        onClick={(e) => {
          if (wasHeld.current) {
            e.preventDefault();
          }
        }}
        title={site.url}
      >
        <CircularDomainBadge site={site} />
      </a>

      {/* Elegant Move Order controls sitting directly below the circular SVG item */}
      {!readOnly && onMove && (
        <div className="flex gap-1 bg-white/70 hover:bg-white border border-slate-200 shadow-xs rounded-full p-1 mt-2 z-20 transition-all duration-300">
          <button
            onClick={() => onMove(index, -1)}
            disabled={index === 0 || saving}
            className="p-1 text-slate-400 hover:text-slate-800 rounded-full disabled:opacity-25 disabled:hover:bg-transparent transition-colors"
            title="Move left"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onMove(index, 1)}
            disabled={index === sitesLength - 1 || saving}
            className="p-1 text-slate-400 hover:text-slate-800 rounded-full disabled:opacity-25 disabled:hover:bg-transparent transition-colors"
            title="Move right"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Floating Rich Detailed Overlay Panel (Displays exactly while held/long-pressed, dismissed instantly when input is released) */}
      {isPressed && (
        <div className={`absolute ${placementClasses} min-w-[280px] sm:min-w-[320px] bg-white border-2 border-indigo-600 rounded-2xl shadow-xl p-5 z-50 pointer-events-none animate-in fade-in zoom-in-95 duration-100 ease-out`}>
          {/* Arrow vectors styled for the specific speech bubble direction */}
          <div className={arrowBodyClasses}></div>
          <div className={arrowBorderClasses}></div>

          <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/20 via-transparent to-purple-50/10 pointer-events-none rounded-2xl"></div>
          
          <div className="flex justify-between items-start mb-4 relative z-10">
            <LauncherSiteIcon site={site} />
            <span className="text-[10px] text-slate-400 font-mono font-semibold px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200">
              AUDIT METADATA
            </span>
          </div>

          <div className="mb-4 relative z-10">
            <h4 className="font-bold text-slate-900 text-lg break-all">
              {site.name}
            </h4>
            <p className="text-xs text-slate-500 break-all mt-1" title={site.ownerRepo}>
              {site.ownerRepo}
            </p>
          </div>

          <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-100 relative z-10">
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 truncate max-w-[140px]" title={site.hostname}>
              {site.hostname}
            </span>
            {site.httpsState === 'enforced' && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-green-50 text-emerald-700 border border-green-200">
                HTTPS
              </span>
            )}
            {site.deploymentMethod === 'workflow' && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-indigo-700 border border-blue-200">
                Workflow
              </span>
            )}
            {site.isPwa ? (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100 shadow-2xs">
                PWA対応
              </span>
            ) : (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-400 border border-slate-200">
                PWA非対応
              </span>
            )}
          </div>
        </div>
      )}
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
