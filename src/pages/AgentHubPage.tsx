import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useGateway } from '../context/GatewayContext';
import { getOrCreateDeviceIdentity } from '../utils/cryptoUtils';
import { getGatewayConfig } from '../gatewayConfig';

const API = import.meta.env.DEV ? 'http://localhost:3001' : '';

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
  contextWindow?: number;
  inputTypes?: string[];
}

const statusCfg: Record<string, { cls: string; dot: string; label: string }> = {
  running: { cls: 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20', dot: 'bg-emerald-400 animate-pulse', label: 'Running' },
  idle: { cls: 'bg-slate-500/10 text-slate-400 ring-slate-500/20', dot: 'bg-slate-500', label: 'Idle' },
  stalled: { cls: 'bg-red-500/10 text-red-400 ring-red-500/20', dot: 'bg-red-400 animate-pulse', label: 'Stalled' },
};

type SelectedItem = { type: 'orchestrator' | 'project' | 'department' | 'agent'; id: string; name: string; filesPath?: string; agentId?: string };

let rpcCounter = 0;
function nextRpcId() { return `hub-${Date.now()}-${++rpcCounter}`; }

const AgentHubPage: React.FC = () => {
  const { eco, status } = useGateway();
  const [selected, setSelected] = useState<SelectedItem | null>(null);
  const [activeFile, setActiveFile] = useState('SOUL.md');
  const [fileContent, setFileContent] = useState('');
  const [editing, setEditing] = useState(false);
  const [editBuffer, setEditBuffer] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [agentFiles, setAgentFiles] = useState<Record<string, string>>({});
  const [liveStatus, setLiveStatus] = useState<LiveStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [filesLoading, setFilesLoading] = useState(false);
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>([]);
  const [currentModel, setCurrentModel] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [modelSaving, setModelSaving] = useState(false);
  const [modelStatus, setModelStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const wsRef = useRef<WebSocket | null>(null);
  const pendingRpc = useRef<Map<string, { resolve: (p: any) => void; reject: (e: Error) => void }>>(new Map());

  const isLive = status === 'connected';

  /* ─── Gateway WS for file/model operations ─────────────── */

  const sendRpc = useCallback((method: string, params: any): Promise<any> => {
    return new Promise((resolve, reject) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) { reject(new Error('Not connected')); return; }
      const id = nextRpcId();
      pendingRpc.current.set(id, { resolve, reject });
      ws.send(JSON.stringify({ type: 'req', id, method, params }));
      setTimeout(() => {
        const p = pendingRpc.current.get(id);
        if (p) { pendingRpc.current.delete(id); reject(new Error('RPC timeout')); }
      }, 15000);
    });
  }, []);

  useEffect(() => {
    let ws: WebSocket;
    let reconnectTimer: ReturnType<typeof setTimeout>;
    let alive = true;

    async function connect() {
      if (!alive) return;
      const cfg = await getGatewayConfig();
      ws = new WebSocket(cfg.gatewayUrl);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'res') {
            const p = pendingRpc.current.get(data.id);
            if (p) {
              pendingRpc.current.delete(data.id);
              if (data.ok === false) { p.reject(new Error(data.error?.message || 'RPC error')); }
              else { p.resolve(data.payload); }
              return;
            }
            if (data.payload?.type === 'hello-ok') { setWsConnected(true); return; }
            return;
          }
          if (data.type === 'event' && data.event === 'connect.challenge') {
            const nonce = data.payload?.nonce;
            if (!nonce) return;
            (async () => {
              const cfg = await getGatewayConfig();
              const device = await getOrCreateDeviceIdentity(nonce, {
                clientId: 'openclaw-control-ui', clientMode: 'webchat',
                platform: 'web', role: 'operator',
                scopes: ['operator.read', 'operator.write'], token: cfg.authToken,
              });
              ws.send(JSON.stringify({
                type: 'req', id: nextRpcId(), method: 'connect',
                params: {
                  minProtocol: 3, maxProtocol: 3,
                  client: { id: 'openclaw-control-ui', version: '1.0.0', platform: 'web', mode: 'webchat' },
                  device, role: 'operator', scopes: ['operator.read', 'operator.write'],
                  caps: ['events'], commands: [], permissions: {},
                  auth: { token: cfg.authToken }, locale: 'en-US', userAgent: 'nova-dashboard/1.0.0',
                },
              }));
            })();
          }
        } catch {}
      };

      ws.onclose = () => {
        setWsConnected(false);
        wsRef.current = null;
        if (alive) reconnectTimer = setTimeout(connect, 3000);
      };
    }

    connect();
    return () => { alive = false; ws?.close(); clearTimeout(reconnectTimer); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load available models when WS connects
  useEffect(() => {
    if (!wsConnected) return;
    (async () => {
      try {
        const result = await sendRpc('models.list', {});
        const models = result?.models || [];
        setAvailableModels(models.map((m: any) => ({
          id: typeof m === 'string' ? m : m.id,
          name: m.name || m.id,
          contextWindow: m.contextWindow,
          inputTypes: m.inputTypes,
        })));
      } catch (err) {
        console.error('[Hub] Failed to load models:', err);
      }
      // Load current agent config
      try {
        const result = await sendRpc('agents.list', {});
        const agents = result?.agents || result || [];
        const mainAgent = Array.isArray(agents)
          ? agents.find((a: any) => a.id === 'main' || a.isDefault)
          : null;
        if (mainAgent?.model) {
          setCurrentModel(mainAgent.model);
          setSelectedModel(mainAgent.model);
        }
      } catch (err) {
        console.error('[Hub] Failed to load agent config:', err);
      }
    })();
  }, [wsConnected, sendRpc]);

  // Fetch live status
  useEffect(() => {
    const fetchStatus = async () => {
      setStatusLoading(true);
      try {
        const endpoint = API ? `${API}/api/status` : '/api/status';
        const r = await fetch(endpoint);
        if (r.ok) setLiveStatus(await r.json());
      } catch {}
      setStatusLoading(false);
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 60000);
    return () => clearInterval(interval);
  }, []);

  const selectItem = async (item: SelectedItem) => {
    setSelected(item);
    setEditing(false);
    setSaveStatus('idle');
    setAgentFiles({});
    setFileContent('');

    if (!wsConnected) return;

    try {
      setFilesLoading(true);
      // All agents currently map to 'main' since that's the only real OpenClaw agent
      const agentId = 'main';
      const listResult = await sendRpc('agents.files.list', { agentId });
      const fileNames: string[] = (listResult?.files || []).map((f: any) => typeof f === 'string' ? f : f.name).filter(Boolean);

      const files: Record<string, string> = {};
      // Load files in parallel (max 5 at a time)
      const mdFileNames = fileNames.filter(n => n.endsWith('.md'));
      for (let i = 0; i < mdFileNames.length; i += 5) {
        const batch = mdFileNames.slice(i, i + 5);
        const results = await Promise.allSettled(
          batch.map(name => sendRpc('agents.files.get', { agentId, name }))
        );
        results.forEach((r, j) => {
          if (r.status === 'fulfilled' && r.value?.content != null) {
            files[batch[j]] = typeof r.value.content === 'string' ? r.value.content : JSON.stringify(r.value.content);
          }
        });
      }

      setAgentFiles(files);
      const firstFile = Object.keys(files)[0];
      if (firstFile) { setFileContent(files[firstFile]); setActiveFile(firstFile); }
      else { setFileContent(''); setActiveFile('SOUL.md'); }
    } catch (err) {
      console.error('[Hub] File load failed:', err);
    } finally {
      setFilesLoading(false);
    }
  };

  const saveFile = async () => {
    if (!selected) return;
    setSaving(true);
    setSaveStatus('idle');
    try {
      await sendRpc('agents.files.set', { agentId: 'main', name: activeFile, content: editBuffer });
      setFileContent(editBuffer);
      agentFiles[activeFile] = editBuffer;
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
      // Use config.get to get current config, then config.set to update model
      const configResult = await sendRpc('config.get', {});
      if (configResult?.raw) {
        const cfg = typeof configResult.raw === 'string' ? JSON.parse(configResult.raw) : configResult.raw;
        // Update the model
        if (!cfg.agents) cfg.agents = {};
        if (!cfg.agents.defaults) cfg.agents.defaults = {};
        if (!cfg.agents.defaults.model) cfg.agents.defaults.model = {};
        cfg.agents.defaults.model.primary = selectedModel;
        
        await sendRpc('config.set', { raw: JSON.stringify(cfg, null, 2), baseHash: configResult.hash });
        await sendRpc('config.apply', {});
        setCurrentModel(selectedModel);
        setModelStatus('success');
        setTimeout(() => setModelStatus('idle'), 3000);
      }
    } catch (err) {
      console.error('Model change failed:', err);
      setModelStatus('error');
      setTimeout(() => setModelStatus('idle'), 5000);
    }
    setModelSaving(false);
  };

  const StatusBadge = ({ status: s }: { status: string }) => {
    const cfg = statusCfg[s] || statusCfg.idle;
    return (
      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium ring-1 ${cfg.cls}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`}></span>{cfg.label}
      </span>
    );
  };

  if (!eco) return (
    <div className="p-6 flex flex-col items-center justify-center min-h-[400px]">
      <p className="text-slate-500 animate-pulse">Waiting for live data feed...</p>
    </div>
  );

  const fileIcons: Record<string, string> = {
    'SOUL.md': '🧬', 'GOAL.md': '🎯', 'MEMORY.md': '🧠', 'IDENTITY.md': '🪪',
    'USER.md': '👤', 'TOOLS.md': '🔧', 'AGENTS.md': '📋', 'HEARTBEAT.md': '💓',
  };
  const mdFiles = Object.keys(agentFiles).filter(f => f.endsWith('.md'));

  const getAgentTaskCount = (agentName: string) => {
    if (!eco.kanban?.columns) return { active: 0, total: 0 };
    let active = 0, total = 0;
    for (const col of eco.kanban.columns) {
      for (const task of col.tasks) {
        if (task.assignee?.toLowerCase() === agentName.toLowerCase()) {
          total++;
          if (col.id === 'in-progress' || col.id === 'review') active++;
        }
      }
    }
    return { active, total };
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Agent Hub</h1>
          <p className="text-slate-400 mt-1 text-sm">Organizational hierarchy &bull; Projects, Departments, Agents</p>
        </div>
        <div className="flex items-center gap-3">
          {/* WS Status */}
          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium ring-1 ${
            wsConnected ? 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20' : 'bg-amber-500/10 text-amber-400 ring-amber-500/20'
          }`}>
            <span className={`h-1.5 w-1.5 rounded-full ${wsConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
            {wsConnected ? 'LIVE' : 'CONNECTING'}
          </span>
        </div>
      </div>

      {/* Live Status Banner */}
      {liveStatus && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Gateway</p>
            <p className={`text-sm font-semibold ${liveStatus.gateway.reachable ? 'text-emerald-400' : 'text-red-400'}`}>
              {liveStatus.gateway.reachable ? 'Online' : 'Offline'}
            </p>
            {liveStatus.gateway.latencyMs !== null && (
              <p className="text-[10px] text-slate-600">{liveStatus.gateway.latencyMs}ms latency</p>
            )}
          </div>
          {liveStatus.ecosystem && (
            <>
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Agents</p>
                <p className="text-sm font-semibold text-white">{liveStatus.ecosystem.runningAgents} / {liveStatus.ecosystem.totalAgents}</p>
                <p className="text-[10px] text-emerald-400">{liveStatus.ecosystem.runningAgents} active</p>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Orchestrator</p>
                <p className={`text-sm font-semibold ${liveStatus.ecosystem.orchestratorStatus === 'running' ? 'text-emerald-400' : 'text-slate-400'}`}>
                  {liveStatus.ecosystem.orchestratorStatus === 'running' ? 'Online' : 'Standby'}
                </p>
              </div>
            </>
          )}
          {liveStatus.kanban && (
            <>
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Active Tasks</p>
                <p className="text-sm font-semibold text-white">{liveStatus.kanban.inProgress + liveStatus.kanban.review}</p>
                <p className="text-[10px] text-slate-600">{liveStatus.kanban.inProgress} in progress · {liveStatus.kanban.review} review</p>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Completion</p>
                <p className="text-sm font-semibold text-white">
                  {liveStatus.kanban.total > 0 ? Math.round((liveStatus.kanban.done / liveStatus.kanban.total) * 100) : 0}%
                </p>
                <p className="text-[10px] text-slate-600">{liveStatus.kanban.done} / {liveStatus.kanban.total} done</p>
              </div>
            </>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel */}
        <div className="lg:col-span-1 space-y-5 overflow-y-auto max-h-[calc(100vh-14rem)]">
          {/* Orchestrator */}
          <div>
            <p className="text-[10px] text-slate-600 uppercase tracking-widest font-medium mb-2">Orchestrator</p>
            <button
              onClick={() => selectItem({ type: 'orchestrator', id: 'nova', name: 'Nova' })}
              className={`w-full text-left bg-slate-900 border rounded-xl p-4 transition-all ${
                selected?.id === 'nova' ? 'border-blue-500/50 ring-1 ring-blue-500/20' : 'border-slate-800 hover:border-slate-700'
              }`}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs">N</div>
                  <span className="font-medium text-white text-sm">Nova</span>
                </div>
                <StatusBadge status={eco.orchestrator.status} />
              </div>
              <p className="text-xs text-slate-500 ml-9">{eco.orchestrator.description}</p>
              {currentModel && <p className="text-[10px] text-blue-400 ml-9 mt-1 font-mono">{currentModel}</p>}
            </button>
          </div>

          {/* Projects */}
          <div>
            <p className="text-[10px] text-slate-600 uppercase tracking-widest font-medium mb-2">Projects</p>
            {eco.projects.length === 0 ? (
              <div className="bg-slate-900/50 border border-dashed border-slate-800 rounded-xl p-4 text-center">
                <p className="text-xs text-slate-600">No active projects</p>
              </div>
            ) : eco.projects.map((proj: Project) => (
              <button key={proj.id}
                onClick={() => selectItem({ type: 'project', id: proj.id, name: proj.name })}
                className={`w-full text-left bg-slate-900 border rounded-xl p-4 mb-2 transition-all ${
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
            {eco.departments.map((dept: Department) => {
              const taskLoad = getAgentTaskCount(dept.name);
              return (
                <div key={dept.id} className="mb-3">
                  <button
                    onClick={() => selectItem({ type: 'department', id: dept.id, name: dept.name, filesPath: `departments/${dept.id}` })}
                    className={`w-full text-left bg-slate-900 border rounded-xl p-4 transition-all ${
                      selected?.id === dept.id ? 'border-blue-500/50 ring-1 ring-blue-500/20' : 'border-slate-800 hover:border-slate-700'
                    }`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-white text-sm">{dept.name}</span>
                      {dept.project && <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded ring-1 ring-amber-500/20">🔒 {dept.project}</span>}
                    </div>
                    <p className="text-xs text-slate-500 mb-2">{dept.description}</p>
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-slate-600">{1 + dept.agents.length} agent{dept.agents.length !== 0 ? 's' : ''}</div>
                      {taskLoad.total > 0 && (
                        <span className="text-[10px] text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded ring-1 ring-blue-500/20">
                          {taskLoad.active} active / {taskLoad.total} tasks
                        </span>
                      )}
                    </div>
                  </button>
                  <div className="ml-4 mt-1 space-y-1">
                    <button
                      onClick={() => selectItem({ type: 'agent', id: dept.lead.id, name: `${dept.lead.name} (Lead)`, filesPath: dept.lead.filesPath || `departments/${dept.id}` })}
                      className={`w-full text-left bg-slate-800/40 border rounded-lg p-3 transition-all ${
                        selected?.id === dept.lead.id ? 'border-blue-500/50 ring-1 ring-blue-500/20' : 'border-slate-800 hover:border-slate-700'
                      }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-amber-400">👑</span>
                          <span className="text-xs font-medium text-slate-300">{dept.lead.name}</span>
                          <span className="text-[10px] text-slate-600">Lead</span>
                        </div>
                        <StatusBadge status={dept.lead.status} />
                      </div>
                    </button>
                    {dept.agents.map((agent: AgentNode) => (
                      <button key={agent.id}
                        onClick={() => selectItem({ type: 'agent', id: agent.id, name: agent.name, filesPath: agent.filesPath || `departments/${dept.id}/${agent.id}` })}
                        className={`w-full text-left bg-slate-800/30 border rounded-lg p-3 transition-all ${
                          selected?.id === agent.id ? 'border-blue-500/50 ring-1 ring-blue-500/20' : 'border-slate-800 hover:border-slate-700'
                        }`}>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-300">{agent.name}</span>
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

        {/* Right Panel */}
        <div className="lg:col-span-2">
          {selected ? (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <span className="text-xs text-slate-600 uppercase">{selected.type}</span>
                  <h2 className="text-xl font-bold text-white">{selected.name}</h2>
                </div>
                {!wsConnected && (
                  <span className="text-xs text-amber-400 bg-amber-500/10 px-2 py-1 rounded ring-1 ring-amber-500/20">
                    ⏳ Connecting to gateway...
                  </span>
                )}
              </div>

              {/* Model Selector — show for orchestrator */}
              {selected.type === 'orchestrator' && (
                <div className="mb-6">
                  <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">🧠 LLM Model Configuration</h3>
                  <div className="bg-slate-800/30 rounded-lg p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1.5">Active Model</label>
                        <select
                          value={selectedModel}
                          onChange={e => setSelectedModel(e.target.value)}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                        >
                          {availableModels.length > 0 ? (
                            availableModels.map(m => (
                              <option key={m.id} value={m.id}>
                                {m.id}{m.id === currentModel ? ' ✓ (current)' : ''}
                              </option>
                            ))
                          ) : (
                            <option value={currentModel}>{currentModel || 'Loading...'}</option>
                          )}
                        </select>
                      </div>
                      <div className="pt-4">
                        <button
                          onClick={saveModel}
                          disabled={modelSaving || selectedModel === currentModel}
                          className={`px-4 py-2 rounded-lg text-xs font-medium transition-all ${
                            selectedModel !== currentModel
                              ? 'bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20 hover:bg-blue-500/20'
                              : 'bg-slate-800 text-slate-600 cursor-not-allowed'
                          }`}
                        >
                          {modelSaving ? '⏳ Applying...' : '🔄 Switch Model'}
                        </button>
                      </div>
                    </div>
                    {modelStatus === 'success' && <p className="text-[10px] text-emerald-400 mt-2">✅ Model changed! Takes effect on next message.</p>}
                    {modelStatus === 'error' && <p className="text-[10px] text-red-400 mt-2">❌ Failed to change model. May need admin scope.</p>}
                    {currentModel && (
                      <div className="mt-3 flex items-center gap-4 text-[10px] text-slate-500">
                        <span>Current: <span className="text-blue-400 font-mono">{currentModel}</span></span>
                        {availableModels.length > 0 && <span>{availableModels.length} models available</span>}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Live Status Panel for Orchestrator */}
              {selected.type === 'orchestrator' && (
                <div className="mb-6 space-y-3">
                  <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider">System Status</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-800/30 rounded-lg p-4">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Role</p>
                      <p className="text-sm font-medium text-white">CEO's Orchestrator AI</p>
                    </div>
                    <div className="bg-slate-800/30 rounded-lg p-4">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Status</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`h-2 w-2 rounded-full ${eco.orchestrator.status === 'running' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`}></span>
                        <p className={`text-sm font-medium ${eco.orchestrator.status === 'running' ? 'text-emerald-400' : 'text-slate-400'}`}>
                          {eco.orchestrator.status === 'running' ? 'Online & Active' : 'Standby'}
                        </p>
                      </div>
                    </div>
                    <div className="bg-slate-800/30 rounded-lg p-4">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Gateway</p>
                      {liveStatus?.gateway ? (
                        <p className={`text-sm font-medium ${liveStatus.gateway.reachable ? 'text-emerald-400' : 'text-red-400'}`}>
                          {liveStatus.gateway.reachable ? `Connected (${liveStatus.gateway.latencyMs}ms)` : 'Unreachable'}
                        </p>
                      ) : <p className="text-sm text-slate-500 animate-pulse">Checking...</p>}
                    </div>
                    <div className="bg-slate-800/30 rounded-lg p-4">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Channels</p>
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        <span className="text-[10px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded ring-1 ring-blue-500/20">Telegram</span>
                        <span className="text-[10px] bg-purple-500/10 text-purple-400 px-1.5 py-0.5 rounded ring-1 ring-purple-500/20">Web Chat</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Department task details */}
              {selected.type === 'department' && eco.kanban?.columns && (() => {
                const deptTasks: any[] = [];
                for (const col of eco.kanban.columns) {
                  for (const task of col.tasks) {
                    if (task.assignee?.toLowerCase() === selected.name.toLowerCase()) {
                      deptTasks.push({ ...task, column: col.title, columnId: col.id });
                    }
                  }
                }
                if (deptTasks.length === 0) return null;
                return (
                  <div className="mb-6">
                    <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">Assigned Tasks ({deptTasks.length})</h3>
                    <div className="space-y-2">
                      {deptTasks.map((task: any) => (
                        <div key={task.id} className="bg-slate-800/30 rounded-lg px-4 py-3 flex items-center justify-between">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-white font-medium truncate">{task.title}</p>
                            <p className="text-[10px] text-slate-500 mt-0.5">{task.description}</p>
                          </div>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ring-1 ml-3 shrink-0 ${
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

              {/* Loading indicator */}
              {filesLoading && (
                <div className="mb-4 flex items-center gap-2 text-sm text-slate-500 animate-pulse">
                  <span>⏳</span> Loading workspace files...
                </div>
              )}

              {/* File tabs */}
              {mdFiles.length > 0 && (
                <>
                  <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">📁 Workspace Files</h3>
                  <div className="flex gap-1 mb-4 bg-slate-800/30 rounded-lg p-1 flex-wrap">
                    {mdFiles.map(file => (
                      <button key={file}
                        onClick={() => { setActiveFile(file); setFileContent(agentFiles[file] || ''); setEditing(false); }}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-all ${
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
                          className="px-3 py-1.5 bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20 rounded-lg text-xs font-medium hover:bg-blue-500/20 transition-colors">
                          ✏️ Edit
                        </button>
                      </div>
                      <div className="bg-slate-800/30 rounded-lg p-4 max-h-[500px] overflow-y-auto">
                        <pre className="text-sm text-slate-300 whitespace-pre-wrap font-mono leading-relaxed">{fileContent || 'No content'}</pre>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs text-slate-500 font-mono">Editing: {activeFile}</span>
                        <div className="flex gap-2 items-center">
                          {saveStatus === 'success' && <span className="text-[10px] text-emerald-400">✅ Saved!</span>}
                          {saveStatus === 'error' && <span className="text-[10px] text-red-400">❌ Save failed</span>}
                          <button onClick={() => setEditing(false)} className="px-3 py-1.5 bg-slate-800 text-slate-400 rounded-lg text-xs font-medium hover:bg-slate-700">Cancel</button>
                          <button onClick={saveFile} disabled={saving}
                            className="px-3 py-1.5 bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20 rounded-lg text-xs font-medium hover:bg-emerald-500/20 disabled:opacity-50">
                            {saving ? 'Saving...' : '💾 Save'}
                          </button>
                        </div>
                      </div>
                      <textarea value={editBuffer} onChange={e => setEditBuffer(e.target.value)}
                        className="w-full h-96 bg-slate-800/50 border border-slate-700 rounded-lg p-4 text-sm text-slate-300 font-mono leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-blue-500/50" />
                    </div>
                  )}
                </>
              )}

              {/* No files state */}
              {!filesLoading && mdFiles.length === 0 && (
                <div className="bg-slate-800/30 rounded-lg p-8 text-center">
                  <p className="text-slate-500">
                    {!wsConnected ? 'Connecting to gateway to load files...' :
                     'No workspace files found for this agent.'}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 flex flex-col items-center justify-center text-center h-full min-h-[400px]">
              <span className="text-4xl mb-4">🏗️</span>
              <h3 className="text-lg font-medium text-white mb-2">Organizational Hierarchy</h3>
              <p className="text-sm text-slate-500 max-w-sm">Select Nova, a project, department, or agent to inspect and edit their configuration.</p>
              <div className="mt-6 text-xs text-slate-600 space-y-1 text-left">
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
