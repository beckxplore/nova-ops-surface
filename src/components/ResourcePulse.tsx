import React, { useState, useEffect } from 'react';

interface ResourceData {
  departmentActivity: { [key: string]: string };
  specialistSpawns: { [key: string]: string };
}

const activityColor: Record<string, string> = {
  'High': 'bg-emerald-400',
  'Medium': 'bg-amber-400',
  'Low': 'bg-slate-500',
};

const ResourcePulse: React.FC = () => {
  const [data, setData] = useState<ResourceData>({
    departmentActivity: {},
    specialistSpawns: {},
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/PERFORMANCE.md');
        const text = await response.text();
        const departmentActivity: { [key: string]: string } = {};
        const specialistSpawns: { [key: string]: string } = {};
        let inDeptSection = false;
        let inSpawnSection = false;

        const lines = text.split('\n');
        for (const line of lines) {
          if (line.includes('## Department Activity')) { inDeptSection = true; inSpawnSection = false; continue; }
          else if (line.includes('## Specialist Spawns')) { inSpawnSection = true; inDeptSection = false; continue; }
          else if (line.startsWith('## ')) { inDeptSection = false; inSpawnSection = false; }

          if (inDeptSection && line.trim().startsWith('-')) {
            const [key, value] = line.substring(1).split(':').map(s => s.trim());
            if (key && value) departmentActivity[key] = value;
          } else if (inSpawnSection && line.trim().startsWith('-')) {
            const [key, value] = line.substring(1).split(':').map(s => s.trim());
            if (key && value) specialistSpawns[key] = value;
          }
        }
        setData({ departmentActivity, specialistSpawns });
      } catch (error) {
        console.error('Error fetching PERFORMANCE.md:', error);
      }
    };
    fetchData();
  }, []);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 h-full">
      <h2 className="text-lg font-semibold text-white mb-4">Resource Pulse</h2>

      {/* Department Activity */}
      <div className="mb-6">
        <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">Department Activity</h3>
        <div className="space-y-3">
          {Object.entries(data.departmentActivity).map(([dept, activity]) => (
            <div key={dept} className="flex items-center justify-between">
              <span className="text-sm text-slate-300">{dept}</span>
              <div className="flex items-center gap-2">
                <div className="w-24 h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${activityColor[activity] || 'bg-slate-600'}`}
                    style={{ width: activity === 'High' ? '90%' : activity === 'Medium' ? '55%' : '25%' }}
                  ></div>
                </div>
                <span className="text-xs text-slate-500 w-14 text-right">{activity}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Specialist Spawns */}
      <div>
        <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">Specialist Spawns (24h)</h3>
        <div className="space-y-2">
          {Object.entries(data.specialistSpawns).map(([role, count]) => (
            <div key={role} className="flex items-center justify-between bg-slate-800/30 rounded-lg px-3 py-2">
              <span className="text-sm text-slate-300">{role}</span>
              <span className={`text-sm font-semibold ${parseInt(count) > 0 ? 'text-white' : 'text-slate-600'}`}>{count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ResourcePulse;
