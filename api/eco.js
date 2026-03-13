// Vercel Serverless Function — full ecosystem + kanban data
const REPO_OWNER = 'beckxplore';
const REPO_NAME = 'nova-ops-surface';
const BRANCH = 'master';

async function ghGet(path, token) {
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/public/${path}?ref=${BRANCH}`;
  const r = await fetch(url, {
    headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' }
  });
  if (!r.ok) return null;
  const d = await r.json();
  return Buffer.from(d.content, 'base64').toString('utf-8');
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const token = process.env.GITHUB_TOKEN;
  if (!token) return res.status(500).json({ error: 'GITHUB_TOKEN not configured' });

  try {
    const [ecoRaw, kanbanRaw, perfRaw] = await Promise.all([
      ghGet('ecosystem.json', token),
      ghGet('kanban.json', token),
      ghGet('PERFORMANCE.md', token)
    ]);

    const eco = ecoRaw ? JSON.parse(ecoRaw) : { orchestrator: {}, departments: [], individualAgents: [], projects: [] };
    const kanban = kanbanRaw ? JSON.parse(kanbanRaw) : null;

    // Enrich departments with file contents
    const departments = [];
    for (const dept of (eco.departments || [])) {
      const files = {};
      for (const f of ['SOUL.md', 'GOAL.md', 'MEMORY.md']) {
        files[f] = await ghGet(`departments/${dept.id}/${f}`, token) || '';
      }
      departments.push({ ...dept, files });
    }

    return res.status(200).json({
      orchestrator: eco.orchestrator || {},
      departments,
      individualAgents: eco.individualAgents || [],
      projects: eco.projects || [],
      kanban,
      performance: perfRaw || '',
      lastUpdated: new Date().toISOString()
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
