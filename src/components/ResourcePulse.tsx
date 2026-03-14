import React, { useMemo } from 'react';
import { useGateway } from '../context/GatewayContext';

const ResourcePulse: React.FC = () => {
  const { eco } = useGateway();

  const deptActivity = useMemo(() => {
    if (!eco) return [];
    const departments = eco.departments || [];
    const kanban = eco.kanban;

    return departments.map((dept: any) => {
      // Count tasks assigned to this department from kanban
      let activeTasks = 0;
      let totalTasks = 0;

      if (kanban?.columns) {
        for (const col of kanban.columns) {
          for (const task of col.tasks) {
            if (task.assignee?.toLowerCase() === dept.name?.toLowerCase() ||
                task.assignee?.toLowerCase() === dept.id?.toLowerCase()) {
              totalTasks++;
              if (col.id === 'in-progress' || col.id === 'review') activeTasks++;
            }
          }
        }
      }

      // Determine activity level from agent status + active tasks
      const leadRunning = dept.lead?.status === 'running';
      const subAgentsRunning = (dept.agents || []).filter((a: any) => a.status === 'running').length;
      const agentActivity = leadRunning ? 2 : 0 + subAgentsRunning;

      let level: 'High' | 'Medium' | 'Low' = 'Low';
      if (activeTasks > 0 || agentActivity > 1) level = 'High';
      else if (totalTasks > 0 || agentActivity > 0) level = 'Medium';

      return {
        name: dept.name,
        level,
        activeTasks,
        totalTasks,
        agentsOnline: (leadRunning ? 1 : 0) + subAgentsRunning,
        totalAgents: 1 + (dept.agents?.length || 0),
        currentTask: dept.lead?.currentTask,
      };
    });
  }, [eco]);

  // Task distribution by priority
  const priorityDist = useMemo(() => {
    if (!eco?.kanban?.columns) return { high: 0, medium: 0, low: 0 };
    const counts = { high: 0, medium: 0, low: 0 };
    for (const col of eco.kanban.columns) {
      if (col.id === 'done') continue; // Only count active tasks
      for (const task of col.tasks) {
        const p = (task.priority || 'medium') as keyof typeof counts;
        if (counts[p] !== undefined) counts[p]++;
      }
    }
    return counts;
  }, [eco]);

  // Orchestrator status
  const orchestratorOnline = eco?.orchestrator?.status === 'running';

  const activityColor: Record<string, string> = {
    'High': 'bg-emerald-400',
    'Medium': 'bg-amber-400',
    'Low': 'bg-slate-500',
  };

  const activityWidth: Record<string, string> = {
    'High': '85%',
    'Medium': '50%',
    'Low': '20%',
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 h-full">
      <h2 className="text-lg font-semibold text-white mb-4">Resource Pulse</h2>

      {/* Orchestrator */}
      <div className="mb-5">
        <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Orchestrator</h3>
        <div className="flex items-center justify-between bg-slate-800/30 rounded-lg px-3 py-2.5">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-md bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-[10px]">N</div>
            <span className="text-sm text-slate-300">Nova</span>
          </div>
          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium ring-1 ${
            orchestratorOnline ? 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20' : 'bg-slate-500/10 text-slate-400 ring-slate-500/20'
          }`}>
            <span className={`h-1.5 w-1.5 rounded-full ${orchestratorOnline ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`}></span>
            {orchestratorOnline ? 'Online' : 'Standby'}
          </span>
        </div>
      </div>

      {/* Department Activity */}
      <div className="mb-5">
        <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">Department Activity</h3>
        <div className="space-y-3">
          {deptActivity.map((dept: any) => (
            <div key={dept.name}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-slate-300">{dept.name}</span>
                <div className="flex items-center gap-2">
                  <div className="w-20 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${activityColor[dept.level]}`}
                      style={{ width: activityWidth[dept.level] }}
                    ></div>
                  </div>
                  <span className="text-[10px] text-slate-500 w-10 text-right">{dept.level}</span>
                </div>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-slate-600 ml-0.5">
                <span>{dept.agentsOnline}/{dept.totalAgents} agents</span>
                <span>·</span>
                <span>{dept.activeTasks} active / {dept.totalTasks} tasks</span>
              </div>
              {dept.currentTask && (
                <p className="text-[10px] text-blue-400 mt-0.5 ml-0.5 truncate">▸ {dept.currentTask}</p>
              )}
            </div>
          ))}
          {deptActivity.length === 0 && (
            <p className="text-xs text-slate-600 text-center py-2">No departments configured</p>
          )}
        </div>
      </div>

      {/* Active Task Priority Distribution */}
      <div>
        <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">Active Task Priority</h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between bg-slate-800/30 rounded-lg px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px]">🔴</span>
              <span className="text-sm text-slate-300">High</span>
            </div>
            <span className={`text-sm font-semibold ${priorityDist.high > 0 ? 'text-red-400' : 'text-slate-600'}`}>{priorityDist.high}</span>
          </div>
          <div className="flex items-center justify-between bg-slate-800/30 rounded-lg px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px]">🟡</span>
              <span className="text-sm text-slate-300">Medium</span>
            </div>
            <span className={`text-sm font-semibold ${priorityDist.medium > 0 ? 'text-amber-400' : 'text-slate-600'}`}>{priorityDist.medium}</span>
          </div>
          <div className="flex items-center justify-between bg-slate-800/30 rounded-lg px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px]">⚪</span>
              <span className="text-sm text-slate-300">Low</span>
            </div>
            <span className={`text-sm font-semibold ${priorityDist.low > 0 ? 'text-white' : 'text-slate-600'}`}>{priorityDist.low}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResourcePulse;
