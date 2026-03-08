import React from 'react';
import Header from './components/Header';
import Footer from './components/Footer';

function App() {
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <Header />
      <main className="flex-grow container mx-auto p-4">
        {/* Main dashboard content area - Widgets will go here */}
        <h2 className="text-2xl font-semibold text-gray-700 mb-4">Dashboard Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Example: Future Widget Placeholder */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-lg font-bold text-gray-800">Widget 1</h3>
            <p className="text-gray-600">Data will be displayed here.</p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default App;
