import React, { useState, useEffect, useCallback } from 'react';
import { useGateway } from '../context/GatewayContext';
import { getGatewayConfig } from '../gatewayConfig';

// Nova API proxy lives at the same host as the gateway, under /nova-api
async function novaFetch(path: string, opts: RequestInit = {}): Promise<any> {
  let base: string;
  let token: string;
  if (import.meta.env.DEV) {
    base = 'http://localhost:3001';
    token = '';
  } else {
    const cfg = await getGatewayConfig();
    const wsUrl = cfg.gatewayUrl || '';
    base = wsUrl.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:') + '/nova-api';
    token = cfg.authToken || '';
  }
  const res = await fetch(`${base}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}), ...(opts.headers as Record<string,string> || {}) },
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return res.json();
}

interface AgentNode {
  id: string; name: string; status: string;
  currentTask?: string | null; filesPath?: string;
}
interface Department {
  id: string; name: string; description: string;
  project: string | null;
  lead: AgentNode; agents: AgentNode[];
}
interface Project {
  id: string; name: string; description: string; status: string;
  manager: AgentNode;
  departments: string[];
  agents: string[];
}

interface LiveStatus {
  timestamp: string;
  gateway: { reachable: boolean; latencyMs: number | null };
  ecosystem: { departments: number; totalAgents: number; runningAgents: number; orchestratorStatus: string; projects: number } | null;
  kanban: { total: number; backlog: number; inProgress: number; review: number; done: number } | null;
}

interface ModelInfo {
  id: string;
  name?: string;
}

const statusCfg: Record<string, { cls: string; dot: string; label: string }> = {
  running: { cls: 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20', dot: 'bg-emerald-400 animate-pulse', label: 'Running' },
  idle: { cls: 'bg-slate-500/10 text-slate-400 ring-slate-500/20', dot: 'bg-slate-500', label: 'Idle' },
  stalled: { cls: 'bg-red-500/10 text-red-400 ring-red-500/20', dot: 'bg-red-400 animate-pulse', label: 'Stalled' },
};

type SelectedItem = { type: 'orchestrator' | 'project' | 'department' | 'agent'; id: string; name: string; filesPath?: string; agentId?: string };

const AgentHubPage: React.FC = () => {
  const { eco, status: gwStatus } = useGateway();
  const [selected, setSelected] = useState<SelectedItem | null>(null);
  const [activeFile, setActiveFile] = useState('SOUL.md');
  const [fileContent, setFileContent] = useState('');
  const [editing, setEditing] = useState(false);
  const [editBuffer, setEditBuffer] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [agentFiles, setAgentFiles] = useState<Record<string, string>>({});
  const [liveStatus, setLiveStatus] = useState<LiveStatus | null>(null);
  const [filesLoading, setFilesLoading] = useState(false);
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>([]);
  const [currentModel, setCurrentModel] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [modelSaving, setModelSaving] = useState(false);
  const [modelStatus, setModelStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const isConnected = gwStatus === 'connected';

  // Load available models + current model via Nova API (no WS dependency)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await novaFetch('/api/models');
        if (cancelled) return;
        const models = Array.isArray(data) ? data : (data?.models || []);
        setAvailableModels(models.map((m: any) => ({
          id: typeof m === 'string' ? m : (m.key || m.id),
          name: m.name || m.alias || m.key || m.id,
        })));
      } catch (err) {
        console.warn('[Hub] models fetch failed:', err);
      }
      try {
        const data = await novaFetch('/api/model');
        if (cancelled) return;
        if (data?.model) {
          setCurrentModel(data.model);
          setSelectedModel(data.model);
        }
      } catch (err) {
        console.warn('[Hub] current model fetch failed:', err);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Fetch live status from API
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const r = await fetch('/api/status');
        if (r.ok) setLiveStatus(await r.json());
      } catch {}
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 60000);
    return () => clearInterval(interval);
  }, []);

  // Map selected item to agent ID for API calls
  const getAgentId = (item: SelectedItem): string => {
    if (item.type === 'orchestrator') return 'nova';
    if (item.type === 'department') return item.id; // 'development' or 'research'
    if (item.type === 'agent') {
      // Map lead agents to their department
      const map: Record<string, string> = { 'dev-lead': 'development', 'research-lead': 'research' };
      return map[item.id] || item.id;
    }
    return 'nova';
  };

  const selectItem = useCallback(async (item: SelectedItem) => {
    setSelected(item);
    setEditing(false);
    setSaveStatus('idle');
    setAgentFiles({});
    setFileContent('');

    try {
      setFilesLoading(true);
      const agentId = getAgentId(item);
      const data = await novaFetch(`/api/files?agent=${encodeURIComponent(agentId)}`);
      const files: Record<string, string> = data?.files || {};
      setAgentFiles(files);
      const firstFile = Object.keys(files)[0];
      if (firstFile) { setFileContent(files[firstFile]); setActiveFile(firstFile); }
      else { setFileContent(''); setActiveFile('SOUL.md'); }
    } catch (err) {
      console.error('[Hub] File load failed:', err);
    } finally {
      setFilesLoading(false);
    }
  }, []);

  const saveFile = async () => {
    if (!selected) return;
    setSaving(true);
    setSaveStatus('idle');
    try {
      const agentId = getAgentId(selected);
      await novaFetch(`/api/files/${encodeURIComponent(activeFile)}?agent=${encodeURIComponent(agentId)}`, {
        method: 'PUT',
        body: JSON.stringify({ content: editBuffer }),
      });
      setFileContent(editBuffer);
      setAgentFiles(prev => ({ ...prev, [activeFile]: editBuffer }));
      setEditing(false);
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err) {
      console.error('Save failed:', err);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 5000);
    }
    setSaving(false);
  };

  const saveModel = async () => {
    if (!selectedModel || selectedModel === currentModel) return;
    setModelSaving(true);
    setModelStatus('idle');
    try {
      await novaFetch('/api/model', {
        method: 'PUT',
        body: JSON.stringify({ model: selectedModel }),
      });
      setCurrentModel(selectedModel);
      setModelStatus('success');
      setTimeout(() => setModelStatus('idle'), 3000);
    } catch (err) {
      console.error('Model change failed:', err);
      setModelStatus('error');
      setTimeout(() => setModelStatus('idle'), 5000);
    }
    setModelSaving(false);
  };

  const StatusBadge = ({ status: s }: { status: string }) => {
    const c = statusCfg[s] || statusCfg.idle;
    return (
      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium ring-1 ${c.cls}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`}></span>{c.label}
      </span>
    );
  };

  if (!eco) return (
    <div className="p-4 md:p-6 flex flex-col items-center justify-center min-h-[400px]">
      <p className="text-slate-500 animate-pulse">Waiting for live data feed...</p>
    </div>
  );

  const fileIcons: Record<string, string> = {
    'SOUL.md': '🧬', 'GOAL.md': '🎯', 'MEMORY.md': '🧠', 'IDENTITY.md': '🪪',
    'USER.md': '👤', 'TOOLS.md': '🔧', 'AGENTS.md': '📋', 'HEARTBEAT.md': '💓',
  };
  const mdFiles = Object.keys(agentFiles).filter(f => f.endsWith('.md'));

  const getAgentTaskCount = (agentName: string) => {
    if (!eco?.kanban?.columns) return { active: 0, total: 0 };
    let active = 0, total = 0;
    for (const col of eco.kanban.columns) {
      for (const task of (col.tasks || [])) {
        if (task.assignee?.toLowerCase() === agentName.toLowerCase()) {
          total++;
          if (col.id === 'in-progress' || col.id === 'review') active++;
        }
      }
    }
    return { active, total };
  };

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 md:mb-8 gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white">Agent Hub</h1>
          <p className="text-slate-400 mt-1 text-xs md:text-sm">Organizational hierarchy &bull; Projects, Departments, Agents</p>
        </div>
        <div className="flex items-center gap-3 self-start">
          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium ring-1 ${
            isConnected ? 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20' : 'bg-amber-500/10 text-amber-400 ring-amber-500/20'
          }`}>
            <span className={`h-1.5 w-1.5 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
            {isConnected ? 'LIVE' : gwStatus === 'connecting' ? 'CONNECTING' : 'OFFLINE'}
          </span>
        </div>
      </div>

      {/* Live Status Banner */}
      {liveStatus && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 md:gap-3 mb-4 md:mb-6">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5 md:p-3">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Gateway</p>
            <p className={`text-xs md:text-sm font-semibold ${liveStatus.gateway?.reachable ? 'text-emerald-400' : 'text-red-400'}`}>
              {liveStatus.gateway?.reachable ? 'Online' : 'Offline'}
            </p>
            {liveStatus.gateway?.latencyMs != null && (
              <p className="text-[10px] text-slate-600">{liveStatus.gateway.latencyMs}ms latency</p>
            )}
          </div>
          {liveStatus.ecosystem && (
            <>
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5 md:p-3">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Agents</p>
                <p className="text-xs md:text-sm font-semibold text-white">{liveStatus.ecosystem.runningAgents} / {liveStatus.ecosystem.totalAgents}</p>
                <p className="text-[10px] text-emerald-400">{liveStatus.ecosystem.runningAgents} active</p>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5 md:p-3">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Orchestrator</p>
                <p className={`text-xs md:text-sm font-semibold ${liveStatus.ecosystem.orchestratorStatus === 'running' ? 'text-emerald-400' : 'text-slate-400'}`}>
                  {liveStatus.ecosystem.orchestratorStatus === 'running' ? 'Online' : 'Standby'}
                </p>
              </div>
            </>
          )}
          {liveStatus.kanban && (
            <>
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5 md:p-3">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Active Tasks</p>
                <p className="text-xs md:text-sm font-semibold text-white">{liveStatus.kanban.inProgress + liveStatus.kanban.review}</p>
                <p className="text-[10px] text-slate-600 hidden sm:block">{liveStatus.kanban.inProgress} in prog · {liveStatus.kanban.review} review</p>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5 md:p-3">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Completion</p>
                <p className="text-xs md:text-sm font-semibold text-white">
                  {liveStatus.kanban.total > 0 ? Math.round((liveStatus.kanban.done / liveStatus.kanban.total) * 100) : 0}%
                </p>
                <p className="text-[10px] text-slate-600">{liveStatus.kanban.done} / {liveStatus.kanban.total} done</p>
              </div>
            </>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Left Panel — Hierarchy */}
        <div className="lg:col-span-1 space-y-4 md:space-y-5 overflow-y-auto lg:max-h-[calc(100vh-14rem)]">
          {/* Orchestrator */}
          <div>
            <p className="text-[10px] text-slate-600 uppercase tracking-widest font-medium mb-2">Orchestrator</p>
            <button
              onClick={() => selectItem({ type: 'orchestrator', id: 'nova', name: 'Nova' })}
              className={`w-full text-left bg-slate-900 border rounded-xl p-3 md:p-4 transition-all ${
                selected?.id === 'nova' ? 'border-blue-500/50 ring-1 ring-blue-500/20' : 'border-slate-800 hover:border-slate-700'
              }`}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs">N</div>
                  <span className="font-medium text-white text-sm">Nova</span>
                </div>
                <StatusBadge status={eco.orchestrator?.status || 'idle'} />
              </div>
              <p className="text-xs text-slate-500 ml-9">{eco.orchestrator?.description || 'Central orchestrator'}</p>
              {currentModel && <p className="text-[10px] text-blue-400 ml-9 mt-1 font-mono truncate">{currentModel}</p>}
            </button>
          </div>

          {/* Projects */}
          <div>
            <p className="text-[10px] text-slate-600 uppercase tracking-widest font-medium mb-2">Projects</p>
            {(!eco.projects || eco.projects.length === 0) ? (
              <div className="bg-slate-900/50 border border-dashed border-slate-800 rounded-xl p-4 text-center">
                <p className="text-xs text-slate-600">No active projects</p>
              </div>
            ) : eco.projects.map((proj: Project) => (
              <button key={proj.id}
                onClick={() => selectItem({ type: 'project', id: proj.id, name: proj.name })}
                className={`w-full text-left bg-slate-900 border rounded-xl p-3 md:p-4 mb-2 transition-all ${
                  selected?.id === proj.id ? 'border-purple-500/50 ring-1 ring-purple-500/20' : 'border-slate-800 hover:border-slate-700'
                }`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-white text-sm">📁 {proj.name}</span>
                  <StatusBadge status={proj.status} />
                </div>
                <p className="text-xs text-slate-500">{proj.description}</p>
              </button>
            ))}
          </div>

          {/* Departments */}
          <div>
            <p className="text-[10px] text-slate-600 uppercase tracking-widest font-medium mb-2">Departments</p>
            {(eco.departments || []).map((dept: Department) => {
              const taskLoad = getAgentTaskCount(dept.name);
              return (
                <div key={dept.id} className="mb-3">
                  <button
                    onClick={() => selectItem({ type: 'department', id: dept.id, name: dept.name, filesPath: `departments/${dept.id}` })}
                    className={`w-full text-left bg-slate-900 border rounded-xl p-3 md:p-4 transition-all ${
                      selected?.id === dept.id ? 'border-blue-500/50 ring-1 ring-blue-500/20' : 'border-slate-800 hover:border-slate-700'
                    }`}>
                    <div className="flex items-center justify-between mb-1 flex-wrap gap-1">
                      <span className="font-medium text-white text-sm">{dept.name}</span>
                      {dept.project && <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded ring-1 ring-amber-500/20">🔒 {dept.project}</span>}
                    </div>
                    <p className="text-xs text-slate-500 mb-2">{dept.description}</p>
                    <div className="flex items-center justify-between flex-wrap gap-1">
                      <div className="text-xs text-slate-600">{1 + (dept.agents?.length || 0)} agent{(dept.agents?.length || 0) !== 0 ? 's' : ''}</div>
                      {taskLoad.total > 0 && (
                        <span className="text-[10px] text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded ring-1 ring-blue-500/20">
                          {taskLoad.active} active / {taskLoad.total} tasks
                        </span>
                      )}
                    </div>
                  </button>
                  <div className="ml-4 mt-1 space-y-1">
                    {dept.lead && (
                      <button
                        onClick={() => selectItem({ type: 'agent', id: dept.lead.id, name: `${dept.lead.name} (Lead)`, filesPath: dept.lead.filesPath || `departments/${dept.id}` })}
                        className={`w-full text-left bg-slate-800/40 border rounded-lg p-2.5 md:p-3 transition-all min-h-[44px] ${
                          selected?.id === dept.lead.id ? 'border-blue-500/50 ring-1 ring-blue-500/20' : 'border-slate-800 hover:border-slate-700'
                        }`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-[10px] text-amber-400 shrink-0">👑</span>
                            <span className="text-xs font-medium text-slate-300 truncate">{dept.lead.name}</span>
                            <span className="text-[10px] text-slate-600 shrink-0">Lead</span>
                          </div>
                          <StatusBadge status={dept.lead.status} />
                        </div>
                      </button>
                    )}
                    {(dept.agents || []).map((agent: AgentNode) => (
                      <button key={agent.id}
                        onClick={() => selectItem({ type: 'agent', id: agent.id, name: agent.name, filesPath: agent.filesPath || `departments/${dept.id}/${agent.id}` })}
                        className={`w-full text-left bg-slate-800/30 border rounded-lg p-2.5 md:p-3 transition-all min-h-[44px] ${
                          selected?.id === agent.id ? 'border-blue-500/50 ring-1 ring-blue-500/20' : 'border-slate-800 hover:border-slate-700'
                        }`}>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-300 truncate">{agent.name}</span>
                          <StatusBadge status={agent.status} />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Panel — Detail */}
        <div className="lg:col-span-2 min-w-0">
          {selected ? (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 md:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 md:mb-6 gap-2">
                <div>
                  <span className="text-xs text-slate-600 uppercase">{selected.type}</span>
                  <h2 className="text-lg md:text-xl font-bold text-white">{selected.name}</h2>
                </div>
                {!isConnected && (
                  <span className="text-xs text-amber-400 bg-amber-500/10 px-2 py-1 rounded ring-1 ring-amber-500/20 self-start">
                    ⏳ Connecting to gateway...
                  </span>
                )}
              </div>

              {/* Model Selector — orchestrator only */}
              {selected.type === 'orchestrator' && (
                <div className="mb-4 md:mb-6">
                  <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">🧠 LLM Model</h3>
                  <div className="bg-slate-800/30 rounded-lg p-3 md:p-4">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
                      <div className="flex-1 min-w-0">
                        <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1.5">Active Model</label>
                        <select
                          value={selectedModel}
                          onChange={e => setSelectedModel(e.target.value)}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 md:py-2 text-sm text-white font-mono focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                        >
                          {availableModels.length > 0 ? availableModels.map(m => (
                            <option key={m.id} value={m.id}>
                              {m.name || m.id}{m.id === currentModel ? ' ✓' : ''}
                            </option>
                          )) : (
                            <option value={currentModel}>{currentModel || 'Loading...'}</option>
                          )}
                        </select>
                      </div>
                      <div>
                        <button
                          onClick={saveModel}
                          disabled={modelSaving || selectedModel === currentModel}
                          className={`w-full sm:w-auto px-4 py-2.5 md:py-2 rounded-lg text-xs font-medium transition-all min-h-[44px] sm:min-h-0 ${
                            selectedModel !== currentModel
                              ? 'bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20 hover:bg-blue-500/20'
                              : 'bg-slate-800 text-slate-600 cursor-not-allowed'
                          }`}
                        >
                          {modelSaving ? '⏳ Applying...' : '🔄 Switch'}
                        </button>
                      </div>
                    </div>
                    {modelStatus === 'success' && <p className="text-[10px] text-emerald-400 mt-2">✅ Model changed! Takes effect on next message.</p>}
                    {modelStatus === 'error' && <p className="text-[10px] text-red-400 mt-2">❌ Failed to save model.</p>}
                    {currentModel && (
                      <p className="mt-2 text-[10px] text-slate-500">
                        Current: <span className="text-blue-400 font-mono break-all">{currentModel}</span>
                        {availableModels.length > 0 && <span className="ml-3">{availableModels.length} models available</span>}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* System status — orchestrator */}
              {selected.type === 'orchestrator' && (
                <div className="mb-4 md:mb-6 space-y-3">
                  <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider">System Status</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="bg-slate-800/30 rounded-lg p-3 md:p-4">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Role</p>
                      <p className="text-sm font-medium text-white">CEO's Orchestrator AI</p>
                    </div>
                    <div className="bg-slate-800/30 rounded-lg p-3 md:p-4">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Status</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`h-2 w-2 rounded-full ${eco.orchestrator?.status === 'running' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`}></span>
                        <p className={`text-sm font-medium ${eco.orchestrator?.status === 'running' ? 'text-emerald-400' : 'text-slate-400'}`}>
                          {eco.orchestrator?.status === 'running' ? 'Online' : 'Standby'}
                        </p>
                      </div>
                    </div>
                    <div className="bg-slate-800/30 rounded-lg p-3 md:p-4">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Gateway</p>
                      {liveStatus?.gateway ? (
                        <p className={`text-sm font-medium ${liveStatus.gateway.reachable ? 'text-emerald-400' : 'text-red-400'}`}>
                          {liveStatus.gateway.reachable ? `Connected (${liveStatus.gateway.latencyMs}ms)` : 'Unreachable'}
                        </p>
                      ) : <p className="text-sm text-slate-500 animate-pulse">Checking...</p>}
                    </div>
                    <div className="bg-slate-800/30 rounded-lg p-3 md:p-4">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Channels</p>
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        <span className="text-[10px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded ring-1 ring-blue-500/20">Telegram</span>
                        <span className="text-[10px] bg-purple-500/10 text-purple-400 px-1.5 py-0.5 rounded ring-1 ring-purple-500/20">Web Chat</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Department tasks */}
              {selected.type === 'department' && eco.kanban?.columns && (() => {
                const deptTasks: any[] = [];
                for (const col of eco.kanban.columns) {
                  for (const task of (col.tasks || [])) {
                    if (task.assignee?.toLowerCase() === selected.name.toLowerCase()) {
                      deptTasks.push({ ...task, column: col.title, columnId: col.id });
                    }
                  }
                }
                if (deptTasks.length === 0) return null;
                return (
                  <div className="mb-4 md:mb-6">
                    <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">Assigned Tasks ({deptTasks.length})</h3>
                    <div className="space-y-2">
                      {deptTasks.map((task: any) => (
                        <div key={task.id} className="bg-slate-800/30 rounded-lg px-3 md:px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-white font-medium truncate">{task.title}</p>
                            <p className="text-[10px] text-slate-500 mt-0.5">{task.description}</p>
                          </div>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ring-1 shrink-0 self-start sm:self-center ${
                            task.columnId === 'done' ? 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20' :
                            task.columnId === 'in-progress' ? 'bg-blue-500/10 text-blue-400 ring-blue-500/20' :
                            'bg-slate-500/10 text-slate-400 ring-slate-500/20'
                          }`}>{task.column}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* File loading */}
              {filesLoading && (
                <div className="mb-4 flex items-center gap-2 text-sm text-slate-500 animate-pulse">
                  <span>⏳</span> Loading workspace files...
                </div>
              )}

              {/* File tabs + editor */}
              {mdFiles.length > 0 && (
                <>
                  <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">📁 Workspace Files</h3>
                  <div className="flex gap-1 mb-4 bg-slate-800/30 rounded-lg p-1 overflow-x-auto">
                    {mdFiles.map(file => (
                      <button key={file}
                        onClick={() => { setActiveFile(file); setFileContent(agentFiles[file] || ''); setEditing(false); }}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-all whitespace-nowrap ${
                          activeFile === file ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'
                        }`}>
                        <span>{fileIcons[file] || '📄'}</span><span>{file}</span>
                      </button>
                    ))}
                  </div>

                  {!editing ? (
                    <div>
                      <div className="flex justify-end mb-2">
                        <button onClick={() => { setEditBuffer(fileContent); setEditing(true); }}
                          className="px-3 py-2 md:py-1.5 bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20 rounded-lg text-xs font-medium hover:bg-blue-500/20 transition-colors min-h-[44px] md:min-h-0">
                          ✏️ Edit
                        </button>
                      </div>
                      <div className="bg-slate-800/30 rounded-lg p-3 md:p-4 max-h-[500px] overflow-y-auto">
                        <pre className="text-xs md:text-sm text-slate-300 whitespace-pre-wrap font-mono leading-relaxed">{fileContent || 'No content'}</pre>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-2 gap-2">
                        <span className="text-xs text-slate-500 font-mono">Editing: {activeFile}</span>
                        <div className="flex gap-2 items-center flex-wrap">
                          {saveStatus === 'success' && <span className="text-[10px] text-emerald-400">✅ Saved!</span>}
                          {saveStatus === 'error' && <span className="text-[10px] text-red-400">❌ Save failed</span>}
                          <button onClick={() => setEditing(false)} className="px-3 py-2 md:py-1.5 bg-slate-800 text-slate-400 rounded-lg text-xs font-medium hover:bg-slate-700 min-h-[44px] md:min-h-0">Cancel</button>
                          <button onClick={saveFile} disabled={saving}
                            className="px-3 py-2 md:py-1.5 bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20 rounded-lg text-xs font-medium hover:bg-emerald-500/20 disabled:opacity-50 min-h-[44px] md:min-h-0">
                            {saving ? 'Saving...' : '💾 Save'}
                          </button>
                        </div>
                      </div>
                      <textarea value={editBuffer} onChange={e => setEditBuffer(e.target.value)}
                        className="w-full h-64 md:h-96 bg-slate-800/50 border border-slate-700 rounded-lg p-3 md:p-4 text-xs md:text-sm text-slate-300 font-mono leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-blue-500/50" />
                    </div>
                  )}
                </>
              )}

              {/* No files */}
              {!filesLoading && mdFiles.length === 0 && (
                <div className="bg-slate-800/30 rounded-lg p-8 text-center">
                  <p className="text-slate-500">
                    {!isConnected ? 'Connecting to gateway to load files...' : 'No workspace files loaded.'}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 md:p-12 flex flex-col items-center justify-center text-center h-full min-h-[300px] md:min-h-[400px]">
              <span className="text-3xl md:text-4xl mb-4">🏗️</span>
              <h3 className="text-base md:text-lg font-medium text-white mb-2">Organizational Hierarchy</h3>
              <p className="text-xs md:text-sm text-slate-500 max-w-sm">Select Nova, a project, department, or agent to inspect and configure.</p>
              <div className="mt-6 text-[10px] md:text-xs text-slate-600 space-y-1 text-left">
                <p>📁 <strong className="text-slate-400">Projects</strong> — dedicated work with locked resources</p>
                <p>🏢 <strong className="text-slate-400">Departments</strong> — teams led by a department lead</p>
                <p>👑 <strong className="text-slate-400">Leads</strong> — manage team, solo until workload grows</p>
                <p>🤖 <strong className="text-slate-400">Agents</strong> — individual workers with own SOUL/MEMORY</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AgentHubPage;
