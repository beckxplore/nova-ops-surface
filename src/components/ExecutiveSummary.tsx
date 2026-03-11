import React, { useState, useEffect } from 'react';

interface ExecutiveSummaryData {
  systemStatus: string;
  uptime: string;
  lastCheck: string;
  activeAlerts: string;
}

const ExecutiveSummary: React.FC = () => {
  const [data, setData] = useState<ExecutiveSummaryData>({
    systemStatus: 'Loading...',
    uptime: '--',
    lastCheck: '--',
    activeAlerts: '0',
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/PERFORMANCE.md');
        const text = await response.text();
        let systemStatus = 'Unknown';
        let uptime = '--';
        let lastCheck = '--';
        let activeAlerts = '0';

        const lines = text.split('\n');
        for (const line of lines) {
          if (line.startsWith('- Status:')) systemStatus = line.split('Status:')[1].trim();
          else if (line.startsWith('- Uptime:')) uptime = line.split('Uptime:')[1].trim();
          else if (line.startsWith('- Last Check:')) lastCheck = line.split('Last Check:')[1].trim();
          else if (line.startsWith('- Count:')) activeAlerts = line.split('Count:')[1].trim();
        }
        setData({ systemStatus, uptime, lastCheck, activeAlerts });
      } catch (error) {
        console.error('Error fetching PERFORMANCE.md:', error);
      }
    };
    fetchData();
  }, []);

  const statusColor = data.systemStatus === 'Operational'
    ? 'text-emerald-400'
    : 'text-red-400';

  const alertColor = parseInt(data.activeAlerts) > 0
    ? 'text-amber-400 bg-amber-500/10 ring-amber-500/20'
    : 'text-emerald-400 bg-emerald-500/10 ring-emerald-500/20';

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Executive Summary</h2>
        <span className="text-xs text-slate-500">Last check: {data.lastCheck}</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* System Status */}
        <div className="bg-slate-800/50 rounded-lg p-4">
          <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">System State</p>
          <p className={`text-xl font-bold ${statusColor}`}>{data.systemStatus}</p>
        </div>
        {/* Uptime */}
        <div className="bg-slate-800/50 rounded-lg p-4">
          <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Uptime</p>
          <p className="text-xl font-bold text-white">{data.uptime}</p>
        </div>
        {/* Active Alerts */}
        <div className="bg-slate-800/50 rounded-lg p-4">
          <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Active Alerts</p>
          <div className="flex items-center gap-2">
            <p className="text-xl font-bold text-white">{data.activeAlerts}</p>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ring-1 ${alertColor}`}>
              {parseInt(data.activeAlerts) > 0 ? 'ATTENTION' : 'ALL CLEAR'}
            </span>
          </div>
        </div>
        {/* Departments */}
        <div className="bg-slate-800/50 rounded-lg p-4">
          <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Departments</p>
          <p className="text-xl font-bold text-white">2</p>
          <p className="text-xs text-slate-500">Development &bull; Research</p>
        </div>
      </div>
    </div>
  );
};

export default ExecutiveSummary;
