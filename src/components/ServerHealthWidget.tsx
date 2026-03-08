import React from 'react';

function ServerHealthWidget() {
  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h3 className="text-lg font-bold text-gray-800 mb-2">Server Health</h3>
      <div className="text-gray-600">
        <p>WebServer: <span className="text-green-500 font-bold">Online</span></p>
        <p>Database: <span className="text-green-500 font-bold">Online</span></p>
        <p>Cache: <span className="text-red-500 font-bold">Offline</span></p>
      </div>
    </div>
  );
}

export default ServerHealthWidget;
