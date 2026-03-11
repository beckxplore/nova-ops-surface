import React, { useState, useEffect } from 'react';

const EventStream: React.FC = () => {
  const [events, setEvents] = useState<string[]>([]);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const response = await fetch('/logs/events.md');
        const text = await response.text();
        const parsedEvents = text.split('\n')
          .filter(line => line.trim() !== '')
          .map(line => line.replace(/^- /, ''));
        setEvents(parsedEvents);
      } catch (error) {
        console.error('Error fetching events.md:', error);
      }
    };
    fetchEvents();
  }, []);

  const getEventIcon = (event: string) => {
    if (event.includes('error') || event.includes('Error') || event.includes('failed')) return '🔴';
    if (event.includes('Fix') || event.includes('fix') || event.includes('resolved')) return '🟢';
    if (event.includes('Heartbeat') || event.includes('check')) return '💓';
    if (event.includes('created') || event.includes('initialized')) return '🚀';
    if (event.includes('updated') || event.includes('refreshed')) return '🔄';
    if (event.includes('Vercel') || event.includes('deployment')) return '☁️';
    if (event.includes('User')) return '👤';
    return '📋';
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Event Stream</h2>
        <span className="text-xs text-slate-500">{events.length} events</span>
      </div>
      <div className="max-h-72 overflow-y-auto pr-2 space-y-1 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900">
        {events.slice().reverse().map((event, index) => {
          const timestampMatch = event.match(/\[(.+?)\]/);
          const timestamp = timestampMatch ? timestampMatch[1] : '';
          const message = event.replace(/\[.+?\]\s*/, '');

          return (
            <div key={index} className="flex items-start gap-3 py-2 px-3 rounded-lg hover:bg-slate-800/30 transition-colors group">
              <span className="text-sm mt-0.5 shrink-0">{getEventIcon(event)}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-slate-300 leading-relaxed">{message}</p>
                {timestamp && (
                  <p className="text-xs text-slate-600 mt-0.5 group-hover:text-slate-500">{timestamp}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default EventStream;
