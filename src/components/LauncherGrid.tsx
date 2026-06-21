import React from 'react';
import { LauncherSite } from '../lib/launcherSites';
import { AlertCircle, ChevronLeft, ChevronRight, RotateCcw, ExternalLink, Database, Loader2, Maximize2, Minimize2, Settings2, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { useAuth } from '../AuthContext';
import { getEnvironmentName } from '../lib/firestorePaths';
import { getCachedIcon, saveCachedIcon, isCacheExpired, toIconDataUrl } from '../lib/launcherIconCache';

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
  onOrderChange?: (ids: string[]) => void | Promise<void>;
  animationSpeed?: number | null;
  visibleIconsRange?: number | null;
  onSettingsChange?: (settings: { animationSpeed?: number; visibleIconsRange?: number }) => void | Promise<void>;
}

const inFlightResolutions = new Set<string>();
const failedResolutions = new Set<string>();

const LauncherSiteIcon = React.memo(function LauncherSiteIcon({ site, sizeClass = "w-12 h-12" }: { site: LauncherSite; sizeClass?: string }) {
  const { user } = useAuth();
  const env = getEnvironmentName(import.meta.env.MODE);

  const [cachedDataUrl, setCachedDataUrl] = React.useState<string | null>(null);
  const [pwaError, setPwaError] = React.useState(false);
  const [favError, setFavError] = React.useState(false);

  // Expose the candidate icon URL and source type based on standard priority
  const showPwaWithoutCache = !!(site.pwaIconUrl && !pwaError);
  const showFavWithoutCache = !showPwaWithoutCache && !!(site.faviconUrl && !favError);

  const candidateUrl = showPwaWithoutCache
    ? site.pwaIconUrl
    : (showFavWithoutCache ? site.faviconUrl : null);

  const candidateSourceKind = showPwaWithoutCache
    ? 'pwa_icon'
    : (showFavWithoutCache ? 'favicon' : null);

  React.useEffect(() => {
    let active = true;
    if (!user || !candidateUrl || !candidateSourceKind) {
      setCachedDataUrl(null);
      return;
    }

    async function checkCacheAndTriggerResolve() {
      const uid = user!.uid;
      const isAnonymous = user!.isAnonymous;

      // 1. Check if we already have it in the Firestore cache
      try {
        const cachedDoc = await getCachedIcon(uid, isAnonymous, site.id, candidateUrl!, env);
        if (cachedDoc && cachedDoc.dataBase64) {
          if (active) {
            setCachedDataUrl(toIconDataUrl(cachedDoc.contentType, cachedDoc.dataBase64));
          }

          // If expired, trigger an async resolve in the background
          if (isCacheExpired(cachedDoc)) {
            triggerBackgroundResolve(uid, isAnonymous);
          }
          return;
        }
      } catch (e) {
        console.warn('Silent local cache read error:', e);
      }

      // 2. Cache miss -> perform background resolve
      triggerBackgroundResolve(uid, isAnonymous);
    }

    async function triggerBackgroundResolve(uid: string, isAnonymous: boolean) {
      const resolutionKey = `${site.id}:${candidateUrl}`;
      if (inFlightResolutions.has(resolutionKey) || failedResolutions.has(resolutionKey)) {
        return;
      }

      inFlightResolutions.add(resolutionKey);

      try {
        const token = await user!.getIdToken();
        const response = await fetch('/api/icon/resolve', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            siteId: site.id,
            pageUrl: site.url,
            iconUrl: candidateUrl,
            sourceKind: candidateSourceKind
          })
        });

        if (!response.ok) {
          throw new Error(`Endpoint returned status ${response.status}`);
        }

        const result = await response.json();
        if (!result.ok) {
          throw new Error(result.error || 'Server-side resolving failed');
        }

        // Cache persistent results in Firestore
        await saveCachedIcon(uid, isAnonymous, env, {
          schemaVersion: 'github-pages-auditor.launcherIconCache.v1',
          siteId: site.id,
          ownerRepo: site.ownerRepo,
          pageUrl: site.url,
          sourceIconUrl: candidateUrl!,
          sourceKind: candidateSourceKind!,
          contentType: result.contentType,
          encoding: 'base64',
          dataBase64: result.dataBase64,
          byteLength: result.byteLength,
          sha256: result.sha256,
          fetchedAt: result.fetchedAt
        });

        if (active) {
          setCachedDataUrl(toIconDataUrl(result.contentType, result.dataBase64));
        }
      } catch (err) {
        failedResolutions.add(resolutionKey);
        console.warn('Silent background resolver error:', err);
      } finally {
        inFlightResolutions.delete(resolutionKey);
      }
    }

    checkCacheAndTriggerResolve();

    return () => {
      active = false;
    };
  }, [user, site.id, candidateUrl, candidateSourceKind, env]);

  const showCached = !!cachedDataUrl;
  const showPwa = !showCached && showPwaWithoutCache;
  const showFav = !showCached && showFavWithoutCache;

  const isLarge = sizeClass.includes('68') || sizeClass.includes('16');
  const textClass = isLarge ? 'text-2xl' : 'text-xl';

  if (!showCached && !showPwa && !showFav) {
    return (
      <div className={`${sizeClass} bg-slate-100 group-hover:bg-indigo-50 group-hover:text-indigo-600 rounded-xl flex items-center justify-center text-slate-600 font-bold ${textClass} uppercase tracking-wider select-none shrink-0 border border-slate-200 group-hover:border-indigo-200 transition-colors duration-300 group-hover:rotate-3`}>
        {site.name.charAt(0)}
      </div>
    );
  }

  return (
    <div className="flex items-end gap-2 shrink-0">
      {showCached && (
        <div className="relative group/cached">
          <img
            src={cachedDataUrl!}
            alt="Cached Site Icon"
            className={`${sizeClass} object-contain rounded-xl select-none shrink-0 border-2 border-indigo-200/50 dark:border-indigo-800/50 bg-indigo-50/30 dark:bg-indigo-950/20 p-1 transition-all group-hover:scale-105 duration-300 shadow-xs`}
            onError={() => setCachedDataUrl(null)}
            referrerPolicy="no-referrer"
          />
        </div>
      )}
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
});

const CircularDomainBadge = React.memo(function CircularDomainBadge({ site }: { site: LauncherSite }) {
  const [isHovered, setIsHovered] = React.useState(false);
  const [isVisible, setIsVisible] = React.useState(true);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => setIsVisible(entry.isIntersecting));
      },
      { rootMargin: '0px', threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const pathId = `circle-path-${site.id}`;
  
  const isProjectDefaultMode = !site.customDomain;
  const rawText = isProjectDefaultMode ? (site.name || '') : (site.hostname || '');

  // Determine repeat count to pad/repeat text on the circular path
  let count = 1;
  if (rawText.length < 8) {
    count = 3;
  } else if (rawText.length < 16) {
    count = 2;
  }

  let contentNodes;
  
  if (isProjectDefaultMode) {
    contentNodes = Array.from({ length: count }).map((_, index) => (
      <React.Fragment key={index}>
        <tspan className="text-emerald-500 fill-emerald-500 transition-colors duration-300" fill="#10b981">
          {rawText}
        </tspan>
        <tspan className="text-slate-200 fill-slate-200 transition-colors duration-300" fill="currentColor">
          {" "}•{" "}
        </tspan>
      </React.Fragment>
    ));
  } else {
    // Split the domain to find the lowest domain fragment
    const parts = rawText.split('.');
    const lowestFragment = parts[0] || '';
    const restOfDomain = parts.slice(1).join('.');
    const restSuffix = restOfDomain ? `.${restOfDomain}` : '';

    contentNodes = Array.from({ length: count }).map((_, index) => (
      <React.Fragment key={index}>
        <tspan className="text-blue-600 fill-blue-600 transition-colors duration-300" fill="#2563eb">
          {lowestFragment}
        </tspan>
        <tspan className="text-slate-200 fill-slate-200 transition-colors duration-300" fill="currentColor">
          {restSuffix} •{" "}
        </tspan>
      </React.Fragment>
    ));
  }

  return (
    <div 
      ref={containerRef}
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
          animationName: 'spin',
          animationDuration: isHovered ? '8s' : '18s',
          animationTimingFunction: 'linear',
          animationIterationCount: 'infinite',
          animationPlayState: isVisible ? 'running' : 'paused',
          willChange: 'transform',
          transformOrigin: 'center',
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
            {contentNodes}
          </textPath>
        </text>
      </svg>
    </div>
  );
});

interface LauncherCardItemProps {
  site: LauncherSite;
  x: number;
  y: number;
  isDragged: boolean;
  readOnly: boolean;
  baseIndex: number;
  onDragStart: (e: React.PointerEvent, id: string) => void;
  onDragEnd: () => void;
}

const LauncherCardItem = React.memo(function LauncherCardItem({
  site,
  x,
  y,
  isDragged,
  readOnly,
  baseIndex,
  onDragStart,
  onDragEnd,
}: LauncherCardItemProps) {
  const [isPressed, setIsPressed] = React.useState(false);
  const [bubblePlacement, setBubblePlacement] = React.useState<'top' | 'left' | 'right'>('top');
  const containerRef = React.useRef<HTMLDivElement>(null);
  const pressTimer = React.useRef<any>(null);
  const wasHeld = React.useRef(false);

  const startX = React.useRef(0);
  const startY = React.useRef(0);
  const startNodeY = React.useRef(0);
  const hasMoved = React.useRef(false);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return; // Only main left click

    startX.current = e.clientX;
    startY.current = e.clientY;
    startNodeY.current = y;
    hasMoved.current = false;
    wasHeld.current = false;

    if (pressTimer.current) clearTimeout(pressTimer.current);

    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceTop = rect.top;
      const spaceRight = window.innerWidth - rect.right;
      const spaceLeft = rect.left;

      if (spaceTop > 245) {
        setBubblePlacement('top');
      } else if (spaceRight > 320) {
        setBubblePlacement('right');
      } else if (spaceLeft > 320) {
        setBubblePlacement('left');
      } else {
        setBubblePlacement(spaceRight >= spaceLeft ? 'right' : 'left');
      }
    }

    // Active long-press threshold at 200ms
    pressTimer.current = setTimeout(() => {
      setIsPressed(true);
      wasHeld.current = true;
    }, 200);

    onDragStart(e, site.id);
  };

  const handleGlobalPointerMove = (e: PointerEvent) => {
    if (!isDragged) return;
    const dx = e.clientX - startX.current;
    const dy = e.clientY - startY.current;
    if (Math.hypot(dx, dy) > 5) {
      hasMoved.current = true;
    }
  };

  const handlePointerUp = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
    setIsPressed(false);
    onDragEnd();
  };

  React.useEffect(() => {
    if (isDragged) {
      window.addEventListener('pointermove', handleGlobalPointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    } else {
      // Ensure we clear the timer and close the bubble on release
      if (pressTimer.current) {
        clearTimeout(pressTimer.current);
        pressTimer.current = null;
      }
      setIsPressed(false);
    }
    return () => {
      window.removeEventListener('pointermove', handleGlobalPointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isDragged]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
  };

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

  const computedZIndex = isDragged ? 40000 + (1000 - baseIndex) + (y > startNodeY.current ? -10000 : y < startNodeY.current ? 10000 : 0) : isPressed ? 50000 + (1000 - baseIndex) : 20000 + (1000 - baseIndex);

  return (
    <div 
      id={`launcher-node-${site.id}`}
      ref={containerRef}
      className="absolute flex flex-col items-center justify-center p-4 touch-none select-none"
      onContextMenu={handleContextMenu}
      style={{
        left: 0,
        top: 0,
        width: 112,
        height: 112,
        transform: `translate3d(${x - 56}px, ${y - 56}px, 0)`,
        zIndex: computedZIndex,
        cursor: isDragged ? 'grabbing' : 'grab',
        transition: isDragged ? 'none' : 'transform 0.15s cubic-bezier(0.25, 0.8, 0.25, 1)',
      }}
    >
      <a
        href={site.url}
        target="_blank"
        rel="noopener noreferrer"
        className="cursor-pointer active:scale-95 transition-all duration-200 select-none touch-none"
        onPointerDown={handlePointerDown}
        onClick={(e) => {
          if (hasMoved.current || wasHeld.current) {
            e.preventDefault();
          }
        }}
        title={site.url}
      >
        <CircularDomainBadge site={site} />
      </a>

      {isPressed && (
        <div className={`absolute ${placementClasses} w-max max-w-[220px] bg-white border border-indigo-600 rounded-lg shadow-xl p-1.5 z-50 pointer-events-none animate-in fade-in zoom-in-95 duration-100 ease-out`}>
          <div className={arrowBodyClasses}></div>
          <div className={arrowBorderClasses}></div>

          <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/20 via-transparent to-purple-50/10 pointer-events-none rounded-lg"></div>
          
          <div className="flex justify-between items-start mb-1 relative z-10 gap-2">
            <LauncherSiteIcon site={site} sizeClass="w-5 h-5" />
            <span className="text-[9px] text-slate-400 font-mono font-semibold px-1 py-0.5 rounded-sm bg-slate-100 border border-slate-200">
              METADATA
            </span>
          </div>

          <div className="mb-1.5 relative z-10 text-left">
            <h4 className="font-bold text-slate-900 text-xs truncate">
              {site.name}
            </h4>
            <p className="text-[9px] text-slate-500 truncate" title={site.ownerRepo}>
              {site.ownerRepo}
            </p>
          </div>

          <div className="flex flex-wrap gap-1 pt-1.5 border-t border-slate-100 relative z-10 text-left">
            <span className="inline-flex items-center px-1 py-0.5 rounded text-[9px] font-medium bg-slate-100 text-slate-700 truncate max-w-[120px]" title={site.hostname}>
              {site.hostname}
            </span>
            <span className="inline-flex items-center px-1 py-0.5 rounded text-[9px] font-mono font-medium bg-slate-100 text-slate-700" title={`z-index: ${computedZIndex}`}>
              z: {computedZIndex}
            </span>
            {site.httpsState === 'enforced' && (
              <span className="inline-flex items-center px-1 py-0.5 rounded text-[9px] font-semibold bg-green-50 text-emerald-700 border border-green-200">
                HTTPS
              </span>
            )}
            {site.deploymentMethod === 'workflow' && (
              <span className="inline-flex items-center px-1 py-0.5 rounded text-[9px] font-semibold bg-blue-50 text-indigo-700 border border-blue-200">
                Workflow
              </span>
            )}
            {site.isPwa && (
              <span className="inline-flex items-center px-1 py-0.5 rounded text-[9px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100 shadow-2xs">
                PWA
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

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
  onOrderChange?: (newIds: string[]) => void | Promise<void>;
  onReset?: () => void | Promise<void>;
  showReset?: boolean;
  readOnly?: boolean;
}

interface PhysicsNode {
  id: string;
  site: LauncherSite;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  baseIndex: number;
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
  onReset,
  showReset = true,
  readOnly = false,
  onOrderChange,
  animationSpeed,
  visibleIconsRange,
  onSettingsChange
}: LauncherGridProps) {
  const arenaRef = React.useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = React.useState({ width: 800, height: 500 });
  
  const [physicsNodes, setPhysicsNodes] = React.useState<PhysicsNode[]>([]);
  const nodesRef = React.useRef<PhysicsNode[]>([]);
  const activeDragIdRef = React.useRef<string | null>(null);
  const [activeDragId, setActiveDragId] = React.useState<string | null>(null);

  const [speedMultiplier, setSpeedMultiplier] = React.useState(animationSpeed ?? 1.0); 
  const speedMultiplierRef = React.useRef(animationSpeed ?? 1.0);
  const [showControls, setShowControls] = React.useState(false);
  const [maxVisibleCount, setMaxVisibleCount] = React.useState<number>(visibleIconsRange ?? 20);

  // Sync props to state when they change (loading from Firestore)
  React.useEffect(() => {
    if (animationSpeed !== null && animationSpeed !== undefined) {
      setSpeedMultiplier(animationSpeed);
    }
  }, [animationSpeed]);

  React.useEffect(() => {
    if (visibleIconsRange !== null && visibleIconsRange !== undefined) {
      setMaxVisibleCount(visibleIconsRange);
    }
  }, [visibleIconsRange]);

  React.useEffect(() => {
    speedMultiplierRef.current = speedMultiplier;
  }, [speedMultiplier]);

  // Measure and trace accurate container bounds
  React.useEffect(() => {
    if (!arenaRef.current) return;
    const updateSize = () => {
      const rect = arenaRef.current?.getBoundingClientRect();
      if (rect) {
        setDimensions({
          width: rect.width || 800,
          height: rect.height || 500
        });
      }
    };
    
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Sync sites with internal physics nodes ref representation
  React.useEffect(() => {
    const cx = dimensions.width / 2;
    const cy = dimensions.height / 2;
    
    const prev = nodesRef.current;
    const activeSites = sites.slice(0, maxVisibleCount);

    const synced = activeSites.map((site, index) => {
      const existing = prev.find(n => n.id === site.id);
      if (existing) {
        return { ...existing, site, baseIndex: index };
      }
      
      // Compute deterministic outward spiral from center
      const angle = index * 1.6;
      const distance = 70 + index * 42;
      return {
        id: site.id,
        site,
        x: cx + Math.cos(angle) * distance,
        y: cy + Math.sin(angle) * distance,
        vx: 0,
        vy: 0,
        radius: 56,
        baseIndex: index
      };
    });
    
    nodesRef.current = synced;
    setPhysicsNodes(synced);
  }, [sites, dimensions.width, dimensions.height, maxVisibleCount]);

  // Regular periodic updates inside a standard requestAnimationFrame loops
  React.useEffect(() => {
    let animationFrameId: number;

    const tick = () => {
      const dragId = activeDragIdRef.current;
      const currentNodes = [...nodesRef.current];
      if (currentNodes.length === 0) {
        animationFrameId = requestAnimationFrame(tick);
        return;
      }

      const cx = dimensions.width / 2;
      const cy = dimensions.height / 2;
      
      // Packing physical parameters
      const kCenter = 0.045; // Attraction force scaling towards center
      const radiusSum = 126; // Double radii (56x2) + spacing buffer (14px)
      const damping = 0.84; // Soft deceleration factor

      // 1. Core Attraction towards Center
      currentNodes.forEach(node => {
        if (node.id === dragId) return;
        const dx = cx - node.x;
        const dy = cy - node.y;
        node.vx += dx * kCenter;
        node.vy += dy * kCenter;
      });

      // 2. Pairwise Mutual Collision Resolution
      for (let i = 0; i < currentNodes.length; i++) {
        for (let j = i + 1; j < currentNodes.length; j++) {
          const u = currentNodes[i];
          const v = currentNodes[j];
          const dx = v.x - u.x;
          const dy = v.y - u.y;
          const dist = Math.hypot(dx, dy);

          if (dist < radiusSum && dist > 0.1) {
            const overlap = radiusSum - dist;
            const nx = dx / dist;
            const ny = dy / dist;

            const force = overlap * 0.42;

            const sm = speedMultiplierRef.current * 0.3;

            if (u.id !== dragId) {
              u.vx -= nx * force * 0.5 * sm;
              u.vy -= ny * force * 0.5 * sm;
              u.x -= nx * overlap * 0.25 * sm;
              u.y -= ny * overlap * 0.25 * sm;
            }
            if (v.id !== dragId) {
              v.vx += nx * force * 0.5 * sm;
              v.vy += ny * force * 0.5 * sm;
              v.x += nx * overlap * 0.25 * sm;
              v.y += ny * overlap * 0.25 * sm;
            }
          }
        }
      }

      // 3. Keep within physical container limits
      const margin = 56;
      currentNodes.forEach(node => {
        if (node.id === dragId) return;

        if (node.x < margin) {
          node.x = margin;
          node.vx = Math.abs(node.vx) * 0.4;
        }
        if (node.x > dimensions.width - margin) {
          node.x = dimensions.width - margin;
          node.vx = -Math.abs(node.vx) * 0.4;
        }
        if (node.y < margin) {
          node.y = margin;
          node.vy = Math.abs(node.vy) * 0.4;
        }
        if (node.y > dimensions.height - margin) {
          node.y = dimensions.height - margin;
          node.vy = -Math.abs(node.vy) * 0.4;
        }
      });

      // 4. Position accumulation and dynamic velocity decay
      currentNodes.forEach(node => {
        const sm = speedMultiplierRef.current * 0.3;
        if (node.id === dragId) return;
        node.x += node.vx * 0.16 * sm;
        node.y += node.vy * 0.16 * sm;
        // Damping also depends on how strongly it's affected, but static damping is okay for preserving inertia organically
        node.vx *= damping;
        node.vy *= damping;
      });

      nodesRef.current = currentNodes;
      
      // OPTIMIZATION: Update direct DOM styles to bypass React render cycle for 60fps performance
      currentNodes.forEach(node => {
        const el = document.getElementById(`launcher-node-${node.id}`);
        if (el) {
          el.style.transform = `translate3d(${node.x - 56}px, ${node.y - 56}px, 0)`;
        }
      });

      animationFrameId = requestAnimationFrame(tick);
    };

    animationFrameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrameId);
  }, [dimensions]);

  const handleDragStart = React.useCallback((e: React.PointerEvent, id: string) => {
    if (readOnly) return;
    activeDragIdRef.current = id;
    setActiveDragId(() => id);
    setPhysicsNodes(() => [...nodesRef.current]);
  }, [readOnly]);

  const handleDragEnd = React.useCallback(() => {
    const dragId = activeDragIdRef.current;
    if (!dragId) return;

    // Calculate final layout positions to resolve new ordered list representation
    const finalNodes = [...nodesRef.current];
    // Sort strictly by Y coordinate as requested, falling back to X if exactly equal
    const sorted = [...finalNodes].sort((a, b) => {
      if (a.y !== b.y) {
        return a.y - b.y;
      }
      return a.x - b.x;
    });

    const newActiveIds = sorted.map(n => n.id);
    const hiddenIds = sites.filter(s => !newActiveIds.includes(s.id)).map(s => s.id);
    const finalIds = [...newActiveIds, ...hiddenIds];
    
    const oldIds = sites.map(s => s.id);

    const hasOrderChanged = finalIds.some((id, index) => id !== oldIds[index]);

    if (hasOrderChanged && onOrderChange) {
      onOrderChange(finalIds);
    }

    activeDragIdRef.current = null;
    setActiveDragId(() => null);
    setPhysicsNodes(() => [...nodesRef.current]);
  }, [sites, onOrderChange]);

  const handleArenaPointerMove = (e: React.PointerEvent) => {
    const dragId = activeDragIdRef.current;
    if (!dragId || !arenaRef.current) return;

    const rect = arenaRef.current.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    const margin = 56;
    const cx = Math.max(margin, Math.min(dimensions.width - margin, px));
    const cy = Math.max(margin, Math.min(dimensions.height - margin, py));

    nodesRef.current = nodesRef.current.map(node => {
      if (node.id === dragId) {
        return {
          ...node,
          x: cx,
          y: cy,
          vx: 0,
          vy: 0
        };
      }
      return node;
    });
    
    // OPTIMIZATION: Update dragged exact pos immediately via style bypassing state re-render
    const el = document.getElementById(`launcher-node-${dragId}`);
    if (el) {
      el.style.transform = `translate3d(${cx - 56}px, ${cy - 56}px, 0)`;
    }
  };

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
    <div className="flex flex-col min-h-0 bg-slate-50 p-0 sm:p-6 md:p-10 font-sans h-full overflow-hidden relative">
      {/* Dynamic Ambient Background Blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div 
          animate={{
            x: [0, 50, -30, 0],
            y: [0, -40, 60, 0],
            scale: [1, 1.1, 0.9, 1],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute -top-[10%] -left-[10%] w-[60%] h-[60%] bg-indigo-300/40 rounded-full blur-[110px]" 
        />
        <motion.div 
          animate={{
            x: [0, -60, 40, 0],
            y: [0, 80, -30, 0],
            scale: [1, 0.9, 1.2, 1],
          }}
          transition={{
            duration: 30,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 2
          }}
          className="absolute top-[20%] -right-[5%] w-[50%] h-[50%] bg-sky-300/45 rounded-full blur-[100px]" 
        />
        <motion.div 
          animate={{
            x: [0, 70, -80, 0],
            y: [0, -50, 40, 0],
            scale: [1, 1.2, 0.8, 1],
          }}
          transition={{
            duration: 35,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 4
          }}
          className="absolute -bottom-[10%] left-[10%] w-[70%] h-[70%] bg-purple-300/35 rounded-full blur-[130px]" 
        />
        <motion.div 
          animate={{
            x: [-40, 40, -50, -40],
            y: [30, -60, 50, 30],
            scale: [0.8, 1.1, 0.9, 0.8],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1
          }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[40%] h-[40%] bg-blue-200/50 rounded-full blur-[90px]" 
        />
      </div>

      <div 
        className="absolute inset-0 opacity-[0.2] pointer-events-none mix-blend-multiply transition-opacity duration-1000"
        style={{
          backgroundImage: `
            linear-gradient(45deg, #e2e8f0 12.5%, transparent 12.5%, transparent 37.5%, #e2e8f0 37.5%, #e2e8f0 62.5%, transparent 62.5%, transparent 87.5%, #e2e8f0 87.5%),
            linear-gradient(135deg, #e2e8f0 12.5%, transparent 12.5%, transparent 37.5%, #e2e8f0 37.5%, #e2e8f0 62.5%, transparent 62.5%, transparent 87.5%, #e2e8f0 87.5%)
          `,
          backgroundSize: '32px 32px',
          backgroundPosition: '0 0, 16px 16px',
        }}
      ></div>
      <div className="max-w-7xl mx-auto w-full flex-1 flex flex-col relative z-10 min-h-0">
        
        {/* Mobile Controls Toggle (Fixed floating at corner) */}
        <div className="sm:hidden absolute bottom-6 right-6 z-50 flex flex-col items-end gap-2">
          {showControls && (
            <div className="bg-white/90 backdrop-blur-md rounded-2xl p-4 shadow-xl border border-slate-200 flex flex-col gap-4 shrink-0 animate-in fade-in slide-in-from-bottom-2 duration-200">
              <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-2">
                <span className="text-sm font-bold text-slate-800">Layout Settings</span>
                <button aria-label="Close settings" className="text-slate-400 hover:text-slate-600" onClick={() => setShowControls(false)}>
                   <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="physicsSpeedMobile" className="text-xs font-semibold text-slate-600 whitespace-nowrap">
                  Animation Speed
                </label>
                <div className="flex items-center gap-3">
                  <input
                    id="physicsSpeedMobile"
                    type="range"
                    min="0.0"
                    max="3.0"
                    step="0.1"
                    value={speedMultiplier}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setSpeedMultiplier(val);
                      if (onSettingsChange) onSettingsChange({ animationSpeed: val });
                    }}
                    className="w-32 accent-indigo-600 cursor-pointer"
                  />
                  <span className="text-xs font-mono font-medium text-slate-600 w-8">{speedMultiplier.toFixed(1)}x</span>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="maxVisibleMobile" className="text-xs font-semibold text-slate-600 whitespace-nowrap">
                  Visible Icons Range
                </label>
                <div className="flex items-center gap-3">
                  <input
                    id="maxVisibleMobile"
                    type="range"
                    min="1"
                    max={Math.max(sites.length, 1)}
                    step="1"
                    value={maxVisibleCount}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      setMaxVisibleCount(val);
                      if (onSettingsChange) onSettingsChange({ visibleIconsRange: val });
                    }}
                    className="w-32 accent-indigo-600 cursor-pointer"
                  />
                  <span className="text-xs font-mono font-medium text-slate-600 w-8">{maxVisibleCount}</span>
                </div>
              </div>
            </div>
          )}
          
          {!showControls && (
            <button 
              onClick={() => setShowControls(true)}
              className="w-12 h-12 bg-white rounded-full shadow-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:text-indigo-600 hover:border-indigo-200 focus:outline-none hover:bg-indigo-50 transition-colors"
              aria-label="Toggle layout settings"
            >
              <Settings2 className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Desktop inline slider (hidden on mobile) */}
        <div className="hidden sm:flex mb-4 bg-white/80 backdrop-blur-md rounded-xl p-4 shadow-sm border border-slate-200 items-center justify-start gap-8 shrink-0 mx-4 sm:mx-0">
          <div className="flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-semibold text-slate-700 whitespace-nowrap">
              Layout Settings
            </span>
          </div>

          <div className="w-px h-6 bg-slate-200" />

          <div className="flex items-center gap-3 w-64">
            <label htmlFor="physicsSpeedDesktop" className="text-xs font-medium text-slate-600 whitespace-nowrap">
              Animation Speed
            </label>
            <input
              id="physicsSpeedDesktop"
              type="range"
              min="0.0"
              max="3.0"
              step="0.1"
              value={speedMultiplier}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setSpeedMultiplier(val);
                if (onSettingsChange) onSettingsChange({ animationSpeed: val });
              }}
              className="w-full accent-indigo-600 cursor-pointer"
            />
            <span className="text-xs font-mono font-medium text-slate-500 w-8">{speedMultiplier.toFixed(1)}x</span>
          </div>

          <div className="flex items-center gap-3 w-64">
            <label htmlFor="maxVisibleDesktop" className="text-xs font-medium text-slate-600 whitespace-nowrap">
              Visible Icons Range
            </label>
            <input
              id="maxVisibleDesktop"
              type="range"
              min="1"
              max={Math.max(sites.length, 1)}
              step="1"
              value={maxVisibleCount}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                setMaxVisibleCount(val);
                if (onSettingsChange) onSettingsChange({ visibleIconsRange: val });
              }}
              className="w-full accent-indigo-600 cursor-pointer"
            />
            <span className="text-xs font-mono font-medium text-slate-500 w-8">{maxVisibleCount}</span>
          </div>
        </div>

        {/* Instruction and Reset removed */}
        {saveWarning && (
          <div className="mb-6 bg-yellow-50 border border-yellow-200 text-yellow-800 p-3 rounded-lg text-sm flex items-center gap-2 shadow-sm">
            <AlertCircle className="w-4 h-4 shrink-0 text-yellow-600" />
            <p>{saveWarning}</p>
          </div>
        )}

        {/* 2D Physics Arena Playground */}
        <div 
          ref={arenaRef}
          className="relative w-full flex-1 bg-white/40 backdrop-blur-xs border-y sm:border-2 border-slate-200/60 rounded-none sm:rounded-[32px] shadow-sm overflow-hidden select-none"
          style={{
            backgroundImage: 'radial-gradient(circle, #cbd5e1 1.5px, transparent 1.5px)',
            backgroundSize: '24px 24px',
          }}
          onPointerMove={handleArenaPointerMove}
          onPointerUp={handleDragEnd}
          onPointerCancel={handleDragEnd}
        >
          {physicsNodes.map((node) => (
            <LauncherCardItem
              key={node.id}
              site={node.site}
              x={node.x}
              y={node.y}
              baseIndex={node.baseIndex}
              isDragged={node.id === activeDragId}
              readOnly={readOnly}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
