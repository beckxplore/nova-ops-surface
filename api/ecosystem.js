// Vercel Serverless Function — full ecosystem state from GitHub repo files
const REPO_OWNER = 'beckxplore';
const REPO_NAME = 'nova-ops-surface';
const BRANCH = 'master';

async function ghGet(path, token) {
  const r = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/public/${path}?ref=${BRANCH}`,
    { headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' } }
  );
  if (!r.ok) return null;
  const d = await r.json();
  return Buffer.from(d.content, 'base64').toString('utf-8');
}

async function ghList(path, token) {
  const r = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/public/${path}?ref=${BRANCH}`,
    { headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' } }
  );
  if (!r.ok) return [];
  const d = await r.json();
  return Array.isArray(d) ? d.map(i => i.name) : [];
}

function extractHeading(md) {
  if (!md) return '';
  const m = md.match(/^#\s+(.+)/m);
  return m ? m[1].trim() : md.slice(0, 80);
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
    // Read base ecosystem.json
    const ecoRaw = await ghGet('ecosystem.json', token);
    const eco = ecoRaw ? JSON.parse(ecoRaw) : { orchestrator: {}, departments: [], individualAgents: [], projects: [] };

    // Enrich departments with real file contents
    const departments = [];
    for (const dept of eco.departments || []) {
      const files = {};
      for (const f of ['SOUL.md', 'GOAL.md', 'MEMORY.md']) {
        files[f] = await ghGet(`departments/${dept.id}/${f}`, token) || '';
      }
      // Extract summary from GOAL.md
      const goalSummary = extractHeading(files['GOAL.md']);
      departments.push({
        ...dept,
        files,
        lead: { ...dept.lead, currentTask: goalSummary || dept.lead?.currentTask || null }
      });
    }

    // Read kanban.json if it exists
    const kanbanRaw = await ghGet('kanban.json', token);
    const kanban = kanbanRaw ? JSON.parse(kanbanRaw) : null;

    // Read performance
    const perfRaw = await ghGet('PERFORMANCE.md', token);

    return res.status(200).json({
      orchestrator: eco.orchestrator,
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
