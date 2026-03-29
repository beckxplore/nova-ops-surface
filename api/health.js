// Vercel Serverless Function — gateway health check
const GATEWAY_URL = 'https://3-227-84-30.sslip.io';
const AUTH_TOKEN = '7dd8ac893a339cb334fb2e5e644a22db16ceeed9baf0ab7a';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const health = {
    timestamp: new Date().toISOString(),
    gateway: { reachable: false, latencyMs: null },
    status: 'unknown',
    connectedDevices: 0,
    integrations: [],
  };

  // Check gateway reachability
  try {
    const start = Date.now();
    const r = await fetch(GATEWAY_URL, {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000),
    });
    const latency = Date.now() - start;
    health.gateway = {
      reachable: r.ok || r.status === 426,
      latencyMs: latency,
    };
    health.status = r.ok || r.status === 426 ? 'healthy' : 'degraded';
  } catch {
    health.gateway = { reachable: false, latencyMs: null };
    health.status = 'unreachable';
  }

  // Try to get gateway status via API
  try {
    const r = await fetch(`${GATEWAY_URL}/nova-api/api/status`, {
      headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
      signal: AbortSignal.timeout(5000),
    });
    if (r.ok) {
      const data = await r.json();
      health.connectedDevices = data.connectedDevices || 0;
      health.integrations = data.integrations || [];
      health.status = data.status || health.status;
    }
  } catch {}

  // Check external services
  health.services = {
    vercel: true,
    openrouter: false,
    github: false,
  };

  try {
    const or = await fetch('https://openrouter.ai/api/v1/auth/key', {
      signal: AbortSignal.timeout(3000),
    });
    health.services.openrouter = or.ok;
  } catch {}

  try {
    const gh = await fetch('https://api.github.com', {
      signal: AbortSignal.timeout(3000),
    });
    health.services.github = gh.ok;
  } catch {}

  return res.status(200).json(health);
}