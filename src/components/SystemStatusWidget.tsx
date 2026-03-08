import React from 'react';

function SystemStatusWidget() {
  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h3 className="text-lg font-bold text-gray-800 mb-2">System Status</h3>
      <p className="text-gray-600">All systems operational.</p>
      <p className="text-sm text-gray-500">Last updated: {new Date().toLocaleTimeString()}</p>
    </div>
  );
}

export default SystemStatusWidget;
