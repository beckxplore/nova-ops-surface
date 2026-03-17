// Vercel Serverless Function — proxy to Nova API comms endpoint
const NOVA_API_BASE = 'https://3-227-84-30.sslip.io/nova-api';
const AUTH_TOKEN = process.env.NOVA_API_TOKEN || '7dd8ac893a339cb334fb2e5e644a22db16ceeed9baf0ab7a';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      const since = req.query.since ? `?since=${encodeURIComponent(req.query.since)}` : '';
      const r = await fetch(`${NOVA_API_BASE}/api/comms${since}`, {
        headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` },
      });
      const data = await r.json();
      return res.status(r.ok ? 200 : r.status).json(data);
    }

    if (req.method === 'POST') {
      const r = await fetch(`${NOVA_API_BASE}/api/comms`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${AUTH_TOKEN}`, 'Content-Type': 'application/json' },
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
