import React, { useState, useEffect } from 'react';

interface Project {
  id: string;
  name: string;
  owner: string;
  status: string;
}

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
          if (line.startsWith('## Project ')) {
            if (currentProject.name) {
              parsedProjects.push({ ...currentProject, id: String(projectId++) } as Project);
            }
            currentProject = { name: line.substring(11).trim() };
          } else if (line.startsWith('- Owner: ')) {
            currentProject.owner = line.substring(9).trim();
          } else if (line.startsWith('- Status: ')) {
            currentProject.status = line.substring(10).trim();
          }
        }
        // Add the last project if it exists
        if (currentProject.name) {
          parsedProjects.push({ ...currentProject, id: String(projectId++) } as Project);
        }
        setProjects(parsedProjects);
      } catch (error) {
        console.error('Error fetching or parsing PROJECTS.md:', error);
      }
    };

    fetchProjects();
  }, []);

  return (
    <div className="bg-white shadow p-4 rounded-lg">
      <h2 className="text-xl font-semibold mb-2">Execution Matrix</h2>
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Project Name</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Owner</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {projects.map((project) => (
            <tr key={project.id}>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{project.name}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{project.owner}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{project.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ExecutionMatrix;
