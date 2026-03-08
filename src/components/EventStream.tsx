import React from 'react';

const mockEvents: string[] = [
  "[2026-03-08 18:50 GMT+3] User request: implement Budget-Aware logic.",
  "[2026-03-08 18:51 GMT+3] SOP.md updated with Budget-Aware logic.",
  "[2026-03-08 18:52 GMT+3] User request: implement Design Governance Rules.",
  "[2026-03-08 18:53 GMT+3] SOP.md updated with Design Governance Rules.",
  "[2026-03-08 18:55 GMT+3] Project nova-ops-surface scaffolded.",
  "[2026-03-08 18:57 GMT+3] Dependencies installed for nova-ops-surface.",
  "[2026-03-08 19:00 GMT+3] Tailwind CSS manually configured.",
  "[2026-03-08 19:05 GMT+3] Git repository initialized and pushed to GitHub.",
  "[2026-03-08 19:08 GMT+3] Executive Summary component integrated.",
  "[2026-03-08 19:10 GMT+3] Execution Matrix component integrated.",
  "[2026-03-08 19:12 GMT+3] Resource Pulse component integrated."
];

const EventStream: React.FC = () => {
  return (
    <div className="bg-white shadow p-4 rounded-lg lg:col-span-3 h-80 overflow-y-auto">
      <h2 className="text-xl font-semibold mb-2">Event Stream</h2>
      <ul className="space-y-2">
        {mockEvents.map((event, index) => (
          <li key={index} className="text-sm text-gray-700">{event}</li>
        ))}
      </ul>
    </div>
  );
};

export default EventStream;
