import React, { useState, useEffect } from 'react';

const API = import.meta.env.DEV ? 'http://localhost:3001' : '';
const USE_SERVERLESS = !import.meta.env.DEV; // Use /api/* on Vercel

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
interface Ecosystem {
  orchestrator: AgentNode & { role: string; description: string };
  projects: Project[];
  departments: Department[];
  individualAgents: AgentNode[];
}

const statusCfg: Record<string, { cls: string; dot: string; label: string }> = {
  running: { cls: 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20', dot: 'bg-emerald-400 animate-pulse', label: 'Running' },
  idle: { cls: 'bg-slate-500/10 text-slate-400 ring-slate-500/20', dot: 'bg-slate-500', label: 'Idle' },
  stalled: { cls: 'bg-red-500/10 text-red-400 ring-red-500/20', dot: 'bg-red-400 animate-pulse', label: 'Stalled' },
};

type SelectedItem = { type: 'orchestrator' | 'project' | 'department' | 'agent'; id: string; name: string; filesPath?: string };

const AgentHubPage: React.FC = () => {
  const [eco, setEco] = useState<Ecosystem | null>(null);
  const [selected, setSelected] = useState<SelectedItem | null>(null);
  const [activeFile, setActiveFile] = useState('SOUL.md');
  const [fileContent, setFileContent] = useState('');
  const [editing, setEditing] = useState(false);
  const [editBuffer, setEditBuffer] = useState('');
  const [saving, setSaving] = useState(false);
  const [agentFiles, setAgentFiles] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch('/ecosystem.json').then(r => r.json()).then(setEco).catch(console.error);
  }, []);

  const loadFile = async (filesPath: string, file: string) => {
    try {
      if (API) {
        const r = await fetch(`${API}/api/file?path=${filesPath}/${file}`);
        const data = await r.json();
        setFileContent(data.content || '');
      } else if (USE_SERVERLESS) {
        const r = await fetch(`/api/file?path=${filesPath}/${file}`);
        const data = await r.json();
        setFileContent(data.content || '');
      } else {
        const r = await fetch(`/${filesPath}/${file}`);
        setFileContent(await r.text());
      }
      setActiveFile(file);
      setEditing(false);
    } catch { setFileContent('File not found'); }
  };

  const selectItem = async (item: SelectedItem) => {
    setSelected(item);
    setEditing(false);
    if (item.filesPath) {
      if (API) {
        // Local dev: use API
        try {
          const r = await fetch(`${API}/api/agents`);
          const data = await r.json();
          const allAgents = [
            ...data.departments.map((d: any) => ({ ...d, filesPath: d.path })),
            ...data.individuals.map((i: any) => ({ ...i, filesPath: i.path })),
          ];
          const match = allAgents.find((a: any) => a.path === item.filesPath || `departments/${a.id}` === item.filesPath);
          if (match) {
            setAgentFiles(match.files || {});
            const firstFile = Object.keys(match.files).find(f => f.endsWith('.md'));
            if (firstFile) { setFileContent(match.files[firstFile]); setActiveFile(firstFile); }
          }
        } catch { setAgentFiles({}); }
      } else {
        // Deployed: use serverless API or static files
        const files: Record<string, string> = {};
        for (const f of ['SOUL.md', 'GOAL.md', 'MEMORY.md']) {
          try {
            const r = USE_SERVERLESS
              ? await fetch(`/api/file?path=${item.filesPath}/${f}`)
              : await fetch(`/${item.filesPath}/${f}`);
            if (r.ok) {
              const data = USE_SERVERLESS ? await r.json() : { content: await r.text() };
              files[f] = data.content;
            }
          } catch {}
        }
        setAgentFiles(files);
        const firstFile = Object.keys(files)[0];
        if (firstFile) { setFileContent(files[firstFile]); setActiveFile(firstFile); }
      }
    } else {
      setAgentFiles({});
      setFileContent('');
    }
  };

  const saveFile = async () => {
    if (!selected?.filesPath) return;
    setSaving(true);
    const endpoint = API ? `${API}/api/file` : '/api/file';
    try {
      await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: `${selected.filesPath}/${activeFile}`, content: editBuffer }),
      });
      setFileContent(editBuffer);
      agentFiles[activeFile] = editBuffer;
      setEditing(false);
    } catch (err) { console.error('Save failed:', err); }
    setSaving(false);
  };

  const StatusBadge = ({ status }: { status: string }) => {
    const s = statusCfg[status] || statusCfg.idle;
    return (
      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium ring-1 ${s.cls}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`}></span>{s.label}
      </span>
    );
  };

  if (!eco) return <div className="p-6 text-slate-500">Loading ecosystem...</div>;

  const fileIcons: Record<string, string> = { 'SOUL.md': '🧬', 'GOAL.md': '🎯', 'MEMORY.md': '🧠', 'IDENTITY.md': '🪪', 'USER.md': '👤' };
  const mdFiles = Object.keys(agentFiles).filter(f => f.endsWith('.md'));
  const skillFiles = Array.isArray(agentFiles['skills']) ? agentFiles['skills'] as unknown as string[] : [];

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-white">Agent Hub</h1>
        <p className="text-slate-400 mt-1 text-sm">Organizational hierarchy &bull; Projects, Departments, Agents</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel */}
        <div className="lg:col-span-1 space-y-5 overflow-y-auto max-h-[calc(100vh-10rem)]">

          {/* Orchestrator */}
          <div>
            <p className="text-[10px] text-slate-600 uppercase tracking-widest font-medium mb-2">Orchestrator</p>
            <button
              onClick={() => selectItem({ type: 'orchestrator', id: 'nova', name: 'Nova', filesPath: '' })}
              className={`w-full text-left bg-slate-900 border rounded-xl p-4 transition-all ${
                selected?.id === 'nova' ? 'border-blue-500/50 ring-1 ring-blue-500/20' : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs">N</div>
                  <span className="font-medium text-white text-sm">Nova</span>
                </div>
                <StatusBadge status={eco.orchestrator.status} />
              </div>
              <p className="text-xs text-slate-500 ml-9">{eco.orchestrator.description}</p>
            </button>
          </div>

          {/* Projects */}
          <div>
            <p className="text-[10px] text-slate-600 uppercase tracking-widest font-medium mb-2">Projects</p>
            {eco.projects.length === 0 ? (
              <div className="bg-slate-900/50 border border-dashed border-slate-800 rounded-xl p-4 text-center">
                <p className="text-xs text-slate-600">No active projects</p>
                <p className="text-[10px] text-slate-700 mt-1">Nova will create projects when tasks require dedicated resources</p>
              </div>
            ) : eco.projects.map(proj => (
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
            {eco.departments.map(dept => {
              const isLocked = !!dept.project;
              return (
                <div key={dept.id} className="mb-3">
                  <button
                    onClick={() => selectItem({ type: 'department', id: dept.id, name: dept.name, filesPath: `departments/${dept.id}` })}
                    className={`w-full text-left bg-slate-900 border rounded-xl p-4 transition-all ${
                      selected?.id === dept.id ? 'border-blue-500/50 ring-1 ring-blue-500/20' : 'border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-white text-sm">{dept.name}</span>
                      {isLocked && <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded ring-1 ring-amber-500/20">🔒 {dept.project}</span>}
                    </div>
                    <p className="text-xs text-slate-500 mb-2">{dept.description}</p>
                    <div className="text-xs text-slate-600">{1 + dept.agents.length} agent{dept.agents.length !== 0 ? 's' : ''} (1 lead{dept.agents.length > 0 ? ` + ${dept.agents.length} member${dept.agents.length > 1 ? 's' : ''}` : ''})</div>
                  </button>

                  {/* Lead */}
                  <div className="ml-4 mt-1 space-y-1">
                    <button
                      onClick={() => selectItem({ type: 'agent', id: dept.lead.id, name: `${dept.lead.name} (Lead)`, filesPath: dept.lead.filesPath || `departments/${dept.id}` })}
                      className={`w-full text-left bg-slate-800/40 border rounded-lg p-3 transition-all ${
                        selected?.id === dept.lead.id ? 'border-blue-500/50 ring-1 ring-blue-500/20' : 'border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-amber-400">👑</span>
                          <span className="text-xs font-medium text-slate-300">{dept.lead.name}</span>
                          <span className="text-[10px] text-slate-600">Lead</span>
                        </div>
                        <StatusBadge status={dept.lead.status} />
                      </div>
                      {dept.lead.currentTask && <p className="text-[10px] text-blue-400 mt-1 ml-5 truncate">▸ {dept.lead.currentTask}</p>}
                    </button>

                    {/* Sub-agents */}
                    {dept.agents.map(agent => (
                      <button key={agent.id}
                        onClick={() => selectItem({ type: 'agent', id: agent.id, name: agent.name, filesPath: agent.filesPath || `departments/${dept.id}/${agent.id}` })}
                        className={`w-full text-left bg-slate-800/30 border rounded-lg p-3 transition-all ${
                          selected?.id === agent.id ? 'border-blue-500/50 ring-1 ring-blue-500/20' : 'border-slate-800 hover:border-slate-700'
                        }`}>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-300">{agent.name}</span>
                          <StatusBadge status={agent.status} />
                        </div>
                        {agent.currentTask && <p className="text-[10px] text-blue-400 mt-1 truncate">▸ {agent.currentTask}</p>}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Individual Agents */}
          <div>
            <p className="text-[10px] text-slate-600 uppercase tracking-widest font-medium mb-2">Individual Agents</p>
            {eco.individualAgents.length === 0 ? (
              <div className="bg-slate-900/50 border border-dashed border-slate-800 rounded-xl p-4 text-center">
                <p className="text-xs text-slate-600">No standalone agents</p>
              </div>
            ) : eco.individualAgents.map(agent => (
              <button key={agent.id}
                onClick={() => selectItem({ type: 'agent', id: agent.id, name: agent.name, filesPath: agent.filesPath })}
                className="w-full text-left bg-slate-900 border border-slate-800 rounded-xl p-4 mb-2 hover:border-slate-700">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-white text-sm">{agent.name}</span>
                  <StatusBadge status={agent.status} />
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right Panel */}
        <div className="lg:col-span-2">
          {selected ? (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-600 uppercase">{selected.type}</span>
                  </div>
                  <h2 className="text-xl font-bold text-white">{selected.name}</h2>
                  {selected.filesPath && <p className="text-xs text-slate-500 font-mono mt-0.5">{selected.filesPath || 'workspace root'}</p>}
                </div>
              </div>

              {/* File tabs — only if has files */}
              {mdFiles.length > 0 && (
                <>
                  <div className="flex gap-1 mb-4 bg-slate-800/30 rounded-lg p-1 flex-wrap">
                    {mdFiles.map(file => (
                      <button key={file}
                        onClick={() => { setActiveFile(file); setFileContent(agentFiles[file] as string || ''); setEditing(false); }}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-all ${
                          activeFile === file ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'
                        }`}>
                        <span>{fileIcons[file] || '📄'}</span><span>{file}</span>
                      </button>
                    ))}
                    {skillFiles.length > 0 && (
                      <button
                        onClick={() => { setActiveFile('skills'); setEditing(false); }}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-all ${
                          activeFile === 'skills' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'
                        }`}>
                        <span>⚡</span><span>Skills</span>
                      </button>
                    )}
                  </div>

                  {activeFile === 'skills' ? (
                    <div className="space-y-2">
                      {skillFiles.map((s, i) => (
                        <div key={i} className="flex items-center gap-3 bg-slate-800/30 rounded-lg px-4 py-3">
                          <span className="text-amber-400">⚡</span>
                          <span className="text-sm text-slate-300 font-mono">{s}</span>
                        </div>
                      ))}
                    </div>
                  ) : !editing ? (
                    <div>
                      <div className="flex justify-end mb-2">
                        <button onClick={() => { setEditBuffer(fileContent); setEditing(true); }}
                          className="px-3 py-1.5 bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20 rounded-lg text-xs font-medium hover:bg-blue-500/20 transition-colors">
                          ✏️ View & Edit
                        </button>
                      </div>
                      <div className="bg-slate-800/30 rounded-lg p-4">
                        <pre className="text-sm text-slate-300 whitespace-pre-wrap font-mono leading-relaxed">{fileContent || 'No content'}</pre>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs text-slate-500 font-mono">Editing: {selected.filesPath}/{activeFile}</span>
                        <div className="flex gap-2">
                          <button onClick={() => setEditing(false)} className="px-3 py-1.5 bg-slate-800 text-slate-400 rounded-lg text-xs font-medium hover:bg-slate-700">Cancel</button>
                          <button onClick={saveFile} disabled={saving}
                            className="px-3 py-1.5 bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20 rounded-lg text-xs font-medium hover:bg-emerald-500/20 disabled:opacity-50">
                            {saving ? 'Saving...' : '💾 Save'}
                          </button>
                        </div>
                      </div>
                      <textarea value={editBuffer} onChange={e => setEditBuffer(e.target.value)}
                        className="w-full h-80 bg-slate-800/50 border border-slate-700 rounded-lg p-4 text-sm text-slate-300 font-mono leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-blue-500/50" />
                    </div>
                  )}
                </>
              )}

              {/* No files state */}
              {mdFiles.length === 0 && (
                <div className="bg-slate-800/30 rounded-lg p-8 text-center">
                  <p className="text-slate-500">
                    {selected.type === 'project' ? 'Project details will appear here when Nova creates a project.' :
                     selected.type === 'orchestrator' ? 'Nova orchestrator files are managed at the workspace root.' :
                     'Select a department or agent to view their files.'}
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
