import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, ThumbsUp, ThumbsDown, Compass, LineChart, BrainCircuit, Info, ArrowUpRight } from 'lucide-react';
import useAppStore from '../store/useAppStore';

const RecommendationsPage = () => {
  const { recommendations, provideFeedback } = useAppStore();

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      <header className="flex justify-between items-end">
        <div>
          <div className="flex items-center gap-2 mb-2">
             <Sparkles className="text-indigo-400" size={24} />
             <h1 className="text-4xl font-black text-white tracking-tight">Cerebro Intelligence</h1>
          </div>
          <p className="text-slate-500 font-medium">Personalized clinical insights and operational discovery.</p>
        </div>
        <div className="bg-indigo-500/10 border border-indigo-500/20 px-6 py-3 rounded-2xl">
           <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-indigo-500 flex-center">
                 <BrainCircuit className="text-white" size={20} />
              </div>
              <div>
                 <span className="block text-lg font-black text-white">94%</span>
                 <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Model Precision</span>
              </div>
           </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Discovery Feed */}
        <section className="lg:col-span-2 space-y-6">
           <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                 <Compass className="text-purple-500" size={20} />
                 Discovery Feed
              </h2>
              <div className="flex gap-2">
                 {['All', 'Clinical', 'Operational', 'Financial'].map(tag => (
                   <button key={tag} className="px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-[10px] font-bold text-slate-400 hover:border-indigo-500/50 transition-colors">
                      {tag}
                   </button>
                 ))}
              </div>
           </div>

           <div className="space-y-4">
             {recommendations.map((rec, i) => (
               <motion.div 
                 initial={{ opacity: 0, x: -20 }}
                 animate={{ opacity: 1, x: 0 }}
                 transition={{ delay: i * 0.1 }}
                 key={rec.id}
                 className="bg-slate-900/40 border border-slate-800 p-6 rounded-3xl group hover:bg-slate-900/60 transition-all hover:border-indigo-500/30"
               >
                 <div className="flex justify-between items-start">
                   <div className="space-y-3 flex-1">
                      <div className="flex items-center gap-3">
                         <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter ${
                            rec.type === 'High Priority' ? 'bg-rose-500/10 text-rose-400' : 
                            rec.type === 'Anomaly' ? 'bg-amber-500/10 text-amber-400' : 'bg-indigo-500/10 text-indigo-400'
                         }`}>
                           {rec.type}
                         </span>
                         <span className="text-slate-600 font-bold text-[10px]">{Math.round(rec.confidence * 100)}% Confidence Match</span>
                      </div>
                      <h3 className="text-xl font-bold text-slate-200 group-hover:text-white transition-colors">{rec.title}</h3>
                      <p className="text-sm text-slate-500 max-w-lg">Based on recent patterns in provider billing and patient encounter history, we recommend a secondary review of this entity.</p>
                      
                      <div className="flex items-center gap-4 pt-4">
                         <button className="text-indigo-400 text-xs font-bold flex items-center gap-1 hover:gap-2 transition-all">
                            Investigate Further <ArrowUpRight size={14} />
                         </button>
                         <div className="h-4 w-px bg-slate-800" />
                         <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-slate-600 uppercase">Was this helpful?</span>
                            <button onClick={() => provideFeedback(rec.id, 1)} className="p-1.5 hover:bg-emerald-500/10 text-slate-500 hover:text-emerald-400 rounded-lg transition-colors">
                               <ThumbsUp size={14} />
                            </button>
                            <button onClick={() => provideFeedback(rec.id, -1)} className="p-1.5 hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 rounded-lg transition-colors">
                               <ThumbsDown size={14} />
                            </button>
                         </div>
                      </div>
                   </div>
                   
                   <div className="w-16 h-16 rounded-2xl bg-slate-800/50 flex-center border border-slate-700/50">
                      <Info size={24} className="text-slate-600" />
                   </div>
                 </div>
               </motion.div>
             ))}
           </div>
        </section>

        {/* Analytics & Transparency */}
        <section className="space-y-6">
           <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <LineChart className="text-emerald-500" size={20} />
              Performance
           </h2>
           
           <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-3xl space-y-6">
              <div className="space-y-2">
                 <div className="flex justify-between text-[10px] font-black text-slate-500 uppercase">
                    <span>Model Accuracy</span>
                    <span>94.2%</span>
                 </div>
                 <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 w-[94%]" />
                 </div>
              </div>
              <div className="space-y-2">
                 <div className="flex justify-between text-[10px] font-black text-slate-500 uppercase">
                    <span>User Adoption</span>
                    <span>78.5%</span>
                 </div>
                 <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 w-[78%]" />
                 </div>
              </div>
              
              <div className="pt-6 border-t border-slate-800/50">
                 <h4 className="text-xs font-bold text-white mb-2">Transparency Note</h4>
                 <p className="text-[10px] text-slate-500 leading-relaxed">
                    Our recommendation engine uses a proprietary Federated Learning model trained on anonymized healthcare data. It prioritizes patient privacy and HIPAA compliance while identifying operational inefficiencies.
                 </p>
              </div>
           </div>

           <div className="bg-gradient-to-br from-indigo-600/20 to-purple-600/20 border border-indigo-500/20 p-6 rounded-3xl">
              <h4 className="text-sm font-bold text-white mb-2">Optimization Active</h4>
              <p className="text-xs text-slate-400 mb-4">The engine is currently optimizing suggestions based on your feedback from the last 24 hours.</p>
              <button className="w-full py-3 bg-white text-indigo-900 font-bold rounded-xl text-xs hover:bg-slate-100 transition-colors">
                 Recalibrate Engine
              </button>
           </div>
        </section>
      </div>
    </div>
  );
};

export default RecommendationsPage;
