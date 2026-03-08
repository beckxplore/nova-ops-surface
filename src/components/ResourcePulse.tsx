import React, { useState, useEffect } from 'react';

interface ResourceData {
  departmentActivity: { [key: string]: string };
  specialistSpawns: { [key: string]: string };
}

const ResourcePulse: React.FC = () => {
  const [resourceData, setResourceData] = useState<ResourceData>({
    departmentActivity: {},
    specialistSpawns: {},
  });

  useEffect(() => {
    const fetchResourceData = async () => {
      try {
        const response = await fetch('/PERFORMANCE.md');
        const text = await response.text();
        
        const departmentActivity: { [key: string]: string } = {};
        const specialistSpawns: { [key: string]: string } = {};
        let inDepartmentActivitySection = false;
        let inSpecialistSpawnsSection = false;

        const lines = text.split('\n');
        for (const line of lines) {
          if (line.includes('## Department Activity')) {
            inDepartmentActivitySection = true;
            inSpecialistSpawnsSection = false;
            continue;
          } else if (line.includes('## Specialist Spawns')) {
            inSpecialistSpawnsSection = true;
            inDepartmentActivitySection = false;
            continue;
          } else if (line.startsWith('## ') && (inDepartmentActivitySection || inSpecialistSpawnsSection)) {
            // End of section
            inDepartmentActivitySection = false;
            inSpecialistSpawnsSection = false;
          }

          if (inDepartmentActivitySection && line.trim().startsWith('-')) {
            const [key, value] = line.substring(1).split(':').map(s => s.trim());
            if (key && value) {
              departmentActivity[key] = value;
            }
          } else if (inSpecialistSpawnsSection && line.trim().startsWith('-')) {
            const [key, value] = line.substring(1).split(':').map(s => s.trim());
            if (key && value) {
              specialistSpawns[key] = value;
            }
          }
        }
        setResourceData({ departmentActivity, specialistSpawns });
      } catch (error) {
        console.error('Error fetching or parsing PERFORMANCE.md:', error);
      }
    };

    fetchResourceData();
  }, []);

  return (
    <div className="bg-white shadow p-4 rounded-lg">
      <h2 className="text-xl font-semibold mb-2">Resource Pulse</h2>
      <div className="mb-4">
        <h3 className="text-lg font-medium">Department Activity:</h3>
        {Object.entries(resourceData.departmentActivity).map(([dept, activity]) => (
          <p key={dept}>{dept}: <span className="font-bold">{activity}</span></p>
        ))}
      </div>
      <div>
        <h3 className="text-lg font-medium">Specialist Spawns (Last 24h):</h3>
        {Object.entries(resourceData.specialistSpawns).map(([role, count]) => (
          <p key={role}>{role}: <span className="font-bold">{count}</span></p>
        ))}
      </div>
    </div>
  );
};

export default ResourcePulse;
