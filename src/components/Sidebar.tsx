import React from 'react';
import { NavLink } from 'react-router-dom';

const navItems = [
  { path: '/', label: 'Overview', icon: '📊' },
  { path: '/agents', label: 'Agent Hub', icon: '🤖' },
  { path: '/kanban', label: 'Kanban', icon: '📋' },
];

const Sidebar: React.FC = () => {
  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 h-screen sticky top-0">
      {/* Logo */}
      <div className="p-5 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
            N
          </div>
          <div>
            <h1 className="text-sm font-bold text-white tracking-tight">Nova Ops</h1>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest">Command Center</p>
          </div>
        </div>
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
  );
};

export default Sidebar;
