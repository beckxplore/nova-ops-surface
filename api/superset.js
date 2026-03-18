// Vercel Serverless Function — proxy to Superset SQL Lab API
const SUPERSET_URL = 'http://64.227.129.135:8088/api/v1/sqllab/execute/';
const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJmcmVzaCI6dHJ1ZSwiaWF0IjoxNzczMjIyMDk5LCJqdGkiOiI1Y2I4YzA2NS01MTUzLTQxMzgtYWFjZi00N2RmYTIwYmI4NjAiLCJ0eXBlIjoiYWNjZXNzIiwic3ViIjozMSwibmJmIjoxNzczMjIyMDk5LCJjc3JmIjoiNGVhODk0NjktMzRmNy00ZjkxLTg2NTUtNWM4YjI4MDRjYjVlIiwiZXhwIjo0OTI2ODIyMDk5fQ.1gQny-6r_vm3IObZ5idx-Wy1YKJZCm2_X8x7R2AUJJc';
const DB_ID = 6;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { sql, schema = 'main' } = req.body;
    if (!sql) return res.status(400).json({ error: 'sql required' });

    // Generate random client_id (Superset requires uniqueness)
    const clientId = Math.random().toString(36).substring(2, 13);

    const r = await fetch(SUPERSET_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        database_id: DB_ID,
        json: true,
        runAsync: false,
        schema,
        sql,
        tab: 'nova-dashboard',
        expand_data: true,
      }),
    });

    const data = await r.json();
    return res.status(r.ok ? 200 : r.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
