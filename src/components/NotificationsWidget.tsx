import React from 'react';

function NotificationsWidget() {
  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h3 className="text-lg font-bold text-gray-800 mb-2">Notifications</h3>
      <ul className="text-gray-600 space-y-2">
        <li><span className="text-red-500 font-bold">High:</span> Database connection error</li>
        <li><span className="text-yellow-500 font-bold">Medium:</span> Disk space low on 'Server-01'</li>
        <li><span className="text-green-500 font-bold">Low:</span> New software update available</li>
      </ul>
    </div>
  );
}

export default NotificationsWidget;
