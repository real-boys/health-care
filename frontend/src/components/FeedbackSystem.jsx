import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  ThumbsDown, MessageSquare, Send, Bot, 
  CheckSquare, Search, Sparkles, Brain 
} from 'lucide-react';

export const FeedbackSystem = ({ submitFeedback, falsePositivesCount }) => {
  const [claimId, setClaimId] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!claimId || !reason) return;
    setIsSubmitting(true);
    await submitFeedback(claimId, reason);
    setIsSubmitting(false);
    setSuccess(true);
    setTimeout(() => {
      setClaimId('');
      setReason('');
      setSuccess(false);
    }, 3000);
  };

  const REASON_TEMPLATES = [
    "Valid high-acuity exception",
    "Pre-authorized override",
    "Emergency service spike",
    "Duplicate submission (corrected)"
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-10">
      
      {/* Immersive Learning Header */}
      <div className="glass-card bg-[#050608]/80 border-indigo-500/20 p-10 rounded-[3rem] relative overflow-hidden group">
         <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-600/10 blur-[100px] rounded-full group-hover:bg-indigo-600/20 transition-all duration-1000"></div>
         
         <div className="flex flex-col lg:flex-row justify-between items-center gap-10 relative z-10">
            <div className="space-y-4">
               <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex-center text-indigo-400">
                     <Brain size={28} />
                  </div>
                  <h2 className="text-3xl font-black text-white tracking-tighter">Neural Re-calibration</h2>
               </div>
               <p className="max-w-xl text-slate-400 font-medium leading-relaxed">
                  Your expert feedback directly influences the ensemble weighting. Correcting a single false result refines the entire decision perimeter for the next iteration.
               </p>
            </div>
            
            <div className="text-center p-8 glass-card border-white/5 rounded-3xl min-w-[200px]">
               <p className="text-5xl font-black text-indigo-400 glow-text-indigo leading-none mb-2">{falsePositivesCount || 0}</p>
               <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em]">Active Corrections</p>
            </div>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Entry Form */}
        <div className="glass-card p-10 rounded-[2.5rem] border-white/5">
           <div className="flex items-center gap-4 mb-8">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex-center text-rose-400">
                 <ThumbsDown size={20} />
              </div>
              <h3 className="text-xl font-black text-white tracking-tight">Signal Adjustment</h3>
           </div>
           
           <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest pl-1">Target Claim ID</label>
                <div className="relative group">
                  <Search size={16} className="absolute left-4 top-3.5 text-slate-600 group-focus-within:text-indigo-400 transition-colors" />
                  <input 
                    type="text" required value={claimId} onChange={(e) => setClaimId(e.target.value)}
                    placeholder="e.g. CLM-8802"
                    className="w-full glass-card bg-white/5 border-white/5 rounded-2xl py-3.5 pl-12 pr-4 text-sm font-medium focus:outline-none focus:border-indigo-500/50 transition-all"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest pl-1">Clinical Context</label>
                <textarea 
                  required value={reason} onChange={(e) => setReason(e.target.value)}
                  placeholder="Explain why this anomaly was a valid clinical outcome..."
                  rows={4}
                  className="w-full glass-card bg-white/5 border-white/5 rounded-2xl py-4 px-5 text-sm font-medium focus:outline-none focus:border-indigo-500/50 transition-all resize-none leading-relaxed"
                ></textarea>
              </div>

              <div className="flex flex-wrap gap-2">
                 {REASON_TEMPLATES.map((tmpl, i) => (
                    <button 
                      key={i} type="button" onClick={() => setReason(tmpl)}
                      className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/5 text-[9px] font-black text-slate-500 uppercase tracking-widest hover:text-white hover:border-white/20 transition-all"
                    >
                      {tmpl}
                    </button>
                 ))}
              </div>

              <button 
                 type="submit" disabled={isSubmitting || success}
                 className={`w-full py-4 rounded-2xl flex-center gap-3 font-black text-xs uppercase tracking-[0.2em] transition-all shadow-lg ${
                    success ? 'bg-emerald-600 text-white' : 
                    isSubmitting ? 'bg-indigo-600/40 text-slate-300' : 
                    'bg-indigo-600 text-white hover:bg-indigo-500 shadow-indigo-900/40'
                 }`}
              >
                 {success ? <><CheckSquare size={16} /> Signal Transmitted</> : <><Send size={16} /> Re-calibrate Engine</>}
              </button>
           </form>
        </div>

        {/* Info Column */}
        <div className="space-y-8">
           <div className="p-10 glass-card rounded-[2.5rem] border-white/5 flex-1 relative overflow-hidden flex flex-col justify-center">
              <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex-center text-indigo-400 mb-8">
                 <Sparkles size={24} />
              </div>
              <h4 className="text-2xl font-black text-white tracking-tighter mb-4">Immediate Propagation</h4>
              <ul className="space-y-5 text-sm font-medium text-slate-400">
                 <li className="flex items-start gap-3">
                    <span className="shrink-0 w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 flex-center font-black text-[10px]">1</span>
                    <span>The scoring matrix adjusts its weightings for similar behavioral signatures.</span>
                 </li>
                 <li className="flex items-start gap-3">
                    <span className="shrink-0 w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 flex-center font-black text-[10px]">2</span>
                    <span>Verified exceptions are cached to prevent future friction for high-performing providers.</span>
                 </li>
                 <li className="flex items-start gap-3">
                    <span className="shrink-0 w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 flex-center font-black text-[10px]">3</span>
                    <span>Natural Language is parsed to extract new rule-base primitives automatically.</span>
                 </li>
              </ul>
           </div>
           
           <div className="p-8 glass-card rounded-[2rem] border-emerald-500/10 bg-emerald-500/5 flex items-center gap-6 group">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex-center text-emerald-400">
                 <Bot size={24} className="group-hover:rotate-[20deg] transition-transform" />
              </div>
              <div>
                 <p className="text-[9px] font-black text-emerald-500 uppercase tracking-[0.2em] mb-1">AI Efficiency</p>
                 <p className="text-sm font-bold text-slate-300">Retraining cycle running in background. High priority feedback applied.</p>
              </div>
           </div>
        </div>
      </div>

    </div>
  );
};

export default FeedbackSystem;
