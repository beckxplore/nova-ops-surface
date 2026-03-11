// Vercel Serverless Function — read & write files via GitHub API
// GET /api/file?path=departments/development/SOUL.md
// PUT /api/file { path, content }

const REPO_OWNER = 'beckxplore';
const REPO_NAME = 'nova-ops-surface';
const BRANCH = 'master';
const BASE_PATH = 'public'; // files live in public/ in the repo

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const token = process.env.GITHUB_TOKEN;
  if (!token) return res.status(500).json({ error: 'GITHUB_TOKEN not configured' });

  const headers = {
    Authorization: `token ${token}`,
    Accept: 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
  };

  if (req.method === 'GET') {
    const filePath = req.query.path;
    if (!filePath) return res.status(400).json({ error: 'path query param required' });

    // Security: no path traversal
    if (filePath.includes('..')) return res.status(403).json({ error: 'Forbidden' });

    const repoPath = `${BASE_PATH}/${filePath}`;
    try {
      const r = await fetch(
        `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${repoPath}?ref=${BRANCH}`,
        { headers }
      );
      if (!r.ok) return res.status(404).json({ error: 'File not found' });
      const data = await r.json();
      const content = Buffer.from(data.content, 'base64').toString('utf-8');
      return res.status(200).json({ content, path: filePath, sha: data.sha });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === 'PUT') {
    const { path: filePath, content } = req.body;
    if (!filePath || content === undefined) return res.status(400).json({ error: 'path and content required' });
    if (filePath.includes('..')) return res.status(403).json({ error: 'Forbidden' });

    const repoPath = `${BASE_PATH}/${filePath}`;
    try {
      // Get current SHA
      const getR = await fetch(
        `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${repoPath}?ref=${BRANCH}`,
        { headers }
      );
      let sha;
      if (getR.ok) {
        const existing = await getR.json();
        sha = existing.sha;
      }

      // Commit the update
      const putR = await fetch(
        `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${repoPath}`,
        {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            message: `Dashboard edit: ${filePath}`,
            content: Buffer.from(content, 'utf-8').toString('base64'),
            branch: BRANCH,
            ...(sha ? { sha } : {}),
          }),
        }
      );
      if (!putR.ok) {
        const errData = await putR.json();
        return res.status(putR.status).json({ error: errData.message });
      }
      return res.status(200).json({ success: true, path: filePath });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
