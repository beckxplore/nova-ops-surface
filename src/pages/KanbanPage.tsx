import React, { useState, useEffect, useRef, useCallback } from 'react';
import CronDashboard from '../components/CronDashboard';

const NOVA_API = 'https://3-227-84-30.sslip.io/nova-api';
const AUTH_TOKEN = '7dd8ac893a339cb334fb2e5e644a22db16ceeed9baf0ab7a';
const AUTH_HEADERS = { Authorization: `Bearer ${AUTH_TOKEN}`, 'Content-Type': 'application/json' };

interface Step {
  text: string;
  done: boolean;
  // legacy field compat
  label?: string;
}

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
  startedAt?: string;
  doneAt?: string;
  steps?: Step[];
}

interface Columns {
  backlog: Task[];
  'in-progress': Task[];
  review: Task[];
  done: Task[];
  [key: string]: Task[];
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

const COLUMN_ORDER = ['backlog', 'in-progress', 'review', 'done'] as const;
type ColumnId = typeof COLUMN_ORDER[number];

const COLUMN_META: Record<ColumnId, { title: string; icon: string; color: string }> = {
  backlog: { title: 'Backlog', icon: '📥', color: 'border-slate-600' },
  'in-progress': { title: 'In Progress', icon: '🔄', color: 'border-blue-500' },
  review: { title: 'Review', icon: '👀', color: 'border-amber-500' },
  done: { title: 'Done', icon: '✅', color: 'border-emerald-500' },
};

const priorityConfig: Record<string, { color: string; label: string }> = {
  high: { color: 'bg-red-500/10 text-red-400 ring-red-500/20', label: 'High' },
  medium: { color: 'bg-amber-500/10 text-amber-400 ring-amber-500/20', label: 'Med' },
  low: { color: 'bg-slate-500/10 text-slate-400 ring-slate-500/20', label: 'Low' },
};

/** SLA thresholds per column (in days) */
const STALE_THRESHOLDS: Record<string, number> = {
  backlog: 7,
  'in-progress': 3,
  review: 1,
};

const emptyColumns = (): Columns => ({ backlog: [], 'in-progress': [], review: [], done: [] });

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  if (isNaN(then)) return dateStr;
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function computeProgress(task: Task): number {
  if (task.steps && task.steps.length > 0) {
    return Math.round((task.steps.filter(s => s.done).length / task.steps.length) * 100);
  }
  return task.progress ?? 0;
}

function isStale(task: Task, columnId: string): boolean {
  if (columnId === 'done') return false;
  const threshold = STALE_THRESHOLDS[columnId];
  if (!threshold || !task.createdAt) return false;
  const ageDays = (Date.now() - new Date(task.createdAt).getTime()) / (1000 * 60 * 60 * 24);
  return ageDays >= threshold;
}

function staleDays(task: Task): number {
  if (!task.createdAt) return 0;
  return Math.floor((Date.now() - new Date(task.createdAt).getTime()) / (1000 * 60 * 60 * 24));
}

function stepLabel(s: Step): string {
  return s.text || s.label || '';
}

// ── API helpers ────────────────────────────────────────────────────────────────

async function apiPost(path: string, body: object) {
  const r = await fetch(`${NOVA_API}${path}`, {
    method: 'POST',
    headers: AUTH_HEADERS,
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`API error: ${r.status}`);
  return r.json();
}

async function apiPut(path: string, body: object) {
  const r = await fetch(`${NOVA_API}${path}`, {
    method: 'PUT',
    headers: AUTH_HEADERS,
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`API error: ${r.status}`);
  return r.json();
}

async function apiDelete(path: string) {
  const r = await fetch(`${NOVA_API}${path}`, {
    method: 'DELETE',
    headers: AUTH_HEADERS,
  });
  if (!r.ok) throw new Error(`API error: ${r.status}`);
  return r.json();
}

async function apiGet(path: string) {
  const r = await fetch(`${NOVA_API}${path}`, { headers: AUTH_HEADERS });
  if (!r.ok) throw new Error(`API error: ${r.status}`);
  return r.json();
}

// ── Component ─────────────────────────────────────────────────────────────────

const KanbanPage: React.FC = () => {
  const [columns, setColumns] = useState<Columns>(emptyColumns());
  const [sseStatus, setSseStatus] = useState<'connecting' | 'live' | 'polling'>('connecting');
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [showCron, setShowCron] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState<string | null>(null);
  const [newTask, setNewTask] = useState({ title: '', description: '', assignee: 'Nova', priority: 'medium' as Task['priority'], tags: '', project: '' });
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);
  const [dragFromCol, setDragFromCol] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

  const sseRef = useRef<EventSource | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cronJobs = [] as CronJob[]; // CronDashboard handles its own data

  // ── Columns update helper ──────────────────────────────────────────────────
  const applyColumns = useCallback((raw: Record<string, Task[]>) => {
    setColumns(prev => {
      const next = { ...prev };
      for (const colId of COLUMN_ORDER) {
        if (raw[colId] !== undefined) next[colId] = raw[colId];
      }
      return next;
    });
  }, []);

  // ── Initial fetch ──────────────────────────────────────────────────────────
  const fetchTasks = useCallback(async () => {
    try {
      const data = await apiGet('/api/tasks');
      if (data.columns) applyColumns(data.columns);
    } catch (err) {
      console.error('[Kanban] Poll failed:', err);
    }
  }, [applyColumns]);

  // ── SSE connection ─────────────────────────────────────────────────────────
  useEffect(() => {
    let retryTimer: ReturnType<typeof setTimeout>;

    function connect() {
      if (sseRef.current) { sseRef.current.close(); sseRef.current = null; }
      setSseStatus('connecting');

      // EventSource doesn't support custom headers — we pass the token as a query param
      // The server accepts it via the Authorization header from the origin, which Caddy proxies
      // For SSE we send the token via query param and accept it on the server
      const url = `${NOVA_API}/api/tasks/stream`;
      const es = new EventSource(url, { withCredentials: false });

      // We need to send auth. EventSource doesn't support headers in browsers.
      // We'll use a fetch-based SSE approach instead.
      es.close();

      // Use fetch streaming for SSE with auth header
      fetchSSE();
    }

    async function fetchSSE() {
      try {
        const controller = new AbortController();
        sseRef.current = { close: () => controller.abort() } as any;

        const response = await fetch(`${NOVA_API}/api/tasks/stream`, {
          headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
          signal: controller.signal,
        });

        if (!response.ok || !response.body) throw new Error(`SSE response ${response.status}`);

        setSseStatus('live');
        // Clear fallback polling since SSE is live
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const evt = JSON.parse(line.slice(6));
                if (evt.columns) applyColumns(evt.columns);
              } catch {}
            }
          }
        }
        throw new Error('SSE stream ended');
      } catch (err: any) {
        if (err?.name === 'AbortError') return; // intentional close
        console.warn('[Kanban] SSE error, falling back to polling:', err.message);
        setSseStatus('polling');
        // Start polling fallback
        if (!pollRef.current) {
          fetchTasks();
          pollRef.current = setInterval(fetchTasks, 30000);
        }
        // Retry SSE after 10s
        retryTimer = setTimeout(connect, 10000);
      }
    }

    // Initial data fetch first
    fetchTasks().then(() => connect());

    return () => {
      clearTimeout(retryTimer);
      sseRef.current?.close();
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [applyColumns, fetchTasks]);

  // ── Add task ───────────────────────────────────────────────────────────────
  const handleAddTask = async (columnId: string) => {
    if (!newTask.title.trim()) return;
    try {
      await apiPost('/api/tasks', {
        title: newTask.title.trim(),
        description: newTask.description.trim(),
        assignee: newTask.assignee || 'Nova',
        priority: newTask.priority,
        tags: newTask.tags.split(',').map(t => t.trim()).filter(Boolean),
        project: newTask.project || undefined,
        column: columnId,
      });
      setNewTask({ title: '', description: '', assignee: 'Nova', priority: 'medium', tags: '', project: '' });
      setShowAddForm(null);
    } catch (err) {
      console.error('[Kanban] Add task failed:', err);
    }
  };

  // ── Move task ──────────────────────────────────────────────────────────────
  const handleMoveTask = async (taskId: string, toColId: string) => {
    // Optimistic update
    setColumns(prev => {
      const next = { ...prev };
      let task: Task | undefined;
      for (const col of COLUMN_ORDER) {
        const idx = next[col].findIndex(t => t.id === taskId);
        if (idx !== -1) {
          task = { ...next[col][idx] };
          next[col] = next[col].filter(t => t.id !== taskId);
          break;
        }
      }
      if (task) {
        if (toColId === 'done') task.doneAt = new Date().toISOString();
        next[toColId] = toColId === 'done' ? [task, ...next[toColId]] : [...next[toColId], task];
      }
      return next;
    });
    try {
      await apiPost(`/api/tasks/${encodeURIComponent(taskId)}/move`, { column: toColId });
    } catch (err) {
      console.error('[Kanban] Move failed:', err);
      fetchTasks(); // revert on error
    }
  };

  // ── Delete task ────────────────────────────────────────────────────────────
  const handleDelete = (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (deletingId === taskId) {
      // Optimistic removal
      setColumns(prev => {
        const next = { ...prev };
        for (const col of COLUMN_ORDER) next[col] = next[col].filter(t => t.id !== taskId);
        return next;
      });
      apiDelete(`/api/tasks/${encodeURIComponent(taskId)}`).catch(() => fetchTasks());
      setDeletingId(null);
      setExpandedTask(null);
    } else {
      setDeletingId(taskId);
      setTimeout(() => setDeletingId(prev => prev === taskId ? null : prev), 3000);
    }
  };

  // ── Toggle step ────────────────────────────────────────────────────────────
  const handleToggleStep = async (taskId: string, stepIndex: number, done: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    // Optimistic update
    setColumns(prev => {
      const next = { ...prev };
      for (const col of COLUMN_ORDER) {
        const idx = next[col].findIndex(t => t.id === taskId);
        if (idx !== -1) {
          const task = { ...next[col][idx] };
          if (task.steps) {
            task.steps = task.steps.map((s, i) => i === stepIndex ? { ...s, done } : s);
            task.progress = Math.round(task.steps.filter(s => s.done).length / task.steps.length * 100);
          }
          next[col] = [...next[col]];
          next[col][idx] = task;
          break;
        }
      }
      return next;
    });
    try {
      await apiPost(`/api/tasks/${encodeURIComponent(taskId)}/step`, { stepIndex, done });
    } catch (err) {
      console.error('[Kanban] Step toggle failed:', err);
      fetchTasks();
    }
  };

  // ── Drag and drop ──────────────────────────────────────────────────────────
  const handleDragStart = (taskId: string, colId: string, e: React.DragEvent) => {
    setDragTaskId(taskId);
    setDragFromCol(colId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (colId: string, e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverCol(colId);
  };

  const handleDrop = (colId: string, e: React.DragEvent) => {
    e.preventDefault();
    setDragOverCol(null);
    if (dragTaskId && dragFromCol && dragFromCol !== colId) {
      handleMoveTask(dragTaskId, colId);
    }
    setDragTaskId(null);
    setDragFromCol(null);
  };

  const handleDragEnd = () => {
    setDragTaskId(null);
    setDragFromCol(null);
    setDragOverCol(null);
  };

  // ── Derived stats ──────────────────────────────────────────────────────────
  const totalTasks = COLUMN_ORDER.reduce((sum, col) => sum + columns[col].length, 0);
  const projects = [...new Set(COLUMN_ORDER.flatMap(c => columns[c].map(t => t.project).filter((p): p is string => !!p)))];

  return (
    <div className="p-4 md:p-6 flex flex-col h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 md:mb-4 shrink-0 gap-2">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white">Kanban Board</h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-slate-400 text-xs md:text-sm">{totalTasks} tasks &bull; {projects.length} projects</p>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ring-1 ${
              sseStatus === 'live' ? 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20' :
              sseStatus === 'polling' ? 'bg-amber-500/10 text-amber-400 ring-amber-500/20' :
              'bg-slate-500/10 text-slate-400 ring-slate-500/20'
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${
                sseStatus === 'live' ? 'bg-emerald-400 animate-pulse' :
                sseStatus === 'polling' ? 'bg-amber-400' : 'bg-slate-500'
              }`}></span>
              {sseStatus === 'live' ? 'LIVE' : sseStatus === 'polling' ? 'POLLING' : 'CONNECTING'}
            </span>
          </div>
        </div>
        {projects.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {projects.map(p => (
              <span key={p} className="px-2.5 py-1 bg-slate-800 rounded-full text-[10px] text-slate-400 font-medium">{p}</span>
            ))}
          </div>
        )}
      </div>

      {/* Cron Jobs */}
      <div className="mb-3 md:mb-4 shrink-0">
        <button onClick={() => setShowCron(!showCron)} className="flex items-center gap-2 text-sm font-semibold text-white mb-2 min-h-[44px] md:min-h-0">
          <span>{showCron ? '▼' : '▸'}</span>
          <span>⏱️ Scheduled Jobs</span>
        </button>
        {showCron && <CronDashboard />}
      </div>

      {/* Board */}
      <div className="flex-1 flex gap-3 md:gap-4 overflow-x-auto pb-4 snap-x snap-mandatory md:snap-none">
        {COLUMN_ORDER.map(colId => {
          const meta = COLUMN_META[colId];
          const tasks = columns[colId] || [];
          const staleTasks = tasks.filter(t => isStale(t, colId));
          const isDragTarget = dragOverCol === colId;

          return (
            <div
              key={colId}
              className="w-72 md:w-72 shrink-0 flex flex-col snap-start"
              onDragOver={e => handleDragOver(colId, e)}
              onDrop={e => handleDrop(colId, e)}
            >
              {/* Column Header */}
              <div className={`flex items-center justify-between px-4 py-3 bg-slate-900 border border-slate-800 rounded-t-xl border-t-2 ${meta.color}`}>
                <div className="flex items-center gap-2">
                  <span className="text-sm">{meta.icon}</span>
                  <h3 className="text-sm font-semibold text-white">{meta.title}</h3>
                  <span className="bg-slate-800 text-slate-400 text-xs font-medium px-2 py-0.5 rounded-full">{tasks.length}</span>
                  {staleTasks.length > 0 && (
                    <span className="bg-amber-500/10 text-amber-400 text-[10px] font-medium px-1.5 py-0.5 rounded-full ring-1 ring-amber-500/20">
                      ⚠️ {staleTasks.length} stale
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setShowAddForm(showAddForm === colId ? null : colId)}
                  className="h-8 w-8 md:h-6 md:w-6 flex items-center justify-center rounded-md text-slate-500 hover:text-white hover:bg-slate-700 transition-colors text-sm min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0"
                >+</button>
              </div>

              {/* Column Body */}
              <div className={`flex-1 bg-slate-900/50 border border-t-0 border-slate-800 rounded-b-xl p-3 space-y-3 overflow-y-auto transition-colors ${isDragTarget ? 'bg-blue-900/20 border-blue-500/40' : ''}`}>
                {/* Add Task Form */}
                {showAddForm === colId && (
                  <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-3 space-y-2">
                    <input
                      value={newTask.title}
                      onChange={e => setNewTask(p => ({ ...p, title: e.target.value }))}
                      onKeyDown={e => { if (e.key === 'Enter') handleAddTask(colId); }}
                      placeholder="Task title..."
                      className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                      autoFocus
                    />
                    <input
                      value={newTask.description}
                      onChange={e => setNewTask(p => ({ ...p, description: e.target.value }))}
                      placeholder="Description..."
                      className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                    />
                    <div className="flex gap-2">
                      <select
                        value={newTask.priority}
                        onChange={e => setNewTask(p => ({ ...p, priority: e.target.value as Task['priority'] }))}
                        className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-300 focus:outline-none"
                      >
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                      </select>
                      <input
                        value={newTask.assignee}
                        onChange={e => setNewTask(p => ({ ...p, assignee: e.target.value }))}
                        placeholder="Assignee"
                        className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white placeholder-slate-600 focus:outline-none"
                      />
                    </div>
                    <div className="flex gap-2">
                      <input
                        value={newTask.tags}
                        onChange={e => setNewTask(p => ({ ...p, tags: e.target.value }))}
                        placeholder="Tags (comma sep)"
                        className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white placeholder-slate-600 focus:outline-none"
                      />
                      <input
                        value={newTask.project}
                        onChange={e => setNewTask(p => ({ ...p, project: e.target.value }))}
                        placeholder="Project"
                        className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white placeholder-slate-600 focus:outline-none"
                      />
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => setShowAddForm(null)} className="px-3 py-1 text-[10px] text-slate-400 bg-slate-800 rounded hover:bg-slate-700">Cancel</button>
                      <button onClick={() => handleAddTask(colId)} className="px-3 py-1 text-[10px] text-white bg-blue-600 rounded hover:bg-blue-500">Add Task</button>
                    </div>
                  </div>
                )}

                {/* Empty state */}
                {tasks.length === 0 && showAddForm !== colId && (
                  <div className="py-8 text-center bg-slate-800/20 rounded-lg border border-dashed border-slate-800">
                    <p className="text-[10px] text-slate-600 uppercase tracking-widest">Empty</p>
                  </div>
                )}

                {/* Task cards */}
                {tasks.map(task => {
                  const isExpanded = expandedTask === task.id;
                  const liveProgress = computeProgress(task);
                  const isConfirmingDelete = deletingId === task.id;
                  const stale = isStale(task, colId);
                  const age = staleDays(task);
                  const isDragging = dragTaskId === task.id;

                  return (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={e => handleDragStart(task.id, colId, e)}
                      onDragEnd={handleDragEnd}
                      className={`bg-slate-900 border rounded-lg p-4 transition-all duration-200 cursor-pointer group select-none ${
                        isDragging ? 'opacity-40 scale-95' :
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
                          <span className="font-medium">Stale — {age}d in {meta.title}</span>
                          <span className="text-amber-500/60 ml-auto">SLA: {STALE_THRESHOLDS[colId]}d</span>
                        </div>
                      )}

                      {/* Priority + Tags */}
                      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                        <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ring-1 ${priorityConfig[task.priority]?.color || priorityConfig.low.color}`}>
                          {priorityConfig[task.priority]?.label || 'Low'}
                        </span>
                        {task.tags.map(tag => (
                          <span key={tag} className="text-[10px] text-slate-600 bg-slate-800/50 px-1.5 py-0.5 rounded">{tag}</span>
                        ))}
                      </div>

                      {/* Project Badge */}
                      {task.project && (
                        <p className="text-[10px] text-purple-400 bg-purple-500/10 rounded px-1.5 py-0.5 inline-block mb-2">{task.project}</p>
                      )}

                      {/* Title */}
                      <h4 className="text-sm font-medium text-white mb-1 group-hover:text-blue-400 transition-colors">{task.title}</h4>
                      {task.description && <p className="text-xs text-slate-500 leading-relaxed">{task.description}</p>}

                      {/* Created date */}
                      {task.createdAt && (
                        <p className="text-[10px] text-slate-600 mt-2">
                          📅 {timeAgo(task.createdAt)}
                          {colId === 'done' && task.doneAt && <span className="ml-1 text-emerald-600">✓ done {timeAgo(task.doneAt)}</span>}
                        </p>
                      )}

                      {/* Progress Bar */}
                      {(task.steps && task.steps.length > 0) || task.progress !== undefined ? (
                        <div className="mt-3">
                          <div className="flex justify-between text-[10px] mb-1">
                            <span className="text-slate-500">
                              {task.steps && task.steps.length > 0
                                ? `${task.steps.filter(s => s.done).length}/${task.steps.length} steps`
                                : 'Progress'}
                            </span>
                            <span className={`font-mono ${liveProgress === 100 ? 'text-emerald-400' : liveProgress >= 50 ? 'text-blue-400' : 'text-amber-400'}`}>
                              {liveProgress}%
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-700 ease-out ${
                                liveProgress === 100 ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' :
                                liveProgress >= 50 ? 'bg-gradient-to-r from-blue-600 to-blue-400' :
                                'bg-gradient-to-r from-amber-600 to-amber-400'
                              }`}
                              style={{ width: `${liveProgress}%` }}
                            />
                          </div>
                        </div>
                      ) : null}

                      {/* Expanded: Steps with interactive checkboxes */}
                      {isExpanded && task.steps && task.steps.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-slate-800 space-y-1.5">
                          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Steps</p>
                          {task.steps.map((step, i) => (
                            <div
                              key={i}
                              className="flex items-center gap-2 group/step cursor-pointer"
                              onClick={e => handleToggleStep(task.id, i, !step.done, e)}
                            >
                              <div className={`h-4 w-4 rounded border flex items-center justify-center transition-colors flex-shrink-0 ${
                                step.done ? 'bg-emerald-500 border-emerald-500' : 'border-slate-600 group-hover/step:border-slate-400'
                              }`}>
                                {step.done && <span className="text-[8px] text-white font-bold">✓</span>}
                              </div>
                              <span className={`text-xs transition-colors ${step.done ? 'text-slate-500 line-through' : 'text-slate-300'}`}>
                                {stepLabel(step)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Assignee + Actions */}
                      <div className="mt-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="h-5 w-5 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-[8px] text-white font-bold">
                            {task.assignee?.[0] || '?'}
                          </div>
                          <span className="text-xs text-slate-500">{task.assignee}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {/* Move buttons — shown when expanded */}
                          {isExpanded && (
                            <div className="flex gap-1">
                              {COLUMN_ORDER.filter(c => c !== colId).map(c => (
                                <button
                                  key={c}
                                  onClick={e => { e.stopPropagation(); handleMoveTask(task.id, c); }}
                                  className="px-1.5 py-0.5 text-[10px] text-slate-400 bg-slate-800 rounded hover:bg-slate-700 hover:text-white transition-colors"
                                  title={`Move to ${COLUMN_META[c].title}`}
                                >
                                  → {COLUMN_META[c].icon}
                                </button>
                              ))}
                            </div>
                          )}
                          <button
                            onClick={e => handleDelete(task.id, e)}
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
          );
        })}
      </div>
    </div>
  );
};

export default KanbanPage;
