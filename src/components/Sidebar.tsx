import React from 'react';
import { NavLink } from 'react-router-dom';

const navItems = [
  { path: '/', label: 'Overview', icon: '📊' },
  { path: '/agents', label: 'Agent Hub', icon: '🤖' },
  { path: '/org-chart', label: 'Org Chart', icon: '🏛️' },
  { path: '/live-feed', label: 'Live Feed', icon: '📡' },
  { path: '/kanban', label: 'Kanban', icon: '📋' },
  { path: '/news', label: 'News', icon: '📡' },
  { path: '/workflows', label: 'Workflows', icon: '🔄' },
  { path: '/skills', label: 'Skills', icon: '🧩' },
  { path: '/gateways', label: 'Gateways', icon: '🔌' },
  { path: '/chat', label: 'Chat', icon: '💬' },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  return (
    <>
      {/* Overlay backdrop — mobile only */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Sidebar / Drawer */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 border-r border-slate-800 flex flex-col
          transform transition-transform duration-300 ease-in-out
          md:relative md:translate-x-0 md:z-auto md:shrink-0 md:h-screen md:sticky md:top-0
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Logo + Close button */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
              N
            </div>
            <div>
              <h1 className="text-sm font-bold text-white tracking-tight">Nova Ops</h1>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest">Command Center</p>
            </div>
          </div>
          {/* Close button — mobile only */}
          <button
            onClick={onClose}
            className="md:hidden flex items-center justify-center h-8 w-8 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
            aria-label="Close menu"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3">
          <p className="text-[10px] text-slate-600 uppercase tracking-widest font-medium px-3 mb-2">Navigation</p>
          <ul className="space-y-1">
            {navItems.map((item) => (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  end={item.path === '/'}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 ${
                      isActive
                        ? 'bg-blue-500/10 text-blue-400 font-medium'
                        : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                    }`
                  }
                >
                  <span className="text-base">{item.icon}</span>
                  <span>{item.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* System Status Footer */}
        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-2 mb-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-xs text-slate-400">System Operational</span>
          </div>
          <p className="text-[10px] text-slate-600">Nova AI &bull; v1.0</p>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
