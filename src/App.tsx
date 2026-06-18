/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Dashboard from './components/Dashboard';

export default function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
        <nav className="bg-white border-b border-gray-200 px-4 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <h1 className="text-xl font-medium tracking-tight text-gray-900">
              GitHub Pages Auditor
            </h1>
            <div className="space-x-4">
              <Link to="/" className="text-sm text-gray-600 hover:text-gray-900">Dashboard</Link>
            </div>
          </div>
        </nav>
        <main className="max-w-7xl mx-auto py-8 px-4">
          <Routes>
            <Route path="/" element={<Dashboard />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}
