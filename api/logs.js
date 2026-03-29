// Vercel Serverless Function — proxy system logs from gateway
const GATEWAY_URL = 'https://3-227-84-30.sslip.io';
const AUTH_TOKEN = '7dd8ac893a339cb334fb2e5e644a22db16ceeed9baf0ab7a';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { lines = '50', level } = req.query;

  // Try fetching from gateway
  try {
    const params = new URLSearchParams();
    if (lines) params.set('lines', lines);
    if (level) params.set('level', level);

    const r = await fetch(`${GATEWAY_URL}/nova-api/logs?${params.toString()}`, {
      headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
      signal: AbortSignal.timeout(10000),
    });

    if (r.ok) {
      const data = await r.json();
      return res.status(200).json(data);
    }
  } catch {}

  // Fallback: return cron job logs
  try {
    const r = await fetch(`${GATEWAY_URL}/nova-api/api/tasks`, {
      headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
      signal: AbortSignal.timeout(5000),
    });

    if (r.ok) {
      const tasks = await r.json();
      const recentTasks = [];

      // Extract recent tasks as log entries
      for (const col of Object.values(tasks.columns || {})) {
        for (const task of (col || [])) {
          recentTasks.push({
            timestamp: task.doneAt || task.createdAt || new Date().toISOString(),
            level: 'info',
            message: task.title,
            source: task.assignee || 'system',
          });
        }
      }

      // Sort by timestamp descending
      recentTasks.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      return res.status(200).json({
        logs: recentTasks.slice(0, parseInt(lines) || 50),
        source: 'kanban-fallback',
        timestamp: new Date().toISOString(),
      });
    }
  } catch {}

  // Final fallback
  return res.status(200).json({
    logs: [
      {
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'Gateway logs endpoint not available. Use gateway CLI: openclaw logs --follow',
        source: 'fallback',
      },
    ],
    source: 'fallback',
    note: 'Live logs require gateway /nova-api/logs endpoint',
  });
}