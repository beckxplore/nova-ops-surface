// Vercel Serverless Function — list installed OpenClaw skills
const GATEWAY_URL = 'https://3-227-84-30.sslip.io';
const AUTH_TOKEN = '7dd8ac893a339cb334fb2e5e644a22db16ceeed9baf0ab7a';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Try fetching from gateway first
  try {
    const r = await fetch(`${GATEWAY_URL}/nova-api/api/skills`, {
      headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
      signal: AbortSignal.timeout(5000),
    });
    if (r.ok) {
      const data = await r.json();
      return res.status(200).json(data);
    }
  } catch {}

  // Fallback: known installed skills
  const skills = [
    {
      id: 'tmux',
      name: 'tmux',
      description: 'Remote-control tmux sessions for interactive CLIs',
      capabilities: ['terminal', 'interactive', 'remote-control'],
      agents: ['main', 'development'],
    },
    {
      id: 'healthcheck',
      name: 'healthcheck',
      description: 'Host security hardening and risk-tolerance configuration',
      capabilities: ['security', 'audit', 'firewall', 'ssh'],
      agents: ['main', 'clinic'],
    },
    {
      id: 'weather',
      name: 'weather',
      description: 'Current weather and forecasts via wttr.in or Open-Meteo',
      capabilities: ['weather', 'forecast'],
      agents: ['main'],
    },
    {
      id: 'skill-creator',
      name: 'skill-creator',
      description: 'Create, edit, improve, or audit AgentSkills',
      capabilities: ['skills', 'creation', 'audit'],
      agents: ['main'],
    },
  ];

  return res.status(200).json({ skills, source: 'fallback' });
}