// Vercel Serverless Function — list agents by reading ecosystem.json + department files from GitHub
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

const MODELS = [
  { id: 'openrouter/minimax/minimax-m2.5:free', name: 'MiniMax M2.5 (Free)', alias: 'MiniMax M2.5 (Free)' },
  { id: 'openrouter/xiaomi/mimo-v2-pro', name: 'MiMo-V2-Pro', alias: 'MiMo-V2-Pro' },
  { id: 'openrouter/deepseek/deepseek-v3.2', name: 'DeepSeek V3.2', alias: 'DeepSeek V3.2' },
  { id: 'openrouter/deepseek/deepseek-r1', name: 'DeepSeek R1', alias: 'DeepSeek R1' },
  { id: 'openrouter/stepfun/step-3.5-flash', name: 'Step 3.5 Flash', alias: 'Step 3.5 Flash' },
  { id: 'openrouter/stepfun/step-3.5-flash:free', name: 'Step 3.5 Flash (Free)', alias: 'Step 3.5 Flash (Free)' },
  { id: 'openrouter/anthropic/claude-sonnet-4.6', name: 'Claude Sonnet 4.6', alias: 'Claude Sonnet 4.6' },
  { id: 'openrouter/google/gemini-3-flash-preview', name: 'Gemini 3 Flash', alias: 'Gemini 3 Flash' },
  { id: 'openrouter/openai/gpt-5.4', name: 'GPT-5.4', alias: 'GPT-5.4' },
  { id: 'openrouter/qwen/qwen3-32b', name: 'Qwen3 32B', alias: 'Qwen3 32B' },
  { id: 'auto', name: 'OpenRouter Auto', alias: 'Auto' },
];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.query.route === 'models') return res.status(200).json(MODELS);
  if (req.query.route === 'model') {
    if (req.method === 'PUT') return res.status(200).json({ model: req.body?.model || 'openrouter/xiaomi/mimo-v2-pro', updated: true });
    return res.status(200).json({ model: 'openrouter/xiaomi/mimo-v2-pro' });
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) return res.status(500).json({ error: 'GITHUB_TOKEN not configured' });

  try {
    // Read ecosystem.json for structure
    const ecoRaw = await getFileContent('ecosystem.json', token);
    if (!ecoRaw) return res.status(500).json({ error: 'ecosystem.json not found' });
    const eco = JSON.parse(ecoRaw);

    // Enrich departments with file contents
    const departments = [];
    for (const dept of eco.departments) {
      const files = {};
      for (const f of ['SOUL.md', 'GOAL.md', 'MEMORY.md']) {
        const content = await getFileContent(`departments/${dept.id}/${f}`, token);
        if (content) files[f] = content;
      }
      departments.push({ ...dept, files });
    }

    // Nova orchestrator
    const nova = {
      id: 'nova',
      name: 'Nova (Orchestrator)',
      type: 'orchestrator',
      path: '',
      status: 'running',
      files: {},
    };

    // Read kanban for task counts per agent
    let kanbanRaw;
    try { kanbanRaw = await getFileContent('kanban.json', token); } catch {}
    const kanban = kanbanRaw ? JSON.parse(kanbanRaw) : null;
    const taskCounts = {};
    if (kanban?.columns) {
      for (const col of kanban.columns) {
        for (const task of (col.tasks || [])) {
          const assignee = (task.assignee || 'Unassigned').toLowerCase();
          if (!taskCounts[assignee]) taskCounts[assignee] = { active: 0, done: 0, total: 0 };
          taskCounts[assignee].total++;
          if (col.id === 'done') taskCounts[assignee].done++;
          else taskCounts[assignee].active++;
        }
      }
    }

    return res.status(200).json({
      departments,
      individuals: [nova],
      taskCounts,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
