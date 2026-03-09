import Header from './components/Header';
import Footer from './components/Footer';
import SystemStatusWidget from './components/SystemStatusWidget';
import RecentActivitiesWidget from './components/RecentActivitiesWidget';
import ResourceUsageWidget from './components/ResourceUsageWidget';
import NetworkActivityWidget from './components/NetworkActivityWidget';
import ServerHealthWidget from './components/ServerHealthWidget';
import QuickLinksWidget from './components/QuickLinksWidget';
import ChatWidget from './components/ChatWidget';

function App() {
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <Header />
      <main className="flex-grow container mx-auto p-4">
        <h2 className="text-2xl font-semibold text-gray-200 mb-4">Dashboard Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <SystemStatusWidget />
          <RecentActivitiesWidget />
          <ResourceUsageWidget />
          <NetworkActivityWidget />
          <ServerHealthWidget />
          <QuickLinksWidget />
        </div>
      </main>
      <Footer />
      <ChatWidget />
    </div>
  );
}

export default App;
