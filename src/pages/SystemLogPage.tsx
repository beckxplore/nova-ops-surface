import React, { useState, useEffect } from 'react';

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  source?: string;
}

const SystemLogPage: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchLogs = async () => {
    try {
      const cfg = await fetch('/gateway-config.json').then(r => r.json());
      const res = await fetch('/api/status?route=logs', {
        headers: {
          'Authorization': `Bearer ${cfg.authToken}`
        }
      });
      
      if (!res.ok) throw new Error('Failed to fetch logs');
      
      const data = await res.json();
      const parsedLogs = (data.logs || []).map((line: string) => {
        const match = line.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[^\s]+)\s+(\w+)\s+(.+)$/);
        if (match) {
          return {
            timestamp: match[1],
            level: match[2],
            message: match[3],
            source: 'gateway'
          };
        }
        return {
          timestamp: new Date().toISOString(),
          level: 'INFO',
          message: line,
          source: 'system'
        };
      });
      
      setLogs(parsedLogs);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    let interval: ReturnType<typeof setInterval>;
    if (autoRefresh) {
      interval = setInterval(fetchLogs, 2000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  const getLevelColor = (level: string) => {
    switch (level.toUpperCase()) {
      case 'ERROR': return 'text-red-400';
      case 'WARN': return 'text-amber-400';
      case 'INFO': return 'text-blue-400';
      case 'DEBUG': return 'text-slate-400';
      default: return 'text-slate-300';
    }
  };

  return (
    <div className="p-6 bg-[#00050a] min-h-screen">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tighter italic">
            SYSTEM <span className="text-emerald-500">LOG</span>
          </h1>
          <p className="text-slate-500 text-xs mt-1 uppercase tracking-widest font-bold">
            Real-time OpenClaw Gateway & Nova API Logs
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-slate-400">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-emerald-500"
            />
            Auto-refresh
          </label>
          <button
            onClick={fetchLogs}
            className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-sm hover:bg-slate-700 transition-colors"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-emerald-500 border-r-transparent"></div>
            <p className="text-slate-400 mt-4 text-sm">Loading system logs...</p>
          </div>
        </div>
      ) : error ? (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6">
          <h3 className="text-red-400 font-bold mb-2">Error Loading Logs</h3>
          <p className="text-red-300 text-sm">{error}</p>
          <button 
            onClick={fetchLogs}
            className="mt-4 px-4 py-2 bg-red-500/20 text-red-400 rounded text-sm hover:bg-red-500/30 transition-colors"
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="bg-slate-900/40 border border-slate-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <span className="text-sm font-bold text-slate-300">
              📋 {logs.length} log entries
            </span>
            <span className="text-xs text-slate-500">
              Last updated: {new Date().toLocaleTimeString()}
            </span>
          </div>
          
          <div className="overflow-y-auto max-h-[calc(100vh-280px)] font-mono text-sm">
            {logs.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                No logs available
              </div>
            ) : (
              logs.map((log, idx) => (
                <div 
                  key={idx}
                  className="px-4 py-2 border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-slate-500 text-xs whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    <span className={`text-xs font-bold ${getLevelColor(log.level)} w-16`}>
                      {log.level.toUpperCase()}
                    </span>
                    <span className="text-slate-300 flex-1 break-all">
                      {log.message}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SystemLogPage;
