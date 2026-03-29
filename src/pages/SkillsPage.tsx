import React, { useState, useEffect } from 'react';
import { getGatewayConfig } from '../gatewayConfig';

interface Skill {
  name: string;
  description: string;
  path: string;
  metadata: { emoji?: string };
}

const SKILL_ICONS: Record<string, string> = {
  healthcheck: '🏥', 'skill-creator': '🛠️', tmux: '🧵', weather: '☔',
};

const SkillsPage: React.FC = () => {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Skill | null>(null);
  const [skillContent, setSkillContent] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const cfg = await getGatewayConfig();
        const wsUrl = cfg.gatewayUrl || '';
        const r = await fetch('/api/status?route=skills', {
          headers: { Authorization: `Bearer ${cfg.authToken}` },
        });
        if (r.ok) {
          const data = await r.json();
          setSkills(data.skills || []);
        }
      } catch { /* fallback */ }
      setLoading(false);
    })();
  }, []);

  const loadSkillDetail = async (skill: Skill) => {
    setSelected(skill);
    setSkillContent('');
    try {
      const cfg = await getGatewayConfig();
      const wsUrl = cfg.gatewayUrl || '';
      const r = await fetch('/api/files?agent=nova', {
        headers: { Authorization: `Bearer ${cfg.authToken}` },
      });
      // Try reading the SKILL.md directly via a different approach
      // For now show description
      setSkillContent(skill.description || 'No description available.');
    } catch {
      setSkillContent(skill.description || 'No description available.');
    }
  };

  const getIcon = (skill: Skill) => skill.metadata?.emoji || SKILL_ICONS[skill.name] || '🧩';

  if (loading) return (
    <div className="p-6 flex items-center justify-center min-h-[400px]">
      <p className="text-slate-500 animate-pulse">Loading skills...</p>
    </div>
  );

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-6 md:mb-8">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white">Skills</h1>
          <p className="text-slate-400 mt-1 text-xs md:text-sm">{skills.length} skills installed &bull; Available to all agents</p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ring-1 bg-emerald-500/10 text-emerald-400 ring-emerald-500/20">
          <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
          {skills.length} Active
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {skills.map(skill => (
          <button
            key={skill.name}
            onClick={() => loadSkillDetail(skill)}
            className={`text-left bg-slate-900 border rounded-xl p-5 transition-all hover:border-slate-600 hover:bg-slate-800/50 ${
              selected?.name === skill.name ? 'border-blue-500/50 ring-1 ring-blue-500/20' : 'border-slate-800'
            }`}
          >
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">{getIcon(skill)}</span>
              <div>
                <h3 className="font-semibold text-white text-sm">{skill.name}</h3>
                <span className="text-[10px] text-emerald-400 uppercase tracking-wider">Installed</span>
              </div>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">{skill.description || 'No description'}</p>
            <div className="mt-3 pt-3 border-t border-slate-800">
              <span className="text-[10px] text-slate-600">Available to: All Agents</span>
            </div>
          </button>
        ))}
      </div>

      {selected && (
        <div className="mt-6 bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{getIcon(selected)}</span>
              <h2 className="text-lg font-bold text-white">{selected.name}</h2>
            </div>
            <button onClick={() => setSelected(null)} className="text-slate-500 hover:text-slate-300 text-sm">✕ Close</button>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed">{skillContent || selected.description}</p>
          <p className="text-[10px] text-slate-600 mt-3">Path: {selected.path}</p>
        </div>
      )}
    </div>
  );
};

export default SkillsPage;
