import React, { useState } from 'react';
import { Terminal, X, ChevronRight, Database, Zap } from 'lucide-react';
import useAppStore from '../store/useAppStore';

const StateDebugger = () => {
  const [isOpen, setIsOpen] = useState(false);
  const state = useAppStore();

  return (
    <div className="fixed bottom-4 right-4 z-[100]">
      <button 
        onClick={() => setIsOpen(true)}
        className="w-12 h-12 bg-slate-900 border border-indigo-500/50 rounded-full flex items-center justify-center text-indigo-400 shadow-2xl hover:bg-indigo-500/10 transition-colors"
      >
        <Terminal size={20} />
      </button>

      {isOpen && (
        <div className="fixed inset-y-0 right-0 w-[400px] bg-[#050608] border-l border-slate-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
          <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/20">
            <div className="flex items-center gap-3">
               <Database className="text-indigo-400" size={18} />
               <h3 className="font-bold text-white text-sm">State Inspector</h3>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-slate-500 hover:text-white">
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-auto p-6 font-mono text-[10px]">
            <div className="space-y-4">
               <div>
                  <p className="text-indigo-400 font-bold mb-2 flex items-center gap-2">
                     <Zap size={12} /> Live Store Object
                  </p>
                  <pre className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-slate-300 overflow-x-auto">
                    {JSON.stringify(state, (key, value) => typeof value === 'function' ? '[Function]' : value, 2)}
                  </pre>
               </div>
               
               <div className="pt-4 border-t border-slate-800">
                  <p className="text-slate-500 font-bold mb-2 uppercase tracking-widest">Performance Metrics</p>
                  <div className="space-y-1">
                     <div className="flex justify-between text-slate-400">
                        <span>Last Update</span>
                        <span className="text-emerald-400">0.42ms</span>
                     </div>
                     <div className="flex justify-between text-slate-400">
                        <span>Persistence</span>
                        <span className="text-indigo-400">localStorage (Active)</span>
                     </div>
                  </div>
               </div>
            </div>
          </div>

          <div className="p-4 bg-slate-900/40 border-t border-slate-800">
             <button 
               onClick={() => { localStorage.removeItem('aegis-app-storage'); window.location.reload(); }}
               className="w-full py-2 bg-rose-500/10 text-rose-400 rounded-lg font-bold text-[10px] uppercase tracking-widest hover:bg-rose-500/20 transition-colors"
             >
                Reset Store & Cache
             </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default StateDebugger;
