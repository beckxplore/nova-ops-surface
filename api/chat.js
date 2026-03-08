// Vercel Serverless — Chat API
// GET /api/chat?session=general — get messages
// POST /api/chat — send message { session, content, source }
// GET /api/chat?list=true — list all sessions
// POST /api/chat?action=create — create session { topic, hashtag, description }

const REPO_OWNER = 'beckxplore';
const REPO_NAME = 'nova-ops-surface';
const BRANCH = 'master';

async function ghGet(path, token) {
  const r = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}?ref=${BRANCH}`,
    { headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' } }
  );
  if (!r.ok) return null;
  const data = await r.json();
  return { content: Buffer.from(data.content, 'base64').toString('utf-8'), sha: data.sha };
}

async function ghPut(path, content, sha, message, token) {
  const r = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`,
    {
      method: 'PUT',
      headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        content: Buffer.from(content, 'utf-8').toString('base64'),
        branch: BRANCH,
        ...(sha ? { sha } : {}),
      }),
    }
  );
  return r.ok;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const token = process.env.GITHUB_TOKEN;
  if (!token) return res.status(500).json({ error: 'GITHUB_TOKEN not configured' });

  // GET — list sessions or get messages
  if (req.method === 'GET') {
    if (req.query.list === 'true') {
      const data = await ghGet('public/chat/sessions.json', token);
      if (!data) return res.status(200).json({ sessions: [] });
      return res.status(200).json(JSON.parse(data.content));
    }

    const session = req.query.session;
    if (!session || session.includes('..') || session.includes('/')) return res.status(400).json({ error: 'Invalid session' });

    const data = await ghGet(`public/chat/${session}.json`, token);
    if (!data) return res.status(200).json({ sessionId: session, messages: [] });
    return res.status(200).json(JSON.parse(data.content));
  }

  // POST — send message or create session
  if (req.method === 'POST') {
    const { action } = req.query;

    // Create new session
    if (action === 'create') {
      const { topic, hashtag, description } = req.body;
      const id = topic.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '');

      // Update sessions.json
      const sessData = await ghGet('public/chat/sessions.json', token);
      const sessions = sessData ? JSON.parse(sessData.content) : { sessions: [] };
      
      if (sessions.sessions.find(s => s.id === id)) {
        return res.status(409).json({ error: 'Session already exists' });
      }

      sessions.sessions.push({
        id, topic, hashtag: hashtag || `#${id}`,
        description: description || '',
        source: 'dashboard',
        lastMessage: null,
        createdAt: new Date().toISOString(),
      });

      await ghPut('public/chat/sessions.json', JSON.stringify(sessions, null, 2), sessData?.sha, `Chat: create session ${id}`, token);

      // Create empty message file
      const msgData = { sessionId: id, messages: [{ id: '1', role: 'system', content: `Session "${topic}" created.`, timestamp: new Date().toISOString(), source: 'system' }] };
      await ghPut(`public/chat/${id}.json`, JSON.stringify(msgData, null, 2), null, `Chat: init ${id}`, token);

      return res.status(201).json({ success: true, session: sessions.sessions[sessions.sessions.length - 1] });
    }

    // Send message
    const { session, content, source } = req.body;
    if (!session || !content) return res.status(400).json({ error: 'session and content required' });
    if (session.includes('..') || session.includes('/')) return res.status(400).json({ error: 'Invalid session' });

    const msgPath = `public/chat/${session}.json`;
    const data = await ghGet(msgPath, token);
    const chat = data ? JSON.parse(data.content) : { sessionId: session, messages: [] };

    const newMsg = {
      id: String(chat.messages.length + 1),
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
      source: source || 'dashboard',
    };
    chat.messages.push(newMsg);

    await ghPut(msgPath, JSON.stringify(chat, null, 2), data?.sha, `Chat: message in ${session}`, token);

    // Update sessions.json lastMessage
    const sessData = await ghGet('public/chat/sessions.json', token);
    if (sessData) {
      const sessions = JSON.parse(sessData.content);
      const sess = sessions.sessions.find(s => s.id === session);
      if (sess) {
        sess.lastMessage = { content: content.substring(0, 80), timestamp: newMsg.timestamp, source: newMsg.source };
        await ghPut('public/chat/sessions.json', JSON.stringify(sessions, null, 2), sessData.sha, `Chat: update lastMsg ${session}`, token);
      }
    }

    return res.status(200).json({ success: true, message: newMsg });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
