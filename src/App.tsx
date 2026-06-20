/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import LauncherPage from './components/LauncherPage';
import { AuthProvider, useAuth } from './AuthContext';
import { validateFrontendFirebaseConfig } from './lib/env';
import { saveLastPath, getLastPath } from './lib/userPrefs';
import { LogOut, LogIn, UserCircle, Ghost, Key, Save, Loader2, CheckCircle, Github, HelpCircle, X, AlertCircle, Database, ShieldCheck, XCircle, LayoutGrid, List, Eye, EyeOff } from 'lucide-react';

function AppContent() {
  const { user, loading, signInWithGoogle, signInAsGuest, logout, hasStoredPat, savePatToFirestore } = useAuth();
  const [firebaseConfigError, setFirebaseConfigError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  
  const [pat, setPat] = useState('');
  const [isSavingPat, setIsSavingPat] = useState(false);
  const [patError, setPatError] = useState<string | null>(null);
  const [patSuccess, setPatSuccess] = useState<string | null>(null);
  const [showPat, setShowPat] = useState(false);

  const [showHeader, setShowHeader] = useState(true);
  const lastScrollY = useRef(0);

  const location = useLocation();
  const navigate = useNavigate();
  const [hasRedirected, setHasRedirected] = useState(false);

  // Redirect to last saved path when visiting the top page
  useEffect(() => {
    if (loading || !user || hasRedirected) return;

    const checkAndRedirect = async () => {
      if (location.pathname === '/' || location.pathname === '') {
        const savedPath = await getLastPath(user.uid, user.isAnonymous);
        if (savedPath && savedPath !== '/' && savedPath !== '') {
          console.log('Automatically redirecting to last visited path:', savedPath);
          setHasRedirected(true);
          navigate(savedPath, { replace: true });
          return;
        }
      }
      setHasRedirected(true);
    };

    checkAndRedirect();
  }, [user, loading, location.pathname, hasRedirected, navigate]);

  // Save current path to Firestore when user navigates
  useEffect(() => {
    if (!user || loading) return;

    // Wait until the initial redirect check has set hasRedirected to true
    if (!hasRedirected) return;

    const fullPath = location.pathname + location.search + location.hash;
    console.log('Recording last path:', fullPath);
    saveLastPath(user.uid, user.isAnonymous, fullPath);
  }, [location, user, loading, hasRedirected]);

  const savePat = async () => {
    if (!pat) {
      setPatError('Please provide a PAT to save.');
      return;
    }
    setPatError(null);
    setPatSuccess(null);
    setIsSavingPat(true);
    try {
      await savePatToFirestore(pat);
      setPatSuccess('PAT securely saved to Cloud.');
      setPat('');
      setTimeout(() => {
        setPatSuccess(null);
      }, 3000);
    } catch (err: any) {
      setPatError(err.message || 'Error saving PAT.');
    } finally {
      setIsSavingPat(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const threshold = 15;
      
      if (currentScrollY <= 15) {
        setShowHeader(true);
      } else if (Math.abs(currentScrollY - lastScrollY.current) > threshold) {
        if (currentScrollY > lastScrollY.current) {
          setShowHeader(false);
        } else {
          setShowHeader(true);
        }
      }
      lastScrollY.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  useEffect(() => {
    const checkFirebase = validateFrontendFirebaseConfig();
    if (!checkFirebase.valid) {
      setFirebaseConfigError(`Firebase setup incomplete. Missing fields: ${checkFirebase.missingFields.join(', ')}. Please ensure Firebase is provisioned via the 'set_up_firebase' tool.`);
      console.error("Firebase config validation failed:", checkFirebase.missingFields);
    }
  }, []);

  if (loading) {
    return <div className="min-h-[100dvh] flex items-center justify-center bg-gray-50"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div></div>;
  }

  if (!user) {
    if (location.pathname === '/launcher') {
      return (
        <Routes>
          <Route path="/launcher" element={<LauncherPage />} />
        </Routes>
      );
    }
    return (
      <div className="min-h-[100dvh] bg-slate-50 text-slate-900 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-xl w-full mx-auto space-y-8 animate-fade-in">
          {firebaseConfigError && (
            <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl text-xs flex items-start gap-2.5 shadow-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-600 mt-0.5" />
              <div>
                <p className="font-semibold mb-0.5">Configuration Warning</p>
                <p className="leading-relaxed opacity-90">{firebaseConfigError}</p>
              </div>
            </div>
          )}
          {/* Visual Identity Hero - Only visible when logged out */}
          <div className="bg-slate-900 text-white rounded-2xl p-8 border border-slate-800 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none">
              <ShieldCheck className="w-40 h-40" />
            </div>
            <div className="relative z-10 space-y-3">
              <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                GitHub Pages Security Auditing
              </div>
              <h2 className="text-2xl font-semibold tracking-tight">
                Security & Custom Domain Auditor
              </h2>
              <p className="text-slate-300 text-sm leading-relaxed">
                Audit GitHub Pages status, custom domains, HTTPS status, and deployment configurations across all your repositories in one click. Completely read-only and processed dynamically in browser guest memory.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-8 space-y-6">
            <div className="space-y-4">
            <button 
              onClick={signInWithGoogle}
              className="w-full flex items-center justify-center gap-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-3 rounded-xl font-medium transition-colors cursor-pointer"
            >
              Sign in with Google
            </button>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white px-2 text-slate-500 uppercase tracking-widest font-medium">Or</span>
              </div>
            </div>
            <button 
              onClick={signInAsGuest}
              className="w-full flex items-center justify-center gap-3 bg-slate-900 hover:bg-slate-800 text-white px-4 py-3 rounded-xl font-medium transition-colors shadow-sm cursor-pointer"
            >
              <UserCircle className="w-5 h-5 opacity-80" />
              Continue as Guest (In-Memory)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
  }

  const isLauncherPath = location.pathname === '/launcher';

  return (
    <div className="relative h-[100dvh] bg-gray-50 text-gray-900 font-sans flex flex-col overflow-hidden">
        {/* Environment Badge */}
        <div className={`absolute top-0 right-0 z-[100] px-2 py-0.5 rounded-bl-[4px] text-[10px] font-bold uppercase tracking-widest text-white shadow-sm pointer-events-none select-none ${
          import.meta.env.MODE === 'production' ? 'bg-emerald-500/90' : 'bg-amber-500/90'
        }`}>
          {import.meta.env.MODE === 'production' ? 'PROD' : 'DEV'}
        </div>

        {isLauncherPath ? (
          <div className="absolute top-4 right-4 z-50" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-2 bg-white/95 backdrop-blur-sm hover:bg-slate-100 p-2 sm:px-3 text-slate-600 rounded-full border border-slate-200 shadow-sm transition-colors cursor-pointer"
            >
              {user.isAnonymous ? (
                <Ghost className="w-7 h-7 text-slate-500" />
              ) : user.photoURL ? (
                <img src={user.photoURL} alt="Profile" className="w-7 h-7 rounded-full" referrerPolicy="no-referrer" />
              ) : (
                <UserCircle className="w-7 h-7 text-slate-500" />
              )}
              <span className="text-sm font-medium hidden sm:block">
                {user.isAnonymous ? 'Guest' : user.email?.split('@')[0]}
              </span>
            </button>
            
            {menuOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-white border border-slate-200 rounded-xl shadow-lg sm:w-80 overflow-hidden z-50">
                <div className="p-3 border-b border-slate-100 sm:hidden">
                  <div className="flex items-center gap-3">
                    {user.isAnonymous ? (
                      <Ghost className="w-10 h-10 text-slate-500 bg-slate-100 p-2 rounded-full" />
                    ) : user.photoURL ? (
                      <img src={user.photoURL} alt="Profile" className="w-10 h-10 rounded-full" referrerPolicy="no-referrer" />
                    ) : (
                      <UserCircle className="w-10 h-10 text-slate-500" />
                    )}
                    <div className="overflow-hidden">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-0.5">Account</p>
                      <p className="text-sm text-slate-800 truncate font-medium" title={user.email || 'Guest Session'}>
                        {user.isAnonymous ? 'Guest Session' : user.email}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5" />
                      GitHub PAT
                      <button onClick={() => setShowGuide(true)} className="text-slate-400 hover:text-emerald-600 transition-colors ml-0.5 cursor-pointer" title="How to get a PAT">
                        <HelpCircle className="w-3.5 h-3.5" />
                      </button>
                    </label>
                    {hasStoredPat && (
                      <span className="flex items-center text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 font-medium tracking-wide">
                        <CheckCircle className="w-3 h-3 mr-0.5" /> Set
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input 
                        type={showPat ? "text" : "password"} 
                        placeholder={hasStoredPat ? "Update token..." : "ghp_... or github_pat_..."}
                        className="w-full text-xs pl-2.5 pr-8 py-1.5 border border-slate-300 rounded shadow-sm focus:ring-1 focus:ring-slate-900 focus:border-slate-900 outline-none transition-shadow"
                        value={pat}
                        onChange={(e) => setPat(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') savePat();
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPat(!showPat)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                      >
                        {showPat ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <button 
                      onClick={savePat}
                      disabled={!pat || isSavingPat}
                      className="px-2.5 py-1.5 bg-slate-900 text-white rounded text-xs font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors flex flex-shrink-0 items-center justify-center min-w-[60px] cursor-pointer"
                    >
                      {isSavingPat ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Save'}
                    </button>
                  </div>
                  {patError && <p className="text-[10px] text-red-600 mt-1.5">{patError}</p>}
                  {patSuccess && <p className="text-[10px] text-emerald-600 mt-1.5">{patSuccess}</p>}
                </div>

                <div className="p-1">
                  {isLauncherPath ? (
                    <button 
                      onClick={() => {
                        setMenuOpen(false);
                        navigate('/');
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-lg flex items-center gap-2 cursor-pointer transition-colors mb-1"
                    >
                      <List className="w-4 h-4 text-slate-500" />
                      Normal Mode
                    </button>
                  ) : (
                    <button 
                      onClick={() => {
                        setMenuOpen(false);
                        navigate('/launcher');
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-lg flex items-center gap-2 cursor-pointer transition-colors mb-1"
                    >
                      <LayoutGrid className="w-4 h-4 text-slate-500" />
                      Launcher Mode
                    </button>
                  )}
                  <button 
                    onClick={() => {
                      setMenuOpen(false);
                      logout();
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 hover:text-red-700 rounded-lg flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <nav className={`bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 bg-[length:200%_200%] animate-gradient-x border-b border-indigo-100/50 sticky top-0 z-50 transition-transform duration-300 shadow-sm ${showHeader ? 'translate-y-0' : '-translate-y-full'}`}>
            <div className="px-3 py-2 sm:px-4 sm:py-3">
              <div className="max-w-7xl mx-auto flex items-center justify-between">
                <div className="flex items-center gap-4">
                <Link to="/" className="text-xl font-semibold tracking-tight text-slate-900 flex items-center gap-2.5 hover:opacity-80 transition-opacity">
                  <img src="/icon.svg" alt="App Logo" className="w-6 h-6 drop-shadow-sm" />
                  <span className="truncate">GitHub Pages Auditor</span>
                </Link>
                <button 
                  onClick={() => setShowGuide(true)}
                  className="hidden sm:flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                >
                  <HelpCircle className="w-4 h-4" />
                  Token Guide
                </button>
                <button
                  onClick={() => setShowInfoModal(true)}
                  className="hidden sm:flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                >
                  <HelpCircle className="w-4 h-4" />
                  What's this app?
                </button>
                <div id="navbar-center-slot"></div>
              </div>
              <div className="flex items-center gap-4">
                <div className="relative" ref={menuRef}>
                  <button
                    onClick={() => setMenuOpen(!menuOpen)}
                    className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100 p-2 sm:px-3 text-slate-600 rounded-full border border-slate-200 transition-colors cursor-pointer"
                  >
                    {user.isAnonymous ? (
                      <Ghost className="w-7 h-7 text-slate-500" />
                    ) : user.photoURL ? (
                      <img src={user.photoURL} alt="Profile" className="w-7 h-7 rounded-full" referrerPolicy="no-referrer" />
                    ) : (
                      <UserCircle className="w-7 h-7 text-slate-500" />
                    )}
                    <span className="text-sm font-medium hidden sm:block">
                      {user.isAnonymous ? 'Guest' : user.email?.split('@')[0]}
                    </span>
                  </button>
                  
                  {menuOpen && (
                    <div className="absolute right-0 mt-2 w-72 bg-white border border-slate-200 rounded-xl shadow-lg sm:w-80 overflow-hidden z-50">
                      <div className="p-3 border-b border-slate-100 sm:hidden">
                        <div className="flex items-center gap-3">
                          {user.isAnonymous ? (
                            <Ghost className="w-10 h-10 text-slate-500 bg-slate-100 p-2 rounded-full" />
                          ) : user.photoURL ? (
                            <img src={user.photoURL} alt="Profile" className="w-10 h-10 rounded-full" referrerPolicy="no-referrer" />
                          ) : (
                            <UserCircle className="w-10 h-10 text-slate-500" />
                          )}
                          <div className="overflow-hidden">
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-0.5">Account</p>
                            <p className="text-sm text-slate-800 truncate font-medium" title={user.email || 'Guest Session'}>
                              {user.isAnonymous ? 'Guest Session' : user.email}
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                            <Key className="w-3.5 h-3.5" />
                            GitHub PAT
                            <button onClick={() => setShowGuide(true)} className="text-slate-400 hover:text-emerald-600 transition-colors ml-0.5 cursor-pointer" title="How to get a PAT">
                              <HelpCircle className="w-3.5 h-3.5" />
                            </button>
                          </label>
                          {hasStoredPat && (
                            <span className="flex items-center text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 font-medium tracking-wide">
                              <CheckCircle className="w-3 h-3 mr-0.5" /> Set
                            </span>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <input 
                              type={showPat ? "text" : "password"} 
                              placeholder={hasStoredPat ? "Update token..." : "ghp_... or github_pat_..."}
                              className="w-full text-xs pl-2.5 pr-8 py-1.5 border border-slate-300 rounded shadow-sm focus:ring-1 focus:ring-slate-900 focus:border-slate-900 outline-none transition-shadow"
                              value={pat}
                              onChange={(e) => setPat(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') savePat();
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => setShowPat(!showPat)}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                            >
                              {showPat ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                          <button 
                            onClick={savePat}
                            disabled={!pat || isSavingPat}
                            className="px-2.5 py-1.5 bg-slate-900 text-white rounded text-xs font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors flex flex-shrink-0 items-center justify-center min-w-[60px] cursor-pointer"
                          >
                            {isSavingPat ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Save'}
                          </button>
                        </div>
                        {patError && <p className="text-[10px] text-red-600 mt-1.5">{patError}</p>}
                        {patSuccess && <p className="text-[10px] text-emerald-600 mt-1.5">{patSuccess}</p>}
                      </div>

                      <div className="p-1">
                        {isLauncherPath ? (
                          <button 
                            onClick={() => {
                              setMenuOpen(false);
                              navigate('/');
                            }}
                            className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-lg flex items-center gap-2 cursor-pointer transition-colors mb-1"
                          >
                            <List className="w-4 h-4 text-slate-500" />
                            Normal Mode
                          </button>
                        ) : (
                          <button 
                            onClick={() => {
                              setMenuOpen(false);
                              navigate('/launcher');
                            }}
                            className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-lg flex items-center gap-2 cursor-pointer transition-colors mb-1"
                          >
                            <LayoutGrid className="w-4 h-4 text-slate-500" />
                            Launcher Mode
                          </button>
                        )}
                        <button 
                          onClick={() => {
                            setMenuOpen(false);
                            logout();
                          }}
                          className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 hover:text-red-700 rounded-lg flex items-center gap-2 cursor-pointer transition-colors"
                        >
                          <LogOut className="w-4 h-4" />
                          Sign out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            </div>
            <div id="navbar-bottom-slot"></div>
          </nav>
        )}
        {firebaseConfigError && (
          <div className="bg-red-50 border-b border-red-200 text-red-800 p-3 text-xs flex items-center justify-center gap-2 shadow-sm shrink-0">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-600" />
            <span className="font-semibold">{firebaseConfigError}</span>
          </div>
        )}
        <main className="flex-1 min-h-0 max-w-7xl w-full mx-auto flex flex-col overflow-hidden">
          <Routes>
            <Route path="/launcher" element={<LauncherPage />} />
            <Route path="/launcher-preview" element={<Dashboard />} />
            <Route path="/" element={<Dashboard />} />
            <Route path="/report" element={<Dashboard />} />
            <Route path="/json" element={<Dashboard />} />
            <Route path="/schema" element={<Dashboard />} />
            <Route path="/results/:auditId" element={<Dashboard />} />
            <Route path="/results/:auditId/report" element={<Dashboard />} />
            <Route path="/results/:auditId/json" element={<Dashboard />} />
            <Route path="/results/:auditId/schema" element={<Dashboard />} />
            <Route path="/results/:auditId/launcher" element={<Dashboard />} />
          </Routes>
        </main>
        {!isLauncherPath && (
          <footer className="shrink-0 w-full bg-gradient-to-r from-purple-50 via-indigo-50 to-blue-50 bg-[length:200%_200%] animate-gradient-x border-t border-indigo-100/50 py-3 mt-auto">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-0 md:gap-4 text-xs sm:text-sm text-slate-500">
              <p>
                &copy; {new Date().getFullYear()} GitHub Pages Auditor v{__APP_VERSION__}
              </p>
              <p className="flex items-center gap-1 text-center md:text-left">
                Created by <span className="font-medium text-slate-700">Takashi Sasaki</span> | 
                <a href="https://x.com/TakashiSasaki" target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:text-emerald-700 hover:underline transition-colors ml-1">
                  x.com/TakashiSasaki
                </a>
              </p>
            </div>
          </footer>
        )}

        {/* Guide Modal */}
        {showGuide && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl border border-slate-200 overflow-hidden">
              <div className="flex items-center justify-between p-5 border-b border-slate-100">
                <h3 className="text-lg font-semibold flex items-center text-slate-900">
                  <ShieldCheck className="w-5 h-5 mr-2 text-emerald-600" />
                  Creating a Safe Read-Only GitHub PAT
                </h3>
                <button 
                  onClick={() => setShowGuide(false)}
                  className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-full hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 overflow-y-auto max-h-[70dvh]">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                  <div className="space-y-3">
                    <h4 className="font-semibold text-slate-800 flex items-center gap-2">
                      <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-xs">Recommended</span>
                      Fine-Grained Token
                    </h4>
                    <ol className="list-decimal pl-5 space-y-2 text-slate-600">
                      <li>Go to GitHub → Settings → Developer Settings → Personal Access Tokens → Fine-grained tokens.</li>
                      <li>Give the token a name and set expiration.</li>
                      <li>Under Repository access, choose <strong className="text-slate-800">Only select repositories</strong> or All.</li>
                      <li>Under Permissions → Repository permissions, grant:
                        <ul className="list-disc pl-5 mt-1.5 space-y-1">
                          <li><strong className="text-slate-800">Metadata</strong>: Read-only (auto-selected)</li>
                          <li><strong className="text-slate-800">Pages</strong>: Read-only</li>
                        </ul>
                      </li>
                      <li>Generate and paste into the configuration menu.</li>
                    </ol>
                  </div>
                  <div className="space-y-3">
                    <h4 className="font-semibold text-slate-800">Classic Token</h4>
                    <ol className="list-decimal pl-5 space-y-2 text-slate-600">
                      <li>Go to Settings → Developer Settings → Personal Access Tokens → Tokens (classic).</li>
                      <li>Generate new token.</li>
                      <li>Select the <strong className="text-slate-800">repo</strong> scope if some repositories are private, or simply <strong className="text-slate-800">read:project</strong> for public repos.</li>
                      <li>Ensure NO write scopes are selected.</li>
                    </ol>
                  </div>
                </div>
                <div className="text-xs bg-blue-50/50 p-4 rounded-xl border border-blue-100 mt-6 flex items-start text-blue-800">
                  <AlertCircle className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0 text-blue-600" />
                  <span className="leading-relaxed"><strong className="text-blue-900">No Write Capability:</strong> This applet is designed to never call any write, dispatch, or delete endpoints. The auditor restricts its actions strictly to page settings and metadata gathering.</span>
                </div>
              </div>
            </div>
          </div>
        )}

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
      </div>
  );
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </Router>
  );
}
