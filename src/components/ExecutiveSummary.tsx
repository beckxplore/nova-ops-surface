import React, { useMemo } from 'react';
import { useGateway } from '../context/GatewayContext';

const ExecutiveSummary: React.FC = () => {
  const { eco, status } = useGateway();

  const stats = useMemo(() => {
    if (!eco) return null;

    // Agent counts
    const deptAgentCount = eco.departments?.reduce((sum: number, d: any) => sum + 1 + (d.agents?.length || 0), 0) || 0;
    const individualCount = eco.individualAgents?.length || 0;
    const totalAgents = deptAgentCount + individualCount + 1; // +1 for Nova orchestrator
    const runningAgents = eco.departments?.reduce((sum: number, d: any) => {
      let c = d.lead?.status === 'running' ? 1 : 0;
      c += (d.agents || []).filter((a: any) => a.status === 'running').length;
      return sum + c;
    }, 0) + (eco.individualAgents || []).filter((a: any) => a.status === 'running').length + (eco.orchestrator?.status === 'running' ? 1 : 0);

    // Kanban stats
    const kanban = eco.kanban;
    let totalTasks = 0, doneTasks = 0, inProgressTasks = 0, blockedTasks = 0;
    if (kanban?.columns) {
      for (const col of kanban.columns) {
        totalTasks += col.tasks.length;
        if (col.id === 'done') doneTasks += col.tasks.length;
        if (col.id === 'in-progress') inProgressTasks += col.tasks.length;
        if (col.id === 'review') blockedTasks += col.tasks.length;
      }
    }

    // Department count
    const deptCount = eco.departments?.length || 0;
    const deptNames = eco.departments?.map((d: any) => d.name).join(' · ') || 'None';

    // Project count
    const projectCount = eco.projects?.length || 0;

    // Connection = system status
    const isOnline = status === 'connected';

    return { totalAgents, runningAgents, totalTasks, doneTasks, inProgressTasks, blockedTasks, deptCount, deptNames, projectCount, isOnline };
  }, [eco, status]);

  const now = new Date();
  const lastCheck = now.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Africa/Nairobi' }) + ' GMT+3';

  const isOnline = status === 'connected';

  if (!stats) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Executive Summary</h2>
          <span className="text-xs text-slate-500 animate-pulse">Loading live data...</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-slate-800/50 rounded-lg p-4 animate-pulse">
              <div className="h-3 bg-slate-700 rounded w-20 mb-3"></div>
              <div className="h-6 bg-slate-700 rounded w-12"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const completionRate = stats.totalTasks > 0 ? Math.round((stats.doneTasks / stats.totalTasks) * 100) : 0;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Executive Summary</h2>
        <span className="text-xs text-slate-500">Live · {lastCheck}</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* System Status */}
        <div className="bg-slate-800/50 rounded-lg p-4">
          <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">System State</p>
          <p className={`text-xl font-bold ${isOnline ? 'text-emerald-400' : 'text-amber-400'}`}>
            {isOnline ? 'Operational' : 'Syncing'}
          </p>
          <p className="text-[10px] text-slate-600 mt-1">
            Gateway {isOnline ? 'connected' : 'reconnecting'}
          </p>
        </div>

        {/* Agents Online */}
        <div className="bg-slate-800/50 rounded-lg p-4">
          <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Agents</p>
          <div className="flex items-baseline gap-1">
            <p className="text-xl font-bold text-white">{stats.runningAgents}</p>
            <p className="text-sm text-slate-500">/ {stats.totalAgents}</p>
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <p className="text-[10px] text-emerald-400">{stats.runningAgents} active</p>
          </div>
        </div>

        {/* Task Progress */}
        <div className="bg-slate-800/50 rounded-lg p-4">
          <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Tasks</p>
          <div className="flex items-baseline gap-1">
            <p className="text-xl font-bold text-white">{stats.doneTasks}</p>
            <p className="text-sm text-slate-500">/ {stats.totalTasks}</p>
          </div>
          <div className="w-full h-1.5 bg-slate-700 rounded-full mt-2 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-400 transition-all duration-1000"
              style={{ width: `${completionRate}%` }}
            ></div>
          </div>
          <p className="text-[10px] text-slate-600 mt-1">{completionRate}% complete · {stats.inProgressTasks} in progress</p>
        </div>

        {/* Departments */}
        <div className="bg-slate-800/50 rounded-lg p-4">
          <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Departments</p>
          <p className="text-xl font-bold text-white">{stats.deptCount}</p>
          <p className="text-xs text-slate-500 mt-1">{stats.deptNames}</p>
        </div>
      </div>
    </div>
  );
};

export default ExecutiveSummary;
