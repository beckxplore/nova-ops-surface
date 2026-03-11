import React, { useState, useEffect } from 'react';
import ExecutiveSummary from '../components/ExecutiveSummary';
import ExecutionMatrix from '../components/ExecutionMatrix';
import ResourcePulse from '../components/ResourcePulse';
import EventStream from '../components/EventStream';

interface Ecosystem {
  orchestrator: { status: string };
  projects: { id: string; name: string; status: string; description: string }[];
  departments: { id: string; name: string; lead: { status: string }; agents: { status: string }[]; project: string | null }[];
  individualAgents: { id: string; name: string; status: string }[];
}

const OverviewPage: React.FC = () => {
  const [eco, setEco] = useState<Ecosystem | null>(null);

  useEffect(() => {
    fetch('/ecosystem.json').then(r => r.json()).then(setEco).catch(console.error);
  }, []);

  const totalAgents = eco ? eco.departments.reduce((sum, d) => sum + 1 + d.agents.length, 0) + eco.individualAgents.length : 0;
  const runningAgents = eco ? eco.departments.reduce((sum, d) => {
    let c = d.lead.status === 'running' ? 1 : 0;
    c += d.agents.filter(a => a.status === 'running').length;
    return sum + c;
  }, 0) + eco.individualAgents.filter(a => a.status === 'running').length : 0;
  const idleAgents = totalAgents - runningAgents;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Overview</h1>
          <p className="text-slate-400 mt-1 text-sm">Real-time organizational monitoring</p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
          LIVE
        </span>
      </div>

      {/* Executive Summary */}
      <div className="mb-6">
        <ExecutiveSummary />
      </div>

      {/* Ecosystem Quick Stats */}
      {eco && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Active Projects</p>
            <p className="text-2xl font-bold text-white">{eco.projects.length}</p>
            {eco.projects.length === 0 && <p className="text-[10px] text-slate-600 mt-1">No active projects</p>}
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Departments</p>
            <p className="text-2xl font-bold text-white">{eco.departments.length}</p>
            <p className="text-[10px] text-slate-600 mt-1">
              {eco.departments.filter(d => d.project).length} locked to projects
            </p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Total Agents</p>
            <p className="text-2xl font-bold text-white">{totalAgents}</p>
            <p className="text-[10px] text-slate-600 mt-1">
              <span className="text-emerald-400">{runningAgents} running</span> · <span className="text-slate-500">{idleAgents} idle</span>
            </p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Orchestrator</p>
            <div className="flex items-center gap-2 mt-1">
              <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs">N</div>
              <div>
                <p className="text-sm font-bold text-white">Nova</p>
                <p className="text-[10px] text-emerald-400">Online</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Projects Section — only if projects exist */}
      {eco && eco.projects.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-white mb-3">Active Projects</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {eco.projects.map(proj => (
              <div key={proj.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-white">📁 {proj.name}</h3>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ring-1 ${
                    proj.status === 'running' ? 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20' : 'bg-slate-500/10 text-slate-400 ring-slate-500/20'
                  }`}>{proj.status}</span>
                </div>
                <p className="text-xs text-slate-500">{proj.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2">
          <ExecutionMatrix />
        </div>
        <div>
          <ResourcePulse />
        </div>
      </div>

      {/* Event Stream */}
      <div>
        <EventStream />
      </div>
    </div>
  );
};

export default OverviewPage;
