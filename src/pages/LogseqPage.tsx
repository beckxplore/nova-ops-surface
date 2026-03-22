import React, { useState, useEffect } from 'react';
import mermaid from 'mermaid';

interface GraphNode {
  title: string;
  type: 'page' | 'journal' | 'agent' | 'project' | 'model';
  updatedAt: string;
  tags: string[];
  content: string;
}

const MermaidGraph = ({ chart }: { chart: string }) => {
  useEffect(() => {
    mermaid.initialize({
      startOnLoad: true,
      theme: 'dark',
      securityLevel: 'loose',
      fontFamily: 'Inter, system-ui, sans-serif',
      themeVariables: {
        primaryColor: '#8b5cf6',
        primaryTextColor: '#fff',
        primaryBorderColor: '#2e1065',
        lineColor: '#60a5fa',
        nodeBkg: '#0f172a',
        edgeLabelBackground: '#020617',
      }
    });
    mermaid.contentLoaded();
  }, [chart]);

  return (
    <div className="mermaid bg-[#020617] p-8 rounded-3xl border border-blue-500/20 flex justify-center shadow-[0_0_50px_rgba(59,130,246,0.1)] overflow-hidden">
      {chart}
    </div>
  );
};

const DETAILED_GRAPH = `
graph BT
    %% Kernel - The Soul
    Kernel((<b>NOVA CORE</b>))
    
    %% AI Models - The Compute Layer
    subgraph "Compute Layer (AI Models)"
        M1[MiniMax M2.5]
        M2[Gemini 3.1 Pro]
        M3[Step 3.5 Flash]
    end

    %% Agents - The Living Nodes
    subgraph "Agent Registry"
        A1(Axel: Frontend)
        A2(Priya: Data Eng)
        A3(Nova-Backend)
        A4(Mender: Clinic)
    end

    %% Project & Memory Clusters
    subgraph "Knowledge Clusters"
        P1{Project Robroi}
        P2{Mate Engine Data}
        P3{SEAF Scorecard}
        P4{Nova Soul Specs}
        P5{AWS Infra Root}
    end

    %% Historical/Journal Logs
    subgraph "Memory Journals"
        J1[2026-03-12]
        J2[2026-03-18]
        J3[2026-03-19]
    end

    %% Relationships (The "Star Map" Connections)
    Kernel --- M1
    Kernel --- M2
    Kernel --- M3
    
    M1 --> A2
    M1 --> A3
    M2 --> A1
    M3 --> A4

    A1 --- P1
    A2 --- P2
    A3 --- P1
    A2 --- P3
    A4 --- P5

    P1 --- P2
    P2 --- P3
    P4 --- Kernel
    
    J3 --- P1
    J3 --- P2
    J2 --- P2
    J1 --- P4
    
    %% Styling for "Space/Star Map" aesthetic
    classDef kernel fill:#8b5cf6,stroke:#fff,stroke-width:4px,color:#fff;
    classDef model fill:#1e293b,stroke:#60a5fa,color:#60a5fa;
    classDef agent fill:#0f172a,stroke:#c084fc,color:#c084fc;
    classDef project fill:#020617,stroke:#fbbf24,color:#fbbf24;
    classDef journal fill:#020617,stroke:#475569,color:#94a3b8;
    
    class Kernel kernel;
    class M1,M2,M3 model;
    class A1,A2,A3,A4 agent;
    class P1,P2,P3,P4,P5 project;
    class J1,J2,J3 journal;
`;

export default function LogseqPage() {
  const [nodes, setNodes] = useState<GraphNode[]>([
    { title: 'Project Robroi', type: 'project', updatedAt: '2026-03-19', tags: ['#project'], content: 'Robroi project tracking.' },
    { title: 'MiniMax M2.5', type: 'model', updatedAt: 'Today', tags: ['#logic', '#heavy'], content: 'Primary reasoning model for heavy coding.' },
    { title: 'Priya', type: 'agent', updatedAt: '2026-03-19', tags: ['#data-eng'], content: 'Data Engineering specialized agent.' },
    { title: '2026-03-19', type: 'journal', updatedAt: 'Today', tags: ['#daily'], content: 'Logseq graph overhaul.' },
  ]);

  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [view, setView] = useState<'list' | 'map'>('map');

  return (
    <div className="p-6 bg-[#00050a] min-h-screen">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tighter italic">LOGSEQ <span className="text-blue-500">K-GRAPH</span></h1>
          <p className="text-slate-500 text-xs mt-1 uppercase tracking-widest font-bold">Neural Topology of Nova Workspace</p>
        </div>
        
        <div className="flex bg-slate-900/50 rounded-xl p-1 border border-blue-500/20 shadow-lg shadow-blue-500/5">
          <button 
            onClick={() => setView('map')}
            className={`px-6 py-2 rounded-lg text-[10px] uppercase font-black tracking-widest transition-all ${view === 'map' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
          >
            Topology Map
          </button>
          <button 
            onClick={() => setView('list')}
            className={`px-6 py-2 rounded-lg text-[10px] uppercase font-black tracking-widest transition-all ${view === 'list' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
          >
            Node Directory
          </button>
        </div>
      </div>

      {view === 'map' ? (
        <div className="space-y-8 animate-in zoom-in-95 duration-500">
          <section className="relative">
            <div className="absolute inset-0 bg-blue-500/5 blur-[100px] pointer-events-none"></div>
            <MermaidGraph chart={DETAILED_GRAPH} />
          </section>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-slate-900/40 border border-blue-900/30 p-4 rounded-2xl backdrop-blur-md">
              <span className="text-[9px] font-black text-blue-500 uppercase tracking-tighter">Nodes</span>
              <div className="text-2xl font-black text-white">24</div>
            </div>
            <div className="bg-slate-900/40 border border-purple-900/30 p-4 rounded-2xl backdrop-blur-md">
              <span className="text-[9px] font-black text-purple-500 uppercase tracking-tighter">Agents</span>
              <div className="text-2xl font-black text-white">4</div>
            </div>
            <div className="bg-slate-900/40 border border-amber-900/30 p-4 rounded-2xl backdrop-blur-md">
              <span className="text-[9px] font-black text-amber-500 uppercase tracking-tighter">Projects</span>
              <div className="text-2xl font-black text-white">5</div>
            </div>
            <div className="bg-slate-900/40 border border-slate-700/30 p-4 rounded-2xl backdrop-blur-md">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">Clusters</span>
              <div className="text-2xl font-black text-white">3</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in slide-in-from-bottom-4 duration-500">
          {/* List remains similar but styled to match */}
          <div className="lg:col-span-1 bg-[#020617] border border-blue-500/10 rounded-2xl overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-blue-500/10 bg-blue-500/5">
              <h3 className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Workspace Index</h3>
            </div>
            <div className="divide-y divide-blue-500/10 h-[600px] overflow-y-auto">
              {nodes.map(node => (
                <div 
                  key={node.title} 
                  onClick={() => setSelectedNode(node)}
                  className={`p-5 hover:bg-blue-500/5 transition-all flex items-center group cursor-pointer ${selectedNode?.title === node.title ? 'bg-blue-500/10' : ''}`}
                >
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center mr-4 transition-all shadow-inner ${selectedNode?.title === node.title ? 'bg-blue-500 text-white shadow-blue-500/50' : 'bg-slate-900 group-hover:bg-blue-500/20'}`}>
                    <span className="text-lg">
                      {node.type === 'agent' ? '🤖' : node.type === 'model' ? '🧠' : node.type === 'project' ? '💼' : '📝'}
                    </span>
                  </div>
                  <div>
                    <h4 className={`text-sm font-bold transition-colors ${selectedNode?.title === node.title ? 'text-blue-400' : 'text-slate-200'}`}>{node.title}</h4>
                    <span className="text-[10px] text-slate-600 font-bold uppercase tracking-tighter">{node.type}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-2">
            {selectedNode ? (
              <div className="bg-[#020617] border border-blue-500/10 rounded-2xl p-10 min-h-[600px] shadow-2xl relative overflow-hidden group">
                <div className="absolute -top-10 -right-10 text-[200px] opacity-[0.02] font-black group-hover:opacity-[0.05] transition-opacity select-none">NODE</div>
                <div className="relative">
                  <h2 className="text-4xl font-black text-white tracking-tighter mb-2">{selectedNode.title}</h2>
                  <div className="flex gap-2 mb-10">
                    <span className="px-3 py-1 bg-blue-500/10 text-blue-400 text-[10px] rounded-full border border-blue-500/20 font-black uppercase tracking-widest">{selectedNode.type}</span>
                    {selectedNode.tags.map(tag => (
                      <span key={tag} className="px-3 py-1 bg-slate-800/50 text-slate-500 text-[10px] rounded-full border border-slate-700/50 font-black uppercase tracking-widest">{tag}</span>
                    ))}
                  </div>
                  <div className="bg-[#010409] p-8 rounded-3xl border border-blue-500/5 text-slate-300 font-mono text-sm leading-relaxed shadow-2xl">
                    {selectedNode.content}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-[#020617]/50 border border-dashed border-blue-500/20 rounded-3xl p-20 flex flex-col items-center justify-center text-center h-full">
                <div className="w-24 h-24 bg-blue-500/5 rounded-full flex items-center justify-center text-5xl mb-6 shadow-inner ring-1 ring-blue-500/20 animate-pulse">🛰️</div>
                <h3 className="text-slate-400 font-black uppercase tracking-widest">Signal Missing</h3>
                <p className="text-slate-600 text-xs mt-2 max-w-xs">Select a neural node from the index to establish a visualization link.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}



