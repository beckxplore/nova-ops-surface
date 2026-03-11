import React, { useState, useEffect } from 'react';

interface Project {
  id: string;
  name: string;
  owner: string;
  status: string;
}

const statusStyles: Record<string, string> = {
  'In Progress': 'bg-blue-500/10 text-blue-400 ring-blue-500/20',
  'Completed': 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20',
  'On Hold': 'bg-amber-500/10 text-amber-400 ring-amber-500/20',
  'Blocked': 'bg-red-500/10 text-red-400 ring-red-500/20',
};

const ExecutionMatrix: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const response = await fetch('/PROJECTS.md');
        const text = await response.text();
        const parsedProjects: Project[] = [];
        const lines = text.split('\n');
        let currentProject: Partial<Project> = {};
        let projectId = 0;

        for (const line of lines) {
          if (line.startsWith('## ')) {
            if (currentProject.name) {
              parsedProjects.push({ ...currentProject, id: String(projectId++) } as Project);
            }
            currentProject = { name: line.substring(3).trim() };
          } else if (line.startsWith('- Owner: ')) {
            currentProject.owner = line.substring(9).trim();
          } else if (line.startsWith('- Status: ')) {
            currentProject.status = line.substring(10).trim();
          }
        }
        if (currentProject.name) {
          parsedProjects.push({ ...currentProject, id: String(projectId++) } as Project);
        }
        setProjects(parsedProjects);
      } catch (error) {
        console.error('Error fetching PROJECTS.md:', error);
      }
    };
    fetchProjects();
  }, []);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 h-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Execution Matrix</h2>
        <span className="text-xs text-slate-500">{projects.length} projects</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-800">
              <th className="text-left py-3 px-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Project</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Owner</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {projects.map((project) => (
              <tr key={project.id} className="hover:bg-slate-800/30 transition-colors">
                <td className="py-3 px-4">
                  <span className="font-medium text-white">{project.name}</span>
                </td>
                <td className="py-3 px-4 text-sm text-slate-400">{project.owner}</td>
                <td className="py-3 px-4">
                  <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ring-1 ${statusStyles[project.status] || 'bg-slate-500/10 text-slate-400 ring-slate-500/20'}`}>
                    {project.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ExecutionMatrix;
