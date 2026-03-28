import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  AlertCircle, ShieldAlert, CheckCircle, 
  ChevronDown, ExternalLink, Activity, Play 
} from 'lucide-react';

const AlertIndicator = ({ severity }) => {
  const colors = {
     'Very High': 'bg-rose-500 shadow-[0_0_15px_rgba(239,68,68,0.6)]',
     'High': 'bg-rose-400 shadow-[0_0_10px_rgba(239,68,68,0.4)]',
     'Medium': 'bg-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.3)]',
     'Low': 'bg-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
  };
  
  return (
    <div className="relative flex-center">
       <div className={`w-3 h-3 rounded-full ${colors[severity]} relative z-10 animate-pulse`}></div>
       <div className={`absolute inset-0 rounded-full ${colors[severity]} animate-ping opacity-60`}></div>
    </div>
  );
};

const AlertCard = ({ alert }) => {
  const [expanded, setExpanded] = React.useState(false);

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`glass-card p-6 rounded-3xl border-white/5 relative overflow-hidden group transition-all ${expanded ? 'bg-white/10 border-white/20' : 'hover:border-white/10'}`}
    >
       <div className="flex items-start gap-5">
          <AlertIndicator severity={alert.severity} />
          
          <div className="flex-1 space-y-2">
             <div className="flex justify-between items-start">
                <div className="space-y-1">
                   <h4 className="text-xl font-black text-white tracking-tight">{alert.claimId}</h4>
                   <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em]">{alert.type}</p>
                </div>
                <div className="flex gap-2">
                   <span className="text-[10px] font-black px-2 py-1 rounded bg-white/5 border border-white/5 text-slate-500 font-mono">
                      {alert.timestamp}
                   </span>
                </div>
             </div>

             <div className="bg-white/5 border border-white/5 p-4 rounded-2xl">
                <p className="text-sm font-medium text-slate-300 leading-relaxed italic">
                   "{alert.explanation}"
                </p>
             </div>

             <div className="flex items-center gap-4 pt-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-rose-500 mb-1">
                   <Activity size={12} />
                   Risk Score: {alert.score}/100
                </div>
                <div className="h-1 flex-1 bg-white/5 rounded-full overflow-hidden">
                   <motion.div 
                      initial={{ width: 0 }} 
                      animate={{ width: `${alert.score}%` }} 
                      className={`h-full ${alert.severity === 'Very High' ? 'bg-rose-600 shadow-[0_0_10px_rgba(239,68,68,0.5)]' : 'bg-rose-400'}`}
                   />
                </div>
             </div>
             
             <button 
               onClick={() => setExpanded(!expanded)}
               className="pt-2 flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-white transition-colors"
             >
                <ChevronDown size={14} className={`transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`} />
                Forensic Details
             </button>
             
             <AnimatePresence>
                {expanded && (
                   <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden pt-4"
                   >
                      <div className="grid grid-cols-2 gap-4 pb-4">
                         <div className="p-4 rounded-2xl bg-slate-900/50 border border-white/5">
                            <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-2">Primary Trigger</p>
                            <p className="text-xs font-bold text-white flex items-center gap-2">
                               <ShieldAlert size={12} className="text-indigo-400" />
                               Behavioral Outlier detected (94th percentile)
                            </p>
                         </div>
                         <div className="p-4 rounded-2xl bg-slate-900/50 border border-white/5">
                            <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-2">System Action</p>
                            <p className="text-xs font-bold text-white flex items-center gap-2">
                               <CheckCircle size={12} className="text-emerald-400" />
                               Autoblock initialized
                            </p>
                         </div>
                      </div>
                      <div className="flex gap-3">
                         <button className="flex-1 py-3 rounded-xl bg-indigo-600 text-white font-black text-xs uppercase tracking-widest hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-900/40">
                            Immediate Review
                         </button>
                         <button className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex-center text-slate-400 hover:text-white transition-colors">
                            <ExternalLink size={18} />
                         </button>
                      </div>
                   </motion.div>
                )}
             </AnimatePresence>
          </div>
       </div>
    </motion.div>
  );
};

export const AlertsPanel = ({ alerts }) => {
  return (
    <div className="max-w-4xl mx-auto space-y-10">
      
      {/* Header Stat Area */}
      <div className="flex justify-between items-end border-b border-white/5 pb-8">
         <div className="space-y-1">
            <h2 className="text-4xl font-extrabold text-white tracking-tighter flex items-center gap-4">
               Risk Stream
               <div className="flex gap-1">
                  <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></div>
                  <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse delay-75"></div>
                  <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse delay-150"></div>
               </div>
            </h2>
            <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">
               Real-time forensic alert propagation
            </p>
         </div>
         <div className="text-right">
            <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1">Total Flags</p>
            <p className="text-4xl font-black text-rose-500 glow-text-rose">{alerts.length}</p>
         </div>
      </div>

      <div className="space-y-6">
         <AnimatePresence>
            {alerts.length > 0 ? (
               alerts.map((alert, idx) => (
                  <AlertCard key={alert.id || idx} alert={alert} />
               ))
            ) : (
               <motion.div 
                 initial={{ opacity: 0, y: 10 }}
                 animate={{ opacity: 1, y: 0 }}
                 className="glass-card p-24 rounded-[3rem] flex-center flex-col gap-6 text-center border-dashed border-2 border-white/5"
               >
                  <div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex-center text-emerald-500">
                     <CheckCircle size={36} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-white">Full Spectrum Secured</h3>
                    <p className="text-slate-500 font-medium mt-2">No active fraudulent triggers detected across the grid.</p>
                  </div>
                  <button className="mt-4 px-8 py-3 rounded-full bg-white/5 border border-white/10 text-white font-black text-xs uppercase tracking-widest hover:bg-white/10 transition-all flexitems-center gap-2">
                    <Play size={12} fill="currentColor" /> Refresh Perimeter
                  </button>
               </motion.div>
            )}
         </AnimatePresence>
      </div>

    </div>
  );
};

export default AlertsPanel;
