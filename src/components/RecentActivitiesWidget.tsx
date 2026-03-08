import React from 'react';

function RecentActivitiesWidget() {
  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h3 className="text-lg font-bold text-gray-800 mb-2">Recent Activities</h3>
      <ul className="list-disc list-inside text-gray-600">
        <li>User 'Beck' logged in (5 mins ago)</li>
        <li>Deployment 'v1.2.3' completed (1 hour ago)</li>
        <li>Error rate spiked by 2% (2 hours ago)</li>
      </ul>
    </div>
  );
}

export default RecentActivitiesWidget;
