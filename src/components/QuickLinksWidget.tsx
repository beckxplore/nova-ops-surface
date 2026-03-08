import React from 'react';

function QuickLinksWidget() {
  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h3 className="text-lg font-bold text-gray-800 mb-2">Quick Links</h3>
      <ul className="text-blue-600 space-y-2">
        <li><a href="#" className="hover:underline">Documentation</a></li>
        <li><a href="#" className="hover:underline">Alerts Console</a></li>
        <li><a href="#" className="hover:underline">User Management</a></li>
      </ul>
    </div>
  );
}

export default QuickLinksWidget;
