// Vercel Serverless Function — live ecosystem data from GitHub
const REPO_OWNER = 'beckxplore';
const REPO_NAME = 'nova-ops-surface';
const BRANCH = 'master';

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
  // No CDN cache — always fresh from GitHub
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const token = process.env.GITHUB_TOKEN;
  if (!token) return res.status(500).json({ error: 'GITHUB_TOKEN not configured' });

  try {
    const ecoRaw = await getFileContent('ecosystem.json', token);
    const kanbanRaw = await getFileContent('kanban.json', token);

    const eco = ecoRaw ? JSON.parse(ecoRaw) : { departments: [], individualAgents: [], projects: [] };
    const kanban = kanbanRaw ? JSON.parse(kanbanRaw) : { columns: [] };

    return res.status(200).json({
      timestamp: new Date().toISOString(),
      ecosystem: eco,
      kanban,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
