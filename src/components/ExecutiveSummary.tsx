import React from 'react';

const ExecutiveSummary: React.FC = () => {
  return (
    <div className="bg-white shadow p-4 rounded-lg md:col-span-2 lg:col-span-3">
      <h2 className="text-xl font-semibold mb-2">Executive Summary</h2>
      <div className="flex items-center space-x-4">
        <p className="text-gray-700">System State: <span className="font-bold text-green-600">Operational</span></p>
        <p className="text-gray-700">Active Alerts: <span className="font-bold text-blue-600">0</span></p>
      </div>
      {/* Placeholder for future alert details */}
    </div>
  );
};

export default ExecutiveSummary;
