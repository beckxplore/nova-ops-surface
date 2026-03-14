import React, { useState, useEffect, useMemo } from 'react';
import { useGateway } from '../context/GatewayContext';

interface EventItem {
  id: string;
  timestamp: string;
  message: string;
  type: 'system' | 'task' | 'agent' | 'deployment' | 'user';
  icon: string;
}

const EventStream: React.FC = () => {
  const { eco, events: wsEvents } = useGateway();
  const [logEvents, setLogEvents] = useState<EventItem[]>([]);

  // Load historical events from logs
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const response = await fetch('/logs/events.md');
        const text = await response.text();
        const parsed: EventItem[] = text.split('\n')
          .filter(line => line.trim() !== '' && line.startsWith('- '))
          .map((line, i) => {
            const raw = line.replace(/^- /, '');
            const timestampMatch = raw.match(/\[(.+?)\]/);
            const timestamp = timestampMatch ? timestampMatch[1] : '';
            const message = raw.replace(/\[.+?\]\s*/, '');
            return {
              id: `log-${i}`,
              timestamp,
              message,
              type: getEventType(message),
              icon: getEventIcon(message),
            };
          });
        setLogEvents(parsed);
      } catch {
        // No log file, that's fine
      }
    };
    fetchEvents();
  }, []);

  // Generate live events from kanban data
  const kanbanEvents = useMemo<EventItem[]>(() => {
    if (!eco?.kanban?.columns) return [];
    const items: EventItem[] = [];

    for (const col of eco.kanban.columns) {
      for (const task of col.tasks) {
        if (task.createdAt) {
          const date = new Date(task.createdAt);
          const ts = date.toLocaleString('en-US', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Africa/Nairobi'
          }) + ' GMT+3';

          if (col.id === 'done') {
            items.push({
              id: `kanban-done-${task.id}`,
              timestamp: ts,
              message: `Task completed: "${task.title}" by ${task.assignee || 'Unknown'}`,
              type: 'task',
              icon: '✅',
            });
          } else if (col.id === 'in-progress') {
            items.push({
              id: `kanban-ip-${task.id}`,
              timestamp: ts,
              message: `Task started: "${task.title}" assigned to ${task.assignee || 'Unknown'}`,
              type: 'task',
              icon: '🔄',
            });
          }
        }
      }
    }

    return items.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }, [eco]);

  // WebSocket live events
  const liveEvents = useMemo<EventItem[]>(() => {
    return wsEvents.map((evt: any, i: number) => ({
      id: `ws-${i}`,
      timestamp: new Date().toLocaleString('en-US', {
        hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Africa/Nairobi'
      }) + ' GMT+3',
      message: evt.message || evt.text || JSON.stringify(evt).slice(0, 100),
      type: 'system' as const,
      icon: '📡',
    }));
  }, [wsEvents]);

  // Merge all events, dedup by message similarity, sort by timestamp desc
  const allEvents = useMemo(() => {
    const merged = [...liveEvents, ...kanbanEvents, ...logEvents];
    // Sort newest first
    merged.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    // Take latest 50
    return merged.slice(0, 50);
  }, [liveEvents, kanbanEvents, logEvents]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Event Stream</h2>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">{allEvents.length} events</span>
          {liveEvents.length > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              LIVE
            </span>
          )}
        </div>
      </div>
      <div className="max-h-72 overflow-y-auto pr-2 space-y-0.5 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900">
        {allEvents.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-slate-500 text-sm">No events yet</p>
            <p className="text-slate-600 text-xs mt-1">Events will appear as the system operates</p>
          </div>
        ) : allEvents.map(event => (
          <div key={event.id} className="flex items-start gap-3 py-2 px-3 rounded-lg hover:bg-slate-800/30 transition-colors group">
            <span className="text-sm mt-0.5 shrink-0">{event.icon}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-slate-300 leading-relaxed">{event.message}</p>
              {event.timestamp && (
                <p className="text-[10px] text-slate-600 mt-0.5 group-hover:text-slate-500">{event.timestamp}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

function getEventType(msg: string): EventItem['type'] {
  if (msg.match(/error|failed|stalled/i)) return 'system';
  if (msg.match(/task|project|completed/i)) return 'task';
  if (msg.match(/agent|spawn|heartbeat/i)) return 'agent';
  if (msg.match(/vercel|deploy|build/i)) return 'deployment';
  if (msg.match(/user|login/i)) return 'user';
  return 'system';
}

function getEventIcon(msg: string): string {
  if (msg.match(/error|failed/i)) return '🔴';
  if (msg.match(/fix|resolved/i)) return '🟢';
  if (msg.match(/heartbeat|check/i)) return '💓';
  if (msg.match(/created|initialized/i)) return '🚀';
  if (msg.match(/updated|refreshed/i)) return '🔄';
  if (msg.match(/vercel|deploy/i)) return '☁️';
  if (msg.match(/user|login/i)) return '👤';
  if (msg.match(/debug/i)) return '🔧';
  return '📋';
}

export default EventStream;
