import React from 'react';
import Header from './components/Header';
import Footer from './components/Footer';
import SystemStatusWidget from './components/SystemStatusWidget';
import RecentActivitiesWidget from './components/RecentActivitiesWidget';
import ResourceUsageWidget from './components/ResourceUsageWidget';
import NetworkActivityWidget from './components/NetworkActivityWidget';
import ServerHealthWidget from './components/ServerHealthWidget';

function App() {
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <Header />
      <main className="flex-grow container mx-auto p-4">
        {/* Main dashboard content area - Widgets will go here */}
        <h2 className="text-2xl font-semibold text-gray-700 mb-4">Dashboard Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <SystemStatusWidget />
          <RecentActivitiesWidget />
          <ResourceUsageWidget />
          <NetworkActivityWidget />
          <ServerHealthWidget />
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default App;
