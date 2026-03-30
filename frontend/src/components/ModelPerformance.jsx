import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Target, TrendingUp, Sliders, RefreshCcw, 
  Brain, Cpu, Zap, Activity 
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine 
} from 'recharts';

const MetricBadge = ({ label, value, desc, delay }) => (
  <motion.div 
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ delay }}
    className="glass-card p-6 rounded-[2rem] border-white/5 flex flex-col items-center justify-center text-center group hover:border-white/10 transition-all"
  >
    <p className="text-4xl font-black text-white tracking-tighter mb-1 glow-text-indigo">{value.toFixed(1)}%</p>
    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400">{label}</h4>
    <p className="text-[9px] text-slate-600 font-bold uppercase mt-2 tracking-widest">{desc}</p>
  </motion.div>
);

export const ModelPerformance = ({ stats }) => {
  const [threshold, setThreshold] = useState(0.7);

  const precision = (stats?.performanceMetrics?.precision || 0.85) * 100;
  const recall = (stats?.performanceMetrics?.recall || 0.92) * 100;
  const f1 = (stats?.performanceMetrics?.f1Score || 0.88) * 100;
  const auc = (stats?.performanceMetrics?.aucRoc || 0.94) * 100;

  return (
    <div className="space-y-10">
      
      {/* Header Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricBadge label="Precision" value={precision} desc="Accuracy of flags" delay={0.1} />
        <MetricBadge label="Recall" value={recall} desc="Fraud captured" delay={0.2} />
        <MetricBadge label="F1-Score" value={f1} desc="Harmonic mean" delay={0.3} />
        <MetricBadge label="AUC-ROC" value={auc} desc="Separability" delay={0.4} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Main Chart */}
        <div className="lg:col-span-2 glass-card p-10 rounded-[2.5rem] border-white/5">
           <div className="flex justify-between items-start mb-10">
              <div>
                 <h3 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
                    <TrendingUp className="text-indigo-400" /> Accuracy Velocity
                 </h3>
                 <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Neural Evolution (Last 30 Days)</p>
              </div>
              <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-white hover:bg-white/10 transition-all group">
                <RefreshCcw size={14} className="group-hover:rotate-180 transition-transform duration-700" /> Forced Retrain
              </button>
           </div>

           <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                 <LineChart data={stats?.accuracyTrend || [
                    { day: 'Day 1', acc: 0.82 }, { day: 'Day 5', acc: 0.85 },
                    { day: 'Day 10', acc: 0.89 }, { day: 'Day 15', acc: 0.94 },
                    { day: 'Day 20', acc: 0.92 }, { day: 'Day 25', acc: 0.95 },
                    { day: 'Day 30', acc: 0.94 }
                 ]}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
                    <XAxis 
                       dataKey="day" axisLine={false} tickLine={false} 
                       tick={{fill: '#475569', fontSize: 10, fontWeight: 700}} dy={15} 
                    />
                    <YAxis 
                       domain={[0.5, 1]} axisLine={false} tickLine={false} 
                       tick={{fill: '#475569', fontSize: 10}} width={30} 
                    />
                    <RechartsTooltip 
                       contentStyle={{ background: '#11151c', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                    />
                    <Line 
                       type="monotone" dataKey="acc" stroke="#6366f1" strokeWidth={5} 
                       dot={{r: 4, fill: '#6366f1', strokeWidth: 0}} activeDot={{r: 8, strokeWidth: 0, fill: '#fff'}} 
                       animationDuration={2000}
                    />
                 </LineChart>
              </ResponsiveContainer>
           </div>
        </div>

        {/* Adjustments */}
        <div className="glass-card p-10 rounded-[2.5rem] border-white/5 flex flex-col justify-between">
           <div className="space-y-1">
              <h3 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                 <Sliders className="text-slate-500" /> Neural Control
              </h3>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Cutoff Optimization</p>
           </div>

           <div className="flex-1 flex flex-col justify-center py-10 space-y-8">
              <div className="space-y-4">
                 <div className="flex justify-between text-[9px] font-black text-slate-600 uppercase tracking-tighter">
                    <span>FNR Focused</span>
                    <span className="text-right">FPR Focused</span>
                 </div>
                 
                 <div className="relative h-2 w-full bg-white/5 rounded-full">
                    <input 
                      type="range" min="0.1" max="0.9" step="0.05" value={threshold} 
                      onChange={(e) => setThreshold(parseFloat(e.target.value))}
                      className="absolute inset-0 w-full opacity-0 cursor-pointer z-10"
                    />
                    <motion.div 
                       className="absolute top-0 bottom-0 left-0 bg-indigo-600 rounded-full"
                       animate={{ width: `${threshold * 100}%` }}
                    />
                    <motion.div 
                       className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-6 bg-white rounded-full shadow-2xl border-4 border-slate-900"
                       animate={{ left: `${threshold * 100}%` }}
                    />
                 </div>

                 <div className="bg-indigo-500/10 border border-indigo-500/20 p-4 rounded-2xl text-center">
                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Active Cutoff</p>
                    <p className="text-2xl font-black text-white">{threshold.toFixed(2)}</p>
                 </div>
              </div>

              <div className="space-y-4">
                 <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-bold uppercase tracking-tight">Est. Alerts / Mo</span>
                    <span className="text-white font-black">{Math.floor(15420 * (1 - threshold))}</span>
                 </div>
                 <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-bold uppercase tracking-tight">Est. FPR / Mo</span>
                    <span className="text-rose-500 font-black">{Math.floor(15420 * (1 - threshold) * (1 - (precision/100)))}</span>
                 </div>
              </div>
           </div>
           
           <button className="w-full py-4 rounded-2xl bg-white/5 border border-white/10 text-white font-black text-xs uppercase tracking-widest hover:bg-white/10 transition-all flex-center gap-2">
              <Zap size={14} className="text-indigo-400" /> Apply Neural Config
           </button>
        </div>
      </div>
    </div>
  );
};

export default ModelPerformance;
