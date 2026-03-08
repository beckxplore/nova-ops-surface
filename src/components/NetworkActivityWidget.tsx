import React from 'react';

function NetworkActivityWidget() {
  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h3 className="text-lg font-bold text-gray-800 mb-2">Network Activity</h3>
      <div className="text-gray-600">
        <p>Inbound: 1.2 MB/s</p>
        <p>Outbound: 800 KB/s</p>
        <p>Latency: 25 ms</p>
      </div>
    </div>
  );
}

export default NetworkActivityWidget;
