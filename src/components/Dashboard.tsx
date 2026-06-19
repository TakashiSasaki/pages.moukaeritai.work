import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { RepositoryResult } from '../types';
import { buildJsonExport, buildCsvExport } from '../export/exportBuilders';
import { buildJsonExportV2 } from '../export/exportBuildersV2';
import { ExportBuildContext } from '../schema/exportTypes';
import { useAuth } from '../AuthContext';
import Ajv from 'ajv';
import schema from '@/schemas/github-pages-auditor-export-v2.schema.json';
import { getEnvironmentName, getAuditCollectionPath } from '../lib/firestorePaths';
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
  Save,
  ArrowLeft,
  Info
} from 'lucide-react';

const COLUMN_HELP: Record<string, { title: string; description: string; values: { label: string; desc: string; }[] }> = {
  repository: {
    title: "Repository",
    description: "The name of the GitHub repository. Indicates if it's a fork or not.",
    values: []
  },
  pagesStatus: {
    title: "Pages Status",
    description: "Indicates whether GitHub Pages is configured and active for the repository.",
    values: [
      { label: "enabled", desc: "Pages is active and currently published." },
      { label: "not_found", desc: "Pages is not configured or disabled currently." },
      { label: "error", desc: "Could not fetch Pages status due to an API error." }
    ]
  },
  deploySource: {
    title: "Deploy Source",
    description: "Describes the method used to build and deploy the GitHub Pages site.",
    values: [
      { label: "actions", desc: "The site is automatically built and deployed using a GitHub Actions workflow." },
      { label: "branch", desc: "The site is built from a specific classic branch (e.g., gh-pages, main) and directory." },
      { label: "not_configured", desc: "No deployment source is configured." }
    ]
  },
  customDomain: {
    title: "Custom Domain",
    description: "Indicates if a custom domain is associated with the Pages site and its current DNS verification status.",
    values: [
      { label: "custom_domain_configured", desc: "A custom domain is set up and successfully verified." },
      { label: "custom_domain_pending", desc: "A custom domain has been added, but DNS verification is still pending." },
      { label: "custom_domain_unverified_or_unknown", desc: "A custom domain is applied, but verification status could not be confirmed or failed." },
      { label: "no_custom_domain", desc: "The site is hosted on the default *.github.io subdomain." }
    ]
  },
  https: {
    title: "HTTPS & Security",
    description: "Shows whether the site enforces HTTPS connections to secure traffic.",
    values: [
      { label: "https_enforced", desc: "All HTTP requests are automatically redirected to HTTPS." },
      { label: "https_not_enforced", desc: "Both HTTP and HTTPS traffic are accepted (enforce option is disabled)." },
      { label: "https_unavailable_or_error", desc: "HTTPS is not available (e.g., certificate provisioning issue) or status is unknown." }
    ]
  }
};

export default function Dashboard() {
  const { user, hasStoredPat, getStoredPat, getStoredTokenType } = useAuth();
  const { auditId } = useParams<{ auditId?: string }>();
  const navigate = useNavigate();

  const [isAuditing, setIsAuditing] = useState(false);
  const [auditProgress, setAuditProgress] = useState<{
    current: number;
    total: number;
    repo: string;
    stage: 'idle' | 'fetching' | 'auditing';
  }>({
    current: 0,
    total: 0,
    repo: '',
    stage: 'idle'
  });
  const [results, setResults] = useState<RepositoryResult[] | null>(null);
  const [auditCreatedAt, setAuditCreatedAt] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [isLoadingResults, setIsLoadingResults] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [showDomainLockGuide, setShowDomainLockGuide] = useState(false);
  const [columnGuideModal, setColumnGuideModal] = useState<string | null>(null);
  const [cachedAudit, setCachedAudit] = useState<{ auditId: string; createdAt: string } | null>(null);
  const [isLoadingCache, setIsLoadingCache] = useState(false);
  const [validationResult, setValidationResult] = useState<{ valid: boolean; errors?: any[] | null } | null>(null);
  const [isValidatingSchema, setIsValidatingSchema] = useState(false);
  const location = useLocation();
  const activeTab = location.pathname.endsWith('/report') 
    ? 'details' 
    : location.pathname.endsWith('/json') 
      ? 'json' 
      : location.pathname.endsWith('/schema') 
        ? 'schema' 
        : 'summary';

  const handleTabChange = (tab: 'summary' | 'details' | 'json' | 'schema') => {
    let basePath = auditId ? `/results/${auditId}` : '';
    if (!basePath) basePath = '/';
    
    if (tab === 'summary') {
      navigate(basePath);
    } else if (tab === 'details') {
      navigate(basePath === '/' ? '/report' : `${basePath}/report`);
    } else if (tab === 'json') {
      navigate(basePath === '/' ? '/json' : `${basePath}/json`);
    } else if (tab === 'schema') {
      navigate(basePath === '/' ? '/schema' : `${basePath}/schema`);
    }
  };

  // Memoized JSON export string and tokenized elements to address extreme latency issues
  const [exportContext, setExportContext] = useState<ExportBuildContext>({
    userMode: 'anonymous',
    appEnvironment: import.meta.env.MODE === 'production' ? 'production' : 'dev',
    tokenType: null,
    githubLogin: null
  });

  useEffect(() => {
    async function determineTokenDetails() {
      if (!user) return;
      try {
        const derivedTokenType = await getStoredTokenType();
        
        let login: string | null = null;
        if (results && results.length > 0) {
          const owners = results.map(r => r.ownerName);
          const counts = owners.reduce((acc, curr) => {
            acc[curr] = (acc[curr] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);
          const maxOwner = Object.entries(counts).sort((a, b) => (b[1] as number) - (a[1] as number))[0];
          if (maxOwner) {
            login = maxOwner[0];
          }
        }

        setExportContext(prev => ({
          ...prev,
          userMode: user.isAnonymous ? 'anonymous' : 'google',
          tokenType: derivedTokenType,
          githubLogin: login
        }));
      } catch (err) {
        console.error("Error determining token details for export context:", err);
      }
    }
    determineTokenDetails();
  }, [user, results, getStoredTokenType]);

  const buildContext = useMemo((): ExportBuildContext => {
    return {
      auditRunId: auditId && auditId !== 'guest' ? auditId : null,
      auditCreatedAt: auditCreatedAt,
      exportedAt: new Date().toISOString(),
      userMode: user ? (user.isAnonymous ? 'anonymous' : 'google') : undefined,
      githubLogin: exportContext.githubLogin,
      appEnvironment: import.meta.env.MODE === 'production' ? 'production' : 'dev',
      tokenType: exportContext.tokenType
    };
  }, [auditId, auditCreatedAt, user, exportContext.githubLogin, exportContext.tokenType]);

  const jsonExportString = useMemo(() => {
    if (!results) return '';
    return JSON.stringify(buildJsonExportV2(results, buildContext), null, 2);
  }, [results, buildContext]);

  const schemaString = useMemo(() => {
    return JSON.stringify(schema, null, 2);
  }, []);

  // Check for existing cached audit on load or after audits are finished
  useEffect(() => {
    if (!user || user.isAnonymous || auditId) {
      setCachedAudit(null);
      return;
    }

    let active = true;
    async function checkLatestCache() {
      setIsLoadingCache(true);
      try {
        const { collection, query, orderBy, limit, getDocs } = await import('firebase/firestore');
        const { db } = await import('../lib/firebase');
        const env = getEnvironmentName(import.meta.env.MODE);
        const collectionPath = getAuditCollectionPath(env, user!.uid);
        
        const q = query(collection(db, collectionPath), orderBy('createdAt', 'desc'), limit(1));
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty && active) {
          const doc = snapshot.docs[0];
          const data = doc.data();
          
          let createdAtStr = new Date().toISOString();
          if (data.createdAt) {
            if (typeof data.createdAt.toDate === 'function') {
              createdAtStr = data.createdAt.toDate().toISOString();
            } else if (data.createdAt instanceof Date) {
              createdAtStr = data.createdAt.toISOString();
            } else if (typeof data.createdAt === 'string') {
              createdAtStr = data.createdAt;
            }
          }
          
          setCachedAudit({
            auditId: doc.id,
            createdAt: createdAtStr
          });
        }
      } catch (err) {
        console.error("Failed to load cached audit:", err);
      } finally {
        if (active) {
          setIsLoadingCache(false);
        }
      }
    }

    checkLatestCache();
    return () => {
      active = false;
    };
  }, [user, auditId]);

  useEffect(() => {
    if (!auditCreatedAt) return;
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 15000);
    return () => clearInterval(interval);
  }, [auditCreatedAt]);

  // Filtering & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'enabled' | 'disabled'>('all');
  const [domainFilter, setDomainFilter] = useState<'all' | 'custom' | 'none' | 'unverified' | 'pending'>('all');
  const [httpsFilter, setHttpsFilter] = useState<'all' | 'ok' | 'not_enforced' | 'problem'>('all');

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Scroll and dimension tracking states for virtualized rendering of audit list
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [clientHeight, setClientHeight] = useState(600);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      setScrollTop(container.scrollTop);
    };

    const handleResize = () => {
      setClientHeight(container.clientHeight);
    };

    // Initialize values
    setScrollTop(container.scrollTop);
    setClientHeight(container.clientHeight);

    container.addEventListener('scroll', handleScroll, { passive: true });

    const observer = new ResizeObserver(() => {
      if (container) {
        setClientHeight(container.clientHeight);
      }
    });
    observer.observe(container);

    return () => {
      container.removeEventListener('scroll', handleScroll);
      observer.disconnect();
    };
  }, [results, activeTab]);

  // Reset scroll to top when page or size changes
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [currentPage, pageSize]);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, domainFilter, httpsFilter]);

  // Stats
  const pagesEnabledList = results?.filter(r => r.hasPages) || [];
  const customDomainList = pagesEnabledList.filter(r => r.cname);

  // Fetch report when auditId changes
  useEffect(() => {
    let active = true;
    async function fetchResults() {
      if (!auditId) {
        setResults(null);
        setError(null);
        setAuditCreatedAt(null);
        return;
      }

      if (auditId === 'guest') {
        if (!results) {
          setError('Guest sessions are single-use/in-memory only and persist until page reload. Please start a new audit.');
        } else if (!auditCreatedAt) {
          setAuditCreatedAt(new Date().toISOString());
        }
        return;
      }

      setIsLoadingResults(true);
      setError(null);
      try {
        const { doc, getDoc } = await import('firebase/firestore');
        const { db } = await import('../lib/firebase');
        const env = getEnvironmentName(import.meta.env.MODE);
        const collectionPath = getAuditCollectionPath(env, user!.uid);
        
        const docRef = doc(db, collectionPath, auditId);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
          throw new Error('Specified audit report was not found. It may belong to a different account or has expired.');
        }

        const data = docSnap.data();
        if (active) {
          setResults(data.results);
          
          let createdAtStr = new Date().toISOString();
          if (data.createdAt) {
            if (typeof data.createdAt.toDate === 'function') {
              createdAtStr = data.createdAt.toDate().toISOString();
            } else if (data.createdAt instanceof Date) {
              createdAtStr = data.createdAt.toISOString();
            } else if (typeof data.createdAt === 'string') {
              createdAtStr = data.createdAt;
            }
          }
          setAuditCreatedAt(createdAtStr);
        }
      } catch (err: any) {
        if (active) {
          setError(err.message || 'An error occurred fetching the audit.');
          setResults(null);
          setAuditCreatedAt(null);
        }
      } finally {
        if (active) {
          setIsLoadingResults(false);
        }
      }
    }

    fetchResults();
    return () => {
      active = false;
    };
  }, [auditId, user]);

  const runAudit = async () => {
    if (!hasStoredPat) {
      setError('Please configure your GitHub Personal Access Token in the profile menu.');
      return;
    }

    setError(null);
    setIsAuditing(true);
    setResults(null);
    setAuditProgress({
      current: 0,
      total: 0,
      repo: 'Connecting to GitHub APIs...',
      stage: 'fetching'
    });

    try {
      const pat = await getStoredPat();
      if (!pat) {
        throw new Error("Could not retrieve stored token.");
      }

      const token = await user?.getIdToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'x-temp-pat': pat
      };

      const res = await fetch('/api/audit/run', {
        method: 'POST',
        headers
      });
      
      if (!res.ok) {
        const text = await res.text();
        let errMsg = 'Failed to start audit';
        try {
          const parsed = JSON.parse(text);
          errMsg = parsed.error || errMsg;
        } catch (_) {
          errMsg = text || errMsg;
        }
        throw new Error(errMsg);
      }

      // Check if it's chunked stream / ndjson
      const contentType = res.headers.get('Content-Type');
      if (contentType && contentType.includes('ndjson')) {
        const reader = res.body?.getReader();
        if (!reader) {
          throw new Error('Streaming response is not supported by this browser.');
        }

        const decoder = new TextDecoder('utf-8');
        let buffer = '';
        let finalData: any = null;

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep the incomplete line in the buffer

          for (const line of lines) {
            if (!line.trim()) continue;
            const data = JSON.parse(line);
            
            if (data.type === 'progress') {
              setAuditProgress({
                current: data.current,
                total: data.total,
                repo: data.repo,
                stage: data.total > 0 ? 'auditing' : 'fetching'
              });
            } else if (data.type === 'error') {
              throw new Error(data.error || 'Server error during audit');
            } else if (data.type === 'done') {
              finalData = data;
            }
          }
        }

        // Parse any remaining line in buffer
        if (buffer.trim()) {
          try {
            const data = JSON.parse(buffer);
            if (data.type === 'progress') {
              setAuditProgress({
                current: data.current,
                total: data.total,
                repo: data.repo,
                stage: data.total > 0 ? 'auditing' : 'fetching'
              });
            } else if (data.type === 'error') {
              throw new Error(data.error || 'Server error during audit');
            } else if (data.type === 'done') {
              finalData = data;
            }
          } catch (e) {
            console.error("Buffer parsing error:", e);
          }
        }

        if (!finalData) {
          throw new Error('Audit did not complete successfully or final payload was missing.');
        }

        setResults(finalData.results);
        setAuditCreatedAt(finalData.createdAt || new Date().toISOString());

        if (finalData.auditId && user && !user.isAnonymous) {
          try {
            const { doc, setDoc, serverTimestamp } = await import('firebase/firestore');
            const { db } = await import('../lib/firebase');
            const env = getEnvironmentName(import.meta.env.MODE);
            const collectionPath = getAuditCollectionPath(env, user.uid);
            
            await setDoc(doc(db, collectionPath, finalData.auditId), {
              results: finalData.results,
              createdAt: serverTimestamp()
            });
            
            navigate(`/results/${finalData.auditId}`);
          } catch (e) {
            console.error("Failed to save audit cache locally:", e);
            navigate('/results/guest');
          }
        } else {
          navigate('/results/guest');
        }

      } else {
        // Fallback for standard JSON (non-streaming)
        const data = await res.json();
        setResults(data.results);
        setAuditCreatedAt(data.createdAt || new Date().toISOString());

        if (data.auditId && user && !user.isAnonymous) {
          try {
            const { doc, setDoc, serverTimestamp } = await import('firebase/firestore');
            const { db } = await import('../lib/firebase');
            const env = getEnvironmentName(import.meta.env.MODE);
            const collectionPath = getAuditCollectionPath(env, user.uid);
            
            await setDoc(doc(db, collectionPath, data.auditId), {
              results: data.results,
              createdAt: serverTimestamp()
            });
            
            navigate(`/results/${data.auditId}`);
          } catch (e) {
            console.error("Failed to save audit cache locally:", e);
            navigate('/results/guest');
          }
        } else {
          navigate('/results/guest');
        }
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during safety audit.');
    } finally {
      setIsAuditing(false);
      setAuditProgress({
        current: 0,
        total: 0,
        repo: '',
        stage: 'idle'
      });
    }
  };

  const getExportFilename = (extension: 'csv' | 'json') => {
    const base = 'github-pages-audit';
    const dateSrc = auditCreatedAt || new Date().toISOString();
    const d = new Date(dateSrc);
    if (isNaN(d.getTime())) {
      return `${base}-current.${extension}`;
    }
    const pad = (n: number) => String(n).padStart(2, '0');
    const year = d.getFullYear();
    const month = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());
    const seconds = pad(d.getSeconds());
    return `${base}-${year}${month}${day}_${hours}${minutes}${seconds}.${extension}`;
  };

  const exportJson = () => {
    if (!results) return;
    
    const exportData = buildJsonExport(results, buildContext);

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = getExportFilename('json');
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportJsonV2 = () => {
    if (!results) return;
    
    const exportData = buildJsonExportV2(results, buildContext);

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = getExportFilename('json').replace('.json', '_v2_draft.json');
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportCsv = () => {
    if (!results) return;
    
    const csvContent = buildCsvExport(results, buildContext);
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = getExportFilename('csv');
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleValidateSchema = () => {
    if (!results) return;
    setIsValidatingSchema(true);
    setTimeout(() => {
      try {
        const exportData = buildJsonExport(results, buildContext);
        const ajv = new Ajv({ strict: false });
        const validate = ajv.compile(schema);
        const valid = validate(exportData);
        setValidationResult({
          valid: !!valid,
          errors: validate.errors || null
        });
      } catch (err: any) {
        console.error("AJV Validation error:", err);
        setValidationResult({
          valid: false,
          errors: [{ message: err.message || 'Validation process encountered an unexpected runtime error' }]
        });
      } finally {
        setIsValidatingSchema(false);
      }
    }, 150);
  };

  useEffect(() => {
    if (activeTab === 'json' && results && !validationResult) {
      handleValidateSchema();
    }
  }, [activeTab, results]);

  // Filter & Search Logic on the results (Memoized to minimize re-renders during full-report generation)
  const filteredResults = useMemo(() => {
    return results?.filter(r => {
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
  }, [results, searchQuery, statusFilter, domainFilter, httpsFilter]);

  // Paginated Results to boost initial rendering speed for large datasets
  const paginatedResults = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredResults.slice(startIndex, startIndex + pageSize);
  }, [filteredResults, currentPage, pageSize]);

  // Total pages calculation
  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(filteredResults.length / pageSize));
  }, [filteredResults, pageSize]);

  // Virtualized list parameters & visible slice to support rendering thousands of items smoothly
  const ROW_HEIGHT = 54;
  const { startIndex, visibleResults, topPadding, bottomPadding } = useMemo(() => {
    const totalItems = paginatedResults.length;
    const totalHeight = totalItems * ROW_HEIGHT;
    
    // 3 rows buffer above/below to prevent visual flicker during fast scrolling
    const startIdx = Math.max(0, Math.floor((scrollTop - ROW_HEIGHT * 3) / ROW_HEIGHT));
    const endIdx = Math.min(totalItems - 1, Math.ceil((scrollTop + clientHeight + ROW_HEIGHT * 3) / ROW_HEIGHT));
    
    const visible = paginatedResults.slice(startIdx, endIdx + 1);
    const topPad = startIdx * ROW_HEIGHT;
    const bottomPad = Math.max(0, totalHeight - (endIdx + 1) * ROW_HEIGHT);
    
    return {
      startIndex: startIdx,
      visibleResults: visible,
      topPadding: topPad,
      bottomPadding: bottomPad
    };
  }, [paginatedResults, scrollTop, clientHeight]);

  const formattedTime = (() => {
    if (!auditCreatedAt) return null;
    const date = new Date(auditCreatedAt);
    if (isNaN(date.getTime())) return null;

    const absolute = date.toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    const diffMs = now - date.getTime();
    const diffSecs = Math.max(0, Math.floor(diffMs / 1000));
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    let relative = '';
    if (diffSecs < 10) {
      relative = 'just now';
    } else if (diffSecs < 60) {
      relative = `${diffSecs}s ago`;
    } else if (diffMins < 60) {
      relative = `${diffMins}m ago`;
    } else if (diffHours < 24) {
      relative = `${diffHours}h ago`;
    } else {
      relative = `${diffDays}d ago`;
    }

    return { absolute, relative };
  })();

  if (isLoadingResults) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-emerald-600" />
        <p className="text-sm font-medium text-slate-500 mt-3 animate-pulse">Loading GitHub Pages audit report...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 w-full min-h-0 flex flex-col overflow-hidden max-w-7xl mx-auto py-0">
      {/* Dialog / Modal for Domain Lock Guide */}
      {showDomainLockGuide && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div 
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity" 
              aria-hidden="true"
              onClick={() => setShowDomainLockGuide(false)}
            ></div>

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

            <div className="relative inline-block align-middle bg-white rounded-2xl text-slate-800 text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full border border-slate-200 animate-fade-in">
              {/* Close button */}
              <button 
                type="button" 
                onClick={() => setShowDomainLockGuide(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <span className="sr-only">Close</span>
                <XCircle className="w-6 h-6" />
              </button>

              <div className="p-6 sm:p-8 space-y-6">
                <div>
                  <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100 mb-3">
                    <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                    カスタムドメインのセキュリティ
                  </div>
                  <h3 className="text-xl font-bold text-slate-950 tracking-tight">
                    教えて！GitHubの『保護ロック（ドメイン検証）』とは？
                  </h3>
                  <p className="mt-2 text-sm text-slate-500 leading-relaxed">
                    「SSL証明書は正常（SSL Active）」なのに「未検証（0 verified）」と表示される理由、セキュリティ上の重要性と設定手順を解説します。
                  </p>
                </div>

                {/* 1. Base Concept */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-3">
                  <h4 className="text-xs font-bold text-slate-500 tracking-wider uppercase">🔴 CNAME（表示） と TXT（保護ロック） の決定的な違い</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs leading-relaxed">
                    <div className="bg-white p-3 rounded-lg border border-slate-200">
                      <div className="font-bold text-emerald-800 flex items-center gap-1.5 mb-11">
                        <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        SSL Active (CNAME)
                      </div>
                      <p className="text-slate-600 mt-1">
                        DNSにCNAMEを登録すると、GitHub Pagesが自動でSSL/HTTPS証明書を生成して<strong>ウェブサイトを正常に表示</strong>します。ほとんどの個人サイトはこれで完了しています。
                      </p>
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-slate-200">
                      <div className="font-bold text-blue-800 flex items-center gap-1.5 mb-11">
                        <Lock className="w-4 h-4 text-blue-600 flex-shrink-0" />
                        Verified (TXT) = 保護ロック
                      </div>
                      <p className="text-slate-600 mt-1">
                        DNSにTXTレコードを検証用として追加し、「このドメインの所有者は自分である」と<strong>GitHubに誓約する保護ロック機能</strong>です。
                      </p>
                    </div>
                  </div>
                </div>

                {/* 2. Why 0 verified? */}
                <div className="space-y-2">
                  <h4 className="text-sm font-bold text-slate-800">⚠️ 設定しないと、どんな危険（乗っ取りリスク）があるの？</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    もしあなたが将来<strong>GitHub Pagesからドメイン設定だけを削除</strong>したが、<strong>DNS側のCNAME設定を消し忘れていた</strong>場合、悪意ある第三者が自分のリポジトリにあなたのドメインを設定することで、<strong>あなたのドメイン名で勝手にサイトを乗っ取られてしまうリスク（Subdomain Takeover）</strong>があります。
                  </p>
                  <p className="text-xs text-slate-600 leading-relaxed bg-amber-50 rounded-lg p-2.5 border border-amber-100 text-amber-800 font-medium">
                    💡 「TXTレコード登録（Verified）」を済ませておけば、あなたのGitHubアカウント以外、このドメインをGitHub Pagesに登録できなくなるため、乗っ取りが完全に防げるようになります！
                  </p>
                </div>

                {/* 3. How to Setup steps */}
                <div className="space-y-3">
                  <h4 className="text-sm font-bold text-slate-800">🛠️ 設定を保護ロックする「3ステップ」</h4>
                  <div className="space-y-3 text-xs text-slate-600">
                    <div className="flex gap-3">
                      <span className="flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-full bg-slate-900 text-white font-bold text-[10px] mt-0.5">1</span>
                      <div>
                        <strong className="text-slate-800">GitHub でTXT情報を取得する</strong>
                        <p className="text-slate-500 mt-0.5">
                          GitHubアカウントの右上アイコン ＞ <strong>Settings</strong> ＞ 左メニューの <strong>Pages</strong> を開き、<strong>Add a domain</strong> からお使いのカスタムドメインを登録します。提示される「TXT verification challenge」キーをコピーします。
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <span className="flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-full bg-slate-900 text-white font-bold text-[10px] mt-0.5">2</span>
                      <div>
                        <strong className="text-slate-800">お使いのドメインDNSにTXTレコードを追記する</strong>
                        <p className="text-slate-500 mt-0.5">
                          ドメイン管理会社（お名前.com, Cloudflare, ムームードメイン等）のDNSレコード管理画面を開き、ホスト名に <code className="bg-slate-100 font-mono px-1 py-0.5 rounded">_github-pages-challenge-&lt;your-owner&gt;</code>、値にコピーしたTXTテキストを設定します。
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <span className="flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-full bg-slate-900 text-white font-bold text-[10px] mt-0.5">3</span>
                      <div>
                        <strong className="text-slate-800">GitHub上で「Verify」を押して完了！</strong>
                        <p className="text-slate-500 mt-0.5">
                          GitHubの Pages 設定画面に戻り、<strong>Verify</strong> ボタンをクリックします。これでアカウント上のドメインが保護され、この監査ツールでも「Verified」や「Configured」として安全かつ強固に検知されるようになります。
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">
                    ※ 監査ツールは100%読み取り専用です。設定変更等を行うことはありません。
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowDomainLockGuide(false)}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                  >
                    閉じる (Close)
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Control Section */}
      {!auditId && (
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center">
            {hasStoredPat ? (
              <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-emerald-50 text-emerald-700 border border-emerald-200" title="Due to sandbox limits, tokens are stored in memory and reset between sessions.">
                <CheckCircle className="w-4 h-4 mr-1.5" />
                Secure Token Loaded (Session Only)
              </span>
            ) : (
              <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-amber-50 text-amber-700 border border-amber-200">
                <Key className="w-4 h-4 mr-1.5" />
                GitHub Personal Access Token Not Configured (Set in Profile Menu)
              </span>
            )}
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            {cachedAudit && !isAuditing && (
              <button
                type="button"
                onClick={() => navigate(`/results/${cachedAudit.auditId}`)}
                className="w-full sm:w-auto px-5 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg flex items-center justify-center font-medium border border-slate-200 shadow-xs transition-all text-sm cursor-pointer"
              >
                <Clock className="w-4 h-4 mr-1.5" />
                <span>キャッシュを表示 ({new Date(cachedAudit.createdAt).toLocaleString([], {month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit'})})</span>
              </button>
            )}

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
        </div>
      )}

      {/* Real-time Audit Progress Bar */}
      {isAuditing && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl max-w-2xl mx-auto my-6 w-full text-slate-100 animate-fade-in space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Loader2 className="w-5 h-5 text-emerald-400 animate-spin" />
              <span className="text-sm font-semibold text-white tracking-tight">
                {auditProgress.stage === 'fetching' ? 'GitHubリポジトリ一覧を取得中...' : 'セキュリティ監査を実行中 (GitHub Pages Real-time Audit)...'}
              </span>
            </div>
            <span className="text-xs font-mono text-slate-400 font-bold bg-slate-800 px-2 py-1 rounded border border-slate-700">
              {auditProgress.total > 0 ? `${auditProgress.current} / ${auditProgress.total}` : 'Initializing'}
            </span>
          </div>

          {auditProgress.total > 0 ? (
            <div className="space-y-3">
              {/* Progress track */}
              <div className="w-full bg-slate-850 h-3 rounded-full overflow-hidden border border-slate-755 relative">
                <div 
                  className="bg-emerald-500 h-full rounded-full transition-all duration-300 ease-out shadow-[0_0_8px_rgba(16,185,129,0.5)]" 
                  style={{ width: `${Math.min(100, (auditProgress.current / auditProgress.total) * 100)}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                <span className="truncate max-w-[80%] flex items-center gap-1.5">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                  Auditing: <span className="text-slate-200 font-semibold">{auditProgress.repo}</span>
                </span>
                <span className="font-bold text-emerald-400">
                  {Math.round((auditProgress.current / auditProgress.total) * 100)}%
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Simulated/Pulse loading track for first stage */}
              <div className="w-full bg-slate-850 h-3 rounded-full overflow-hidden border border-slate-755 relative">
                <div className="absolute top-0 bottom-0 left-0 bg-emerald-500 rounded-full animate-pulse transition-all" style={{ width: '35%' }} />
              </div>
              <p className="text-xs text-slate-400 font-mono italic flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                {auditProgress.repo || 'Connecting to GitHub APIs...'}
              </p>
            </div>
          )}
        </div>
      )}

      {error && !results && (
        <div className="p-8 bg-white border border-red-200 rounded-2xl text-center space-y-4 max-w-lg mx-auto py-12 shadow-sm">
          <AlertCircle className="w-12 h-12 text-red-600 mx-auto" />
          <h4 className="text-base font-semibold text-slate-900">Unable to load report</h4>
          <p className="text-slate-600 text-sm leading-relaxed">{error}</p>
          <button
            onClick={() => {
              setError(null);
              navigate('/');
            }}
            className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-sm inline-flex items-center gap-1.5"
          >
            Start New Security Audit
          </button>
        </div>
      )}

      {error && results && (
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
        <div className="flex-1 flex flex-col min-h-0 animate-fade-in">
          
          {/* Cached Data & Tabs Portal */}
          {document.getElementById('navbar-center-slot') && createPortal(
            <div className="flex space-x-1 p-0.5 bg-slate-100 rounded-lg ml-2 hidden lg:flex">
              <button
                onClick={() => handleTabChange('summary')}
                className={`px-3 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${activeTab === 'summary' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Summary
              </button>
              <button
                onClick={() => handleTabChange('details')}
                className={`px-3 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${activeTab === 'details' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Full Report
              </button>
              <button
                onClick={() => handleTabChange('json')}
                className={`px-3 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${activeTab === 'json' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                JSON
              </button>
              <button
                onClick={() => handleTabChange('schema')}
                className={`px-3 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${activeTab === 'schema' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Schema
              </button>
            </div>,
            document.getElementById('navbar-center-slot')!
          )}

          {formattedTime && document.getElementById('navbar-bottom-slot') && createPortal(
            <div className="py-2 bg-slate-50/80 border-t border-slate-200 text-gray-500 font-medium">
              <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3 px-3 sm:px-4">
                {/* Mobile Tabs (fallback for center slot) */}
                <div className="flex lg:hidden space-x-1 p-0.5 bg-slate-200 rounded-lg max-w-fit flex-wrap">
                  <button
                    onClick={() => handleTabChange('summary')}
                    className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${activeTab === 'summary' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Summary
                  </button>
                  <button
                    onClick={() => handleTabChange('details')}
                    className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${activeTab === 'details' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Full Report
                  </button>
                  <button
                    onClick={() => handleTabChange('json')}
                    className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${activeTab === 'json' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    JSON
                  </button>
                  <button
                    onClick={() => handleTabChange('schema')}
                    className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${activeTab === 'schema' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Schema
                  </button>
                </div>

                {/* Cache Info */}
                <div className="flex items-center justify-between sm:justify-end gap-3 flex-1">
                  <div className="flex items-center gap-2 text-[10px] sm:text-xs">
                    <Clock className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                    <span className="leading-tight">
                      Last Fetched: <span className="font-semibold text-slate-800 font-mono">{formattedTime.absolute}</span>
                    </span>
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/50">
                      {formattedTime.relative}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 border-l border-slate-300 pl-3 ml-1">
                    <span className="text-[9px] text-slate-400 font-normal leading-tight hidden lg:inline">
                      ※ Cached data
                    </span>
                    <button 
                      onClick={runAudit}
                      disabled={isAuditing}
                      className="px-2 py-1 bg-white text-slate-800 rounded-md hover:bg-gray-50 flex items-center border border-slate-300 shadow-xs text-[10px] font-bold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <RefreshCw className={`w-3 h-3 mr-1.5 text-slate-500 ${isAuditing ? 'animate-spin' : ''}`} />
                      Rescan
                    </button>
                  </div>
                </div>
              </div>
            </div>,
            document.getElementById('navbar-bottom-slot')!
          )}

          <div className="pt-1"></div>

          {/* Key Metrics Grid */}
          {activeTab === 'summary' && (
            <div className="space-y-4 animate-fade-in">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
                <div className="bg-slate-50/50 p-3 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors flex flex-col justify-between">
                  <span className="text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider block">Total</span>
                  <div className="mt-1 flex items-baseline justify-between">
                    <span className="text-xl sm:text-2xl font-bold text-gray-900">{results.length}</span>
                    <span className="text-[9px] sm:text-xs text-gray-400">Repos</span>
                  </div>
                </div>
                <div className="bg-slate-50/50 p-3 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors flex flex-col justify-between">
                  <span className="text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider block">Pages Enabled</span>
                  <div className="mt-1 flex items-baseline justify-between">
                    <span className="text-xl sm:text-2xl font-bold text-gray-900">{pagesEnabledList.length}</span>
                    <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-150 px-1.5 py-0.5 rounded-full">
                      {results.length ? Math.round((pagesEnabledList.length / results.length) * 100) : 0}%
                    </span>
                  </div>
                </div>
                <div className="bg-slate-50/50 p-3 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors relative group flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider block">Domains</span>
                    <button 
                      type="button"
                      onClick={() => setShowDomainLockGuide(true)}
                      className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer flex items-center gap-1 text-[10px] font-medium border-0 bg-transparent p-0 outline-none"
                      title="Click to view explanation"
                    >
                      <span className="hidden sm:inline text-[9px] text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity">❓ Info</span>
                      <Info className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="mt-1">
                    <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 sm:gap-0">
                      <span className="text-xl sm:text-2xl font-bold text-gray-900">
                        {results.filter(r => !!r.cname).length}
                      </span>
                      <span className="self-start sm:self-auto text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-1.5 rounded-full whitespace-nowrap">
                        {results.filter(r => !!r.cname && r.httpsCertificateState === 'approved').length} SSL OK
                      </span>
                    </div>
                    <div className="mt-1 pt-1 border-t border-slate-200/60 flex justify-between items-center text-[9px] text-slate-400">
                      <span className="flex items-center gap-1">
                        <span>Verified:</span>
                        <button 
                          type="button"
                          onClick={() => setShowDomainLockGuide(true)}
                          className="text-blue-500 hover:text-blue-700 underline font-medium cursor-pointer border-0 bg-transparent p-0 outline-none"
                        >
                          Protection Lock?
                        </button>
                      </span>
                      <span className="font-semibold text-slate-600">
                        {results.filter(r => r.customDomainStatus === 'custom_domain_verified').length}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="bg-slate-50/50 p-3 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors flex flex-col justify-between">
                  <span className="text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider block">Action Deploy</span>
                  <div className="mt-1 flex items-baseline justify-between">
                    <span className="text-xl sm:text-2xl font-bold text-gray-900">
                      {results.filter(r => r.deploymentMethod === 'workflow').length}
                    </span>
                    <span className="text-xs text-gray-400 whitespace-nowrap font-sans">Modern build</span>
                  </div>
                </div>
              </div>

              {/* Seamless Unfiltered Export Section with Cache Datetime */}
              <div className="bg-slate-50/40 p-5 rounded-xl border border-gray-200 mt-4 shadow-3xs flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="space-y-1 text-center md:text-left flex-1">
                  <h4 className="text-sm font-semibold text-slate-900 flex items-center justify-center md:justify-start gap-1.5">
                    <Download className="w-4 h-4 text-emerald-600" />
                    監査レポートのダウンロード (Export Audit Data)
                  </h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    現在取得できているすべての監査データをダウンロードします。GitHub APIから取得した時点（データキャッシュ日時: <span className="font-mono text-slate-700 font-semibold">{formattedTime?.absolute || 'N/A'}</span>）のまま、<strong>検索やフィルタリングなどの抽出条件は無視して、常にすべてのリポジトリ情報</strong>をエクスポートします。
                  </p>
                </div>
                <div className="flex gap-2.5 w-full md:w-auto justify-center">
                  <button 
                    onClick={exportCsv} 
                    className="flex-1 md:flex-initial px-4 py-2 bg-white text-slate-800 rounded-lg hover:bg-slate-50 flex items-center justify-center border border-slate-200 shadow-2xs text-xs font-semibold hover:border-slate-300 transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 mr-2 text-slate-400" />
                    CSVをダウンロード
                  </button>
                  <button 
                    onClick={exportJson} 
                    className="flex-1 md:flex-initial px-4 py-2 bg-white text-slate-800 rounded-lg hover:bg-slate-50 flex items-center justify-center border border-slate-200 shadow-2xs text-xs font-semibold hover:border-slate-300 transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 mr-2 text-slate-400" />
                    JSONをダウンロード
                  </button>
                  <button 
                    onClick={exportJsonV2} 
                    className="flex-1 md:flex-initial px-4 py-2 bg-white text-slate-800 rounded-lg hover:bg-slate-50 flex items-center justify-center border border-slate-200 shadow-2xs text-xs font-semibold hover:border-slate-300 transition-colors cursor-pointer"
                    title="ネストされたJSON v2 構造のインターチェンジドラフト版をダウンロード"
                  >
                    <Download className="w-3.5 h-3.5 mr-2 text-slate-400" />
                    JSON V2 (Interchange Draft)
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'details' && (
            <>
          {/* Results Table view - Seamless Flat High-Density Layout */}
          <div ref={scrollContainerRef} className="flex-1 overflow-auto border-b border-gray-200 bg-white mt-1 animate-fade-in relative">
            <div className="min-h-full">
              {results && (
                <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-gray-500 font-mono text-[10px]">
                  <span className="flex items-center gap-1.5 font-sans font-medium text-slate-700">
                    <Filter className="w-3.5 h-3.5 text-slate-500" />
                    カラム別フィルタリング
                  </span>
                  <span>
                    Showing {filteredResults.length} of {results.length} results
                  </span>
                </div>
              )}
              <table className="min-w-[960px] w-full divide-y divide-gray-200 font-sans text-xs border-separate border-spacing-0">
                <thead className="bg-slate-50 font-mono">
                  <tr>
                    <th scope="col" className="sticky top-0 z-50 bg-slate-50 px-2 py-2 text-center font-bold text-slate-400 uppercase text-[10px] w-10 border-r border-b border-slate-200 shadow-[0_1px_0_0_rgba(226,232,240,1)]">
                      #
                    </th>
                    <th scope="col" className="sticky top-0 z-50 bg-slate-50 px-3 py-2 text-left font-semibold text-slate-600 uppercase tracking-wider text-[11px] border-r border-b border-slate-200 shadow-[0_1px_0_0_rgba(226,232,240,1)]">
                      <div className="flex items-center gap-1">
                        Repository
                        <button onClick={() => setColumnGuideModal('repository')} className="text-slate-400 hover:text-indigo-500 focus:outline-none transition-colors" title="View details">
                          <HelpCircle className="w-3 h-3" />
                        </button>
                      </div>
                    </th>
                    <th scope="col" className="sticky top-0 z-40 bg-slate-50 px-3 py-2 text-left font-semibold text-slate-600 uppercase tracking-wider text-[11px] border-b border-slate-200 shadow-[0_1px_0_0_rgba(226,232,240,1)]">
                      <div className="flex items-center gap-1">
                        Pages Status
                        <button onClick={() => setColumnGuideModal('pagesStatus')} className="text-slate-400 hover:text-indigo-500 focus:outline-none transition-colors" title="View details">
                          <HelpCircle className="w-3 h-3" />
                        </button>
                      </div>
                    </th>
                    <th scope="col" className="sticky top-0 z-40 bg-slate-50 px-3 py-2 text-left font-semibold text-slate-600 uppercase tracking-wider text-[11px] border-b border-slate-200 shadow-[0_1px_0_0_rgba(226,232,240,1)]">
                      <div className="flex items-center gap-1">
                        Deploy Source
                        <button onClick={() => setColumnGuideModal('deploySource')} className="text-slate-400 hover:text-indigo-500 focus:outline-none transition-colors" title="View details">
                          <HelpCircle className="w-3 h-3" />
                        </button>
                      </div>
                    </th>
                    <th scope="col" className="sticky top-0 z-40 bg-slate-50 px-3 py-2 text-left font-semibold text-slate-600 uppercase tracking-wider text-[11px] border-b border-slate-200 shadow-[0_1px_0_0_rgba(226,232,240,1)]">
                      <div className="flex items-center gap-1">
                        Custom Domain
                        <button onClick={() => setColumnGuideModal('customDomain')} className="text-slate-400 hover:text-indigo-500 focus:outline-none transition-colors" title="View details font-sans">
                          <HelpCircle className="w-3 h-3" />
                        </button>
                      </div>
                    </th>
                    <th scope="col" className="sticky top-0 z-40 bg-slate-50 px-3 py-2 text-left font-semibold text-slate-600 uppercase tracking-wider text-[11px] border-b border-slate-200 shadow-[0_1px_0_0_rgba(226,232,240,1)]">
                      <div className="flex items-center gap-1">
                        HTTPS & Security
                        <button onClick={() => setColumnGuideModal('https')} className="text-slate-400 hover:text-indigo-500 focus:outline-none transition-colors" title="View details">
                          <HelpCircle className="w-3 h-3" />
                        </button>
                      </div>
                    </th>
                    <th scope="col" className="sticky top-0 z-40 bg-slate-50 px-3 py-2 text-right font-semibold text-slate-600 uppercase tracking-wider text-[11px] border-b border-slate-200 shadow-[0_1px_0_0_rgba(226,232,240,1)]">Link</th>
                  </tr>
                  {/* カラムヘッダ名の直下に配置するフィルタリングUI行 */}
                  <tr className="bg-slate-100/75">
                    <th scope="col" className="sticky top-[31px] z-40 bg-slate-100/95 px-1 py-1 border-r border-b border-slate-200 text-center">
                      <button 
                        onClick={() => {
                          setSearchQuery('');
                          setStatusFilter('all');
                          setDomainFilter('all');
                          setHttpsFilter('all');
                        }}
                        className="text-[9px] px-1 py-0.5 bg-white border border-slate-300 rounded text-slate-500 hover:text-slate-800 hover:border-slate-400 transition-colors cursor-pointer w-full"
                        title="Clear all filters"
                        disabled={!searchQuery && statusFilter === 'all' && domainFilter === 'all' && httpsFilter === 'all'}
                      >
                        Reset
                      </button>
                    </th>
                    <th scope="col" className="sticky top-[31px] z-40 bg-slate-100/95 px-2 py-1 border-r border-b border-slate-200 text-left">
                      <div className="relative">
                        <Search className="w-3 h-3 text-slate-400 absolute left-2 top-1.5" />
                        <input 
                          type="text" 
                          placeholder="Search repo/domain..."
                          className="w-full pl-6 pr-2 py-0.5 border border-slate-200 rounded text-[11px] font-sans font-normal bg-white outline-none focus:border-slate-800"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                        />
                      </div>
                    </th>
                    <th scope="col" className="sticky top-[31px] z-40 bg-slate-100/95 px-2 py-1 border-b border-slate-200 text-left">
                      <select 
                        className="w-full bg-white border border-slate-200 rounded px-1 py-0.5 text-[11px] font-sans font-normal outline-none focus:border-slate-800"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as any)}
                      >
                        <option value="all">All Pages</option>
                        <option value="enabled">Enabled</option>
                        <option value="disabled">Disabled</option>
                      </select>
                    </th>
                    <th scope="col" className="sticky top-[31px] z-40 bg-slate-100/95 px-2 py-1 border-b border-slate-200 text-left text-slate-400 italic font-sans font-normal text-[10px] text-center">
                      —
                    </th>
                    <th scope="col" className="sticky top-[31px] z-40 bg-slate-100/95 px-2 py-1 border-b border-slate-200 text-left">
                      <select 
                        className="w-full bg-white border border-slate-200 rounded px-1 py-0.5 text-[11px] font-sans font-normal outline-none focus:border-slate-800"
                        value={domainFilter}
                        onChange={(e) => setDomainFilter(e.target.value as any)}
                      >
                        <option value="all">All Domains</option>
                        <option value="custom">Configured</option>
                        <option value="none">No Custom</option>
                        <option value="unverified">Unverified/Unknown</option>
                        <option value="pending">Pending Verif.</option>
                      </select>
                    </th>
                    <th scope="col" className="sticky top-[31px] z-40 bg-slate-100/95 px-2 py-1 border-b border-slate-200 text-left">
                      <select 
                        className="w-full bg-white border border-slate-200 rounded px-1 py-0.5 text-[11px] font-sans font-normal outline-none focus:border-slate-800"
                        value={httpsFilter}
                        onChange={(e) => setHttpsFilter(e.target.value as any)}
                      >
                        <option value="all">All HTTPS</option>
                        <option value="ok">Approved & Enforced</option>
                        <option value="not_enforced">Not Enforced</option>
                        <option value="problem">Problem/Unknown</option>
                      </select>
                    </th>
                    <th scope="col" className="sticky top-[31px] z-40 bg-slate-100/95 px-2 py-1 border-b border-slate-200 text-right font-normal">
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100 font-mono text-xs">
                  {filteredResults.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-6 text-center text-gray-500 bg-gray-25">
                        <div className="max-w-md mx-auto space-y-2 text-center">
                          <AlertCircle className="w-6 h-6 text-gray-300 mx-auto" />
                          <p className="font-medium text-slate-800 text-xs">No matching repositories found</p>
                          <p className="text-[10px] text-gray-400">Try loosening your search query or adjusting active filtering options above.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <>
                      {topPadding > 0 && (
                        <tr>
                          <td colSpan={7} style={{ height: `${topPadding}px`, padding: 0 }} className="border-0 bg-transparent" />
                        </tr>
                      )}
                      {visibleResults.map((repo, index) => (
                        <RepoRow 
                          key={repo.id} 
                          repo={repo} 
                          serialNumber={(currentPage - 1) * pageSize + startIndex + index + 1} 
                        />
                      ))}
                      {bottomPadding > 0 && (
                        <tr>
                          <td colSpan={7} style={{ height: `${bottomPadding}px`, padding: 0 }} className="border-0 bg-transparent" />
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
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-2.5 py-1 border border-slate-200 rounded bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white text-xs font-semibold transition-colors cursor-pointer"
                  title="戻る"
                >
                  前へ
                </button>

                <span className="text-slate-500 mx-1 font-mono text-[11px]">
                  ページ <strong>{currentPage}</strong> / <strong>{totalPages}</strong>
                </span>

                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
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
          )}

          {activeTab === 'json' && results && (
            <div className="flex-1 overflow-hidden flex flex-col bg-slate-900 text-slate-100 rounded-xl border border-slate-800 p-4 min-h-[450px] animate-fade-in relative shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-3 mb-4 gap-3">
                <div>
                  <h3 className="text-sm font-semibold tracking-tight text-white flex items-center gap-1.5 font-mono">
                    <Database className="w-4 h-4 text-emerald-400 animate-pulse" />
                    Export Payload (JSON View)
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                    This represents the exact JSON output that will be downloaded via the "JSONをダウンロード" button.
                  </p>
                </div>
                <div className="flex gap-2.5 flex-wrap">
                  <button
                    onClick={handleValidateSchema}
                    disabled={isValidatingSchema}
                    className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white rounded-lg flex items-center shadow-md text-xs font-semibold cursor-pointer transition-colors"
                  >
                    {isValidatingSchema ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                        Validating...
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-3.5 h-3.5 mr-1.5 text-indigo-200" />
                        Run Schema Check
                      </>
                    )}
                  </button>
                  <CopyButton text={jsonExportString} />
                </div>
              </div>

              {/* Validation Feedback Banner */}
              {validationResult ? (
                validationResult.valid ? (
                  <div className="mb-4 p-3 bg-emerald-950/80 border border-emerald-800 text-emerald-300 rounded-lg flex items-start text-xs font-medium shadow-xs">
                    <CheckCircle className="w-4 h-4 mr-2 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-emerald-200 font-semibold text-[13px] block mb-0.5">Schema Validation Passed!</strong>
                      <span className="leading-relaxed text-emerald-400">This audit run output conforms strictly to the specified JSON schema layout rules (github-pages-auditor.export.v1).</span>
                    </div>
                  </div>
                ) : (
                  <div className="mb-4 p-3 bg-rose-950/80 border border-rose-800 text-rose-300 rounded-lg flex items-start text-xs font-medium shadow-xs">
                    <AlertCircle className="w-4 h-4 mr-2 text-rose-400 flex-shrink-0 mt-0.5" />
                    <div className="space-y-1 w-full">
                      <strong className="text-rose-200 font-semibold text-[13px] block mb-0.5">Schema Validation Failed</strong>
                      <span className="leading-relaxed block text-rose-200">Validation errors found:</span>
                      <ul className="list-disc pl-5 space-y-1 font-mono text-[10px] mt-1 text-rose-300 bg-rose-950/60 p-2 rounded border border-rose-900 max-h-32 overflow-y-auto">
                        {validationResult.errors?.map((err, i) => (
                          <li key={i} className="leading-normal">
                            <span className="text-rose-400 font-semibold font-mono">[{err.instancePath || 'root'}]</span> {err.message} {err.params ? JSON.stringify(err.params) : ''}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )
              ) : (
                <div className="mb-4 p-3 bg-slate-950 text-slate-400 border border-slate-800 rounded-lg flex items-center justify-between text-xs font-medium">
                  <span className="flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-slate-500" />
                    Validation has not run yet. Press "Run Schema Check" to verify structure.
                  </span>
                </div>
              )}

              {/* High-density code preview with virtualization to prevent blocking main thread */}
              <VirtualizedCodeViewer code={jsonExportString} />
            </div>
          )}

          {activeTab === 'schema' && (
            <div className="flex-1 overflow-hidden flex flex-col bg-slate-900 text-slate-100 rounded-xl border border-slate-800 p-4 min-h-[450px] animate-fade-in relative shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-3 mb-4 gap-3">
                <div>
                  <h3 className="text-sm font-semibold tracking-tight text-white flex items-center gap-1.5 font-mono">
                    <ShieldCheck className="w-4 h-4 text-indigo-400" />
                    JSON Schema (Specification)
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                    This is the schema definition conforming to Draft-07 syntax, located in <span className="font-mono text-slate-200">schemas/github-pages-auditor-export-v2.schema.json</span>.
                  </p>
                </div>
                <CopyButton text={schemaString} />
              </div>

              {/* Informational banner */}
              <div className="mb-4 p-3 bg-indigo-950/60 border border-indigo-900 text-indigo-300 rounded-lg flex items-start text-xs font-medium shadow-xs">
                <Info className="w-4 h-4 mr-2 text-indigo-400 flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="text-indigo-200 font-semibold text-[12px] block mb-0.5">Schema Truth Policy</strong>
                  <span className="leading-relaxed text-indigo-400">Any structure-affecting changes to the TS definitions in <code className="bg-indigo-950/80 px-1 py-0.5 rounded font-mono text-indigo-100">src/schema/exportTypesV2.ts</code> must automatically compile down to update this output dynamically during code validation.</span>
                </div>
              </div>

              {/* High-density code preview with virtualization to prevent blocking main thread */}
              <VirtualizedCodeViewer code={schemaString} />
            </div>
          )}
        </div>
      )}

      {/* Column Guide Modal */}
      {columnGuideModal && COLUMN_HELP[columnGuideModal] && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden border border-slate-200 flex flex-col">
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-semibold tracking-tight text-slate-900 font-sans">
                {COLUMN_HELP[columnGuideModal].title}
              </h3>
              <button
                onClick={() => setColumnGuideModal(null)}
                className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[400px]">
              <p className="text-sm text-slate-700 leading-relaxed mb-6 font-sans">
                {COLUMN_HELP[columnGuideModal].description}
              </p>
              
              {COLUMN_HELP[columnGuideModal].values.length > 0 && (
                <div className="space-y-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 font-sans">Possible Values</h4>
                  <ul className="space-y-4">
                    {COLUMN_HELP[columnGuideModal].values.map((val, i) => (
                      <li key={i} className="flex gap-3 text-sm">
                        <div className="flex-shrink-0 mt-0.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5"></div>
                        </div>
                        <div>
                          <span className="font-mono text-xs font-semibold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded mr-2 break-all">
                            {val.label}
                          </span>
                          <span className="text-slate-600 text-sm font-sans">{val.desc}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setColumnGuideModal(null)}
                className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-705 hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer"
              >
                Close
              </button>
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

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  return (
    <button
      onClick={handleCopy}
      className="px-2.5 py-1.5 bg-slate-800 text-slate-200 hover:text-white rounded-lg hover:bg-slate-700 flex items-center border border-slate-700 shadow-2xs text-xs font-semibold hover:border-slate-600 transition-all cursor-pointer"
    >
      {copied ? (
        <>
          <CheckCircle className="w-3.5 h-3.5 mr-1.5 text-emerald-405" />
          Copied!
        </>
      ) : (
        <>
          <Save className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
          コピーする
        </>
      )}
    </button>
  );
}

const RepoRow = React.memo(({ repo, serialNumber, style }: { repo: RepositoryResult; serialNumber: number; style?: React.CSSProperties }) => {
  return (
    <tr style={style} className="hover:bg-slate-50 border-b border-slate-100 transition-colors group">
      
      {/* Serial Number */}
      <td className="w-10 text-center text-[10px] text-slate-400 font-mono p-2 border-r border-slate-100 align-middle">
        {serialNumber}
      </td>

      {/* Repository name with fork badge */}
      <td className="px-3 py-2 border-r border-slate-100 align-middle">
        <div className="flex flex-col whitespace-normal font-sans">
          <a href={repo.htmlUrl} target="_blank" rel="noopener noreferrer" className="font-bold text-blue-600 hover:text-blue-800 hover:underline flex items-start gap-1 text-xs" title={repo.fullName}>
            <span className="leading-tight block truncate max-w-[200px] sm:max-w-xs">{repo.repoName}</span>
            <ExternalLink className="w-2.5 h-2.5 flex-shrink-0 opacity-70 mt-0.5" />
          </a>
          <div className="flex items-center space-x-1.5 mt-0.5">
            <span className={`px-1.5 py-0.5 rounded text-[9px] uppercase font-bold tracking-wider leading-none ${repo.visibility === 'public' ? 'bg-sky-50 text-sky-700 border border-sky-150' : 'bg-amber-50 text-amber-700 border border-amber-150'}`}>
              {repo.visibility}
            </span>
            {repo.isFork && (
              <span className="px-1.5 py-0.5 rounded text-[9px] uppercase font-bold tracking-wider leading-none bg-slate-100 text-slate-500 border border-slate-200">
                Fork
              </span>
            )}
            {repo.archived && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider leading-none bg-orange-50 text-orange-600 border border-orange-150">
                Archived
              </span>
            )}
          </div>
        </div>
      </td>

      {/* Pages Status badge */}
      <td className="px-3 py-2 align-middle border-r border-slate-50">
        <div className="flex flex-col">
          <div>
            {repo.hasPages ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-150 font-sans">
                <span className="w-1 h-1 bg-emerald-500 rounded-full mr-1 animate-pulse"></span>
                Active ({repo.pagesStatus || 'configured'})
              </span>
            ) : (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-50 text-gray-550 border border-gray-200 font-sans">
                <span className="w-1 h-1 bg-gray-300 rounded-full mr-1"></span>
                Disabled
              </span>
            )}
          </div>
          {repo.errorClassification && (
            <div className="text-[9px] text-red-500 mt-0.5 flex items-center gap-1 font-sans truncate max-w-full">
              <AlertCircle className="w-2.5 h-2.5 text-red-400 flex-shrink-0" />
              <span className="truncate">{repo.errorClassification}</span>
            </div>
          )}
        </div>
      </td>

      {/* Deployment method & publishing branch */}
      <td className="px-3 py-2 align-middle border-r border-slate-50">
        <div className="flex flex-col">
          {repo.hasPages ? (
            <div className="space-y-0.5">
              <div className="flex items-center text-gray-750 text-xs gap-1">
                <GitBranch className="w-3 h-3 text-gray-400 flex-shrink-0" />
                <span className="font-sans font-medium">{repo.deploymentMethod}</span>
              </div>
              {repo.publishingSourceSummary && (
                <div className="text-[9px] text-gray-400 select-all font-mono truncate">
                  {repo.publishingSourceSummary}
                </div>
              )}
            </div>
          ) : (
            <span className="text-gray-400">-</span>
          )}
        </div>
      </td>

      {/* Custom Domain and Verification Status */}
      <td className="px-3 py-2 align-middle border-r border-slate-50">
        <div className="flex flex-col">
          {repo.cname ? (
            <div className="space-y-0.5 max-w-full overflow-hidden">
              <div className="flex items-center gap-1.5 text-gray-800 font-sans leading-none min-w-0">
                <Globe className="w-3 h-3 text-slate-400 flex-shrink-0" />
                <span className="font-semibold text-xs truncate max-w-[150px]">{repo.cname}</span>
              </div>
              
              {repo.customDomainStatus === 'custom_domain_verified' ? (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider leading-none uppercase bg-green-50 text-green-700 border border-green-150 font-sans">
                  Verified
                </span>
              ) : repo.customDomainStatus === 'custom_domain_pending' ? (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider leading-none uppercase bg-amber-50 text-amber-700 border border-amber-150 font-sans">
                  Pending Verification
                </span>
              ) : (
                <span 
                  className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium tracking-wide leading-none bg-blue-50 text-blue-700 border border-blue-105 cursor-help font-sans"
                  title="カスタムドメイン（CNAME）が設定されています。GitHubの「ドメイン所有権検証」機能が未設定のためAPI上はUnverified/Unknownとなっていますが、HTTPS証明書が承認されていれば安全に動作しています。"
                >
                  Configured
                </span>
              )}
            </div>
          ) : repo.hasPages ? (
            <span className="text-[11px] text-gray-400 font-normal font-sans">GitHub standard URL</span>
          ) : (
            <span className="text-gray-400">-</span>
          )}
        </div>
      </td>

      {/* HTTPS and Enforcement */}
      <td className="px-3 py-2 align-middle text-gray-500">
        <div className="flex flex-col">
          {repo.hasPages ? (
            <div className="space-y-0.5">
              {repo.httpsCertificateStatus === 'https_certificate_ok' ? (
                <div className="flex items-center gap-1 text-emerald-700 text-xs font-sans">
                  <Lock className="w-3 h-3 text-emerald-500" />
                  <span>HTTPS Enforced & SSL OK</span>
                </div>
              ) : repo.httpsCertificateStatus === 'https_not_enforced' ? (
                <div className="flex items-center gap-1 text-amber-605 text-xs font-sans">
                  <UnlockWarningIcon className="w-3 h-3 text-amber-500" />
                  <span>Approved but Not Enforced</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-red-650 text-xs font-sans">
                  <AlertCircle className="w-3 h-3 text-red-500" />
                  <span>SSL Configuration Issue</span>
                </div>
              )}
              
              {repo.httpsCertificateState && (
                <div className="text-[9px] text-gray-450 font-sans truncate">
                  Cert status: <span className="font-mono text-gray-550 select-all truncate max-w-[120px] inline-block align-bottom">{repo.httpsCertificateState}</span>
                </div>
              )}
            </div>
          ) : (
            <span className="text-gray-400">-</span>
          )}
        </div>
      </td>

      {/* Link to settings */}
      <td className="px-3 py-2 text-right font-medium align-middle">
        <a 
          href={repo.pagesSettingsUrl} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="inline-flex items-center text-[11px] text-slate-800 bg-slate-50 hover:bg-slate-100 hover:text-slate-900 px-2 py-1 rounded-md border border-slate-200 font-sans shadow-3xs cursor-pointer transition-colors"
        >
          <Settings className="w-2.5 h-2.5 mr-1" />
          Settings
        </a>
      </td>
    </tr>
  );
});

RepoRow.displayName = 'RepoRow';

interface VirtualizedCodeViewerProps {
  code: string;
}

export function VirtualizedCodeViewer({ code }: VirtualizedCodeViewerProps) {
  const [highlightedLines, setHighlightedLines] = useState<string[]>([]);
  const [isHighlighting, setIsHighlighting] = useState(true);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(550);
  const currentJobId = React.useRef(0);
  const workerRef = React.useRef<Worker | null>(null);

  // Define inline worker script code
  const workerCode = React.useMemo(() => `
    function escapeHtml(text) {
      if (!text) return '';
      return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    function processLine(line) {
      const indentMatch = line.match(/^(\\s*)/);
      const indent = indentMatch ? indentMatch[1] : '';
      let remaining = line.substring(indent.length);
      
      let html = escapeHtml(indent);
      
      const keyMatch = remaining.match(/^("[^"]+")\\s*:/);
      if (keyMatch) {
        html += '<span class="text-purple-405 font-semibold">' + escapeHtml(keyMatch[1]) + '</span>';
        html += '<span class="text-slate-405">:</span>';
        remaining = remaining.substring(keyMatch[0].length);
      }
      
      while (remaining.length > 0) {
        const stringValueMatch = remaining.match(/^(\\s*"[^"]*")([, ]*)/);
        const numberValueMatch = remaining.match(/^(\\s*[0-9.-]+)([, ]*)/);
        const boolValueMatch = remaining.match(/^(\\s*(true|false))([, ]*)/);
        const nullValueMatch = remaining.match(/^(\\s*null)([, ]*)/);
        const bracketMatch = remaining.match(/^(\\s*[{}[\\]]+)([, ]*)/);
        
        if (stringValueMatch) {
          html += '<span class="text-emerald-405 font-medium">' + escapeHtml(stringValueMatch[1]) + '</span>';
          if (stringValueMatch[2]) {
            html += '<span class="text-slate-500">' + escapeHtml(stringValueMatch[2]) + '</span>';
          }
          remaining = remaining.substring(stringValueMatch[0].length);
        } else if (numberValueMatch) {
          html += '<span class="text-amber-500 font-mono">' + escapeHtml(numberValueMatch[1]) + '</span>';
          if (numberValueMatch[2]) {
            html += '<span class="text-slate-500">' + escapeHtml(numberValueMatch[2]) + '</span>';
          }
          remaining = remaining.substring(numberValueMatch[0].length);
        } else if (boolValueMatch) {
          html += '<span class="text-blue-400 font-semibold">' + escapeHtml(boolValueMatch[1]) + '</span>';
          if (boolValueMatch[2]) {
            html += '<span class="text-slate-500">' + escapeHtml(boolValueMatch[2]) + '</span>';
          }
          remaining = remaining.substring(boolValueMatch[0].length);
        } else if (nullValueMatch) {
          html += '<span class="text-rose-400 italic">' + escapeHtml(nullValueMatch[1]) + '</span>';
          if (nullValueMatch[2]) {
            html += '<span class="text-slate-500">' + escapeHtml(nullValueMatch[2]) + '</span>';
          }
          remaining = remaining.substring(nullValueMatch[0].length);
        } else if (bracketMatch) {
          html += '<span class="text-slate-400 font-medium">' + escapeHtml(bracketMatch[1]) + '</span>';
          if (bracketMatch[2]) {
            html += '<span class="text-slate-500">' + escapeHtml(bracketMatch[2]) + '</span>';
          }
          remaining = remaining.substring(bracketMatch[0].length);
        } else {
          html += '<span class="text-slate-300">' + escapeHtml(remaining) + '</span>';
          break;
        }
      }
      return html;
    }

    self.onmessage = function(e) {
      const { code, id } = e.data;
      if (typeof code !== 'string') return;
      
      const lines = code.split('\\n');
      const highlighted = [];
      
      for (let i = 0; i < lines.length; i++) {
        highlighted.push(processLine(lines[i]));
      }
      
      self.postMessage({ lines: highlighted, id: id });
    };
  `, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.Worker) {
      try {
        const blob = new Blob([workerCode], { type: 'application/javascript' });
        const worker = new Worker(URL.createObjectURL(blob));
        workerRef.current = worker;

        worker.onmessage = (e) => {
          const { lines, id } = e.data;
          if (id === currentJobId.current) {
            setHighlightedLines(lines);
            setIsHighlighting(false);
          }
        };

        return () => {
          worker.terminate();
        };
      } catch (err) {
        console.error('Failed to initialize inline Web Worker:', err);
      }
    }
  }, [workerCode]);

  useEffect(() => {
    setIsHighlighting(true);
    const jobId = ++currentJobId.current;

    if (workerRef.current) {
      workerRef.current.postMessage({ code, id: jobId });
    } else {
      // Fallback if browser/context does not support Web Worker
      setTimeout(() => {
        if (jobId !== currentJobId.current) return;
        const lines = code.split('\n');
        const highlighted = lines.map(line => {
          const indentMatch = line.match(/^(\s*)/);
          const indent = indentMatch ? indentMatch[1] : '';
          let remaining = line.substring(indent.length);
          
          let html = escapeHtml(indent);
          
          const keyMatch = remaining.match(/^("[^"]+")\s*:/);
          if (keyMatch) {
             html += `<span class="text-purple-405 font-semibold">${escapeHtml(keyMatch[1])}</span>`;
             html += `<span class="text-slate-405">:</span>`;
             remaining = remaining.substring(keyMatch[0].length);
          }
          
          while (remaining.length > 0) {
            const stringValueMatch = remaining.match(/^(\s*"[^"]*")([, ]*)/);
            const numberValueMatch = remaining.match(/^(\s*[0-9.-]+)([, ]*)/);
            const boolValueMatch = remaining.match(/^(\s*(true|false))([, ]*)/);
            const nullValueMatch = remaining.match(/^(\s*null)([, ]*)/);
            const bracketMatch = remaining.match(/^(\s*[{}\[\]]+)([, ]*)/);
            
            if (stringValueMatch) {
              html += `<span class="text-emerald-405 font-medium">${escapeHtml(stringValueMatch[1])}</span>`;
              if (stringValueMatch[2]) {
                html += `<span class="text-slate-500">${escapeHtml(stringValueMatch[2])}</span>`;
              }
              remaining = remaining.substring(stringValueMatch[0].length);
            } else if (numberValueMatch) {
              html += `<span class="text-amber-500 font-mono">${escapeHtml(numberValueMatch[1])}</span>`;
              if (numberValueMatch[2]) {
                html += `<span class="text-slate-500">${escapeHtml(numberValueMatch[2])}</span>`;
              }
              remaining = remaining.substring(numberValueMatch[0].length);
            } else if (boolValueMatch) {
              html += `<span class="text-blue-400 font-semibold">${escapeHtml(boolValueMatch[1])}</span>`;
              if (boolValueMatch[2]) {
                html += `<span class="text-slate-500">${escapeHtml(boolValueMatch[2])}</span>`;
              }
              remaining = remaining.substring(boolValueMatch[0].length);
            } else if (nullValueMatch) {
              html += `<span class="text-rose-400 italic">${escapeHtml(nullValueMatch[1])}</span>`;
              if (nullValueMatch[2]) {
                html += `<span class="text-slate-500">${escapeHtml(nullValueMatch[2])}</span>`;
              }
              remaining = remaining.substring(nullValueMatch[0].length);
            } else if (bracketMatch) {
              html += `<span class="text-slate-400 font-medium">${escapeHtml(bracketMatch[1])}</span>`;
              if (bracketMatch[2]) {
                html += `<span class="text-slate-500">${escapeHtml(bracketMatch[2])}</span>`;
              }
              remaining = remaining.substring(bracketMatch[0].length);
            } else {
              html += `<span class="text-slate-300">${escapeHtml(remaining)}</span>`;
              break;
            }
          }
          return html;
        });

        setHighlightedLines(highlighted);
        setIsHighlighting(false);
      }, 50);
    }
  }, [code]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    setContainerHeight(el.clientHeight || 550);

    const handleScroll = () => {
      setScrollTop(el.scrollTop);
    };

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.height) {
          setContainerHeight(entry.contentRect.height);
        }
      }
    });

    el.addEventListener('scroll', handleScroll, { passive: true });
    resizeObserver.observe(el);

    return () => {
      el.removeEventListener('scroll', handleScroll);
      resizeObserver.disconnect();
    };
  }, [highlightedLines]);

  const rowHeight = 22;
  const totalHeight = highlightedLines.length * rowHeight;

  const visibleIndices = useMemo(() => {
    const start = Math.max(0, Math.floor(scrollTop / rowHeight) - 8);
    const end = Math.min(highlightedLines.length - 1, Math.ceil((scrollTop + containerHeight) / rowHeight) + 8);
    return { start, end };
  }, [scrollTop, containerHeight, highlightedLines.length]);

  const renderedLines = useMemo(() => {
    const elements: React.ReactNode[] = [];
    const { start, end } = visibleIndices;

    for (let i = start; i <= end; i++) {
      const html = highlightedLines[i];
      if (html === undefined) continue;

      elements.push(
        <div 
          key={i} 
          className="absolute left-0 right-0 flex min-h-[22px] leading-normal font-mono hover:bg-slate-800/50 transition-colors select-text" 
          style={{ top: `${i * rowHeight}px`, height: `${rowHeight}px` }}
        >
          <span className="w-12 select-none text-right pr-4 text-slate-500 font-mono text-[10px] border-r border-slate-800 mr-4 shrink-0">
            {i + 1}
          </span>
          <span className="select-all whitespace-pre pr-4 overflow-hidden text-ellipsis" dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      );
    }

    return elements;
  }, [visibleIndices, highlightedLines]);

  return (
    <div 
      ref={containerRef}
      className="flex-1 overflow-auto bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs font-mono text-slate-300 select-text relative"
      style={{ height: '550px', maxHeight: '550px' }}
    >
      {isHighlighting ? (
        <div className="flex flex-col items-center justify-center h-full space-y-3 text-slate-400">
          <svg className="animate-spin h-5 w-5 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-[11px] font-medium tracking-wide">highlighting code in background thread...</span>
        </div>
      ) : (
        <div className="relative select-text" style={{ height: `${totalHeight}px`, minWidth: '100%' }}>
          {renderedLines}
        </div>
      )}
    </div>
  );
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Simple custom tokenizer to syntax highlight JSON strings
function highlightJson(str: string): React.ReactNode[] {
  const lines = str.split('\n');
  
  return lines.map((line, i) => {
    // We match leading spaces and keep them
    const indentMatch = line.match(/^(\s*)/);
    const indent = indentMatch ? indentMatch[1] : '';
    let remaining = line.substring(indent.length);
    
    let html = escapeHtml(indent);
    
    // Match key: "key":
    const keyMatch = remaining.match(/^("[^"]+")\s*:/);
    if (keyMatch) {
      html += `<span class="text-purple-405 font-semibold">${escapeHtml(keyMatch[1])}</span>`;
      html += `<span class="text-slate-405">:</span>`;
      remaining = remaining.substring(keyMatch[0].length);
    }
    
    // Match rest of values
    while (remaining.length > 0) {
      const stringValueMatch = remaining.match(/^(\s*"[^"]*")([, ]*)/);
      const numberValueMatch = remaining.match(/^(\s*[0-9.-]+)([, ]*)/);
      const boolValueMatch = remaining.match(/^(\s*(true|false))([, ]*)/);
      const nullValueMatch = remaining.match(/^(\s*null)([, ]*)/);
      const bracketMatch = remaining.match(/^(\s*[{}\[\]]+)([, ]*)/);
      
      if (stringValueMatch) {
        html += `<span class="text-emerald-405 font-medium">${escapeHtml(stringValueMatch[1])}</span>`;
        if (stringValueMatch[2]) {
          html += `<span class="text-slate-500">${escapeHtml(stringValueMatch[2])}</span>`;
        }
        remaining = remaining.substring(stringValueMatch[0].length);
      } else if (numberValueMatch) {
        html += `<span class="text-amber-500 font-mono">${escapeHtml(numberValueMatch[1])}</span>`;
        if (numberValueMatch[2]) {
          html += `<span class="text-slate-500">${escapeHtml(numberValueMatch[2])}</span>`;
        }
        remaining = remaining.substring(numberValueMatch[0].length);
      } else if (boolValueMatch) {
        html += `<span class="text-blue-400 font-semibold">${escapeHtml(boolValueMatch[1])}</span>`;
        if (boolValueMatch[2]) {
          html += `<span class="text-slate-500">${escapeHtml(boolValueMatch[2])}</span>`;
        }
        remaining = remaining.substring(boolValueMatch[0].length);
      } else if (nullValueMatch) {
        html += `<span class="text-rose-400 italic">${escapeHtml(nullValueMatch[1])}</span>`;
        if (nullValueMatch[2]) {
          html += `<span class="text-slate-500">${escapeHtml(nullValueMatch[2])}</span>`;
        }
        remaining = remaining.substring(nullValueMatch[0].length);
      } else if (bracketMatch) {
        html += `<span class="text-slate-400 font-medium">${escapeHtml(bracketMatch[1])}</span>`;
        if (bracketMatch[2]) {
          html += `<span class="text-slate-500">${escapeHtml(bracketMatch[2])}</span>`;
        }
        remaining = remaining.substring(bracketMatch[0].length);
      } else {
        html += `<span class="text-slate-300">${escapeHtml(remaining)}</span>`;
        break;
      }
    }
    
    return (
      <div key={i} className="flex min-h-[1.25rem] leading-normal font-mono hover:bg-slate-800/50 transition-colors min-w-max">
        {/* Line Number */}
        <span className="w-12 select-none text-right pr-4 text-slate-500 font-mono text-[10px] border-r border-slate-800 mr-4 shrink-0">
          {i + 1}
        </span>
        <span className="select-all whitespace-pre pr-4" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    );
  });
}

