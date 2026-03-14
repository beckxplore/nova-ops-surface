import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getOrCreateDeviceIdentity } from '../utils/cryptoUtils';

const GATEWAY_URL = 'wss://98-93-181-83.sslip.io';
const AUTH_TOKEN = '7dd8ac893a339cb334fb2e5e644a22db16ceeed9baf0ab7a';

/* ─── Types ────────────────────────────────────────────────── */

interface CronJob {
  id: string;
  name: string;
  enabled: boolean;
  agentId: string;
  sessionTarget: string;
  schedule: {
    kind: string;
    everyMs?: number;
    anchorMs?: number;
    cronExpr?: string;
    at?: string;
  };
  wakeMode: string;
  payload: {
    kind: string;
    text?: string;
    message?: string;
  };
  state: {
    nextRunAtMs: number;
    lastRunAtMs: number;
    lastRunStatus: string;
    lastDurationMs: number;
    lastDeliveryStatus: string;
    consecutiveErrors: number;
  };
  createdAtMs: number;
  updatedAtMs: number;
}

interface CronStatus {
  enabled: boolean;
  jobs: number;
  nextWakeAtMs: number;
}

/* ─── Helpers ──────────────────────────────────────────────── */

let reqCounter = 0;
function nextReqId() { return `cron-${Date.now()}-${++reqCounter}`; }

function formatSchedule(schedule: CronJob['schedule']): string {
  if (schedule.kind === 'every' && schedule.everyMs) {
    const mins = Math.floor(schedule.everyMs / 60000);
    if (mins < 60) return `Every ${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `Every ${hrs}h`;
    return `Every ${Math.floor(hrs / 24)}d`;
  }
  if (schedule.cronExpr) return schedule.cronExpr;
  if (schedule.at) return `At ${schedule.at}`;
  return schedule.kind;
}

function relativeTime(ms: number): string {
  const now = Date.now();
  const diff = ms - now;
  const absDiff = Math.abs(diff);
  const isFuture = diff > 0;

  const mins = Math.floor(absDiff / 60000);
  if (mins < 1) return isFuture ? 'now' : 'just now';
  if (mins < 60) return isFuture ? `in ${mins}m` : `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return isFuture ? `in ${hrs}h ${mins % 60}m` : `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return isFuture ? `in ${days}d` : `${days}d ago`;
}

function statusBadge(status: string) {
  const styles: Record<string, string> = {
    ok: 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20',
    error: 'bg-red-500/10 text-red-400 ring-red-500/20',
    skipped: 'bg-amber-500/10 text-amber-400 ring-amber-500/20',
    running: 'bg-blue-500/10 text-blue-400 ring-blue-500/20',
  };
  return styles[status] || 'bg-slate-500/10 text-slate-400 ring-slate-500/20';
}

/* ─── Component ────────────────────────────────────────────── */

const CronDashboard: React.FC = () => {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [cronStatus, setCronStatus] = useState<CronStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [runningJob, setRunningJob] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const pendingRpc = useRef<Map<string, (p: any) => void>>(new Map());

  const sendRpc = useCallback((method: string, params: any): Promise<any> => {
    return new Promise((resolve, reject) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) { reject(new Error('Not connected')); return; }
      const id = nextReqId();
      pendingRpc.current.set(id, resolve);
      ws.send(JSON.stringify({ type: 'req', id, method, params }));
      setTimeout(() => {
        if (pendingRpc.current.has(id)) { pendingRpc.current.delete(id); reject(new Error('Timeout')); }
      }, 15000);
    });
  }, []);

  const loadCronData = useCallback(async () => {
    try {
      setLoading(true);
      const [listRes, statusRes] = await Promise.all([
        sendRpc('cron.list', { includeDisabled: true, limit: 50 }),
        sendRpc('cron.status', {}),
      ]);
      if (listRes?.jobs) setJobs(listRes.jobs);
      if (statusRes) setCronStatus(statusRes);
    } catch (err) {
      console.error('[Cron] Failed to load:', err);
    } finally {
      setLoading(false);
    }
  }, [sendRpc]);

  const handleRunNow = useCallback(async (jobId: string) => {
    try {
      setRunningJob(jobId);
      await sendRpc('cron.run', { id: jobId });
      // Reload data after short delay for state update
      setTimeout(() => loadCronData(), 2000);
    } catch (err) {
      console.error('[Cron] Run failed:', err);
    } finally {
      setTimeout(() => setRunningJob(null), 2000);
    }
  }, [sendRpc, loadCronData]);

  const handleToggle = useCallback(async (job: CronJob) => {
    try {
      await sendRpc('cron.update', { id: job.id, enabled: !job.enabled });
      await loadCronData();
    } catch (err) {
      console.error('[Cron] Toggle failed:', err);
    }
  }, [sendRpc, loadCronData]);

  // WebSocket connection
  useEffect(() => {
    let ws: WebSocket;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    function connect() {
      ws = new WebSocket(GATEWAY_URL);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // RPC responses
          if (data.type === 'res') {
            const cb = pendingRpc.current.get(data.id);
            if (cb) { pendingRpc.current.delete(data.id); cb(data.ok !== false ? data.payload : null); return; }
            if (data.payload?.type === 'hello-ok') { setConnected(true); return; }
            return;
          }

          // Handshake
          if (data.type === 'event' && data.event === 'connect.challenge') {
            const nonce = data.payload?.nonce;
            if (!nonce) return;
            (async () => {
              const device = await getOrCreateDeviceIdentity(nonce, {
                clientId: 'openclaw-control-ui', clientMode: 'webchat',
                platform: 'web', role: 'operator',
                scopes: ['operator.read', 'operator.write'], token: AUTH_TOKEN,
              });
              ws.send(JSON.stringify({
                type: 'req', id: nextReqId(), method: 'connect',
                params: {
                  minProtocol: 3, maxProtocol: 3,
                  client: { id: 'openclaw-control-ui', version: '1.0.0', platform: 'web', mode: 'webchat' },
                  device, role: 'operator', scopes: ['operator.read', 'operator.write'],
                  caps: ['events'], commands: [], permissions: {},
                  auth: { token: AUTH_TOKEN }, locale: 'en-US', userAgent: 'nova-dashboard/1.0.0',
                },
              }));
            })();
            return;
          }

          // Cron events (real-time updates)
          if (data.type === 'event' && data.event === 'cron') {
            loadCronData();
            return;
          }
        } catch {}
      };

      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;
        reconnectTimer = setTimeout(connect, 3000);
      };
    }

    connect();
    return () => { ws?.close(); clearTimeout(reconnectTimer); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load data on connect
  useEffect(() => {
    if (connected) loadCronData();
  }, [connected, loadCronData]);

  // Auto-refresh every 30s
  useEffect(() => {
    if (!connected) return;
    const interval = setInterval(loadCronData, 30000);
    return () => clearInterval(interval);
  }, [connected, loadCronData]);

  const nextWake = cronStatus?.nextWakeAtMs ? relativeTime(cronStatus.nextWakeAtMs) : '—';

  return (
    <div className="space-y-4">
      {/* Status Bar */}
      <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-xl px-5 py-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${cronStatus?.enabled ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
            <span className="text-sm font-medium text-white">Cron Scheduler</span>
          </div>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ring-1 ${
            cronStatus?.enabled ? 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20' : 'bg-slate-500/10 text-slate-400 ring-slate-500/20'
          }`}>{cronStatus?.enabled ? 'Active' : 'Disabled'}</span>
          <span className="text-[10px] text-slate-500">
            {cronStatus?.jobs ?? 0} job{(cronStatus?.jobs ?? 0) !== 1 ? 's' : ''} · Next wake: {nextWake}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {!connected && <span className="text-[10px] text-amber-400 animate-pulse">Connecting...</span>}
          <button
            onClick={loadCronData}
            disabled={loading || !connected}
            className="px-3 py-1 text-[10px] text-slate-400 bg-slate-800 rounded-lg hover:bg-slate-700 hover:text-white transition-colors disabled:opacity-50"
          >
            {loading ? '⏳' : '🔄'} Refresh
          </button>
        </div>
      </div>

      {/* Jobs List */}
      {loading && jobs.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
          <span className="text-2xl animate-bounce block mb-2">⏱️</span>
          <p className="text-sm text-slate-500">Loading cron jobs...</p>
        </div>
      ) : jobs.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
          <span className="text-2xl block mb-2">📭</span>
          <p className="text-sm text-slate-500">No cron jobs configured</p>
          <p className="text-[10px] text-slate-600 mt-1">Create one from the OpenClaw CLI or Control UI</p>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map(job => {
            const isExpanded = expandedJob === job.id;
            const isRunning = runningJob === job.id;
            const lastStatus = job.state?.lastRunStatus || 'unknown';
            const hasErrors = job.state?.consecutiveErrors > 0;

            return (
              <div
                key={job.id}
                className={`bg-slate-900 border rounded-xl transition-all cursor-pointer ${
                  hasErrors ? 'border-red-500/30' : 'border-slate-800 hover:border-slate-700'
                }`}
                onClick={() => setExpandedJob(isExpanded ? null : job.id)}
              >
                {/* Job Header */}
                <div className="px-5 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className={`h-3 w-3 rounded-full ${job.enabled ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-medium text-white">{job.name}</h3>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ring-1 ${statusBadge(lastStatus)}`}>
                          {lastStatus}
                        </span>
                        {hasErrors && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium ring-1 bg-red-500/10 text-red-400 ring-red-500/20">
                            ⚠️ {job.state.consecutiveErrors} errors
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {formatSchedule(job.schedule)} · Agent: {job.agentId} · Target: {job.sessionTarget}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Next / Last run */}
                    <div className="text-right">
                      <p className="text-[10px] text-slate-400">
                        Next: <span className="text-blue-400">{job.state?.nextRunAtMs ? relativeTime(job.state.nextRunAtMs) : '—'}</span>
                      </p>
                      <p className="text-[10px] text-slate-600">
                        Last: {job.state?.lastRunAtMs ? relativeTime(job.state.lastRunAtMs) : 'never'}
                        {job.state?.lastDurationMs ? ` (${job.state.lastDurationMs}ms)` : ''}
                      </p>
                    </div>

                    {/* Actions */}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRunNow(job.id); }}
                      disabled={isRunning || !connected}
                      className={`px-3 py-1.5 text-[10px] font-medium rounded-lg transition-colors ${
                        isRunning
                          ? 'bg-blue-500/20 text-blue-300 animate-pulse'
                          : 'bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20 hover:bg-blue-500/20'
                      } disabled:opacity-50`}
                    >
                      {isRunning ? '⏳ Running...' : '▶️ Run Now'}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleToggle(job); }}
                      disabled={!connected}
                      className={`px-3 py-1.5 text-[10px] font-medium rounded-lg transition-colors ring-1 ${
                        job.enabled
                          ? 'bg-amber-500/10 text-amber-400 ring-amber-500/20 hover:bg-amber-500/20'
                          : 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20 hover:bg-emerald-500/20'
                      } disabled:opacity-50`}
                    >
                      {job.enabled ? '⏸️ Pause' : '▶️ Enable'}
                    </button>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="px-5 pb-4 pt-0 border-t border-slate-800 mt-0">
                    <div className="grid grid-cols-2 gap-4 pt-4">
                      <div>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Configuration</p>
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-500">Schedule</span>
                            <span className="text-slate-300 font-mono">{formatSchedule(job.schedule)}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-500">Wake Mode</span>
                            <span className="text-slate-300">{job.wakeMode}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-500">Payload</span>
                            <span className="text-slate-300">{job.payload?.kind}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-500">Session</span>
                            <span className="text-slate-300 font-mono text-[10px]">{job.sessionTarget}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-500">Created</span>
                            <span className="text-slate-300">{new Date(job.createdAtMs).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Last Run</p>
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-500">Status</span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ring-1 ${statusBadge(lastStatus)}`}>{lastStatus}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-500">Duration</span>
                            <span className="text-slate-300">{job.state?.lastDurationMs ? `${job.state.lastDurationMs}ms` : '—'}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-500">Delivery</span>
                            <span className="text-slate-300">{job.state?.lastDeliveryStatus || '—'}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-500">Errors</span>
                            <span className={job.state?.consecutiveErrors > 0 ? 'text-red-400' : 'text-slate-300'}>
                              {job.state?.consecutiveErrors ?? 0} consecutive
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Payload Preview */}
                    {(job.payload?.text || job.payload?.message) && (
                      <div className="mt-4">
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Payload</p>
                        <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-3">
                          <pre className="text-xs text-slate-300 whitespace-pre-wrap font-mono">
                            {job.payload.text || job.payload.message}
                          </pre>
                        </div>
                      </div>
                    )}

                    <div className="mt-3 flex justify-end">
                      <span className="text-[10px] text-slate-600 font-mono">{job.id}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CronDashboard;
