import React from 'react';
import { motion } from 'framer-motion';
import { 
  TrendingUp, TrendingDown, Users, AlertCircle, 
  ShieldCheck, Activity, Brain, Fingerprint 
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Radar, RadarChart, PolarGrid, 
  PolarAngleAxis, PolarRadiusAxis 
} from 'recharts';

const KPICard = ({ title, value, change, icon: Icon, color, delay }) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay }}
    className="glass-card p-6 rounded-3xl relative overflow-hidden group hover:border-white/20 transition-all border-white/5"
  >
    <div className="absolute -right-4 -top-4 w-24 h-24 bg-current opacity-[0.03] rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" style={{ color }}></div>
    
    <div className="flex justify-between items-start mb-6">
       <div className={`p-3 rounded-2xl bg-white/5 border border-white/10 group-hover:border-white/20 transition-colors`} style={{ color }}>
          <Icon size={22} />
       </div>
       <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg bg-white/5 border border-white/10 ${change.startsWith('+') ? 'text-emerald-400' : 'text-rose-400'}`}>
          {change.startsWith('+') ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {change}
       </div>
    </div>
    
    <div className="space-y-1">
       <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500">{title}</h4>
       <p className="text-3xl font-black text-white tracking-tight">{value}</p>
    </div>
  </motion.div>
);

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="glass-card p-3 rounded-xl border-indigo-500/20 shadow-2xl">
        <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">{label}</p>
        <p className="text-sm font-black text-white">{payload[0].name}: <span className="text-indigo-400">{payload[0].value}%</span></p>
      </div>
    );
  }
  return null;
};

const FraudDashboard = ({ kpis, riskTrend, riskDistribution, modelPerformance }) => {
  const COLORS = {
    veryHigh: '#ef4444',
    high: '#f59e0b',
    medium: '#6366f1',
    low: '#10b981'
  };

  const pieData = [
     { name: 'Very High', value: 3, color: COLORS.veryHigh },
     { name: 'High', value: 12, color: COLORS.high },
     { name: 'Medium', value: 25, color: COLORS.medium },
     { name: 'Low', value: 60, color: COLORS.low },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      
      {/* Top Row: KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
         <KPICard 
            title="Total Analyzed" value={kpis?.totalAnalyzed?.toLocaleString() || "15,420"} 
            change="+12% from last week" icon={Activity} color="#6366f1" delay={0.1} 
         />
         <KPICard 
            title="High Risk Alerts" value={kpis?.activeAlerts || "423"} 
            change="+5 new today" icon={AlertCircle} color="#ef4444" delay={0.2} 
         />
         <KPICard 
            title="Investigations" value={kpis?.underInvestigation || "85"} 
            change="12 assigned today" icon={Users} color="#f59e0b" delay={0.3} 
         />
         <KPICard 
            title="Fraud Prevented" value={`$${(kpis?.totalPrevented / 1000).toFixed(0)}k`} 
            change="+$142k this week" icon={ShieldCheck} color="#10b981" delay={0.4} 
         />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         
         {/* Risk Detection Trend */}
         <div className="lg:col-span-2 glass-card p-8 rounded-[2rem] border-white/5">
            <div className="flex justify-between items-center mb-10">
               <div>
                  <h3 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
                     <Brain className="text-indigo-400" /> Detection Intelligence
                  </h3>
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">Anomaly Scoring Volume (Last 7 Days)</p>
               </div>
               <div className="flex gap-2">
                  <span className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex-center text-slate-400 hover:text-white transition-colors cursor-pointer"><Activity size={16} /></span>
               </div>
            </div>
            
            <div className="h-80 w-full">
               <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={riskTrend || [
                     { day: 'Mon', score: 40 }, { day: 'Tue', score: 35 }, { day: 'Wed', score: 55 },
                     { day: 'Thu', score: 45 }, { day: 'Fri', score: 70 }, { day: 'Sat', score: 30 },
                     { day: 'Sun', score: 50 }
                  ]}>
                     <defs>
                        <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                           <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                           <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                        </linearGradient>
                     </defs>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
                     <XAxis 
                        dataKey="day" axisLine={false} tickLine={false} 
                        tick={{fill: '#475569', fontSize: 10, fontWeight: 700}} dy={15} 
                     />
                     <YAxis axisLine={false} tickLine={false} tick={{fill: '#475569', fontSize: 10}} width={30} />
                     <RechartsTooltip content={<CustomTooltip />} />
                     <Area 
                        type="monotone" dataKey="score" stroke="#6366f1" strokeWidth={4} 
                        fillOpacity={1} fill="url(#colorScore)" 
                        animationDuration={2000}
                     />
                  </AreaChart>
               </ResponsiveContainer>
            </div>
         </div>

         {/* Distribution Radar */}
         <div className="glass-card p-8 rounded-[2rem] border-white/5 flex flex-col items-center justify-between">
            <div className="text-center w-full mb-6">
               <h3 className="text-xl font-black text-white tracking-tight">Anomaly Drivers</h3>
               <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Core Risk Vectors</p>
            </div>
            
            <div className="h-64 w-full">
               <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="80%" data={[
                     { subject: 'Temporal', A: 85, fullMark: 100 },
                     { subject: 'Cluster', A: 65, fullMark: 100 },
                     { subject: 'Behavioral', A: 90, fullMark: 100 },
                     { subject: 'Upcoding', A: 70, fullMark: 100 },
                     { subject: 'Velocity', A: 78, fullMark: 100 },
                  ]}>
                     <PolarGrid stroke="rgba(255,255,255,0.05)" />
                     <PolarAngleAxis dataKey="subject" tick={{fill: '#64748b', fontSize: 10, fontWeight: 700}} />
                     <Radar 
                        name="Drivers" dataKey="A" stroke="#6366f1" 
                        fill="#6366f1" fillOpacity={0.4} 
                        animationDuration={1500}
                     />
                  </RadarChart>
               </ResponsiveContainer>
            </div>

            <div className="w-full space-y-3 mt-4">
               <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-bold uppercase tracking-tighter">Model Confidence</span>
                  <span className="text-emerald-400 font-black">94.2%</span>
               </div>
               <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <motion.div 
                     initial={{ width: 0 }} animate={{ width: "94.2%" }} transition={{ duration: 1.5 }}
                     className="h-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" 
                  />
               </div>
            </div>
         </div>
      </div>

      {/* Distribution Pie Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
         <div className="glass-card p-8 rounded-[2rem] border-white/5 flex items-center gap-10">
            <div className="h-48 w-48 relative shrink-0">
               <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                     <Pie
                        data={pieData}
                        cx="50%" cy="50%"
                        innerRadius={65}
                        outerRadius={80}
                        paddingAngle={8}
                        dataKey="value"
                        animationDuration={1500}
                     >
                        {pieData.map((entry, index) => (
                           <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                        ))}
                     </Pie>
                  </PieChart>
               </ResponsiveContainer>
               <div className="absolute-center text-center">
                  <p className="text-2xl font-black text-white">3%</p>
                  <p className="text-[10px] text-slate-500 font-bold uppercase leading-none">Flagged</p>
               </div>
            </div>
            
            <div className="flex-1 space-y-4">
               <h4 className="text-lg font-black text-white mb-2">Systemic Risk Split</h4>
               {pieData.map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                     <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }}></div>
                     <span className="text-xs font-bold text-slate-400 w-24">{item.name}</span>
                     <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full" style={{ width: `${item.value}%`, backgroundColor: item.color }}></div>
                     </div>
                     <span className="text-xs font-black text-white w-8 text-right">{item.value}%</span>
                  </div>
               ))}
            </div>
         </div>

         <div className="glass-card p-8 rounded-[2rem] border-white/5 flex flex-col justify-center">
            <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex-center text-indigo-400">
                   <Fingerprint size={24} />
                </div>
                <div>
                   <h3 className="text-xl font-black text-white">Neural Signatures</h3>
                   <p className="text-xs text-slate-500 font-medium">Auto-detected behavioral markers identified today.</p>
                </div>
            </div>
            
            <div className="space-y-3">
               {[
                  { label: "Impossible Travel (Distance Anomaly)", count: 4, drift: "+2" },
                  { label: "Sub-second Procedural Claiming", count: 12, drift: "Safe" },
                  { label: "Night-cycle Batching (Provider Cluster)", count: 7, drift: "+1" }
               ].map((sig, idx) => (
                  <div key={idx} className="flex justify-between items-center p-3 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-all group">
                     <span className="text-sm font-semibold text-slate-300 group-hover:text-white transition-colors">{sig.label}</span>
                     <div className="flex items-center gap-3">
                        <span className="text-sm font-black text-indigo-400">{sig.count}</span>
                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${sig.drift === 'Safe' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                           {sig.drift}
                        </span>
                     </div>
                  </div>
               ))}
            </div>
         </div>
      </div>

    </div>
  );
};

export default FraudDashboard;
