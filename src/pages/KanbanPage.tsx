import React, { useState } from 'react';

interface Task {
  id: string;
  title: string;
  description: string;
  assignee: string;
  priority: 'high' | 'medium' | 'low';
  tags: string[];
  project?: string;
  progress?: number;
  steps?: { label: string; done: boolean }[];
}

interface CronJob {
  id: string;
  name: string;
  schedule: string;
  lastRun?: string;
  nextRun?: string;
  status: 'active' | 'paused';
  target: string;
}

interface Column {
  id: string;
  title: string;
  icon: string;
  color: string;
  tasks: Task[];
}

const initialColumns: Column[] = [
  {
    id: 'backlog', title: 'Backlog', icon: '📥', color: 'border-slate-600',
    tasks: [
      { id: '1', title: 'Local LLM Research', description: 'Evaluate local LLM deployment options', assignee: 'Research', priority: 'medium', tags: ['research', 'ai'], project: 'AI Infrastructure' },
      { id: '2', title: 'AI Workflow Optimization', description: 'Document workflow improvement proposals', assignee: 'Research', priority: 'low', tags: ['research'], project: 'AI Infrastructure' },
    ],
  },
  {
    id: 'in-progress', title: 'In Progress', icon: '🔄', color: 'border-blue-500',
    tasks: [
      { id: '3', title: 'Nova Ops Surface', description: 'Build operational intelligence dashboard', assignee: 'Development', priority: 'high', tags: ['frontend', 'dashboard'], project: 'Nova Platform', progress: 75,
        steps: [
          { label: 'Scaffold React+Vite project', done: true },
          { label: 'Fix Tailwind CSS v4 styling', done: true },
          { label: 'Build Overview page', done: true },
          { label: 'Build Agent Hub with real data', done: true },
          { label: 'Build Kanban board', done: true },
          { label: 'Add cron job management', done: false },
          { label: 'Deploy to Vercel', done: false },
        ]},
      { id: '4', title: 'Heartbeat Monitoring', description: 'Implement 5-min orchestration checks', assignee: 'Nova', priority: 'high', tags: ['ops', 'automation'], project: 'Nova Platform', progress: 60,
        steps: [
          { label: 'Create heartbeat cron job', done: true },
          { label: 'Scan PROJECTS.md for stalled agents', done: true },
          { label: 'Auto-intervene on stalled agents', done: false },
          { label: 'Push status updates to dashboard', done: false },
        ]},
    ],
  },
  {
    id: 'review', title: 'Review', icon: '👀', color: 'border-amber-500',
    tasks: [
      { id: '5', title: 'Vercel Deployment', description: 'Deploy dashboard to Vercel platform', assignee: 'Development', priority: 'high', tags: ['devops'], project: 'Nova Platform', progress: 30,
        steps: [
          { label: 'Create Vercel project', done: true },
          { label: 'Fix branch mismatch (main vs master)', done: false },
          { label: 'Successful production build', done: false },
        ]},
    ],
  },
  {
    id: 'done', title: 'Done', icon: '✅', color: 'border-emerald-500',
    tasks: [
      { id: '6', title: 'Governance Framework', description: 'Initialize departments with SOUL/GOAL/MEMORY', assignee: 'Nova', priority: 'high', tags: ['ops'], project: 'Nova Platform', progress: 100 },
      { id: '7', title: 'SOP Documentation', description: 'Budget-Aware Logic & Design Governance rules', assignee: 'Nova', priority: 'medium', tags: ['docs'], project: 'Nova Platform', progress: 100 },
      { id: '8', title: 'GitHub Repository', description: 'Create and configure nova-ops-surface repo', assignee: 'Development', priority: 'medium', tags: ['devops'], project: 'Nova Platform', progress: 100 },
    ],
  },
];

const initialCronJobs: CronJob[] = [
  { id: 'hb-1', name: 'Orchestration Heartbeat', schedule: 'Every 5 minutes', lastRun: '2026-03-08 22:49 GMT+3', status: 'active', target: 'Main Session' },
];

const priorityConfig: Record<string, { color: string; label: string }> = {
  high: { color: 'bg-red-500/10 text-red-400 ring-red-500/20', label: 'High' },
  medium: { color: 'bg-amber-500/10 text-amber-400 ring-amber-500/20', label: 'Med' },
  low: { color: 'bg-slate-500/10 text-slate-400 ring-slate-500/20', label: 'Low' },
};

const KanbanPage: React.FC = () => {
  const [columns] = useState<Column[]>(initialColumns);
  const [cronJobs] = useState<CronJob[]>(initialCronJobs);
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [showCron, setShowCron] = useState(true);

  const totalTasks = columns.reduce((sum, col) => sum + col.tasks.length, 0);
  const projects = [...new Set(columns.flatMap(c => c.tasks.map(t => t.project).filter(Boolean)))];

  return (
    <div className="p-6 flex flex-col h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Kanban Board</h1>
          <p className="text-slate-400 mt-1 text-sm">{totalTasks} tasks &bull; {projects.length} projects</p>
        </div>
        <div className="flex gap-2">
          {projects.map(p => (
            <span key={p} className="px-2.5 py-1 bg-slate-800 rounded-full text-[10px] text-slate-400 font-medium">{p}</span>
          ))}
        </div>
      </div>

      {/* Cron Jobs Section */}
      <div className="mb-4 shrink-0">
        <button onClick={() => setShowCron(!showCron)} className="flex items-center gap-2 text-sm font-semibold text-white mb-2">
          <span>{showCron ? '▼' : '▸'}</span>
          <span>⏱️ Cron Jobs</span>
          <span className="bg-slate-800 text-slate-400 text-[10px] font-medium px-2 py-0.5 rounded-full">{cronJobs.length}</span>
        </button>
        {showCron && (
          <div className="space-y-2">
            {cronJobs.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 text-center">
                <p className="text-sm text-slate-500">No cron jobs configured</p>
              </div>
            ) : cronJobs.map(job => (
              <div key={job.id} className="bg-slate-900 border border-slate-800 rounded-lg px-4 py-3 flex items-center justify-between hover:border-slate-700 transition-colors">
                <div className="flex items-center gap-4">
                  <span className={`h-2.5 w-2.5 rounded-full ${job.status === 'active' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`}></span>
                  <div>
                    <p className="text-sm font-medium text-white">{job.name}</p>
                    <p className="text-xs text-slate-500">{job.schedule} &bull; Target: {job.target}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {job.lastRun && <span className="text-[10px] text-slate-600">Last: {job.lastRun}</span>}
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ring-1 ${
                    job.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20' : 'bg-slate-500/10 text-slate-400 ring-slate-500/20'
                  }`}>{job.status === 'active' ? 'Active' : 'Paused'}</span>
                  <button className="text-xs text-slate-500 hover:text-blue-400 transition-colors">⚙️</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Board */}
      <div className="flex-1 flex gap-4 overflow-x-auto pb-4">
        {columns.map(column => (
          <div key={column.id} className="w-72 shrink-0 flex flex-col">
            {/* Column Header */}
            <div className={`flex items-center justify-between px-4 py-3 bg-slate-900 border border-slate-800 rounded-t-xl border-t-2 ${column.color}`}>
              <div className="flex items-center gap-2">
                <span className="text-sm">{column.icon}</span>
                <h3 className="text-sm font-semibold text-white">{column.title}</h3>
              </div>
              <span className="bg-slate-800 text-slate-400 text-xs font-medium px-2 py-0.5 rounded-full">{column.tasks.length}</span>
            </div>

            {/* Column Body */}
            <div className="flex-1 bg-slate-900/50 border border-t-0 border-slate-800 rounded-b-xl p-3 space-y-3 overflow-y-auto">
              {column.tasks.map(task => {
                const isExpanded = expandedTask === task.id;
                return (
                  <div
                    key={task.id}
                    className="bg-slate-900 border border-slate-800 rounded-lg p-4 hover:border-slate-700 transition-colors cursor-pointer group"
                    onClick={() => setExpandedTask(isExpanded ? null : task.id)}
                  >
                    {/* Priority + Tags + Project */}
                    <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                      <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ring-1 ${priorityConfig[task.priority].color}`}>
                        {priorityConfig[task.priority].label}
                      </span>
                      {task.tags.map(tag => (
                        <span key={tag} className="text-[10px] text-slate-600 bg-slate-800/50 px-1.5 py-0.5 rounded">{tag}</span>
                      ))}
                    </div>

                    {/* Project Badge */}
                    {task.project && (
                      <p className="text-[10px] text-purple-400 bg-purple-500/10 rounded px-1.5 py-0.5 inline-block mb-2">{task.project}</p>
                    )}

                    {/* Title */}
                    <h4 className="text-sm font-medium text-white mb-1 group-hover:text-blue-400 transition-colors">{task.title}</h4>
                    <p className="text-xs text-slate-500 leading-relaxed">{task.description}</p>

                    {/* Progress Bar */}
                    {task.progress !== undefined && (
                      <div className="mt-3">
                        <div className="flex justify-between text-[10px] mb-1">
                          <span className="text-slate-500">Progress</span>
                          <span className={task.progress === 100 ? 'text-emerald-400' : 'text-blue-400'}>{task.progress}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${task.progress === 100 ? 'bg-emerald-400' : 'bg-blue-400'}`}
                            style={{ width: `${task.progress}%` }}
                          ></div>
                        </div>
                      </div>
                    )}

                    {/* Expanded: Steps */}
                    {isExpanded && task.steps && (
                      <div className="mt-3 pt-3 border-t border-slate-800 space-y-1.5">
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Steps</p>
                        {task.steps.map((step, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <span className={`text-xs ${step.done ? 'text-emerald-400' : 'text-slate-600'}`}>
                              {step.done ? '✓' : '○'}
                            </span>
                            <span className={`text-xs ${step.done ? 'text-slate-400 line-through' : 'text-slate-300'}`}>{step.label}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Assignee + Actions */}
                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-5 w-5 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-[8px] text-white font-bold">
                          {task.assignee[0]}
                        </div>
                        <span className="text-xs text-slate-500">{task.assignee}</span>
                      </div>
                      {column.id === 'in-progress' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); }}
                          className="px-2 py-0.5 text-[10px] text-red-400 bg-red-500/10 ring-1 ring-red-500/20 rounded hover:bg-red-500/20 transition-colors"
                        >
                          Terminate
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default KanbanPage;
