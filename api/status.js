// Vercel Serverless Function — fetch live system status
// Checks OpenClaw gateway health + returns agent status summary

const REPO_OWNER = 'beckxplore';
const REPO_NAME = 'nova-ops-surface';
const BRANCH = 'master';
const GATEWAY_URL = 'https://3-227-84-30.sslip.io';

async function getFileContent(path, token) {
  const headers = { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' };
  const r = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/public/${path}?ref=${BRANCH}`,
    { headers }
  );
  if (!r.ok) return null;
  const data = await r.json();
  return Buffer.from(data.content, 'base64').toString('utf-8');
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.query.route === 'health') {
    const health = { timestamp: new Date().toISOString(), gateway: { reachable: false, latencyMs: null }, status: 'unknown', services: { vercel: true, openrouter: false, github: false } };
    try { const s = Date.now(); const r = await fetch(GATEWAY_URL, { method: 'HEAD', signal: AbortSignal.timeout(5000) }); health.gateway = { reachable: r.ok || r.status === 426, latencyMs: Date.now() - s }; health.status = r.ok || r.status === 426 ? 'healthy' : 'degraded'; } catch { health.status = 'unreachable'; }
    try { const or = await fetch('https://openrouter.ai/api/v1/auth/key', { signal: AbortSignal.timeout(3000) }); health.services.openrouter = or.ok; } catch {}
    try { const gh = await fetch('https://api.github.com', { signal: AbortSignal.timeout(3000) }); health.services.github = gh.ok; } catch {}
    return res.status(200).json(health);
  }
  if (req.query.route === 'skills') {
    return res.status(200).json({ skills: [
      { id: 'tmux', name: 'tmux', description: 'Remote-control tmux sessions for interactive CLIs', capabilities: ['terminal', 'interactive', 'remote-control'], agents: ['main', 'development'] },
      { id: 'healthcheck', name: 'healthcheck', description: 'Host security hardening and risk-tolerance configuration', capabilities: ['security', 'audit', 'firewall', 'ssh'], agents: ['main', 'clinic'] },
      { id: 'weather', name: 'weather', description: 'Current weather and forecasts via wttr.in or Open-Meteo', capabilities: ['weather', 'forecast'], agents: ['main'] },
      { id: 'skill-creator', name: 'skill-creator', description: 'Create, edit, improve, or audit AgentSkills', capabilities: ['skills', 'creation', 'audit'], agents: ['main'] },
    ], source: 'fallback' });
  }
  if (req.query.route === 'logs') {
    const AUTH_TOKEN = '7dd8ac893a339cb334fb2e5e644a22db16ceeed9baf0ab7a';
    try { const r = await fetch(`${GATEWAY_URL}/nova-api/api/tasks`, { headers: { Authorization: `Bearer ${AUTH_TOKEN}` }, signal: AbortSignal.timeout(5000) }); if (r.ok) { const t = await r.json(); const logs = []; for (const c of Object.values(t.columns || {})) { for (const task of (c || [])) { logs.push({ timestamp: task.doneAt || task.createdAt || new Date().toISOString(), level: 'info', message: task.title, source: task.assignee || 'system' }); } } logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)); return res.status(200).json({ logs: logs.slice(0, parseInt(req.query.lines) || 50), source: 'kanban' }); } } catch {}
    return res.status(200).json({ logs: [{ timestamp: new Date().toISOString(), level: 'info', message: 'No logs available', source: 'fallback' }], source: 'fallback' });
  }

  const token = process.env.GITHUB_TOKEN;

  const status = {
    timestamp: new Date().toISOString(),
    gateway: { reachable: false, latencyMs: null },
    ecosystem: null,
    kanban: null,
  };

  // Check gateway reachability
  try {
    const start = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const r = await fetch(GATEWAY_URL, { signal: controller.signal, method: 'HEAD' });
    clearTimeout(timeout);
    status.gateway = {
      reachable: r.ok || r.status === 426, // 426 = upgrade required (WSS), still reachable
      latencyMs: Date.now() - start,
    };
  } catch {
    status.gateway = { reachable: false, latencyMs: null };
  }

  // Read ecosystem.json for agent data
  if (token) {
    try {
      const ecoRaw = await getFileContent('ecosystem.json', token);
      if (ecoRaw) {
        const eco = JSON.parse(ecoRaw);
        const totalAgents = eco.departments.reduce((s, d) => s + 1 + d.agents.length, 0) + (eco.individualAgents?.length || 0) + 1;
        const runningAgents = eco.departments.reduce((s, d) => {
          let c = d.lead?.status === 'running' ? 1 : 0;
          c += (d.agents || []).filter(a => a.status === 'running').length;
          return s + c;
        }, 0) + (eco.individualAgents || []).filter(a => a.status === 'running').length + (eco.orchestrator?.status === 'running' ? 1 : 0);

        status.ecosystem = {
          departments: eco.departments.length,
          totalAgents,
          runningAgents,
          orchestratorStatus: eco.orchestrator?.status || 'unknown',
          projects: eco.projects?.length || 0,
        };
      }
    } catch {}
  }

  // Read kanban.json for task stats
  if (token) {
    try {
      const kanbanRaw = await getFileContent('kanban.json', token);
      if (kanbanRaw) {
        const kanban = JSON.parse(kanbanRaw);
        const stats = { total: 0, backlog: 0, inProgress: 0, review: 0, done: 0 };
        for (const col of kanban.columns || []) {
          const count = col.tasks?.length || 0;
          stats.total += count;
          if (col.id === 'backlog') stats.backlog = count;
          if (col.id === 'in-progress') stats.inProgress = count;
          if (col.id === 'review') stats.review = count;
          if (col.id === 'done') stats.done = count;
        }
        status.kanban = stats;
      }
    } catch {}
  }

  return res.status(200).json(status);
}
