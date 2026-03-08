import './App.css'
import ExecutiveSummary from './components/ExecutiveSummary';
import ExecutionMatrix from './components/ExecutionMatrix';
import ResourcePulse from './components/ResourcePulse';
import EventStream from './components/EventStream';





function App() {
  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <header className="bg-white shadow p-4 rounded-lg mb-4">
        <h1 className="text-2xl font-bold text-gray-800">Operational Intelligence Surface</h1>
      </header>
      <main className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Modules will go here */}
        <ExecutiveSummary />
        <ExecutionMatrix />
        <ResourcePulse />
        <EventStream />
      </main>
    </div>
  )
}

export default App
