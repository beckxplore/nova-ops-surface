// Vercel Serverless Function — get/set current OpenClaw model
const GATEWAY_URL = 'https://3-227-84-30.sslip.io';
const AUTH_TOKEN = '7dd8ac893a339cb334fb2e5e644a22db16ceeed9baf0ab7a';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const headers = {
    Authorization: `Bearer ${AUTH_TOKEN}`,
    'Content-Type': 'application/json',
  };

  try {
    if (req.method === 'GET') {
      // Try to get current model from gateway
      const r = await fetch(`${GATEWAY_URL}/nova-api/api/model`, {
        headers,
        signal: AbortSignal.timeout(5000),
      });
      if (r.ok) {
        const data = await r.json();
        return res.status(200).json(data);
      }
      // Fallback
      return res.status(200).json({ model: 'openrouter/xiaomi/mimo-v2-pro' });
    }

    if (req.method === 'PUT') {
      const { model } = req.body;
      if (!model) return res.status(400).json({ error: 'model required' });

      const r = await fetch(`${GATEWAY_URL}/nova-api/api/model`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ model }),
        signal: AbortSignal.timeout(10000),
      });
      const data = await r.json();
      return res.status(r.ok ? 200 : r.status).json(data);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}