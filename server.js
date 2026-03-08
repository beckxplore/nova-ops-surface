import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE = path.resolve(__dirname, '../../../');
const DEPARTMENTS_DIR = path.join(WORKSPACE, 'departments');

const app = express();
app.use(cors());
app.use(express.json());

// GET /api/agents - List all departments and their sub-agents
app.get('/api/agents', async (req, res) => {
  try {
    const departments = [];
    const entries = await fs.readdir(DEPARTMENTS_DIR, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const deptPath = path.join(DEPARTMENTS_DIR, entry.name);
      const dept = {
        id: entry.name,
        name: entry.name.charAt(0).toUpperCase() + entry.name.slice(1),
        type: 'department',
        path: `departments/${entry.name}`,
        files: {},
        subAgents: [],
        status: 'idle',
      };

      // Read department MD files
      for (const file of ['SOUL.md', 'GOAL.md', 'MEMORY.md']) {
        try {
          const content = await fs.readFile(path.join(deptPath, file), 'utf-8');
          dept.files[file] = content;
        } catch { dept.files[file] = ''; }
      }

      // Read skills
      try {
        const skills = await fs.readdir(path.join(deptPath, 'skills'));
        dept.files['skills'] = skills.filter(s => s.endsWith('.js') || s.endsWith('.ts'));
      } catch { dept.files['skills'] = []; }

      // Check for sub-agents (subdirectories inside department)
      try {
        const subEntries = await fs.readdir(deptPath, { withFileTypes: true });
        for (const sub of subEntries) {
          if (!sub.isDirectory() || sub.name === 'skills') continue;
          const subPath = path.join(deptPath, sub.name);
          const subAgent = {
            id: `${entry.name}-${sub.name}`,
            name: sub.name.charAt(0).toUpperCase() + sub.name.slice(1),
            type: 'sub-agent',
            department: entry.name,
            path: `departments/${entry.name}/${sub.name}`,
            files: {},
            status: 'idle',
          };
          for (const file of ['SOUL.md', 'GOAL.md', 'MEMORY.md']) {
            try {
              const content = await fs.readFile(path.join(subPath, file), 'utf-8');
              subAgent.files[file] = content;
            } catch { subAgent.files[file] = ''; }
          }
          try {
            const skills = await fs.readdir(path.join(subPath, 'skills'));
            subAgent.files['skills'] = skills.filter(s => s.endsWith('.js') || s.endsWith('.ts'));
          } catch { subAgent.files['skills'] = []; }
          dept.subAgents.push(subAgent);
        }
      } catch {}

      departments.push(dept);
    }

    // Add Nova orchestrator as individual agent
    const nova = {
      id: 'nova-orchestrator',
      name: 'Nova (Orchestrator)',
      type: 'individual',
      path: '',
      files: {},
      status: 'running',
    };
    for (const file of ['SOUL.md', 'IDENTITY.md', 'USER.md']) {
      try {
        const content = await fs.readFile(path.join(WORKSPACE, file), 'utf-8');
        nova.files[file] = content;
      } catch { nova.files[file] = ''; }
    }
    try {
      const memoryDir = path.join(WORKSPACE, 'memory');
      const memFiles = await fs.readdir(memoryDir);
      const latest = memFiles.filter(f => f.endsWith('.md')).sort().pop();
      if (latest) {
        nova.files['MEMORY.md'] = await fs.readFile(path.join(memoryDir, latest), 'utf-8');
      }
    } catch { nova.files['MEMORY.md'] = ''; }

    res.json({ departments, individuals: [nova] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/file?path=departments/development/SOUL.md
app.get('/api/file', async (req, res) => {
  try {
    const filePath = path.join(WORKSPACE, req.query.path);
    // Security: ensure path stays within workspace
    if (!filePath.startsWith(WORKSPACE)) return res.status(403).json({ error: 'Forbidden' });
    const content = await fs.readFile(filePath, 'utf-8');
    res.json({ content, path: req.query.path });
  } catch (err) {
    res.status(404).json({ error: 'File not found' });
  }
});

// PUT /api/file - Save edited MD file
app.put('/api/file', async (req, res) => {
  try {
    const { path: filePath, content } = req.body;
    const fullPath = path.join(WORKSPACE, filePath);
    if (!fullPath.startsWith(WORKSPACE)) return res.status(403).json({ error: 'Forbidden' });

    await fs.writeFile(fullPath, content, 'utf-8');

    // Log the edit to events
    const timestamp = new Date().toISOString();
    const eventsPath = path.join(__dirname, 'public/logs/events.md');
    try {
      await fs.appendFile(eventsPath, `\n- [${timestamp}] Dashboard: CEO edited ${filePath}`);
    } catch {}

    res.json({ success: true, path: filePath });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/cron-jobs - placeholder for cron job listing
app.get('/api/cron-jobs', async (req, res) => {
  res.json({ jobs: [] });
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Nova API server running on http://localhost:${PORT}`);
});
