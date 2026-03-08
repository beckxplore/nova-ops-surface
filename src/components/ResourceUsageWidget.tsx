import React from 'react';

function ResourceUsageWidget() {
  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h3 className="text-lg font-bold text-gray-800 mb-2">Resource Usage</h3>
      <div className="text-gray-600">
        <p>CPU: 45%</p>
        <p>Memory: 60%</p>
        <p>Disk: 72%</p>
      </div>
    </div>
  );
}

export default ResourceUsageWidget;
