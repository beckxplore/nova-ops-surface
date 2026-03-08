import React, { useState, useEffect } from 'react';

const EventStream: React.FC = () => {
  const [events, setEvents] = useState<string[]>([]);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const response = await fetch('/logs/events.md');
        const text = await response.text();
        const parsedEvents = text.split('\n').filter(line => line.trim() !== '');
        setEvents(parsedEvents);
      } catch (error) {
        console.error('Error fetching or parsing events.md:', error);
      }
    };

    fetchEvents();
  }, []);

  return (
    <div className="bg-white shadow p-4 rounded-lg lg:col-span-3 h-80 overflow-y-auto">
      <h2 className="text-xl font-semibold mb-2">Event Stream</h2>
      <ul className="space-y-2">
        {events.map((event, index) => (
          <li key={index} className="text-sm text-gray-700">{event.replace('- ', '')}</li>
        ))}
      </ul>
    </div>
  );
};

export default EventStream;
