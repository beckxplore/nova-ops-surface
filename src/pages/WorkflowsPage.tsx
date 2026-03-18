import React, { useState, useEffect } from 'react';

interface WorkflowRow {
  id: string;
  name?: string;
  status?: string;
  id_employee?: string;
  source_user?: string;
  intent?: string;
  trigger?: string;
  temporal_level?: string;
  [key: string]: any;
}

const QUERIES = {
  tables: "SELECT name FROM sqlite_master WHERE type='table';",
  recentWorkflows: "SELECT id, name, status, id_employee, source_user, intent, trigger, temporal_level FROM workflows ORDER BY rowid DESC LIMIT 50;",
  workflowStats: "SELECT status, COUNT(*) as count FROM workflows GROUP BY status;",
  employeeActivity: "SELECT id_employee, source_user, COUNT(*) as workflow_count FROM workflows GROUP BY id_employee, source_user ORDER BY workflow_count DESC LIMIT 20;",
};

export default function WorkflowsPage() {
  const [data, setData] = useState<WorkflowRow[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeQuery, setActiveQuery] = useState<string>('recentWorkflows');
  const [customSql, setCustomSql] = useState('');

  const runQuery = async (sql: string) => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch('/api/superset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql }),
      });
      const result = await r.json();
      if (result.errors?.length) {
        setError(result.errors[0].message);
        setData([]);
        setColumns([]);
      } else {
        setData(result.data || []);
        setColumns((result.columns || []).map((c: any) => c.name));
      }
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    runQuery(QUERIES.recentWorkflows);
  }, []);

  const handlePresetClick = (key: string) => {
    setActiveQuery(key);
    runQuery(QUERIES[key as keyof typeof QUERIES]);
  };

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-6 md:mb-8">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white">🔄 Workflows</h1>
          <p className="text-slate-400 mt-1 text-xs md:text-sm">Live database from Superset &bull; Mate Workflow Engine</p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ring-1 bg-emerald-500/10 text-emerald-400 ring-emerald-500/20">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
          DB Connected
        </span>
      </div>

      {/* Query presets */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {Object.entries({ recentWorkflows: 'Recent Workflows', workflowStats: 'Status Stats', employeeActivity: 'Employee Activity' }).map(([key, label]) => (
          <button key={key} onClick={() => handlePresetClick(key)}
            className={`px-3 py-2 rounded-lg text-xs font-medium transition-all min-h-[44px] ${
              activeQuery === key ? 'bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/30' : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* Custom SQL */}
      <div className="mb-4 flex gap-2">
        <input value={customSql} onChange={e => setCustomSql(e.target.value)}
          placeholder="Custom SQL query..."
          className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:ring-1 focus:ring-blue-500/50" />
        <button onClick={() => { setActiveQuery('custom'); runQuery(customSql); }}
          disabled={!customSql.trim() || loading}
          className="px-4 py-2 bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20 rounded-lg text-xs font-medium hover:bg-blue-500/20 disabled:opacity-50 min-h-[44px]">
          Run
        </button>
      </div>

      {error && <div className="mb-4 bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm text-red-400">{error}</div>}

      {loading && <p className="text-slate-500 text-sm animate-pulse py-8 text-center">Running query...</p>}

      {!loading && data.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800">
                  {columns.map(col => (
                    <th key={col} className="text-left py-3 px-3 text-[10px] font-medium text-slate-400 uppercase tracking-wider whitespace-nowrap">
                      {col.replace(/_/g, ' ')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {data.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                    {columns.map(col => (
                      <td key={col} className="py-2 px-3 text-xs text-slate-300 whitespace-nowrap max-w-[200px] truncate">
                        {row[col] !== null && row[col] !== undefined ? String(row[col]) : '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-slate-800 px-4 py-2">
            <span className="text-[10px] text-slate-600">{data.length} rows returned</span>
          </div>
        </div>
      )}
    </div>
  );
}
