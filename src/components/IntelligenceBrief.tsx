import React, { useState, useEffect } from 'react';

interface BriefItem {
  category: 'model-release' | 'industry' | 'devtools' | 'openclaw';
  title: string;
  summary: string;
  source: string;
  date: string;
  priority: 'high' | 'medium' | 'low';
}

interface BriefData {
  generated: string;
  period: string;
  items: BriefItem[];
  stats: { totalItems: number; highPriority: number; categories: Record<string, number> };
}

const CATEGORY_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  'model-release': { label: 'Model Release', icon: '🧠', color: 'bg-purple-500/10 text-purple-400 ring-purple-500/20' },
  'industry': { label: 'Industry', icon: '🏢', color: 'bg-blue-500/10 text-blue-400 ring-blue-500/20' },
  'devtools': { label: 'Dev Tools', icon: '🛠️', color: 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20' },
  'openclaw': { label: 'OpenClaw', icon: '🦞', color: 'bg-amber-500/10 text-amber-400 ring-amber-500/20' },
};

const PRIORITY_STYLES = {
  high: 'border-l-red-500',
  medium: 'border-l-amber-500',
  low: 'border-l-slate-600',
};

export default function IntelligenceBrief() {
  const [brief, setBrief] = useState<BriefData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    const fetchBrief = async () => {
      try {
        const r = await fetch('/brief.json');
        if (r.ok) setBrief(await r.json());
      } catch {}
      setLoading(false);
    };
    fetchBrief();
    const interval = setInterval(fetchBrief, 300000); // 5 min
    return () => clearInterval(interval);
  }, []);

  if (loading) return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <p className="text-slate-500 text-sm animate-pulse">Loading intelligence brief...</p>
    </div>
  );

  if (!brief) return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-white">📡 Intelligence Brief</h2>
        <span className="text-[10px] text-slate-600">No data yet</span>
      </div>
      <p className="text-xs text-slate-500">Research agent is compiling the first briefing. Check back shortly.</p>
    </div>
  );

  const filtered = filter === 'all' ? brief.items : brief.items.filter(i => i.category === filter);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-white">📡 Intelligence Brief</h2>
          <p className="text-[10px] text-slate-500 mt-0.5">{brief.period} • {brief.stats?.totalItems ?? brief.items?.length ?? 0} items</p>
        </div>
        <div className="flex items-center gap-2">
          {(brief.stats?.highPriority ?? 0) > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 ring-1 ring-red-500/20">
              {brief.stats.highPriority} priority
            </span>
          )}
          <span className="text-[10px] text-slate-600">
            Updated {new Date(brief.generated || brief.generatedAt || Date.now()).toLocaleTimeString()}
          </span>
        </div>
      </div>

      {/* Category filter */}
      <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 rounded-md text-[10px] font-medium whitespace-nowrap transition-all ${
            filter === 'all' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'
          }`}
        >All ({brief.stats?.totalItems ?? brief.items?.length ?? 0})</button>
        {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => (
          <button key={key} onClick={() => setFilter(key)}
            className={`px-3 py-1.5 rounded-md text-[10px] font-medium whitespace-nowrap transition-all flex items-center gap-1 ${
              filter === key ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <span>{cfg.icon}</span>
            <span>{cfg.label}</span>
            {brief.stats?.categories?.[key] ? <span className="text-slate-600">({brief.stats.categories[key]})</span> : null}
          </button>
        ))}
      </div>

      {/* News items */}
      <div className="space-y-2 max-h-[420px] overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="text-xs text-slate-600 text-center py-4">No items in this category</p>
        ) : filtered.map((item, i) => {
          const cat = CATEGORY_CONFIG[item.category] || CATEGORY_CONFIG.industry;
          return (
            <div key={i} className={`bg-slate-800/30 rounded-lg p-3 border-l-2 ${PRIORITY_STYLES[item.priority]} hover:bg-slate-800/50 transition-colors`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[9px] px-1.5 py-0.5 rounded ring-1 ${cat.color}`}>{cat.label}</span>
                    {item.priority === 'high' && <span className="text-[9px] text-red-400">🔴</span>}
                    <span className="text-[9px] text-slate-600">{item.date}</span>
                  </div>
                  <h4 className="text-sm text-white font-medium leading-snug">{item.title}</h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">{item.summary}</p>
                </div>
              </div>
              {item.source && (
                <a href={item.source.startsWith('http') ? item.source : '#'} target="_blank" rel="noopener noreferrer"
                  className="text-[9px] text-blue-500 hover:text-blue-400 mt-1.5 inline-block truncate max-w-full">
                  🔗 {item.source.replace(/^https?:\/\//, '').slice(0, 50)}
                </a>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
