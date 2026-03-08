import React from 'react';

interface Project {
  id: string;
  name: string;
  owner: string;
  status: string;
}

const mockProjects: Project[] = [
  { id: '1', name: 'Project Alpha', owner: 'Alice', status: 'In Progress' },
  { id: '2', name: 'Project Beta', owner: 'Bob', status: 'Completed' },
  { id: '3', name: 'Project Gamma', owner: 'Charlie', status: 'On Hold' },
];

const ExecutionMatrix: React.FC = () => {
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
          {mockProjects.map((project) => (
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
