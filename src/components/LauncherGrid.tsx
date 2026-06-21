import React from 'react';
import { LauncherSite } from '../lib/launcherSites';
import { AlertCircle, ChevronLeft, ChevronRight, RotateCcw, ExternalLink, Database, Loader2, Maximize2, Minimize2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';

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
  
  // Split the domain to find the lowest domain fragment (left-most part, e.g. "pages" in "pages.moukaeritai.work")
  const parts = rawText.split('.');
  const lowestFragment = parts[0] || '';
  const restOfDomain = parts.slice(1).join('.');
  const restSuffix = restOfDomain ? `.${restOfDomain}` : '';

  // Determine repeat count to pad/repeat domain text on the circular path
  let count = 1;
  if (rawText.length < 8) {
    count = 3;
  } else if (rawText.length < 16) {
    count = 2;
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
            {Array.from({ length: count }).map((_, index) => (
              <React.Fragment key={index}>
                <tspan className="text-blue-600 fill-blue-600 transition-colors duration-300" fill="#2563eb">
                  {lowestFragment}
                </tspan>
                <tspan className="text-slate-200 fill-slate-200 transition-colors duration-300" fill="currentColor">
                  {restSuffix} •{" "}
                </tspan>
              </React.Fragment>
            ))}
          </textPath>
        </text>
      </svg>
    </div>
  );
}

interface LauncherCardItemProps {
  site: LauncherSite;
  x: number;
  y: number;
  isDragged: boolean;
  readOnly: boolean;
  onDragStart: (e: React.PointerEvent, id: string) => void;
  onDragEnd: () => void;
}

function LauncherCardItem({
  site,
  x,
  y,
  isDragged,
  readOnly,
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
  const hasMoved = React.useRef(false);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return; // Only main left click

    startX.current = e.clientX;
    startY.current = e.clientY;
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
      if (pressTimer.current) {
        clearTimeout(pressTimer.current);
        pressTimer.current = null;
      }
      setIsPressed(false);
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

  return (
    <div 
      ref={containerRef}
      className="absolute flex flex-col items-center justify-center p-4 touch-none select-none"
      onContextMenu={handleContextMenu}
      style={{
        left: 0,
        top: 0,
        width: 112,
        height: 112,
        transform: `translate3d(${x - 56}px, ${y - 56}px, 0)`,
        zIndex: isDragged ? 40 : 20,
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
        <div className={`absolute ${placementClasses} min-w-[280px] sm:min-w-[320px] bg-white border-2 border-indigo-600 rounded-2xl shadow-xl p-5 z-50 pointer-events-none animate-in fade-in zoom-in-95 duration-100 ease-out`}>
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
  onOrderChange
}: LauncherGridProps) {
  const arenaRef = React.useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = React.useState({ width: 800, height: 500 });
  
  const [physicsNodes, setPhysicsNodes] = React.useState<PhysicsNode[]>([]);
  const nodesRef = React.useRef<PhysicsNode[]>([]);
  const activeDragIdRef = React.useRef<string | null>(null);
  const [activeDragId, setActiveDragId] = React.useState<string | null>(null);

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
    const synced = sites.map((site, index) => {
      const existing = prev.find(n => n.id === site.id);
      if (existing) {
        return { ...existing, site };
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
        radius: 56
      };
    });
    
    nodesRef.current = synced;
    setPhysicsNodes(synced);
  }, [sites, dimensions.width, dimensions.height]);

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

            if (u.id !== dragId) {
              u.vx -= nx * force * 0.5;
              u.vy -= ny * force * 0.5;
              u.x -= nx * overlap * 0.25;
              u.y -= ny * overlap * 0.25;
            }
            if (v.id !== dragId) {
              v.vx += nx * force * 0.5;
              v.vy += ny * force * 0.5;
              v.x += nx * overlap * 0.25;
              v.y += ny * overlap * 0.25;
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
        if (node.id === dragId) return;
        node.x += node.vx * 0.16;
        node.y += node.vy * 0.16;
        node.vx *= damping;
        node.vy *= damping;
      });

      nodesRef.current = currentNodes;
      setPhysicsNodes([...currentNodes]);

      animationFrameId = requestAnimationFrame(tick);
    };

    animationFrameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrameId);
  }, [dimensions]);

  const handleDragStart = (e: React.PointerEvent, id: string) => {
    if (readOnly) return;
    activeDragIdRef.current = id;
    setActiveDragId(id);
  };

  const handleDragEnd = () => {
    const dragId = activeDragIdRef.current;
    if (!dragId) return;

    // Calculate final layout positions to resolve new ordered list representation
    const finalNodes = [...nodesRef.current];
    // Sort primarily by row Y coordinates (bucketed to 150px rows), then by X coordinate
    const sorted = [...finalNodes].sort((a, b) => {
      const rowA = Math.floor(a.y / 150);
      const rowB = Math.floor(b.y / 150);
      if (rowA !== rowB) {
        return rowA - rowB;
      }
      return a.x - b.x;
    });

    const newIds = sorted.map(n => n.id);
    const oldIds = sites.map(s => s.id);

    const hasOrderChanged = newIds.some((id, index) => id !== oldIds[index]);

    if (hasOrderChanged && onOrderChange) {
      onOrderChange(newIds);
    }

    activeDragIdRef.current = null;
    setActiveDragId(null);
  };

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
    setPhysicsNodes([...nodesRef.current]);
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

      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.15] pointer-events-none mix-blend-multiply animate-[pulse_10s_ease-in-out_infinite]"></div>
      <div className="max-w-7xl mx-auto w-full flex-1 flex flex-col relative z-10 min-h-0">
        
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
