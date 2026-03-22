import React, { useState, useEffect, useMemo } from 'react';
import mermaid from 'mermaid';
import { 
  detectCausalHandoffs,
  detectBottlenecks,
  type CausalHandoff,
  type ProcessBottleneck
} from '../data/workflow-processor';
import { getLiveWorkflowData } from '../data/live-workflow-fetcher';
import type { WorkflowEvent } from '../data/workflow-processor';
import { valueStreams, userDepartments } from '../data/sample-workflow-data';

const Mermaid = ({ chart }: { chart: string }) => {
  useEffect(() => {
    mermaid.initialize({
      startOnLoad: true,
      theme: 'dark',
      securityLevel: 'loose',
      fontFamily: 'Inter, system-ui, sans-serif',
      themeVariables: {
        primaryColor: '#3b82f6',
        primaryTextColor: '#fff',
        primaryBorderColor: '#1e293b',
        lineColor: '#60a5fa',
        secondaryColor: '#10b981',
        tertiaryColor: '#f59e0b',
      }
    });
    mermaid.contentLoaded();
  }, [chart]);

  return (
    <div className="mermaid bg-[#010409] p-6 rounded-2xl border border-blue-500/20 flex justify-center shadow-[0_0_60px_rgba(59,130,246,0.1)] overflow-x-auto">
      {chart}
    </div>
  );
};

const generateTrueIndustrialGraph = (
  handoffs: CausalHandoff[],
  bottlenecks: ProcessBottleneck[],
  events: WorkflowEvent[]
): string => {
  let graph = 'graph TD\n';
  
  // Define node IDs based on actual tasks from events
  const uniqueTasks = Array.from(new Set(events.map(e => e.task_type)));
  const nodeIds = new Map<string, string>();
  
  uniqueTasks.forEach(task => {
    const id = task.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
    nodeIds.set(task, id);
  });
  
  // Create nodes with duration info
  const taskStats = new Map<string, { avgDuration: number; count: number }>();
  events.forEach(e => {
    const existing = taskStats.get(e.task_type) || { avgDuration: 0, count: 0 };
    taskStats.set(e.task_type, {
      avgDuration: (existing.avgDuration * existing.count + e.duration_seconds) / (existing.count + 1),
      count: existing.count + 1
    });
  });
  
  // Add nodes
  uniqueTasks.forEach(task => {
    const id = nodeIds.get(task)!;
    const stats = taskStats.get(task)!;
    const avgMin = Math.round(stats.avgDuration / 60);
    const isBottleneck = bottlenecks.some(b => b.task_type === task);
    const style = isBottleneck ? 'fill:#78350f,stroke:#f59e0b,stroke-width:4px' : '';
    graph += `    ${id}["${task}<br/><small>avg: ${avgMin}min</small>"]\n`;
    if (style) graph += `    style ${id} ${style}\n`;
  });
  
  // Add edges based on handoffs
  handoffs.forEach((h, idx) => {
    const fromId = nodeIds.get(h.from_task) || h.from_task.replace(/\s+/g, '_');
    const toId = nodeIds.get(h.to_task) || h.to_task.replace(/\s+/g, '_');
    if (!fromId || !toId) return;
    
    const confidencePct = Math.round(h.confidence * 100);
    const lineStyle = h.confidence > 0.85 ? '==>' : h.confidence > 0.7 ? '-->' : '-.->';
    const label = `${Math.round(h.gap_seconds)}s (${confidencePct}%)`;
    
    graph += `    ${fromId} ${lineStyle}|"${label}"| ${toId}\n`;
  });
  
  return graph;
};

export default function RobRoiPage() {
  const [activeView, setActiveView] = useState<'causal' | 'valuestream'>('causal');
  const [useLiveData, setUseLiveData] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<WorkflowEvent[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  // Fetch data on mount
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await getLiveWorkflowData(false);
        setEvents(data);
        setLastUpdated(new Date());
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
        console.error('Data load error:', err);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
    // Refresh every 5 minutes
    const interval = setInterval(loadData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);
  
  // Process data
  const { handoffs, bottlenecks, graphData } = useMemo(() => {
    if (events.length === 0) {
      return { handoffs: [], bottlenecks: [], graphData: 'graph TD\n    A["No data available"]' };
    }
    
    const handoffs = detectCausalHandoffs(events, 300);
    const bottlenecks = detectBottlenecks(events);
    const graphData = generateTrueIndustrialGraph(handoffs, bottlenecks, events);
    
    return { handoffs, bottlenecks, graphData };
  }, [events]);
  
  // Calculate stats
  const stats = useMemo(() => {
    if (events.length === 0) {
      return { totalEvents: 0, handoffCount: 0, bottleneckCount: 0, avgHandoffConfidence: 0, totalContextSwitches: 0 };
    }
    
    const totalEvents = events.length;
    const handoffCount = handoffs.length;
    const bottleneckCount = bottlenecks.length;
    const avgHandoffConfidence = handoffCount > 0 
      ? handoffs.reduce((sum, h) => sum + h.confidence, 0) / handoffCount 
      : 0;
    const totalContextSwitches = events.reduce((sum, e) => sum + e.app_switches, 0);
    
    return { totalEvents, handoffCount, bottleneckCount, avgHandoffConfidence, totalContextSwitches };
  }, [events, handoffs, bottlenecks]);

  // Calculate value stream statistics
  const valueStreamStats = useMemo(() => {
    if (events.length === 0) return [];
    
    // Helper to map event to value stream
    const getValueStreamForEvent = (event: WorkflowEvent): string => {
      // First try to match by task type
      for (const stream of valueStreams) {
        if (stream.tasks.includes(event.task_type)) {
          return stream.name;
        }
      }
      // Then try by user department mapping
      const userDept = userDepartments[event.user_name];
      if (userDept) return userDept;
      // Default to 'Uncategorized'
      return 'Uncategorized';
    };

    // Initialize stats per value stream
    const streamMap = new Map<string, {
      name: string;
      color: string;
      eventCount: number;
      totalDuration: number;
      handoffCount: number;
      bottleneckCount: number;
      avgDuration: number;
      productivityScore: number; // events per hour (normalized)
      userCount: number;
      uniqueUsers: Set<string>;
    }>();

    // Initialize with predefined value streams
    valueStreams.forEach(vs => {
      streamMap.set(vs.name, {
        name: vs.name,
        color: vs.color,
        eventCount: 0,
        totalDuration: 0,
        handoffCount: 0,
        bottleneckCount: 0,
        avgDuration: 0,
        productivityScore: 0,
        userCount: 0,
        uniqueUsers: new Set()
      });
    });

    // Add uncategorized bucket
    streamMap.set('Uncategorized', {
      name: 'Uncategorized',
      color: '#6b7280',
      eventCount: 0,
      totalDuration: 0,
      handoffCount: 0,
      bottleneckCount: 0,
      avgDuration: 0,
      productivityScore: 0,
      userCount: 0,
      uniqueUsers: new Set()
    });

    // Process events
    events.forEach(event => {
      const streamName = getValueStreamForEvent(event);
      const stream = streamMap.get(streamName);
      if (!stream) return;
      
      stream.eventCount++;
      stream.totalDuration += event.duration_seconds;
      stream.uniqueUsers.add(event.user_id || event.user_name);
    });

    // Process handoffs (count handoffs where from_task or to_task belongs to stream)
    handoffs.forEach(handoff => {
      // Determine which streams the handoff involves
      const fromStream = getValueStreamForEvent({ 
        task_type: handoff.from_task, 
        user_name: handoff.from_user 
      } as WorkflowEvent);
      const toStream = getValueStreamForEvent({ 
        task_type: handoff.to_task, 
        user_name: handoff.to_user 
      } as WorkflowEvent);
      
      if (fromStream === toStream) {
        // Intra-stream handoff
        const stream = streamMap.get(fromStream);
        if (stream) stream.handoffCount++;
      } else {
        // Cross-stream handoff - count for both streams
        const from = streamMap.get(fromStream);
        if (from) from.handoffCount++;
        const to = streamMap.get(toStream);
        if (to) to.handoffCount++;
      }
    });

    // Process bottlenecks
    bottlenecks.forEach(bottleneck => {
      const streamName = getValueStreamForEvent({
        task_type: bottleneck.task_type,
        user_name: '' // unknown user
      } as WorkflowEvent);
      const stream = streamMap.get(streamName);
      if (stream) stream.bottleneckCount++;
    });

    // Calculate derived metrics
    const maxEvents = Math.max(...Array.from(streamMap.values()).map(s => s.eventCount), 1);
    
    return Array.from(streamMap.values())
      .filter(stream => stream.eventCount > 0)
      .map(stream => {
        const avgDuration = stream.eventCount > 0 ? stream.totalDuration / stream.eventCount : 0;
        const productivityScore = (stream.eventCount / maxEvents) * 100;
        const userCount = stream.uniqueUsers.size;
        
        return {
          ...stream,
          avgDuration,
          productivityScore,
          userCount,
          uniqueUsers: undefined // Remove Set from output
        };
      })
      .sort((a, b) => b.eventCount - a.eventCount);
  }, [events, handoffs, bottlenecks]);

  return (
    <div className="p-6 bg-[#00050a] min-h-screen">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tighter italic">
            ROB <span className="text-blue-500">ROI</span>
          </h1>
          <p className="text-slate-500 text-xs mt-1 uppercase tracking-widest font-bold">
            True Industrial Process Map — Live Mate Data
          </p>
          {lastUpdated && (
            <p className="text-[10px] text-emerald-400 mt-1 font-mono">
              LIVE • Updated {lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={() => setActiveView('causal')}
            className={`px-4 py-2 rounded-lg text-[10px] uppercase font-black tracking-widest transition-all ${
              activeView === 'causal' 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' 
                : 'bg-slate-900 text-slate-500 hover:text-white'
            }`}
          >
            Causal Map
          </button>
          <button
            onClick={() => setActiveView('valuestream')}
            className={`px-4 py-2 rounded-lg text-[10px] uppercase font-black tracking-widest transition-all ${
              activeView === 'valuestream' 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' 
                : 'bg-slate-900 text-slate-500 hover:text-white'
            }`}
          >
            Value Streams
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-5 gap-4 mb-8">
        <div className="bg-slate-900/40 border border-blue-900/30 p-4 rounded-xl">
          <span className="text-[9px] font-black text-blue-400 uppercase tracking-tighter">Events</span>
          <div className="text-2xl font-black text-white">{stats.totalEvents}</div>
        </div>
        <div className="bg-slate-900/40 border border-emerald-900/30 p-4 rounded-xl">
          <span className="text-[9px] font-black text-emerald-400 uppercase tracking-tighter">Handoffs</span>
          <div className="text-2xl font-black text-white">{stats.handoffCount}</div>
        </div>
        <div className="bg-slate-900/40 border border-amber-900/30 p-4 rounded-xl">
          <span className="text-[9px] font-black text-amber-400 uppercase tracking-tighter">Bottlenecks</span>
          <div className="text-2xl font-black text-white">{stats.bottleneckCount}</div>
        </div>
        <div className="bg-slate-900/40 border border-purple-900/30 p-4 rounded-xl">
          <span className="text-[9px] font-black text-purple-400 uppercase tracking-tighter">Confidence</span>
          <div className="text-2xl font-black text-white">{Math.round(stats.avgHandoffConfidence * 100)}%</div>
        </div>
        <div className="bg-slate-900/40 border border-rose-900/30 p-4 rounded-xl">
          <span className="text-[9px] font-black text-rose-400 uppercase tracking-tighter">Context Switches</span>
          <div className="text-2xl font-black text-white">{stats.totalContextSwitches}</div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-500 border-r-transparent"></div>
            <p className="text-slate-400 mt-4 text-sm">Loading live workflow data from Mate...</p>
          </div>
        </div>
      ) : error ? (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6">
          <h3 className="text-red-400 font-bold mb-2">Error Loading Data</h3>
          <p className="text-red-300 text-sm">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-red-500/20 text-red-400 rounded text-sm hover:bg-red-500/30 transition-colors"
          >
            Retry
          </button>
        </div>
      ) : activeView === 'causal' ? (
        <div className="space-y-8">
          <div className="bg-[#010409] border border-blue-500/10 rounded-2xl p-6 shadow-2xl shadow-black/50">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">🔗 True Causal Network (Live)</h3>
              <span className="text-[10px] text-slate-500 font-mono">
                {events.length} events • {handoffs.length} handoffs detected
              </span>
            </div>
            <Mermaid chart={graphData} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-6">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4">🎯 Causal Handoffs</h3>
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {handoffs.slice(0, 10).map(h => (
                  <div key={h.id} className="p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-white">
                        {h.from_user} → {h.to_user}
                      </span>
                      <span className={`text-[10px] font-mono ${h.confidence > 0.8 ? 'text-emerald-400' : h.confidence > 0.6 ? 'text-amber-400' : 'text-slate-500'}`}>
                        {Math.round(h.confidence * 100)}%
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400">
                      "{h.from_task}" → "{h.to_task}"
                    </div>
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {h.shared_keywords.slice(0, 4).map(kw => (
                        <span key={kw} className="px-2 py-0.5 bg-blue-500/10 text-blue-400 text-[9px] rounded font-mono">
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-6">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4">⚠️ Process Bottlenecks</h3>
              <div className="space-y-2">
                {bottlenecks.length > 0 ? bottlenecks.map(b => (
                  <div key={b.node_id} className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold text-white">{b.task_type}</span>
                      <span className="text-[10px] font-mono text-amber-400">
                        {Math.round(b.wait_time_ratio * 100)}% wait time
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-400">
                      <div>Avg: {Math.round(b.avg_duration_seconds / 60)}min</div>
                      <div>Context Switches: {b.context_switch_count.toFixed(1)}</div>
                    </div>
                  </div>
                )) : (
                  <p className="text-slate-500 text-sm text-center py-8">No bottlenecks detected</p>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-6">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4">📊 Value Stream Statistics</h3>
            <p className="text-slate-400 text-sm mb-6">Productivity metrics per department based on live Mate workflow data.</p>
            
            {valueStreamStats.length === 0 ? (
              <p className="text-slate-500 text-center py-8">No value stream data available yet.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {valueStreamStats.map(stream => {
                  const avgMinutes = Math.round(stream.avgDuration / 60);
                  const totalHours = Math.round(stream.totalDuration / 3600 * 10) / 10;
                  const productivityWidth = Math.round(stream.productivityScore);
                  
                  return (
                    <div 
                      key={stream.name} 
                      className="bg-slate-800/30 border border-slate-700/30 rounded-xl p-5 hover:border-slate-600/50 transition-colors"
                      style={{ borderLeftColor: stream.color, borderLeftWidth: '4px' }}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-sm font-bold text-white">{stream.name}</h4>
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stream.color }}></div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="text-center">
                          <div className="text-2xl font-black text-white">{stream.eventCount}</div>
                          <div className="text-[10px] text-slate-400 uppercase tracking-tighter">Events</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-black text-white">{stream.userCount}</div>
                          <div className="text-[10px] text-slate-400 uppercase tracking-tighter">Users</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-black text-white">{stream.handoffCount}</div>
                          <div className="text-[10px] text-slate-400 uppercase tracking-tighter">Handoffs</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-black text-white">{stream.bottleneckCount}</div>
                          <div className="text-[10px] text-slate-400 uppercase tracking-tighter">Bottlenecks</div>
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        <div>
                          <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                            <span>Avg Duration</span>
                            <span>{avgMinutes} min</span>
                          </div>
                          <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                            <div 
                              className="h-full rounded-full" 
                              style={{ 
                                width: `${Math.min(100, avgMinutes / 2)}%`, 
                                backgroundColor: stream.color 
                              }}
                            ></div>
                          </div>
                        </div>
                        
                        <div>
                          <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                            <span>Productivity</span>
                            <span>{productivityWidth.toFixed(0)}%</span>
                          </div>
                          <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                            <div 
                              className="h-full rounded-full" 
                              style={{ 
                                width: `${productivityWidth}%`, 
                                backgroundColor: stream.color 
                              }}
                            ></div>
                          </div>
                        </div>
                        
                        <div className="pt-2 border-t border-slate-700/50 text-[10px] text-slate-500">
                          <div className="flex justify-between">
                            <span>Total Time:</span>
                            <span className="text-slate-300">{totalHours}h</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Handoff Ratio:</span>
                            <span className="text-slate-300">
                              {stream.eventCount > 0 ? (stream.handoffCount / stream.eventCount).toFixed(2) : 0}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            
            <div className="mt-8 pt-6 border-t border-slate-800/50">
              <h4 className="text-xs font-bold text-slate-300 mb-3">📈 Value Stream Insights</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-[10px] text-slate-400">
                <div className="bg-slate-800/20 p-3 rounded">
                  <div className="font-bold text-slate-300">Highest Productivity</div>
                  <div>{valueStreamStats.length > 0 ? valueStreamStats[0].name : '—'}</div>
                </div>
                <div className="bg-slate-800/20 p-3 rounded">
                  <div className="font-bold text-slate-300">Most Handoffs</div>
                  <div>{valueStreamStats.length > 0 ? [...valueStreamStats].sort((a,b) => b.handoffCount - a.handoffCount)[0].name : '—'}</div>
                </div>
                <div className="bg-slate-800/20 p-3 rounded">
                  <div className="font-bold text-slate-300">Most Bottlenecks</div>
                  <div>{valueStreamStats.length > 0 ? [...valueStreamStats].sort((a,b) => b.bottleneckCount - a.bottleneckCount)[0].name : '—'}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Data Source Note */}
      <div className="mt-8 p-4 bg-slate-900/30 border border-blue-500/10 rounded-xl">
        <div className="text-[10px] text-slate-500 font-mono">
          🔗 Data Source: Mate (Superset API @ 64.227.129.135:8088) • 
          Algorithm: Temporal Proximity (300s) + Keyword Context Matching (Jaccard) • 
          Cached for 5 minutes
        </div>
      </div>
    </div>
  );
}
