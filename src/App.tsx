import React from 'react';
import Header from './components/Header';
import Footer from './components/Footer';

function App() {
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <Header />
      <main className="flex-grow flex items-center justify-center">
        <h1 className="text-4xl font-bold text-gray-800">Operational Intelligence Dashboard</h1>
      </main>
      <Footer />
    </div>
  );
}

export default App;
