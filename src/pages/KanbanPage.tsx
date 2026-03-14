import React, { useState } from 'react';
import { useGateway } from '../context/GatewayContext';
import CronDashboard from '../components/CronDashboard';

interface Task {
  id: string;
  title: string;
  description: string;
  assignee: string;
  priority: 'high' | 'medium' | 'low';
  tags: string[];
  project?: string;
  progress?: number;
  createdAt?: string;
  steps?: { label: string; done: boolean }[];
}

interface CronJob {
  id: string;
  name: string;
  schedule: string;
  lastRun?: string;
  nextRun?: string;
  status: 'active' | 'paused';
  target: string;
}

interface Column {
  id: string;
  title: string;
  icon: string;
  color: string;
  tasks: Task[];
}

const fallbackColumns: Column[] = [
  { id: 'backlog', title: 'Backlog', icon: '📥', color: 'border-slate-600', tasks: [] },
  { id: 'in-progress', title: 'In Progress', icon: '🔄', color: 'border-blue-500', tasks: [] },
  { id: 'review', title: 'Review', icon: '👀', color: 'border-amber-500', tasks: [] },
  { id: 'done', title: 'Done', icon: '✅', color: 'border-emerald-500', tasks: [] },
];

const priorityConfig: Record<string, { color: string; label: string }> = {
  high: { color: 'bg-red-500/10 text-red-400 ring-red-500/20', label: 'High' },
  medium: { color: 'bg-amber-500/10 text-amber-400 ring-amber-500/20', label: 'Med' },
  low: { color: 'bg-slate-500/10 text-slate-400 ring-slate-500/20', label: 'Low' },
};

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  if (isNaN(then)) return dateStr;
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function computeProgress(task: Task): number {
  if (task.steps && task.steps.length > 0) {
    return Math.round((task.steps.filter(s => s.done).length / task.steps.length) * 100);
  }
  return task.progress ?? 0;
}

/** SLA thresholds per column (in days) */
const STALE_THRESHOLDS: Record<string, number> = {
  'backlog': 7,
  'in-progress': 3,
  'review': 1,
};

function isStale(task: Task, columnId: string): boolean {
  if (columnId === 'done') return false;
  const threshold = STALE_THRESHOLDS[columnId];
  if (!threshold || !task.createdAt) return false;
  const ageMs = Date.now() - new Date(task.createdAt).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  return ageDays >= threshold;
}

function staleDays(task: Task): number {
  if (!task.createdAt) return 0;
  return Math.floor((Date.now() - new Date(task.createdAt).getTime()) / (1000 * 60 * 60 * 24));
}

const KanbanPage: React.FC = () => {
  const { eco, status } = useGateway();
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [showCron, setShowCron] = useState(true);
  const [kanbanData, setKanbanData] = useState<{ columns: Column[]; cronJobs: CronJob[] } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState<string | null>(null); // column id
  const [newTask, setNewTask] = useState({ title: '', description: '', assignee: 'Nova', priority: 'medium' as Task['priority'], tags: '', project: '' });

  React.useEffect(() => {
    if (eco?.kanban) {
      setKanbanData(eco.kanban);
    } else {
      fetch('/kanban.json')
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data) setKanbanData(data); })
        .catch(() => {});
    }
  }, [eco]);

  const persistKanban = async (data: { columns: Column[]; cronJobs: CronJob[] }) => {
    try {
      await fetch('/api/file', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: 'kanban.json', content: JSON.stringify(data, null, 2) })
      });
    } catch (err) {
      console.error('[Kanban] Failed to persist:', err);
    }
  };

  const handleDelete = (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (deletingId === taskId) {
      // Second click = confirm delete — update state + persist
      setKanbanData(prev => {
        if (!prev) return prev;
        const updated = {
          ...prev,
          columns: prev.columns.map(col => ({
            ...col,
            tasks: col.tasks.filter(t => t.id !== taskId)
          }))
        };
        persistKanban(updated);
        return updated;
      });
      setDeletingId(null);
      setExpandedTask(null);
    } else {
      setDeletingId(taskId);
      // Auto-cancel after 3s
      setTimeout(() => setDeletingId(prev => prev === taskId ? null : prev), 3000);
    }
  };

  const handleAddTask = (columnId: string) => {
    if (!newTask.title.trim()) return;
    const task: Task = {
      id: `t-${Date.now()}`,
      title: newTask.title.trim(),
      description: newTask.description.trim(),
      assignee: newTask.assignee || 'Nova',
      priority: newTask.priority,
      tags: newTask.tags.split(',').map(t => t.trim()).filter(Boolean),
      project: newTask.project || undefined,
      createdAt: new Date().toISOString(),
    };
    setKanbanData(prev => {
      if (!prev) return prev;
      const updated = {
        ...prev,
        columns: prev.columns.map(col =>
          col.id === columnId ? { ...col, tasks: [...col.tasks, task] } : col
        )
      };
      persistKanban(updated);
      return updated;
    });
    setNewTask({ title: '', description: '', assignee: 'Nova', priority: 'medium', tags: '', project: '' });
    setShowAddForm(null);
  };

  const handleMoveTask = (taskId: string, fromColId: string, toColId: string) => {
    setKanbanData(prev => {
      if (!prev) return prev;
      let movedTask: Task | undefined;
      const updated = {
        ...prev,
        columns: prev.columns.map(col => {
          if (col.id === fromColId) {
            movedTask = col.tasks.find(t => t.id === taskId);
            return { ...col, tasks: col.tasks.filter(t => t.id !== taskId) };
          }
          if (col.id === toColId && movedTask) {
            return { ...col, tasks: [...col.tasks, movedTask] };
          }
          return col;
        })
      };
      persistKanban(updated);
      return updated;
    });
  };

  const columns = kanbanData?.columns || fallbackColumns;
  const cronJobs = kanbanData?.cronJobs || [];
  const isLive = status === 'connected' || !!kanbanData;

  const totalTasks = columns.reduce((sum: number, col: Column) => sum + col.tasks.length, 0);
  const projects = [...new Set(columns.flatMap((c: Column) => c.tasks.map((t: Task) => t.project).filter(Boolean)))];

  return (
    <div className="p-6 flex flex-col h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Kanban Board</h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-slate-400 text-sm">{totalTasks} tasks &bull; {projects.length} projects</p>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ring-1 ${
              isLive ? 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20' : 'bg-amber-500/10 text-amber-400 ring-amber-500/20'
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${isLive ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
              {isLive ? 'LIVE' : 'SYNCING'}
            </span>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {projects.map((p: any) => (
            <span key={p} className="px-2.5 py-1 bg-slate-800 rounded-full text-[10px] text-slate-400 font-medium">{p}</span>
          ))}
        </div>
      </div>

      {/* Cron Jobs Section — Live from Gateway */}
      <div className="mb-4 shrink-0">
        <button onClick={() => setShowCron(!showCron)} className="flex items-center gap-2 text-sm font-semibold text-white mb-2">
          <span>{showCron ? '▼' : '▸'}</span>
          <span>⏱️ Scheduled Jobs</span>
        </button>
        {showCron && <CronDashboard />}
      </div>

      {/* Board */}
      <div className="flex-1 flex gap-4 overflow-x-auto pb-4">
        {columns.map((column: Column) => (
          <div key={column.id} className="w-72 shrink-0 flex flex-col">
            {/* Column Header */}
            <div className={`flex items-center justify-between px-4 py-3 bg-slate-900 border border-slate-800 rounded-t-xl border-t-2 ${column.color}`}>
              <div className="flex items-center gap-2">
                <span className="text-sm">{column.icon}</span>
                <h3 className="text-sm font-semibold text-white">{column.title}</h3>
                <span className="bg-slate-800 text-slate-400 text-xs font-medium px-2 py-0.5 rounded-full">{column.tasks.length}</span>
                {column.tasks.filter(t => isStale(t, column.id)).length > 0 && (
                  <span className="bg-amber-500/10 text-amber-400 text-[10px] font-medium px-1.5 py-0.5 rounded-full ring-1 ring-amber-500/20">
                    ⚠️ {column.tasks.filter(t => isStale(t, column.id)).length} stale
                  </span>
                )}
              </div>
              <button
                onClick={() => setShowAddForm(showAddForm === column.id ? null : column.id)}
                className="h-6 w-6 flex items-center justify-center rounded-md text-slate-500 hover:text-white hover:bg-slate-700 transition-colors text-sm"
              >+</button>
            </div>

            {/* Column Body */}
            <div className="flex-1 bg-slate-900/50 border border-t-0 border-slate-800 rounded-b-xl p-3 space-y-3 overflow-y-auto">
              {/* Add Task Form */}
              {showAddForm === column.id && (
                <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-3 space-y-2">
                  <input value={newTask.title} onChange={e => setNewTask(p => ({ ...p, title: e.target.value }))}
                    placeholder="Task title..." className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50" autoFocus />
                  <input value={newTask.description} onChange={e => setNewTask(p => ({ ...p, description: e.target.value }))}
                    placeholder="Description..." className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50" />
                  <div className="flex gap-2">
                    <select value={newTask.priority} onChange={e => setNewTask(p => ({ ...p, priority: e.target.value as Task['priority'] }))}
                      className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-300 focus:outline-none">
                      <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
                    </select>
                    <input value={newTask.assignee} onChange={e => setNewTask(p => ({ ...p, assignee: e.target.value }))}
                      placeholder="Assignee" className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white placeholder-slate-600 focus:outline-none" />
                  </div>
                  <div className="flex gap-2">
                    <input value={newTask.tags} onChange={e => setNewTask(p => ({ ...p, tags: e.target.value }))}
                      placeholder="Tags (comma sep)" className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white placeholder-slate-600 focus:outline-none" />
                    <input value={newTask.project} onChange={e => setNewTask(p => ({ ...p, project: e.target.value }))}
                      placeholder="Project" className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white placeholder-slate-600 focus:outline-none" />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setShowAddForm(null)} className="px-3 py-1 text-[10px] text-slate-400 bg-slate-800 rounded hover:bg-slate-700">Cancel</button>
                    <button onClick={() => handleAddTask(column.id)} className="px-3 py-1 text-[10px] text-white bg-blue-600 rounded hover:bg-blue-500">Add Task</button>
                  </div>
                </div>
              )}
              {column.tasks.length === 0 && showAddForm !== column.id && (
                <div className="py-8 text-center bg-slate-800/20 rounded-lg border border-dashed border-slate-800">
                  <p className="text-[10px] text-slate-600 uppercase tracking-widest">Empty</p>
                </div>
              )}
              {column.tasks.map((task: Task) => {
                const isExpanded = expandedTask === task.id;
                const liveProgress = computeProgress(task);
                const isConfirmingDelete = deletingId === task.id;
                const stale = isStale(task, column.id);
                const age = staleDays(task);

                return (
                  <div
                    key={task.id}
                    className={`bg-slate-900 border rounded-lg p-4 transition-all duration-200 cursor-pointer group ${
                      isConfirmingDelete ? 'border-red-500/50 bg-red-950/20' :
                      stale ? 'border-amber-500/40 bg-amber-950/10' :
                      'border-slate-800 hover:border-slate-700'
                    }`}
                    onClick={() => setExpandedTask(isExpanded ? null : task.id)}
                  >
                    {/* Stale Warning Banner */}
                    {stale && (
                      <div className="flex items-center gap-1.5 mb-2 px-2 py-1 bg-amber-500/10 border border-amber-500/20 rounded text-[10px] text-amber-400">
                        <span>⚠️</span>
                        <span className="font-medium">Stale — {age}d in {column.title}</span>
                        <span className="text-amber-500/60 ml-auto">SLA: {STALE_THRESHOLDS[column.id]}d</span>
                      </div>
                    )}

                    {/* Priority + Tags */}
                    <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                      <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ring-1 ${priorityConfig[task.priority]?.color || priorityConfig.low.color}`}>
                        {priorityConfig[task.priority]?.label || 'Low'}
                      </span>
                      {stale && (
                        <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ring-1 bg-amber-500/10 text-amber-400 ring-amber-500/20">
                          ⚠️ Stale
                        </span>
                      )}
                      {task.tags.map((tag: string) => (
                        <span key={tag} className="text-[10px] text-slate-600 bg-slate-800/50 px-1.5 py-0.5 rounded">{tag}</span>
                      ))}
                    </div>

                    {/* Project Badge */}
                    {task.project && (
                      <p className="text-[10px] text-purple-400 bg-purple-500/10 rounded px-1.5 py-0.5 inline-block mb-2">{task.project}</p>
                    )}

                    {/* Title */}
                    <h4 className="text-sm font-medium text-white mb-1 group-hover:text-blue-400 transition-colors">{task.title}</h4>
                    <p className="text-xs text-slate-500 leading-relaxed">{task.description}</p>

                    {/* Created date */}
                    {task.createdAt && (
                      <p className="text-[10px] text-slate-600 mt-2">
                        📅 Created {timeAgo(task.createdAt)} <span className="text-slate-700">({new Date(task.createdAt).toLocaleDateString()})</span>
                      </p>
                    )}

                    {/* Dynamic Progress Bar — auto-computed from steps */}
                    {(task.steps || task.progress !== undefined) && (
                      <div className="mt-3">
                        <div className="flex justify-between text-[10px] mb-1">
                          <span className="text-slate-500">
                            {task.steps ? `${task.steps.filter(s => s.done).length}/${task.steps.length} steps` : 'Progress'}
                          </span>
                          <span className={`font-mono ${liveProgress === 100 ? 'text-emerald-400' : liveProgress > 50 ? 'text-blue-400' : 'text-amber-400'}`}>
                            {liveProgress}%
                          </span>
                        </div>
                        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-700 ease-out ${
                              liveProgress === 100 ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' :
                              liveProgress > 50 ? 'bg-gradient-to-r from-blue-600 to-blue-400' :
                              'bg-gradient-to-r from-amber-600 to-amber-400'
                            }`}
                            style={{ width: `${liveProgress}%` }}
                          ></div>
                        </div>
                      </div>
                    )}

                    {/* Expanded: Steps */}
                    {isExpanded && task.steps && (
                      <div className="mt-3 pt-3 border-t border-slate-800 space-y-1.5">
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Steps</p>
                        {task.steps.map((step: { label: string; done: boolean }, i: number) => (
                          <div key={i} className="flex items-center gap-2">
                            <span className={`text-xs ${step.done ? 'text-emerald-400' : 'text-slate-600'}`}>
                              {step.done ? '✓' : '○'}
                            </span>
                            <span className={`text-xs ${step.done ? 'text-slate-400 line-through' : 'text-slate-300'}`}>{step.label}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Assignee + Actions */}
                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-5 w-5 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-[8px] text-white font-bold">
                          {task.assignee[0]}
                        </div>
                        <span className="text-xs text-slate-500">{task.assignee}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {/* Move buttons */}
                        {isExpanded && (
                          <div className="flex gap-1">
                            {columns.filter(c => c.id !== column.id).map(c => (
                              <button key={c.id}
                                onClick={(e) => { e.stopPropagation(); handleMoveTask(task.id, column.id, c.id); }}
                                className="px-1.5 py-0.5 text-[10px] text-slate-400 bg-slate-800 rounded hover:bg-slate-700 hover:text-white transition-colors"
                                title={`Move to ${c.title}`}
                              >→ {c.icon}</button>
                            ))}
                          </div>
                        )}
                        {column.id === 'in-progress' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); }}
                            className="px-2 py-0.5 text-[10px] text-amber-400 bg-amber-500/10 ring-1 ring-amber-500/20 rounded hover:bg-amber-500/20 transition-colors"
                          >
                            Terminate
                          </button>
                        )}
                        <button
                          onClick={(e) => handleDelete(task.id, e)}
                          className={`px-2 py-0.5 text-[10px] rounded transition-all duration-200 ${
                            isConfirmingDelete
                              ? 'text-white bg-red-600 ring-1 ring-red-500 animate-pulse'
                              : 'text-red-400 bg-red-500/10 ring-1 ring-red-500/20 hover:bg-red-500/20 opacity-0 group-hover:opacity-100'
                          }`}
                        >
                          {isConfirmingDelete ? 'Confirm ✕' : '✕'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default KanbanPage;
