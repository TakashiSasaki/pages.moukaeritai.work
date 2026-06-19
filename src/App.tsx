/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import { AuthProvider, useAuth } from './AuthContext';
import { LogOut, LogIn, UserCircle, Ghost, Key, Save, Loader2, CheckCircle, ShieldCheck as ShieldCheckIcon, HelpCircle, X, AlertCircle } from 'lucide-react';

function AppContent() {
  const { user, loading, signInWithGoogle, signInAsGuest, logout, hasStoredPat, savePatToFirestore } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [showGuide, setShowGuide] = useState(false);
  
  const [pat, setPat] = useState('');
  const [isSavingPat, setIsSavingPat] = useState(false);
  const [patError, setPatError] = useState<string | null>(null);
  const [patSuccess, setPatSuccess] = useState<string | null>(null);

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

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div></div>;
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-xl w-full mx-auto space-y-8 animate-fade-in">
          {/* Visual Identity Hero - Only visible when logged out */}
          <div className="bg-slate-900 text-white rounded-2xl p-8 border border-slate-800 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none">
              <ShieldCheckIcon className="w-40 h-40" />
            </div>
            <div className="relative z-10 space-y-3">
              <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                <ShieldCheckIcon className="w-3.5 h-3.5 mr-1" />
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

  return (
    <Router>
      <div className="min-h-screen bg-gray-50 text-gray-900 font-sans flex flex-col">
        <nav className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-semibold tracking-tight text-slate-900 flex items-center gap-2">
                <ShieldCheckIcon className="w-5 h-5 text-emerald-600" />
                GitHub Pages Auditor
              </h1>
              <button 
                onClick={() => setShowGuide(true)}
                className="hidden sm:flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
              >
                <HelpCircle className="w-4 h-4" />
                Token Guide
              </button>
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
                        <input 
                          type="password" 
                          placeholder={hasStoredPat ? "Update token..." : "ghp_... or github_pat_..."}
                          className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded shadow-sm focus:ring-1 focus:ring-slate-900 focus:border-slate-900 outline-none transition-shadow"
                          value={pat}
                          onChange={(e) => setPat(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') savePat();
                          }}
                        />
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
        </nav>
        <main className="flex-1 max-w-7xl w-full mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
          </Routes>
        </main>
        <footer className="w-full bg-white border-t border-slate-200 py-6 mt-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-slate-500">
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

        {/* Guide Modal */}
        {showGuide && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl border border-slate-200 overflow-hidden">
              <div className="flex items-center justify-between p-5 border-b border-slate-100">
                <h3 className="text-lg font-semibold flex items-center text-slate-900">
                  <ShieldCheckIcon className="w-5 h-5 mr-2 text-emerald-600" />
                  Creating a Safe Read-Only GitHub PAT
                </h3>
                <button 
                  onClick={() => setShowGuide(false)}
                  className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-full hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 overflow-y-auto max-h-[70vh]">
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
      </div>
    </Router>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
