// Vercel Serverless Function — proxy task operations to Nova API
// GET    /api/tasks                  → list all tasks by column
// POST   /api/tasks                  → create a task
// PUT    /api/tasks?id=<id>          → update task fields
// POST   /api/tasks?id=<id>&action=move → move task to column
// POST   /api/tasks?id=<id>&action=step → toggle step
// DELETE /api/tasks?id=<id>         → delete task
//
// NOTE: SSE stream (/api/tasks/stream) is NOT proxied here.
//       The dashboard connects directly to https://3-227-84-30.sslip.io/nova-api/api/tasks/stream

const NOVA_API_BASE = 'https://3-227-84-30.sslip.io/nova-api';
const AUTH_TOKEN = process.env.NOVA_API_TOKEN || '7dd8ac893a339cb334fb2e5e644a22db16ceeed9baf0ab7a';

export const config = { api: { bodyParser: { sizeLimit: '1mb' } } };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store, no-cache');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id, action } = req.query;
  const authHeader = { Authorization: `Bearer ${AUTH_TOKEN}` };

  try {
    // GET /api/tasks — list all tasks
    if (req.method === 'GET' && !id) {
      const r = await fetch(`${NOVA_API_BASE}/api/tasks`, { headers: authHeader });
      const data = await r.json();
      return res.status(r.ok ? 200 : r.status).json(data);
    }

    // POST /api/tasks — create task
    if (req.method === 'POST' && !id) {
      const r = await fetch(`${NOVA_API_BASE}/api/tasks`, {
        method: 'POST',
        headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body),
      });
      const data = await r.json();
      return res.status(r.ok ? 200 : r.status).json(data);
    }

    // PUT /api/tasks?id=<id> — update task
    if (req.method === 'PUT' && id) {
      const r = await fetch(`${NOVA_API_BASE}/api/tasks/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body),
      });
      const data = await r.json();
      return res.status(r.ok ? 200 : r.status).json(data);
    }

    // DELETE /api/tasks?id=<id> — delete task
    if (req.method === 'DELETE' && id) {
      const r = await fetch(`${NOVA_API_BASE}/api/tasks/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: authHeader,
      });
      const data = await r.json();
      return res.status(r.ok ? 200 : r.status).json(data);
    }

    // POST /api/tasks?id=<id>&action=move — move task
    if (req.method === 'POST' && id && action === 'move') {
      const r = await fetch(`${NOVA_API_BASE}/api/tasks/${encodeURIComponent(id)}/move`, {
        method: 'POST',
        headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body),
      });
      const data = await r.json();
      return res.status(r.ok ? 200 : r.status).json(data);
    }

    // POST /api/tasks?id=<id>&action=step — toggle step
    if (req.method === 'POST' && id && action === 'step') {
      const r = await fetch(`${NOVA_API_BASE}/api/tasks/${encodeURIComponent(id)}/step`, {
        method: 'POST',
        headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body),
      });
      const data = await r.json();
      return res.status(r.ok ? 200 : r.status).json(data);
    }

    return res.status(405).json({ error: 'Method not allowed or missing params' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
