import React, { useState, useEffect } from 'react';

interface ExecutiveSummaryData {
  systemStatus: string;
  activeAlerts: string;
}

const ExecutiveSummary: React.FC = () => {
  const [summaryData, setSummaryData] = useState<ExecutiveSummaryData>({
    systemStatus: 'Unknown',
    activeAlerts: 'Unknown',
  });

  useEffect(() => {
    const fetchPerformanceData = async () => {
      try {
        const response = await fetch('/PERFORMANCE.md');
        const text = await response.text();
        
        let systemStatus = 'Unknown';
        let activeAlerts = 'Unknown';

        const lines = text.split('\n');
        for (const line of lines) {
          if (line.includes('Status:')) {
            systemStatus = line.split('Status:')[1].trim();
          } else if (line.includes('Count:') && line.includes('Active Alerts')) {
            activeAlerts = line.split('Count:')[1].trim();
          }
        }
        setSummaryData({ systemStatus, activeAlerts });
      } catch (error) {
        console.error('Error fetching or parsing PERFORMANCE.md:', error);
      }
    };

    fetchPerformanceData();
  }, []);

  return (
    <div className="bg-white shadow p-4 rounded-lg md:col-span-2 lg:col-span-3">
      <h2 className="text-xl font-semibold mb-2">Executive Summary</h2>
      <div className="flex items-center space-x-4">
        <p className="text-gray-700">System State: <span className="font-bold text-green-600">{summaryData.systemStatus}</span></p>
        <p className="text-gray-700">Active Alerts: <span className="font-bold text-blue-600">{summaryData.activeAlerts}</span></p>
      </div>
    </div>
  );
};

export default ExecutiveSummary;
