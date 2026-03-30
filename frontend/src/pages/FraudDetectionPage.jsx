import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, AlertTriangle, LayoutDashboard, Database, Activity, MessagesSquare, Cpu, Bell, Settings } from 'lucide-react';

// Components
import FraudDashboard from '../components/FraudDashboard';
import CaseManager from '../components/CaseManager';
import AlertsPanel from '../components/AlertsPanel';
import PatternVisualizer from '../components/PatternVisualizer';
import ModelPerformance from '../components/ModelPerformance';
import FeedbackSystem from '../components/FeedbackSystem';

export const FraudDetectionPage = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  
  // Data State
  const [stats, setStats] = useState({
    kpis: null,
    riskTrend: [],
    riskDistribution: [],
    alerts: [],
    cases: [],
    networkData: null,
    heatmapData: null,
    modelStats: null
  });

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const API = 'http://localhost:3000/api/fraud';
        const [dash, alerts, cases, patterns, mStats] = await Promise.all([
          axios.get(`${API}/dashboard`),
          axios.get(`${API}/alerts`),
          axios.get(`${API}/cases`),
          axios.get(`${API}/patterns`),
          axios.get(`${API}/model-stats`)
        ]);

        setStats({
          kpis: dash.data.kpis,
          riskTrend: dash.data.riskTrend,
          riskDistribution: dash.data.riskDistribution,
          alerts: alerts.data,
          cases: cases.data,
          networkData: patterns.data.network,
          heatmapData: patterns.data.heatmap,
          modelStats: mStats.data
        });
      } catch (error) {
        console.error("Dashboard Data Fetch Failed", error);
      } finally {
        setTimeout(() => setLoading(false), 800); // Smooth transition
      }
    };
    fetchData();
  }, []);

  const tabs = [
    { id: 'dashboard', label: 'Detection Center', icon: <LayoutDashboard size={18} /> },
    { id: 'cases', label: 'Investigator Queue', icon: <Database size={18} /> },
    { id: 'alerts', label: 'Live Risk Stream', icon: <AlertTriangle size={18} /> },
    { id: 'patterns', label: 'Pattern Network', icon: <Activity size={18} /> },
    { id: 'performance', label: 'Model Intelligence', icon: <Cpu size={18} /> },
    { id: 'feedback', label: 'Feedback Loop', icon: <MessagesSquare size={18} /> }
  ];

  const updateCase = async (id, update) => {
    setStats(prev => ({ ...prev, cases: prev.cases.map(c => c.id === id ? {...c, ...update} : c) }));
    await axios.patch(`http://localhost:3000/api/fraud/cases/${id}`, update);
  };

  return (
    <div className="min-h-screen text-slate-100 selection:bg-indigo-500/30">
      
      {/* Immersive Header */}
      <div className="relative overflow-hidden pt-12 pb-24 px-8 lg:px-16">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_-20%,#1e1b4b,transparent)] pointer-events-none opacity-40"></div>
        
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 mb-12">
            <motion.div 
               initial={{ opacity: 0, x: -20 }} 
               animate={{ opacity: 1, x: 0 }}
               className="space-y-2"
            >
              <div className="flex items-center gap-3">
                 <div className="w-12 h-12 glass-card rounded-2xl flex-center text-indigo-400 border-indigo-500/30 glow-text-indigo">
                    <ShieldAlert size={28} />
                 </div>
                 <h1 className="text-4xl font-extrabold tracking-tight">
                    Security <span className="text-indigo-400">Intelligence</span>
                 </h1>
              </div>
              <p className="text-slate-400 font-medium max-w-xl">
                 Real-time ensemble forensics powered by Isolation Forest & behavioral pattern matching.
              </p>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-6"
            >
               <div className="glass-card px-6 py-3 rounded-2xl flex items-center gap-4">
                  <div className="text-right">
                     <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Model Engine</p>
                     <p className="text-sm font-bold text-indigo-300">Ensemble v2.4a</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex-center text-indigo-400 border border-indigo-500/20">
                     <Cpu size={20} className="animate-pulse" />
                  </div>
               </div>

               <div className="flex items-center gap-2">
                  <button className="glass-card w-11 h-11 flex-center rounded-xl text-slate-400 hover:text-white transition-colors">
                     <Bell size={20} />
                  </button>
                  <button className="glass-card w-11 h-11 flex-center rounded-xl text-slate-400 hover:text-white transition-colors">
                     <Settings size={20} />
                  </button>
               </div>
            </motion.div>
          </div>

          {/* Navigation Bar */}
          <div className="flex gap-2 bg-[#050608]/40 p-1.5 rounded-2xl border border-slate-800/50 backdrop-blur-xl max-w-fit overflow-x-auto scrollbar-hide">
             {tabs.map(tab => (
                <button
                   key={tab.id}
                   onClick={() => setActiveTab(tab.id)}
                   className={`relative flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all duration-300 ${
                      activeTab === tab.id 
                      ? 'text-white' 
                      : 'text-slate-400 hover:text-slate-200'
                   }`}
                >
                   {activeTab === tab.id && (
                      <motion.div 
                        layoutId="activeTab" 
                        className="absolute inset-0 bg-indigo-600/20 border border-indigo-500/40 rounded-xl"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                      />
                   )}
                   <span className="relative z-10">{tab.icon}</span>
                   <span className="relative z-10">{tab.label}</span>
                   {tab.id === 'alerts' && stats.alerts.length > 0 && (
                      <span className="relative z-10 ml-2 px-2 py-0.5 bg-rose-600 text-white text-[10px] font-black rounded-full animate-pulse shadow-lg shadow-rose-900/40">
                         {stats.alerts.length}
                      </span>
                   )}
                </button>
             ))}
          </div>
        </div>
      </div>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-8 lg:px-16 -mt-8 pb-32">
        <AnimatePresence mode="wait">
          {loading ? (
             <motion.div 
               key="loader"
               initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
               className="glass-card rounded-3xl p-24 flex-center flex-col gap-6 min-h-[500px]"
             >
                <div className="relative">
                   <div className="w-16 h-16 border-4 border-indigo-500/10 border-t-indigo-500 rounded-full animate-spin"></div>
                   <ShieldAlert className="absolute-center text-indigo-400/40" size={24} />
                </div>
                <div className="text-center space-y-2">
                   <p className="text-xl font-bold glow-text-indigo">Initializing Neural Core</p>
                   <p className="text-sm text-slate-500">Synthesizing behavioral patterns...</p>
                </div>
             </motion.div>
          ) : (
            <motion.div
               key={activeTab}
               initial={{ opacity: 0, y: 15 }}
               animate={{ opacity: 1, y: 0 }}
               transition={{ duration: 0.4, ease: "easeOut" }}
            >
               {activeTab === 'dashboard' && (
                  <FraudDashboard 
                    kpis={stats.kpis} 
                    alerts={stats.alerts} 
                    riskTrend={stats.riskTrend} 
                    riskDistribution={stats.riskDistribution}
                    modelPerformance={stats.modelStats?.performanceMetrics}
                  />
               )}
               {activeTab === 'cases' && <CaseManager cases={stats.cases} onUpdateCase={updateCase} />}
               {activeTab === 'alerts' && <AlertsPanel alerts={stats.alerts} />}
               {activeTab === 'patterns' && <PatternVisualizer networkData={stats.networkData} heatmapData={stats.heatmapData} />}
               {activeTab === 'performance' && <ModelPerformance stats={stats.modelStats} />}
               {activeTab === 'feedback' && (
                  <FeedbackSystem 
                    submitFeedback={async (cid, r) => {
                       await axios.post('http://localhost:3000/api/fraud/feedback', { claimId: cid, reason: r });
                       const s = await axios.get('http://localhost:3000/api/fraud/model-stats');
                       setStats(p => ({...p, modelStats: s.data}));
                    }} 
                    falsePositivesCount={stats.modelStats?.performanceMetrics?.falsePositivesRecorded}
                  />
               )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      
    </div>
  );
};

export default FraudDetectionPage;
