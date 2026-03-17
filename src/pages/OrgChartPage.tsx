import React, { useState, useEffect } from 'react';
import { getGatewayConfig } from '../gatewayConfig';

interface AgentInfo {
  name: string;
  status: string;
  role?: string;
  skills?: string[];
  taskCount?: number;
  completedTasks?: number;
}

interface DepartmentInfo {
  name: string;
  lead: AgentInfo;
  agents: AgentInfo[];
}

interface EcosystemData {
  orchestrator: AgentInfo;
  departments: DepartmentInfo[];
  individualAgents: AgentInfo[];
}

interface OrgNode {
  id: string;
  name: string;
  role: string;
  level: number;
  status: string;
  description: string;
  tasksAssigned: number;
  tasksCompleted: number;
  skills: string[];
  files: string[];
  children: OrgNode[];
  gradient: string;
  icon: string;
}

const LEVEL_GRADIENTS = [
  'from-amber-500 to-yellow-600',    // Level 0: CEO
  'from-blue-500 to-purple-600',     // Level 1: Orchestrator
  'from-emerald-500 to-teal-600',    // Level 2: Departments
  'from-slate-500 to-slate-600',     // Level 3: Future
];

const LEVEL_ICONS = ['👑', '🧠', '🏢', '👤'];

const OrgChartPage: React.FC = () => {
  const [eco, setEco] = useState<EcosystemData | null>(null);
  const [selectedNode, setSelectedNode] = useState<OrgNode | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/ecosystem');
        if (res.ok && !cancelled) {
          const data = await res.json();
          setEco(data.ecosystem || data);
        }
      } catch (e) {
        console.error('Failed to load ecosystem:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Build tree from ecosystem data
  const buildTree = (): OrgNode => {
    const deptChildren: OrgNode[] = eco
      ? eco.departments.map((dept, i) => ({
          id: `dept-${i}`,
          name: dept.name,
          role: 'Department',
          level: 2,
          status: dept.lead.status || 'idle',
          description: `Led by ${dept.lead.name}. ${dept.agents.length} team member${dept.agents.length !== 1 ? 's' : ''}.`,
          tasksAssigned: (dept.lead.taskCount || 0) + dept.agents.reduce((s, a) => s + (a.taskCount || 0), 0),
          tasksCompleted: (dept.lead.completedTasks || 0) + dept.agents.reduce((s, a) => s + (a.completedTasks || 0), 0),
          skills: dept.lead.skills || [],
          files: [],
          gradient: LEVEL_GRADIENTS[2],
          icon: LEVEL_ICONS[2],
          children: [
            {
              id: `lead-${i}`,
              name: dept.lead.name,
              role: `${dept.name.replace(' Department', '')} Lead`,
              level: 3,
              status: dept.lead.status || 'idle',
              description: `Lead agent for ${dept.name}. Manages ${dept.agents.length} team member${dept.agents.length !== 1 ? 's' : ''}.`,
              tasksAssigned: dept.lead.taskCount || 0,
              tasksCompleted: dept.lead.completedTasks || 0,
              skills: dept.lead.skills || [],
              files: [],
              gradient: LEVEL_GRADIENTS[3],
              icon: '👤',
              children: [],
            },
            ...dept.agents.map((agent, j) => ({
              id: `agent-${i}-${j}`,
              name: agent.name,
              role: agent.role || 'Agent',
              level: 3,
              status: agent.status || 'idle',
              description: `Team member in ${dept.name}.`,
              tasksAssigned: agent.taskCount || 0,
              tasksCompleted: agent.completedTasks || 0,
              skills: agent.skills || [],
              files: [],
              gradient: LEVEL_GRADIENTS[3],
              icon: '👤',
              children: [],
            })),
          ],
        }))
      : [];

    return {
      id: 'ceo',
      name: 'Beck',
      role: 'CEO',
      level: 0,
      status: 'running',
      description: 'Chief Executive Officer. Oversees the entire Nova AI ecosystem.',
      tasksAssigned: 0,
      tasksCompleted: 0,
      skills: [],
      files: [],
      gradient: LEVEL_GRADIENTS[0],
      icon: LEVEL_ICONS[0],
      children: [
        {
          id: 'orchestrator',
          name: 'Nova',
          role: 'Orchestrator',
          level: 1,
          status: eco?.orchestrator.status || 'running',
          description: 'Central AI orchestrator. Coordinates all departments and agents.',
          tasksAssigned: eco?.orchestrator.taskCount || 0,
          tasksCompleted: eco?.orchestrator.completedTasks || 0,
          skills: eco?.orchestrator.skills || [],
          files: [],
          gradient: LEVEL_GRADIENTS[1],
          icon: LEVEL_ICONS[1],
          children: deptChildren,
        },
      ],
    };
  };

  const tree = eco ? buildTree() : null;

  const StatusBadge: React.FC<{ status: string }> = ({ status }) => (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ring-1 ${
      status === 'running'
        ? 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20'
        : 'bg-slate-500/10 text-slate-400 ring-slate-500/20'
    }`}>
      <span className={`h-1.5 w-1.5 rounded-full ${status === 'running' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`}></span>
      {status === 'running' ? 'Running' : 'Idle'}
    </span>
  );

  const NodeCard: React.FC<{ node: OrgNode; onClick: () => void; isSelected: boolean }> = ({ node, onClick, isSelected }) => (
    <button
      onClick={onClick}
      className={`w-full text-left bg-slate-800 border rounded-xl p-3 md:p-4 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg hover:shadow-blue-500/5 ${
        isSelected ? 'border-blue-500/50 ring-1 ring-blue-500/20' : 'border-slate-700 hover:border-slate-600'
      }`}
    >
      <div className="flex items-center gap-3 mb-2">
        <div className={`h-10 w-10 md:h-11 md:w-11 rounded-xl bg-gradient-to-br ${node.gradient} flex items-center justify-center text-lg shadow-md shrink-0`}>
          {node.icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-white truncate">{node.name}</p>
          <p className="text-[10px] text-slate-400 uppercase tracking-wider">{node.role}</p>
        </div>
        <StatusBadge status={node.status} />
      </div>
      <p className="text-xs text-slate-400 mb-2 line-clamp-2">{node.description}</p>
      <div className="flex items-center gap-3 text-[10px] text-slate-500">
        <span>{node.tasksAssigned} tasks</span>
        <span className="text-emerald-500/70">{node.tasksCompleted} done</span>
      </div>
    </button>
  );

  const TreeNode: React.FC<{ node: OrgNode; isLast?: boolean }> = ({ node, isLast }) => {
    const hasChildren = node.children.length > 0;

    return (
      <div className="flex flex-col items-center">
        <NodeCard
          node={node}
          onClick={() => setSelectedNode(selectedNode?.id === node.id ? null : node)}
          isSelected={selectedNode?.id === node.id}
        />

        {hasChildren && (
          <div className="flex flex-col items-center mt-2">
            {/* Vertical line down */}
            <div className="w-px h-6 bg-slate-700"></div>

            {/* Horizontal connector for multiple children */}
            {node.children.length > 1 && (
              <div className="flex items-start relative">
                {/* Horizontal line */}
                <div
                  className="absolute top-0 h-px bg-slate-700"
                  style={{
                    left: `${100 / node.children.length / 2}%`,
                    right: `${100 / node.children.length / 2}%`,
                  }}
                ></div>

                {node.children.map((child, i) => (
                  <div key={child.id} className="flex flex-col items-center px-2 md:px-4" style={{ minWidth: '180px' }}>
                    {/* Vertical line down from horizontal */}
                    <div className="w-px h-6 bg-slate-700"></div>
                    <TreeNode node={child} isLast={i === node.children.length - 1} />
                  </div>
                ))}
              </div>
            )}

            {/* Single child */}
            {node.children.length === 1 && (
              <div>
                <TreeNode node={node.children[0]} isLast />
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const DetailPanel: React.FC<{ node: OrgNode; onClose: () => void }> = ({ node, onClose }) => (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 md:p-5 h-fit sticky top-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-white">Details</h3>
        <button
          onClick={onClose}
          className="h-7 w-7 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors flex items-center justify-center"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${node.gradient} flex items-center justify-center text-xl shadow-md`}>
          {node.icon}
        </div>
        <div>
          <p className="text-base font-bold text-white">{node.name}</p>
          <p className="text-xs text-slate-400 uppercase tracking-wider">{node.role}</p>
        </div>
      </div>

      <StatusBadge status={node.status} />

      <p className="text-sm text-slate-300 mt-3 mb-4">{node.description}</p>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-slate-800/50 rounded-lg p-3">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Tasks Assigned</p>
          <p className="text-lg font-bold text-white">{node.tasksAssigned}</p>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Completed</p>
          <p className="text-lg font-bold text-emerald-400">{node.tasksCompleted}</p>
        </div>
      </div>

      {node.skills.length > 0 && (
        <div className="mb-4">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Skills</p>
          <div className="flex flex-wrap gap-1.5">
            {node.skills.map((skill, i) => (
              <span key={i} className="px-2 py-0.5 bg-slate-800 text-slate-300 text-[10px] rounded-md ring-1 ring-slate-700">
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}

      {node.children.length > 0 && (
        <div>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Direct Reports ({node.children.length})</p>
          <div className="space-y-1.5">
            {node.children.map(child => (
              <div key={child.id} className="flex items-center gap-2 p-2 bg-slate-800/50 rounded-lg">
                <div className={`h-6 w-6 rounded-lg bg-gradient-to-br ${child.gradient} flex items-center justify-center text-xs`}>
                  {child.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-white truncate">{child.name}</p>
                  <p className="text-[10px] text-slate-500">{child.role}</p>
                </div>
                <StatusBadge status={child.status} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="mb-6 md:mb-8">
        <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white">Org Chart</h1>
        <p className="text-slate-400 mt-1 text-xs md:text-sm">Organizational hierarchy & reporting structure</p>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="flex items-center gap-3 text-slate-400">
            <div className="h-5 w-5 border-2 border-slate-600 border-t-blue-500 rounded-full animate-spin"></div>
            <span className="text-sm">Loading org chart...</span>
          </div>
        </div>
      )}

      {!loading && !eco && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
          <p className="text-slate-400 text-sm">Unable to load ecosystem data.</p>
          <p className="text-slate-600 text-xs mt-1">Check your connection to the gateway.</p>
        </div>
      )}

      {!loading && tree && (
        <div className="flex flex-col lg:flex-row gap-4 md:gap-6">
          {/* Tree Chart */}
          <div className="flex-1 overflow-x-auto pb-4">
            <div className="min-w-fit flex justify-center py-4">
              <TreeNode node={tree} />
            </div>
          </div>

          {/* Detail Panel */}
          {selectedNode && (
            <div className="lg:w-80 shrink-0">
              <DetailPanel node={selectedNode} onClose={() => setSelectedNode(null)} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default OrgChartPage;
