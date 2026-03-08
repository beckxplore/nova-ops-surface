import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import Sidebar from './components/Sidebar';
import OverviewPage from './pages/OverviewPage';
import AgentHubPage from './pages/AgentHubPage';
import KanbanPage from './pages/KanbanPage';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-slate-950 text-slate-100 flex">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/" element={<OverviewPage />} />
            <Route path="/agents" element={<AgentHubPage />} />
            <Route path="/kanban" element={<KanbanPage />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
