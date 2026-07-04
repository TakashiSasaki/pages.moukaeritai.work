/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import ReactMarkdown from 'react-markdown';
import { 
  FileText, 
  ChevronLeft, 
  Loader2, 
  BookOpen, 
  AlertCircle, 
  ExternalLink,
  Search,
  Menu,
  X
} from 'lucide-react';

interface DocItem {
  id: string;
  title: string;
  source: 'root' | 'docs';
}

export default function DeveloperDocs() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { docId } = useParams<{ docId?: string }>();
  
  const [docsList, setDocsList] = useState<DocItem[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<DocItem | null>(null);
  const [docContent, setDocContent] = useState<string>('');
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Fetch documents index on mount
  useEffect(() => {
    const fetchDocsIndex = async () => {
      if (!user) return;
      setIsLoadingList(true);
      setError(null);
      try {
        const token = await user.getIdToken();
        const res = await fetch('/api/docs', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (!res.ok) {
          throw new Error(`Failed to fetch documents index: ${res.statusText}`);
        }
        const data = await res.json();
        setDocsList(data);
        
        // Handle auto-selection based on URL or defaults
        const initialDocId = docId || 'README.md';
        const found = data.find((d: DocItem) => d.id === initialDocId) || data[0];
        if (found) {
          setSelectedDoc(found);
        }
      } catch (err: any) {
        console.error('Error fetching docs list:', err);
        setError('Could not retrieve developer documentation list.');
      } finally {
        setIsLoadingList(false);
      }
    };

    fetchDocsIndex();
  }, [user]);

  // Synchronize URL changes with selected document
  useEffect(() => {
    if (docsList.length === 0) return;
    const currentId = docId || 'README.md';
    const found = docsList.find(d => d.id === currentId);
    if (found) {
      setSelectedDoc(found);
    }
  }, [docId, docsList]);

  // Fetch document content when selectedDoc changes
  useEffect(() => {
    const fetchDocContent = async () => {
      if (!user || !selectedDoc) return;
      setIsLoadingContent(true);
      setDocContent('');
      try {
        const token = await user.getIdToken();
        const res = await fetch(`/api/docs/${selectedDoc.id}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (!res.ok) {
          throw new Error(`Failed to fetch document contents: ${res.statusText}`);
        }
        const data = await res.json();
        setDocContent(data.content || '');
      } catch (err: any) {
        console.error('Error fetching doc content:', err);
        setDocContent('# Document Load Error\nCould not fetch document content.');
      } finally {
        setIsLoadingContent(false);
      }
    };

    fetchDocContent();
  }, [selectedDoc, user]);

  const handleSelectDoc = (docItem: DocItem) => {
    setSelectedDoc(docItem);
    setMobileMenuOpen(false);
    navigate(`/docs/${docItem.id}`);
  };

  const filteredDocs = docsList.filter(doc => 
    doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-50">
      {/* Upper Navigation Bar */}
      <header className="shrink-0 bg-white border-b border-slate-200 py-3.5 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link 
              to="/" 
              className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back to Dashboard</span>
            </Link>
            <span className="text-slate-300">/</span>
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-emerald-600" />
              <span className="font-semibold text-slate-800">Developer Docs Center</span>
            </div>
          </div>
          
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden flex items-center justify-center p-2 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Main Workspace Grid */}
      <div className="flex-1 flex min-h-0 relative max-w-7xl w-full mx-auto">
        
        {/* Left Sidebar Index Panel */}
        <aside className={`
          absolute inset-y-0 left-0 z-30 w-72 bg-white border-r border-slate-200 flex flex-col transform transition-transform duration-300 ease-in-out md:relative md:transform-none md:translate-x-0
          ${mobileMenuOpen ? 'translate-x-0 shadow-xl' : '-translate-x-full md:flex'}
        `}>
          {/* Search Box */}
          <div className="p-4 border-b border-slate-200 shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search documents..."
                className="w-full text-xs pl-9 pr-3 py-2 border border-slate-200 rounded-lg outline-none bg-slate-50 focus:bg-white focus:border-slate-400 transition-colors"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* List Items Scroll Area */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {isLoadingList ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
                <Loader2 className="w-6 h-6 animate-spin" />
                <span className="text-xs">Loading indexes...</span>
              </div>
            ) : filteredDocs.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400">
                No matching documents
              </div>
            ) : (
              <>
                <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Root Manuals</div>
                {filteredDocs.filter(d => d.source === 'root').map((docItem) => (
                  <button
                    key={docItem.id}
                    onClick={() => handleSelectDoc(docItem)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-medium flex items-center gap-2.5 transition-all cursor-pointer ${
                      selectedDoc?.id === docItem.id 
                        ? 'bg-slate-900 text-white shadow-sm' 
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <FileText className={`w-4 h-4 ${selectedDoc?.id === docItem.id ? 'text-emerald-400' : 'text-slate-400'}`} />
                    <span className="truncate">{docItem.title}</span>
                  </button>
                ))}

                <div className="px-3 py-1.5 pt-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Technical Specs (docs/)</div>
                {filteredDocs.filter(d => d.source === 'docs').map((docItem) => (
                  <button
                    key={docItem.id}
                    onClick={() => handleSelectDoc(docItem)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-medium flex items-center gap-2.5 transition-all cursor-pointer ${
                      selectedDoc?.id === docItem.id 
                        ? 'bg-slate-900 text-white shadow-sm' 
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <FileText className={`w-4 h-4 ${selectedDoc?.id === docItem.id ? 'text-blue-400' : 'text-slate-400'}`} />
                    <span className="truncate">{docItem.title}</span>
                  </button>
                ))}
              </>
            )}
          </div>
        </aside>

        {/* Mobile Sidebar Backdrop Overlay */}
        {mobileMenuOpen && (
          <div 
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs z-20 md:hidden"
          />
        )}

        {/* Right Content Viewer Section */}
        <main className="flex-1 min-w-0 bg-white flex flex-col overflow-hidden">
          {error ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <AlertCircle className="w-12 h-12 text-red-500 mb-3" />
              <h3 className="text-base font-semibold text-slate-800 mb-1">Documentation Unavailable</h3>
              <p className="text-slate-500 text-xs max-w-sm leading-relaxed">{error}</p>
            </div>
          ) : isLoadingContent ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2.5">
              <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
              <p className="text-slate-500 text-xs">Fetching document content...</p>
            </div>
          ) : selectedDoc ? (
            <div className="flex-1 overflow-y-auto px-4 py-6 sm:p-8 lg:p-10 select-text">
              <div className="max-w-3xl mx-auto space-y-6">
                
                {/* Meta details header card */}
                <div className="bg-slate-50 border border-slate-150 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shrink-0">
                  <div className="space-y-1">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-200 text-slate-700">
                      {selectedDoc.source === 'root' ? 'Project root file' : 'docs/ spec file'}
                    </span>
                    <h2 className="text-lg font-bold text-slate-900">{selectedDoc.title}</h2>
                    <p className="font-mono text-[11px] text-slate-500">File path: {selectedDoc.source === 'root' ? selectedDoc.id : `docs/${selectedDoc.id}`}</p>
                  </div>
                  <a 
                    href={`https://github.com/takashi316/github-pages-auditor/blob/main/${selectedDoc.source === 'root' ? '' : 'docs/'}${selectedDoc.id}`}
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-emerald-600 hover:text-emerald-700 font-medium hover:underline self-start sm:self-center cursor-pointer"
                  >
                    <span>View on GitHub</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>

                {/* Markdown Main Box */}
                <div className="prose prose-slate max-w-none prose-sm sm:prose-base focus:outline-none">
                  <ReactMarkdown
                    components={{
                      h1: ({node, ...props}) => <h1 className="text-2xl font-bold mt-8 mb-4 text-slate-950 border-b border-slate-200 pb-2 tracking-tight" {...props} />,
                      h2: ({node, ...props}) => <h2 className="text-xl font-semibold mt-6 mb-3 text-slate-900 tracking-tight" {...props} />,
                      h3: ({node, ...props}) => <h3 className="text-lg font-semibold mt-5 mb-2 text-slate-800 tracking-tight" {...props} />,
                      p: ({node, ...props}) => <p className="my-2.5 text-slate-600 leading-relaxed text-sm sm:text-base" {...props} />,
                      ul: ({node, ...props}) => <ul className="list-disc pl-5 my-3 text-slate-600 space-y-1 text-sm sm:text-base" {...props} />,
                      ol: ({node, ...props}) => <ol className="list-decimal pl-5 my-3 text-slate-600 space-y-1 text-sm sm:text-base" {...props} />,
                      li: ({node, ...props}) => <li className="my-1" {...props} />,
                      code: ({node, className, children, ...props}) => {
                        const match = /language-(\w+)/.exec(className || '');
                        const inline = !match;
                        return inline ? (
                          <code className="bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded text-[11px] sm:text-xs font-mono font-semibold" {...props}>{children}</code>
                        ) : (
                          <div className="relative my-4">
                            <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto text-xs font-mono shadow-sm">
                              <code {...props}>{children}</code>
                            </pre>
                          </div>
                        );
                      },
                      a: ({node, ...props}) => <a className="text-emerald-600 hover:text-emerald-700 underline font-medium transition-colors" {...props} />,
                      blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-slate-300 pl-4 italic my-4 text-slate-500 text-sm sm:text-base bg-slate-50 py-1 pr-2 rounded-r-md" {...props} />,
                      table: ({node, ...props}) => (
                        <div className="overflow-x-auto my-4 border border-slate-200 rounded-lg shadow-xs">
                          <table className="w-full border-collapse text-left text-xs sm:text-sm" {...props} />
                        </div>
                      ),
                      thead: ({node, ...props}) => <thead className="bg-slate-50 border-b border-slate-200" {...props} />,
                      th: ({node, ...props}) => <th className="px-4 py-2.5 font-semibold text-slate-700" {...props} />,
                      td: ({node, ...props}) => <td className="border-t border-slate-150 px-4 py-2.5 text-slate-600" {...props} />
                    }}
                  >
                    {docContent}
                  </ReactMarkdown>
                </div>

              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
              Select a document to begin reading
            </div>
          )}
        </main>

      </div>
    </div>
  );
}
