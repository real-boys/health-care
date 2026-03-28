import React, { useState, useEffect } from 'react';
import { Users, Clock, Loader2, ArrowRight, ShieldCheck, Video, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const VirtualLobby = ({ doctorName, onJoinConsultation }) => {
  const [queuePosition, setQueuePosition] = useState(3);
  const [estimatedWait, setEstimatedWait] = useState(12);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Simulate queue movement
    const timer = setTimeout(() => {
      setQueuePosition(2);
      setEstimatedWait(8);
    }, 5000);

    const readyTimer = setTimeout(() => {
      setQueuePosition(1);
      setEstimatedWait(2);
      setIsReady(true);
    }, 12000);

    return () => {
      clearTimeout(timer);
      clearTimeout(readyTimer);
    };
  }, []);

  return (
    <div className="virtual-lobby flex flex-col items-center justify-center min-h-[500px] p-8 max-w-2xl mx-auto">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full bg-white rounded-[2.5rem] p-12 shadow-2xl shadow-blue-600/5 border border-slate-100 text-center relative overflow-hidden"
      >
        {/* Background Gradients */}
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-400 via-indigo-500 to-purple-500" />
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-blue-50 rounded-full blur-3xl opacity-50" />
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-indigo-50 rounded-full blur-3xl opacity-50" />

        <div className="relative z-10">
          <div className="flex justify-center mb-8">
            <div className="relative">
              <div className="w-24 h-24 bg-blue-600 rounded-[2rem] flex items-center justify-center text-white shadow-xl shadow-blue-600/30">
                <Video className="w-10 h-10" />
              </div>
              <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-emerald-500 border-4 border-white rounded-full" />
            </div>
          </div>

          <h1 className="text-3xl font-black text-slate-900 mb-2 tracking-tight">Virtual Waiting Room</h1>
          <p className="text-slate-500 mb-10 max-w-md mx-auto">
            You're in line for your consultation with <span className="text-blue-600 font-bold">{doctorName}</span>.
          </p>

          <div className="grid grid-cols-2 gap-6 mb-10">
            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
              <div className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Queue Position</div>
              <div className="text-3xl font-black text-slate-900 flex items-center justify-center gap-2">
                <Users className="w-6 h-6 text-blue-600" />
                #{queuePosition}
              </div>
            </div>
            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
              <div className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Est. Wait Time</div>
              <div className="text-3xl font-black text-slate-900 flex items-center justify-center gap-2">
                <Clock className="w-6 h-6 text-blue-600" />
                {estimatedWait} <span className="text-sm font-medium">min</span>
              </div>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {!isReady ? (
              <motion.div 
                key="waiting"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex items-center justify-center gap-3 text-blue-600 font-bold bg-blue-50 py-4 px-8 rounded-2xl"
              >
                <Loader2 className="w-5 h-5 animate-spin" />
                The doctor will be with you shortly...
              </motion.div>
            ) : (
              <motion.button
                key="ready"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onJoinConsultation}
                className="w-full bg-blue-600 text-white font-black py-6 rounded-[2rem] shadow-2xl shadow-blue-600/30 flex items-center justify-center gap-3 group"
              >
                Join Consultation Now
                <ArrowRight className="w-6 h-6 group-hover:translate-x-2 transition-transform" />
              </motion.button>
            )}
          </AnimatePresence>

          <div className="mt-12 flex items-center justify-center gap-2 text-slate-400 text-sm font-medium">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            End-to-end encrypted consultation
          </div>
        </div>
      </motion.div>

      <div className="mt-8 flex items-center gap-3 bg-white/50 backdrop-blur-sm p-4 rounded-2xl border border-white/50">
        <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
          <Info className="w-4 h-4" />
        </div>
        <p className="text-xs text-slate-500 text-left">
          Please stay on this page. We'll automatically notify you when it's your turn. Make sure your camera and microphone permissions are enabled.
        </p>
      </div>
    </div>
  );
};

export default VirtualLobby;
