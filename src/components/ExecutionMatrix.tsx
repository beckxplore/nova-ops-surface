import React, { useMemo } from 'react';
import { useGateway } from '../context/GatewayContext';

interface TaskRow {
  id: string;
  title: string;
  assignee: string;
  status: string;
  priority: string;
  project: string;
  progress?: number;
}

const statusStyles: Record<string, string> = {
  'Backlog': 'bg-slate-500/10 text-slate-400 ring-slate-500/20',
  'In Progress': 'bg-blue-500/10 text-blue-400 ring-blue-500/20',
  'Review': 'bg-amber-500/10 text-amber-400 ring-amber-500/20',
  'Done': 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20',
};

const priorityStyles: Record<string, string> = {
  'high': 'text-red-400',
  'medium': 'text-amber-400',
  'low': 'text-slate-500',
};

const priorityIcons: Record<string, string> = {
  'high': '🔴',
  'medium': '🟡',
  'low': '⚪',
};

const columnToStatus: Record<string, string> = {
  'backlog': 'Backlog',
  'in-progress': 'In Progress',
  'review': 'Review',
  'done': 'Done',
};

const ExecutionMatrix: React.FC = () => {
  const { eco } = useGateway();

  const tasks: TaskRow[] = useMemo(() => {
    if (!eco?.kanban?.columns) return [];
    const rows: TaskRow[] = [];
    for (const col of eco.kanban.columns) {
      const status = columnToStatus[col.id] || col.title;
      for (const task of col.tasks) {
        // Compute progress from steps if available
        let progress = task.progress;
        if (task.steps?.length > 0 && progress === undefined) {
          const doneSteps = task.steps.filter((s: any) => s.done).length;
          progress = Math.round((doneSteps / task.steps.length) * 100);
        }
        if (col.id === 'done') progress = 100;

        rows.push({
          id: task.id,
          title: task.title,
          assignee: task.assignee || 'Unassigned',
          status,
          priority: task.priority || 'medium',
          project: task.project || 'General',
          progress,
        });
      }
    }
    return rows;
  }, [eco]);

  // Group by project
  const projects = useMemo(() => {
    const groups: Record<string, TaskRow[]> = {};
    for (const task of tasks) {
      if (!groups[task.project]) groups[task.project] = [];
      groups[task.project].push(task);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [tasks]);

  const activeTasks = tasks.filter(t => t.status !== 'Done');

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 h-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Execution Matrix</h2>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">{activeTasks.length} active</span>
          <span className="text-xs text-slate-600">·</span>
          <span className="text-xs text-slate-500">{tasks.length} total</span>
        </div>
      </div>

      {tasks.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-slate-500 text-sm">No task data available</p>
          <p className="text-slate-600 text-xs mt-1">Tasks will appear here from the Kanban board</p>
        </div>
      ) : (
        <div className="overflow-x-auto max-h-80 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
          <table className="w-full">
            <thead className="sticky top-0 bg-slate-900 z-10">
              <tr className="border-b border-slate-800">
                <th className="text-left py-3 px-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Task</th>
                <th className="text-left py-3 px-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Assignee</th>
                <th className="text-left py-3 px-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Status</th>
                <th className="text-left py-3 px-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Priority</th>
                <th className="text-left py-3 px-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Progress</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {projects.map(([project, projectTasks]) => (
                <React.Fragment key={project}>
                  {/* Project header row */}
                  <tr className="bg-slate-800/20">
                    <td colSpan={5} className="py-2 px-3">
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">📁 {project}</span>
                      <span className="text-[10px] text-slate-600 ml-2">{projectTasks.length} tasks</span>
                    </td>
                  </tr>
                  {projectTasks.map(task => (
                    <tr key={task.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-2.5 px-3">
                        <span className="font-medium text-white text-sm">{task.title}</span>
                      </td>
                      <td className="py-2.5 px-3 text-xs text-slate-400">{task.assignee}</td>
                      <td className="py-2.5 px-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ring-1 ${statusStyles[task.status] || 'bg-slate-500/10 text-slate-400 ring-slate-500/20'}`}>
                          {task.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="text-xs flex items-center gap-1">
                          <span className="text-[10px]">{priorityIcons[task.priority]}</span>
                          <span className={priorityStyles[task.priority] || 'text-slate-500'}>{task.priority}</span>
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        {task.progress !== undefined ? (
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                  task.progress === 100 ? 'bg-emerald-400' : task.progress > 50 ? 'bg-blue-400' : 'bg-amber-400'
                                }`}
                                style={{ width: `${task.progress}%` }}
                              ></div>
                            </div>
                            <span className="text-[10px] text-slate-500">{task.progress}%</span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-600">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ExecutionMatrix;
