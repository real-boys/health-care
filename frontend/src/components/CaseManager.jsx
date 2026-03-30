import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, Filter, ChevronRight, User, 
  Clock, ShieldAlert, CheckCircle, ExternalLink,
  MoreVertical, FileText, Activity
} from 'lucide-react';

const CaseCard = ({ caseData, onUpdate, isSelected, onSelect }) => {
  const statusColors = {
    'Open': 'text-rose-400 bg-rose-400/10 border-rose-500/20',
    'Investigating': 'text-amber-400 bg-amber-400/10 border-amber-500/20',
    'Resolved': 'text-emerald-400 bg-emerald-400/10 border-emerald-500/20'
  };

  const riskColors = {
     'Very High': 'text-rose-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]',
     'High': 'text-rose-400',
     'Medium': 'text-amber-400',
     'Low': 'text-emerald-400'
  };

  return (
    <motion.div 
      layout
      onClick={onSelect}
      className={`glass-card p-5 rounded-3xl cursor-pointer transition-all border-white/5 relative overflow-hidden group ${isSelected ? 'border-indigo-500/50 bg-indigo-500/5 shadow-2xl shadow-indigo-500/10' : 'hover:border-white/20'}`}
    >
      <div className="flex justify-between items-start mb-4">
         <div className={`text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-widest border ${statusColors[caseData.status]}`}>
            {caseData.status}
         </div>
         <button className="text-slate-600 hover:text-white transition-colors">
            <MoreVertical size={16} />
         </button>
      </div>
      
      <div className="space-y-1 mb-6">
         <div className="flex items-baseline gap-2">
            <h4 className="text-xl font-black text-white tracking-tight">{caseData.id}</h4>
            <span className={`text-[10px] font-bold uppercase tracking-widest ${riskColors[caseData.riskLevel]}`}>
               {caseData.riskLevel} Risk
            </span>
         </div>
         <p className="text-xs text-slate-500 font-medium truncate">{caseData.claimDetails}</p>
      </div>

      <div className="flex items-center gap-4 pt-4 border-t border-white/5">
         <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-slate-800 border border-white/10 flex-center">
               <User size={12} className="text-slate-500" />
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{caseData.assignee}</span>
         </div>
         <div className="ml-auto flex items-center gap-1.5 text-slate-500">
            <Clock size={12} />
            <span className="text-[10px] font-bold uppercase tracking-tighter">{caseData.lastUpdated}</span>
         </div>
      </div>
    </motion.div>
  );
};

export const CaseManager = ({ cases, onUpdateCase }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedCaseId, setSelectedCaseId] = useState(null);

  const filteredCases = cases.filter(c => {
    const matchesSearch = c.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          c.claimDetails.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = selectedStatus === 'All' || c.status === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  const selectedCard = cases.find(c => c.id === selectedCaseId);

  return (
    <div className="flex gap-8 items-start">
      
      {/* Search & Grid Area */}
      <div className="flex-1 space-y-6">
         <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:w-96 group">
               <Search size={18} className="absolute left-4 top-3.5 text-slate-600 group-focus-within:text-indigo-400 transition-colors" />
               <input 
                  type="text"
                  placeholder="Scan investigations..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full glass-card bg-white/5 border-white/5 rounded-2xl py-3 pl-12 pr-4 text-sm font-medium focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 active:scale-[0.99] transition-all"
               />
            </div>
            
            <div className="flex bg-white/5 p-1 rounded-2xl border border-white/5 gap-1">
               {['All', 'Open', 'Investigating', 'Resolved'].map(status => (
                  <button 
                     key={status}
                     onClick={() => setSelectedStatus(status)}
                     className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                        selectedStatus === status 
                        ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30' 
                        : 'text-slate-500 hover:text-slate-300'
                     }`}
                  >
                     {status}
                  </button>
               ))}
            </div>
         </div>

         <div className="dashboard-grid">
            <AnimatePresence>
               {filteredCases.map((c, idx) => (
                  <CaseCard 
                     key={c.id} 
                     caseData={c} 
                     isSelected={selectedCaseId === c.id}
                     onSelect={() => setSelectedCaseId(c.id === selectedCaseId ? null : c.id)}
                  />
               ))}
            </AnimatePresence>
            {filteredCases.length === 0 && (
               <div className="col-span-full glass-card p-20 rounded-[2rem] flex-center flex-col text-slate-600 border-dashed border-2 border-white/5">
                  <Activity size={48} className="mb-4 opacity-20" />
                  <p className="font-bold text-lg">No active signals found.</p>
                  <p className="text-xs uppercase tracking-widest opacity-60">Adjust your filters to broaden the perimeter scan.</p>
               </div>
            )}
         </div>
      </div>

      {/* Side Detail Panel - Only shown when a case is selected */}
      <AnimatePresence>
         {selectedCard && (
            <motion.div 
               initial={{ opacity: 0, x: 50 }}
               animate={{ opacity: 1, x: 0 }}
               exit={{ opacity: 0, x: 50 }}
               className="w-[400px] shrink-0 sticky top-4 space-y-6"
            >
               <div className="glass-card p-8 rounded-[2.5rem] border-white/5 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-3xl rounded-full"></div>
                  
                  <div className="flex justify-between items-start mb-8">
                     <div className="p-4 rounded-3xl bg-white/5 border border-white/10 text-indigo-400">
                        <FileText size={24} />
                     </div>
                     <button 
                       onClick={() => setSelectedCaseId(null)}
                       className="w-10 h-10 rounded-xl bg-white/5 flex-center text-slate-500 hover:text-white transition-colors"
                     >
                       <ChevronRight size={20} />
                     </button>
                  </div>

                  <div className="space-y-1 mb-8">
                     <h3 className="text-4xl font-black text-white tracking-tighter">{selectedCard.id}</h3>
                     <p className="text-sm font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                        <ShieldAlert size={14} className="text-rose-500" />
                        Forensic Intelligence Breakdown
                     </p>
                  </div>

                  <div className="space-y-6">
                     <div className="p-5 rounded-2xl bg-white/5 border border-white/5 space-y-2">
                        <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">Summary</p>
                        <p className="text-sm text-slate-300 leading-relaxed font-medium">
                           {selectedCard.claimDetails}
                        </p>
                     </div>

                     <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                           <p className="text-[10px] font-black text-slate-600 uppercase tracking-wider mb-1">Risk Score</p>
                           <p className="text-xl font-black text-rose-500">92/100</p>
                        </div>
                        <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                           <p className="text-[10px] font-black text-slate-600 uppercase tracking-wider mb-1">Exposure</p>
                           <p className="text-xl font-black text-white">$14,200</p>
                        </div>
                     </div>

                     <div className="space-y-3">
                        <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest pl-1">Action Protocol</p>
                        <button 
                           onClick={() => onUpdateCase(selectedCard.id, { status: 'Resolved' })}
                           className="w-full py-4 rounded-2xl bg-emerald-600 text-white font-black text-sm uppercase tracking-widest flex-center gap-2 hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-900/40"
                        >
                           <CheckCircle size={18} /> Resolve Case
                        </button>
                        <button 
                           className="w-full py-4 rounded-2xl bg-white/5 border border-white/10 text-white font-black text-sm uppercase tracking-widest flex-center gap-2 hover:bg-white/10 transition-all"
                        >
                           <ExternalLink size={18} /> Full Provider Audit
                        </button>
                     </div>
                  </div>
               </div>
            </motion.div>
         )}
      </AnimatePresence>
    </div>
  );
};

export default CaseManager;
