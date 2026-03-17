import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getGatewayConfig } from '../gatewayConfig';

const NOVA_API = 'https://3-227-84-30.sslip.io/nova-api';

interface FeedEvent {
  id: string;
  agent: string;
  message: string;
  type: 'Task' | 'Status' | 'Deploy' | 'System' | 'Delegation' | 'Update' | 'Completion' | 'Message';
  timestamp: string;
  to?: string;
}

interface Task {
  id: string;
  title: string;
  assignee: string;
  description?: string;
  createdAt?: string;
  startedAt?: string;
  doneAt?: string;
}

const AGENTS = ['All', '@nova', '@kai', '@sage'] as const;
type AgentFilter = typeof AGENTS[number];

const AGENT_NAMES: Record<string, string> = {
  '@nova': 'Nova', '@kai': 'Kai (Dev Lead)', '@sage': 'Sage (Research)',
  '@dev-lead': 'Kai', '@research-lead': 'Sage',
};

const AGENT_AVATARS: Record<string, string> = {
  '@nova': '/avatars/nova.jpg', '@kai': '/avatars/kai.jpg', '@sage': '/avatars/sage.jpg',
  '@dev-lead': '/avatars/kai.jpg', '@research-lead': '/avatars/sage.jpg',
};

const AGENT_COLORS: Record<string, string> = {
  '@nova': 'text-blue-400', '@kai': 'text-emerald-400', '@sage': 'text-purple-400',
  '@dev-lead': 'text-emerald-400', '@research-lead': 'text-purple-400',
};

const AGENT_BG: Record<string, string> = {
  '@nova': 'bg-blue-500/20', '@kai': 'bg-emerald-500/20', '@sage': 'bg-purple-500/20',
  '@dev-lead': 'bg-emerald-500/20', '@research-lead': 'bg-purple-500/20',
};

const TYPE_BADGE: Record<string, string> = {
  Task: 'bg-blue-500/10 text-blue-400 ring-blue-500/20',
  Status: 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20',
  Deploy: 'bg-amber-500/10 text-amber-400 ring-amber-500/20',
  System: 'bg-slate-500/10 text-slate-400 ring-slate-500/20',
  Message: 'bg-slate-500/10 text-slate-300 ring-slate-500/20',
  Delegation: 'bg-purple-500/10 text-purple-400 ring-purple-500/20',
  Update: 'bg-cyan-500/10 text-cyan-400 ring-cyan-500/20',
  Completion: 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20',
};

const TYPE_ICONS: Record<string, string> = {
  Task: '📋', Status: '✅', Deploy: '🚀', System: '⚙️',
  Message: '💬', Delegation: '👉', Update: '📢', Completion: '🏁',
};

const AGENT_ICONS: Record<string, string> = {
  '@nova': '🤖',
  '@dev-lead': '👨‍💻',
  '@research-lead': '🔬',
};

const MAX_EVENTS = 100;

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  if (isNaN(then)) return dateStr;
  const diff = now - then;
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function normalizeAssignee(raw: string): string {
  const lower = (raw || '').toLowerCase().replace(/^@/, '');
  if (lower === 'nova' || lower === '@nova') return '@nova';
  if (lower === 'dev-lead' || lower === 'dev_lead' || lower === 'devlead') return '@dev-lead';
  if (lower === 'research-lead' || lower === 'research_lead' || lower === 'researchlead') return '@research-lead';
  return `@${lower}`;
}

function eventTypeFor(task: Task, column: string): FeedEvent['type'] {
  if (column === 'done') return 'Status';
  if (task.startedAt && !task.doneAt) return 'Task';
  return 'Task';
}

function makeEventId(): string {
  return `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const LiveFeedPage: React.FC = () => {
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [filter, setFilter] = useState<AgentFilter>('All');
  const [connectionStatus, setConnectionStatus] = useState<'LIVE' | 'POLLING' | 'DISCONNECTED'>('POLLING');
  const [authToken, setAuthToken] = useState<string>('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const esRef = useRef<EventSource | null>(null);
  const prevTasksRef = useRef<Map<string, Task>>(new Map());

  // Load gateway config for auth
  useEffect(() => {
    getGatewayConfig().then((cfg) => {
      setAuthToken(cfg.authToken);
    });
  }, []);

  // Auto-scroll to bottom on new events
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events]);

  const addEvent = useCallback((evt: FeedEvent) => {
    setEvents((prev) => {
      // Insert sorted by timestamp (newest first), dedup by id
      const next = [evt, ...prev.filter(e => e.id !== evt.id)];
      next.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      return next.slice(0, MAX_EVENTS);
    });
  }, []);

  // Fetch initial tasks and generate synthetic events
  const fetchTasks = useCallback(async (token: string) => {
    try {
      const res = await fetch(`${NOVA_API}/api/tasks`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      // Flatten columns { backlog: [...], in-progress: [...], ... } into single array
      const tasks: Task[] = data.columns
        ? Object.entries(data.columns).flatMap(([colId, colTasks]: [string, any]) =>
            (Array.isArray(colTasks) ? colTasks : []).map((t: any) => ({ ...t, column: colId }))
          )
        : Array.isArray(data) ? data : data.tasks || [];

      // Build current task map and generate events for new/changed tasks
      const currentMap = new Map<string, Task>();
      const newEvents: FeedEvent[] = [];

      for (const task of tasks) {
        currentMap.set(task.id, task);
        const prev = prevTasksRef.current.get(task.id);

        if (!prev) {
          // New task
          newEvents.push({
            id: makeEventId(),
            agent: normalizeAssignee(task.assignee),
            message: `Task created: "${task.title}"`,
            type: 'Task',
            timestamp: task.createdAt || new Date().toISOString(),
          });
        } else if (prev.doneAt !== task.doneAt && task.doneAt) {
          newEvents.push({
            id: makeEventId(),
            agent: normalizeAssignee(task.assignee),
            message: `Task completed: "${task.title}"`,
            type: 'Status',
            timestamp: task.doneAt,
          });
        } else if (prev.startedAt !== task.startedAt && task.startedAt) {
          newEvents.push({
            id: makeEventId(),
            agent: normalizeAssignee(task.assignee),
            message: `Task started: "${task.title}"`,
            type: 'Status',
            timestamp: task.startedAt,
          });
        }
      }

      if (newEvents.length > 0) {
        setEvents((prev) => {
          const combined = [...newEvents.reverse(), ...prev];
          return combined.length > MAX_EVENTS ? combined.slice(0, MAX_EVENTS) : combined;
        });
      }

      prevTasksRef.current = currentMap;
    } catch {
      // silently fail
    }
  }, []);

  // SSE connection for real-time updates
  useEffect(() => {
    if (!authToken) return;

    // Initial fetch
    fetchTasks(authToken);

    const sseUrl = `${NOVA_API}/api/tasks/stream`;

    const connectSSE = () => {
      try {
        // Use fetch-based SSE for Bearer auth support
        const controller = new AbortController();

        fetch(sseUrl, {
          headers: { Authorization: `Bearer ${authToken}` },
          signal: controller.signal,
        })
          .then(async (res) => {
            if (!res.ok) {
              setConnectionStatus('POLLING');
              return;
            }
            setConnectionStatus('LIVE');

            const reader = res.body?.getReader();
            if (!reader) return;

            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop() || '';

              for (const line of lines) {
                if (line.startsWith('data:')) {
                  try {
                    const data = JSON.parse(line.slice(5).trim());
                    // Skip init event (full state dump — handled by fetchTasks)
                    if (data.type === 'init') continue;
                    // Skip column-level events
                    if (data.columns && !data.title) continue;

                    const agent = normalizeAssignee(data.assignee || data.agent || 'nova');
                    const message = data.title
                      ? `Task updated: "${data.title}"`
                      : data.message || null;
                    // Skip if no meaningful message
                    if (!message) continue;

                    const type: FeedEvent['type'] = data.doneAt
                      ? 'Status'
                      : data.startedAt
                      ? 'Task'
                      : 'System';

                    addEvent({
                      id: makeEventId(),
                      agent,
                      message,
                      type,
                      timestamp: data.updatedAt || data.doneAt || data.startedAt || data.createdAt || new Date().toISOString(),
                    });
                  } catch {
                    // non-JSON data line
                  }
                }
              }
            }
          })
          .catch(() => {
            setConnectionStatus('DISCONNECTED');
          });

        return () => controller.abort();
      } catch {
        setConnectionStatus('POLLING');
      }
    };

    const cleanup = connectSSE();

    // Polling fallback: refresh tasks every 30s
    const pollInterval = setInterval(() => {
      fetchTasks(authToken);
    }, 30000);

    return () => {
      cleanup?.();
      clearInterval(pollInterval);
      esRef.current?.close();
    };
  }, [authToken, fetchTasks, addEvent]);

  // Fetch agent communications (natural language inter-agent messages)
  useEffect(() => {
    const fetchComms = async () => {
      try {
        const r = await fetch('/api/comms');
        if (!r.ok) return;
        const data = await r.json();
        const msgs = data.messages || [];
        for (const msg of msgs) {
          addEvent({
            id: msg.id || `comms-${msg.timestamp}`,
            agent: msg.from || '@nova',
            message: msg.to && msg.to !== '@all' ? `→ ${msg.to} ${msg.message}` : msg.message,
            type: (msg.type === 'delegation' ? 'Delegation' : msg.type === 'completion' ? 'Completion' : msg.type === 'update' ? 'Update' : 'Message') as FeedEvent['type'],
            timestamp: msg.timestamp,
            to: msg.to,
          });
        }
      } catch {}
    };
    fetchComms();
    const interval = setInterval(fetchComms, 60000);
    return () => clearInterval(interval);
  }, [addEvent]);

  // Connection status dot
  const statusDot =
    connectionStatus === 'LIVE'
      ? 'bg-emerald-400 animate-pulse'
      : connectionStatus === 'POLLING'
      ? 'bg-amber-400'
      : 'bg-red-400';

  const statusText =
    connectionStatus === 'LIVE' ? 'LIVE' : connectionStatus === 'POLLING' ? 'POLLING' : 'OFFLINE';

  const statusBadgeClass =
    connectionStatus === 'LIVE'
      ? 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20'
      : connectionStatus === 'POLLING'
      ? 'bg-amber-500/10 text-amber-400 ring-amber-500/20'
      : 'bg-red-500/10 text-red-400 ring-red-500/20';

  const filteredEvents = (filter === 'All' ? events : events.filter((e) => e.agent === filter))
    .slice()
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur border-b border-slate-800">
        <div className="px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-white tracking-tight">📡 Live Feed</h1>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ring-1 ring-inset ${statusBadgeClass}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${statusDot}`} />
                {statusText}
              </span>
            </div>
            <div className="text-xs text-slate-500">
              {filteredEvents.length} event{filteredEvents.length !== 1 ? 's' : ''}
            </div>
          </div>

          {/* Filter bar */}
          <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1">
            {AGENTS.map((agent) => (
              <button
                key={agent}
                onClick={() => setFilter(agent)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all duration-150 min-h-[44px] ${
                  filter === agent
                    ? 'bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/30'
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                }`}
              >
                {agent !== 'All' && (
                  <span className="text-sm">{AGENT_ICONS[agent]}</span>
                )}
                {agent}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Event stream */}
      <div
        ref={scrollRef}
        className="px-4 sm:px-6 py-4 space-y-2 overflow-y-auto"
        style={{ minHeight: 'calc(100vh - 160px)' }}
      >
        {filteredEvents.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-slate-600">
            <span className="text-4xl mb-3">📡</span>
            <p className="text-sm">No events yet</p>
            <p className="text-xs mt-1">Waiting for agent activity...</p>
          </div>
        )}

        {filteredEvents.map((evt) => (
          <div
            key={evt.id}
            className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 hover:bg-slate-800/40 transition-colors"
          >
            <div className="flex items-start gap-3">
              {/* Avatar */}
              <div
                className={`h-9 w-9 rounded-lg overflow-hidden shrink-0 ${AGENT_BG[evt.agent] || 'bg-slate-700'} flex items-center justify-center`}
              >
                {AGENT_AVATARS[evt.agent] ? (
                  <img src={AGENT_AVATARS[evt.agent]} alt={evt.agent} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-base">{AGENT_ICONS[evt.agent] || '❓'}</span>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-sm font-semibold ${AGENT_COLORS[evt.agent] || 'text-slate-300'}`}>
                    {AGENT_NAMES[evt.agent] || evt.agent}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold ring-1 ring-inset ${TYPE_BADGE[evt.type] || TYPE_BADGE.System}`}
                  >
                    <span>{TYPE_ICONS[evt.type] || '📋'}</span>
                    {evt.type}
                  </span>
                  <span className="text-[11px] text-slate-600 ml-auto shrink-0">
                    {timeAgo(evt.timestamp)}
                  </span>
                </div>
                <p className="text-sm text-slate-300 mt-1 break-words">{evt.message}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LiveFeedPage;
