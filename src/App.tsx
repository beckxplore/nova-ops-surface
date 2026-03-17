import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import Sidebar from './components/Sidebar';
import OverviewPage from './pages/OverviewPage';
import AgentHubPage from './pages/AgentHubPage';
import KanbanPage from './pages/KanbanPage';
import LiveFeedPage from './pages/LiveFeedPage';
import ChatPage from './pages/ChatPage';
import OrgChartPage from './pages/OrgChartPage';

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <Router>
      <div className="min-h-screen bg-slate-950 text-slate-100 flex">
        {/* Mobile hamburger top bar */}
        <div className="fixed top-0 left-0 right-0 z-40 md:hidden flex items-center h-14 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-4">
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex items-center justify-center h-10 w-10 rounded-lg text-slate-300 hover:bg-slate-800 transition-colors"
            aria-label="Open menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex items-center gap-2 ml-3">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs">
              N
            </div>
            <span className="text-sm font-bold text-white tracking-tight">Nova Ops</span>
          </div>
        </div>

        {/* Sidebar / Drawer */}
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        {/* Main content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden min-w-0 pt-14 md:pt-0">
          <Routes>
            <Route path="/" element={<OverviewPage />} />
            <Route path="/agents" element={<AgentHubPage />} />
            <Route path="/live-feed" element={<LiveFeedPage />} />
            <Route path="/org-chart" element={<OrgChartPage />} />
            <Route path="/kanban" element={<KanbanPage />} />
            <Route path="/chat" element={<ChatPage />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
