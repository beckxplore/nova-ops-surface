// Vercel Serverless Function — proxy file operations to Nova API
// GET  /api/files?agent=development           → list files for agent
// PUT  /api/files?agent=development&name=SOUL.md → save file for agent

const NOVA_API_BASE = 'https://3-227-84-30.sslip.io/nova-api';
const AUTH_TOKEN = process.env.NOVA_API_TOKEN || '7dd8ac893a339cb334fb2e5e644a22db16ceeed9baf0ab7a';

export const config = { api: { bodyParser: { sizeLimit: '1mb' } } };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store, no-cache');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const agent = req.query.agent || 'nova';

  try {
    if (req.method === 'GET') {
      const r = await fetch(`${NOVA_API_BASE}/api/files?agent=${encodeURIComponent(agent)}`, {
        headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` },
      });
      const data = await r.json();
      return res.status(r.ok ? 200 : r.status).json(data);
    }

    if (req.method === 'PUT') {
      const name = req.query.name;
      if (!name) return res.status(400).json({ error: 'name query param required' });

      const r = await fetch(`${NOVA_API_BASE}/api/files/${encodeURIComponent(name)}?agent=${encodeURIComponent(agent)}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${AUTH_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(req.body),
      });
      const data = await r.json();
      return res.status(r.ok ? 200 : r.status).json(data);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
