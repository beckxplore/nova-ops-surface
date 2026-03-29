import React, { useState, useEffect } from 'react';
import { useGateway } from '../context/GatewayContext';
import { getGatewayConfig } from '../gatewayConfig';

interface GatewayStatus {
  url: string;
  status: 'connected' | 'disconnected' | 'error';
  latencyMs: number | null;
  uptime: string;
  version: string;
}

interface Device {
  deviceId: string;
  platform: string;
  clientMode: string;
  clientId: string;
  scopes: string[];
  status: 'connected' | 'disconnected';
  createdAt: string;
}

const GatewaysPage: React.FC = () => {
  const { status: gwStatus, ws } = useGateway();
  const [gwInfo, setGwInfo] = useState<GatewayStatus>({
    url: 'wss://3-227-84-30.sslip.io',
    status: 'disconnected',
    latencyMs: null,
    uptime: '—',
    version: '2026.3.11',
  });
  const [devices] = useState<Device[]>([
    {
      deviceId: 'daeb779b...9ecdc4',
      platform: 'linux',
      clientMode: 'cli',
      clientId: 'cli',
      scopes: ['operator.read', 'operator.admin', 'operator.write', 'operator.approvals', 'operator.pairing'],
      status: 'connected',
      createdAt: '2026-03-13',
    },
    {
      deviceId: '5251b058...64bb7ff6',
      platform: 'web',
      clientMode: 'webchat',
      clientId: 'openclaw-control-ui',
      scopes: ['operator.read', 'operator.write'],
      status: gwStatus === 'connected' ? 'connected' : 'disconnected',
      createdAt: '2026-03-17',
    },
  ]);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const cfg = await getGatewayConfig();
        const wsUrl = cfg.gatewayUrl || '';
        const r = await fetch('/api/status?route=health', {
          headers: { Authorization: `Bearer ${cfg.authToken}` },
        });
        if (r.ok) {
          const data = await r.json();
          const gw = data?.gateway;
          setGwInfo(prev => ({
            ...prev,
            url: gw?.url || wsUrl,
            status: gw?.reachable ? 'connected' : 'error',
            latencyMs: gw?.latencyMs ?? null,
            version: gw?.version || '2026.3.11',
          }));
        } else {
          setGwInfo(prev => ({ ...prev, status: 'error' }));
        }
      } catch {
        setGwInfo(prev => ({ ...prev, status: 'error', latencyMs: null }));
      }
    };
    fetchHealth();
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const statusBadge = (s: string) => {
    const styles: Record<string, string> = {
      connected: 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20',
      disconnected: 'bg-amber-500/10 text-amber-400 ring-amber-500/20',
      error: 'bg-red-500/10 text-red-400 ring-red-500/20',
    };
    return (
      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium ring-1 ${styles[s] || styles.disconnected}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${s === 'connected' ? 'bg-emerald-400 animate-pulse' : s === 'error' ? 'bg-red-400' : 'bg-amber-400'}`}></span>
        {s === 'connected' ? 'Online' : s === 'error' ? 'Error' : 'Offline'}
      </span>
    );
  };

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-6 md:mb-8">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white">Gateways</h1>
          <p className="text-slate-400 mt-1 text-xs md:text-sm">Gateway connections & device management</p>
        </div>
        {statusBadge(gwInfo.status)}
      </div>

      {/* Connection Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-6">
        <h2 className="text-sm font-semibold text-white mb-4">Connection Status</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Gateway URL</p>
            <p className="text-xs text-slate-300 font-mono break-all">{gwInfo.url}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Status</p>
            {statusBadge(gwInfo.status)}
          </div>
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Latency</p>
            <p className="text-sm text-white font-semibold">{gwInfo.latencyMs !== null ? `${gwInfo.latencyMs}ms` : '—'}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Version</p>
            <p className="text-sm text-white font-semibold">{gwInfo.version}</p>
          </div>
        </div>
      </div>

      {/* Connected Devices */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-6">
        <h2 className="text-sm font-semibold text-white mb-4">Connected Devices ({devices.length})</h2>
        <div className="space-y-3">
          {devices.map((dev, i) => (
            <div key={i} className="flex items-center justify-between bg-slate-800/30 rounded-lg p-4">
              <div className="flex items-center gap-4">
                <span className="text-xl">{dev.platform === 'web' ? '🌐' : '💻'}</span>
                <div>
                  <p className="text-sm text-white font-medium">{dev.clientId}</p>
                  <p className="text-[10px] text-slate-500 font-mono">{dev.deviceId}</p>
                </div>
              </div>
              <div className="text-right">
                {statusBadge(dev.status)}
                <p className="text-[10px] text-slate-600 mt-1">{dev.clientMode} &bull; Since {dev.createdAt}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Configuration */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white mb-4">Configuration</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Auth Mode</p>
            <p className="text-sm text-slate-300">Token-based</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Protocol</p>
            <p className="text-sm text-slate-300">v3 (WebSocket)</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Trusted Proxies</p>
            <p className="text-sm text-slate-300">127.0.0.1, ::1</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Allowed Origins</p>
            <p className="text-xs text-slate-400">nova-ops-surface-ndef.vercel.app, localhost</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GatewaysPage;
