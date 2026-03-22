import React, { useState, useEffect } from 'react';

interface SpendingData {
  totalCostToday: number;
  monthlyProjection: number;
  topModel: {
    name: string;
    cost: number;
    tokens: number;
  };
  dailyTrend: 'up' | 'down' | 'stable';
  perModelBreakdown: Array<{
    model: string;
    promptTokens: number;
    completionTokens: number;
    cost: number;
  }>;
  lastUpdated: string;
}

const CostsWidget: React.FC = () => {
  const [data, setData] = useState<SpendingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // TODO: Replace with actual API call
    const mockData: SpendingData = {
      totalCostToday: 0.42,
      monthlyProjection: 12.60,
      topModel: {
        name: 'DeepSeek V3.2',
        cost: 0.28,
        tokens: 14000
      },
      dailyTrend: 'up',
      perModelBreakdown: [
        { model: 'DeepSeek V3.2', promptTokens: 8000, completionTokens: 6000, cost: 0.28 },
        { model: 'GLM‑5', promptTokens: 3000, completionTokens: 2000, cost: 0.08 },
        { model: 'Step‑3.5‑Flash', promptTokens: 5000, completionTokens: 1000, cost: 0.03 },
        { model: 'MiniMax M2.5', promptTokens: 2000, completionTokens: 500, cost: 0.02 },
        { model: 'Hunter Alpha', promptTokens: 1000, completionTokens: 500, cost: 0.01 }
      ],
      lastUpdated: new Date().toISOString()
    };

    // Simulate API fetch
    setTimeout(() => {
      setData(mockData);
      setLoading(false);
    }, 300);
  }, []);

  if (loading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base md:text-lg font-semibold text-white">💰 Costs</h2>
          <div className="h-6 w-24 bg-slate-800 rounded animate-pulse"></div>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-4 bg-slate-800 rounded animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 md:p-6">
        <h2 className="text-base md:text-lg font-semibold text-white mb-2">💰 Costs</h2>
        <p className="text-slate-400 text-sm">Daily spending data will appear here after the first Finance Department report (08:00 UTC).</p>
        <p className="text-slate-500 text-xs mt-2">Finance agent: Fiona • Next report: Tomorrow 08:00 UTC</p>
      </div>
    );
  }

  const trendColor = data.dailyTrend === 'up' ? 'text-rose-400' : data.dailyTrend === 'down' ? 'text-emerald-400' : 'text-slate-400';
  const trendIcon = data.dailyTrend === 'up' ? '↗' : data.dailyTrend === 'down' ? '↘' : '→';

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base md:text-lg font-semibold text-white">💰 Costs</h2>
        <span className="text-[10px] text-slate-500 font-mono">
          Updated {new Date(data.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
          <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Today</p>
          <p className="text-xl md:text-2xl font-bold text-white">${data.totalCostToday.toFixed(2)}</p>
          <p className="text-[10px] text-slate-500">USD</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
          <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Month</p>
          <p className="text-xl md:text-2xl font-bold text-white">${data.monthlyProjection.toFixed(2)}</p>
          <p className="text-[10px] text-slate-500">projected</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
          <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Top Model</p>
          <p className="text-sm font-bold text-white truncate">{data.topModel.name}</p>
          <p className="text-[10px] text-slate-500">${data.topModel.cost.toFixed(2)}</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
          <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Trend</p>
          <p className={`text-xl md:text-2xl font-bold ${trendColor}`}>{trendIcon}</p>
          <p className="text-[10px] text-slate-500">vs yesterday</p>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-medium text-slate-300">Per‑Model Breakdown</h3>
        <div className="space-y-1.5">
          {data.perModelBreakdown.slice(0, 3).map((item, idx) => (
            <div key={idx} className="flex items-center justify-between text-sm">
              <div className="flex-1 truncate">
                <span className="text-slate-300">{item.model}</span>
              </div>
              <div className="text-right">
                <div className="text-white font-medium">${item.cost.toFixed(2)}</div>
                <div className="text-[10px] text-slate-500">
                  {((item.promptTokens + item.completionTokens) / 1000).toFixed(1)}k tokens
                </div>
              </div>
            </div>
          ))}
        </div>
        {data.perModelBreakdown.length > 3 && (
          <p className="text-xs text-slate-500 text-center pt-1">
            +{data.perModelBreakdown.length - 3} more models
          </p>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-slate-800">
        <p className="text-xs text-slate-500">
          💡 Daily report generated by <span className="text-slate-300">Finance Department (Fiona)</span> at 08:00 UTC.
          Next report: <span className="text-slate-300">Tomorrow 08:00 UTC</span>.
        </p>
      </div>
    </div>
  );
};

export default CostsWidget;