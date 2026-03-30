import React from 'react';
import { motion } from 'framer-motion';
import { 
  Activity, Zap, Globe, Clock, 
  Info, CornerRightDown, Fingerprint, Layers
} from 'lucide-react';

const NetworkGraph = ({ nodes = [], links = [] }) => {
  // Mock data for the "Glow Up" if none provided
  const displayNodes = nodes.length > 0 ? nodes : [
     { id: 'P1', x: 200, y: 150, type: 'Provider', label: 'Dr. Smith', risk: 'High' },
     { id: 'C1', x: 100, y: 100, type: 'Claim', label: 'C-001' },
     { id: 'C2', x: 300, y: 100, type: 'Claim', label: 'C-002' },
     { id: 'C3', x: 200, y: 250, type: 'Claim', label: 'C-003' },
     { id: 'P2', x: 450, y: 200, type: 'Provider', label: 'Clinic A' },
     { id: 'C4', x: 550, y: 150, type: 'Claim', label: 'C-004' },
  ];
  
  const displayLinks = links.length > 0 ? links : [
     { source: 'P1', target: 'C1' }, { source: 'P1', target: 'C2' }, 
     { source: 'P1', target: 'C3' }, { source: 'P2', target: 'C4' },
     { source: 'P1', target: 'P2', relation: 'Referral Spike' }
  ];

  return (
    <div className="relative w-full h-[500px] glass-card rounded-[3rem] border-white/5 overflow-hidden group">
       <div className="absolute top-8 left-8 z-10">
          <h4 className="text-xl font-black text-white tracking-tighter flex items-center gap-2">
             <Globe className="text-indigo-400" size={20} /> Relational Mesh
          </h4>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Provider-Patient Cluster Analysis</p>
       </div>

       <div className="absolute top-8 right-8 z-10 flex gap-2">
          <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[9px] font-black text-slate-400 uppercase tracking-widest">Live Forensics</div>
          <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse mt-1.5 shadow-[0_0_10px_rgba(99,102,241,0.5)]"></div>
       </div>

       <svg viewBox="0 0 600 400" className="w-full h-full p-20 cursor-move">
          <defs>
             <filter id="glow">
                <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
                <feMerge>
                   <feMergeNode in="coloredBlur" />
                   <feMergeNode in="SourceGraphic" />
                </feMerge>
             </filter>
             <linearGradient id="linkGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#6366f1" stopOpacity="0.2" />
                <stop offset="50%" stopColor="#6366f1" stopOpacity={0.8} />
                <stop offset="100%" stopColor="#6366f1" stopOpacity="0.2" />
             </linearGradient>
          </defs>

          {/* Links */}
          {displayLinks.map((link, i) => {
             const s = displayNodes.find(n => n.id === link.source);
             const t = displayNodes.find(n => n.id === link.target);
             if (!s || !t) return null;
             return (
                <motion.line 
                  key={i} x1={s.x} y1={s.y} x2={t.x} y2={t.y} 
                  stroke="url(#linkGrad)" strokeWidth={link.relation ? 3 : 1}
                  initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                  transition={{ duration: 2, delay: i * 0.1 }}
                  strokeDasharray={link.relation ? "5,5" : "0"}
                />
             );
          })}

          {/* Nodes */}
          {displayNodes.map((node, i) => (
             <motion.g 
                key={node.id} 
                initial={{ opacity: 0, scale: 0 }} 
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05, type: 'spring' }}
                whileHover={{ scale: 1.2 }}
             >
                <circle 
                   cx={node.x} cy={node.y} r={node.type === 'Provider' ? 14 : 8} 
                   fill={node.type === 'Provider' ? '#6366f1' : '#1e293b'} 
                   stroke={node.risk === 'High' ? '#ef4444' : '#6366f1'} 
                   strokeWidth="2"
                   filter="url(#glow)"
                />
                {node.type === 'Provider' && (
                   <text 
                     x={node.x} y={node.y + 30} textAnchor="middle" 
                     className="text-[10px] font-black fill-slate-500 uppercase tracking-widest pointer-events-none"
                   >
                      {node.label}
                   </text>
                )}
             </motion.g>
          ))}
       </svg>

       <div className="absolute bottom-8 left-8 right-8 z-10 flex justify-between items-end">
          <div className="glass-card bg-black/40 p-4 rounded-2xl flex items-center gap-6 border-white/5">
             <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Verified Entities</span>
             </div>
             <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]"></div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Anomalous Nodes</span>
             </div>
          </div>
          <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] animate-pulse">Scanning Relational Graph...</p>
       </div>
    </div>
  );
};

const HeatmapCell = ({ value, delay }) => {
   // Generate color based on intensity
   const getCellColor = (val) => {
      if (val > 0.8) return 'bg-rose-500 shadow-[inset_0_0_10px_rgba(0,0,0,0.3)] shadow-rose-900/40 border-rose-400/30';
      if (val > 0.6) return 'bg-rose-600/60 border-rose-500/20';
      if (val > 0.4) return 'bg-indigo-600/40 border-indigo-500/10';
      if (val > 0.2) return 'bg-indigo-900/20 border-white/5';
      return 'bg-white/5 border-white/5';
   };

   return (
      <motion.div 
         initial={{ opacity: 0, scale: 0.8 }} 
         animate={{ opacity: 1, scale: 1 }} 
         transition={{ delay }}
         whileHover={{ scale: 1.2, zIndex: 10 }}
         className={`w-full h-full rounded-md border transition-colors ${getCellColor(value)}`}
      />
   );
};

export const PatternVisualizer = ({ networkData, heatmapData }) => {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const hours = ['00h', '04h', '08h', '12h', '16h', '20h'];

  return (
    <div className="space-y-10">
      
      {/* Mesh Visualization */}
      <NetworkGraph nodes={networkData?.nodes} links={networkData?.links} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
         
         {/* Temporal Heatmap */}
         <div className="glass-card p-8 rounded-[2.5rem] border-white/5">
            <div className="flex justify-between items-start mb-10">
               <div>
                  <h4 className="text-xl font-black text-white tracking-tighter flex items-center gap-3">
                     <Clock className="text-amber-400" size={20} /> Risk Chronology
                  </h4>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Spectral Anomaly Density</p>
               </div>
               <div className="p-3 rounded-2xl bg-white/5 text-slate-500">
                  <Activity size={18} />
               </div>
            </div>

            <div className="flex gap-4">
               <div className="flex flex-col justify-between py-2 text-[10px] font-black text-slate-600 uppercase">
                  {hours.map(h => <span key={h}>{h}</span>)}
               </div>
               <div className="flex-1 space-y-2">
                  <div className="grid grid-cols-7 gap-2">
                     {days.map(d => <span key={d} className="text-[10px] font-black text-slate-600 uppercase text-center mb-1">{d}</span>)}
                  </div>
                  <div className="grid grid-cols-7 grid-rows-6 gap-2 aspect-[7/6]">
                     {Array.from({ length: 42 }).map((_, i) => (
                        <HeatmapCell key={i} value={Math.random()} delay={i * 0.01} />
                     ))}
                  </div>
               </div>
            </div>

            <div className="mt-8 flex justify-between items-center text-[9px] font-black text-slate-600 uppercase tracking-widest">
               <span>Inert</span>
               <div className="flex-1 h-1.5 mx-4 flex gap-1">
                  {[...Array(6)].map((_, i) => (
                     <div key={i} className="flex-1 rounded-full h-full" style={{ backgroundColor: i < 2 ? '#1e293b' : i < 4 ? '#6366f1' : '#ef4444', opacity: 0.1 + (i*0.2) }}></div>
                  ))}
               </div>
               <span className="text-rose-500">Critical</span>
            </div>
         </div>

         {/* Insights / drivers */}
         <div className="glass-card p-8 rounded-[2.5rem] border-white/5 relative overflow-hidden flex flex-col justify-between">
            <div className="absolute top-0 right-0 w-48 h-48 bg-rose-500/5 blur-3xl rounded-full pointer-events-none"></div>
            
            <div className="space-y-8">
               <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex-center text-rose-400 glow-text-rose">
                     <Zap size={24} />
                  </div>
                  <div>
                     <h4 className="text-xl font-black text-white tracking-tight">Active Indicators</h4>
                     <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Live Signal Feed</p>
                  </div>
               </div>

               <div className="space-y-4">
                  {[
                     { label: "Impossible Distance Spike", val: "Critical", icon: Globe, color: "text-rose-500" },
                     { label: "Provider-Patient Loop", val: "Detected", icon: Fingerprint, color: "text-indigo-400" },
                     { label: "Night-Shift Billing Cluster", val: "Warning", icon: Layers, color: "text-amber-500" },
                     { label: "UPC Mismatch Signature", val: "Confirmed", icon: Zap, color: "text-rose-400" }
                  ].map((item, i) => (
                     <div key={i} className="flex items-center gap-4 p-4 rounded-3xl bg-white/5 border border-white/5 hover:border-white/10 transition-all group">
                        <div className={`w-10 h-10 rounded-xl bg-black/40 flex-center ${item.color}`}>
                           <item.icon size={18} />
                        </div>
                        <div className="flex-1">
                           <p className="text-xs font-bold text-slate-300 group-hover:text-white transition-colors">{item.label}</p>
                           <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mt-0.5">Automated Match</p>
                        </div>
                        <span className={`text-[10px] font-black uppercase tracking-widest ${item.color}`}>{item.val}</span>
                     </div>
                  ))}
               </div>
            </div>

            <button className="w-full mt-6 py-4 rounded-2xl bg-white/5 border border-white/10 text-slate-300 font-black text-xs uppercase tracking-widest hover:bg-white/10 transition-all flex items-center justify-between px-6">
               View Full Neural Map
               <CornerRightDown size={14} />
            </button>
         </div>
      </div>

    </div>
  );
};

export default PatternVisualizer;
