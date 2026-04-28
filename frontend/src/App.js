import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { 
  ShieldAlert, Users, Database, LayoutDashboard, Search, Command, 
  Trophy, FileText, Sparkles, Activity, Upload, Menu, X, Bell
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { HelmetProvider } from 'react-helmet-async';
import LanguageSwitcher from './components/LanguageSwitcher';
import SyncStatusIndicator from './components/SyncStatusIndicator';
import SEOHead from './components/SEO/SEOHead';
import FraudDetectionPage from './pages/FraudDetectionPage';
import GamificationPage from './pages/GamificationPage';
import CMSPage from './pages/CMSPage';
import RecommendationsPage from './pages/RecommendationsPage';
import RealtimeDashboard from './components/RealtimeDashboard';
import AdvancedSearch from './components/AdvancedSearch';
import DocumentUpload from './components/DocumentUpload';
import PaymentHistoryAnalytics from './components/PaymentHistoryAnalytics';
import VoicePaymentCommands from './components/VoicePaymentCommands';
import useAppStore from './store/useAppStore';
import StateDebugger from './components/StateDebugger';

const SidebarItem = ({ to, icon, label, badge }) => {
   const location = useLocation();
   const isActive = location.pathname === to || (to === '/' && location.pathname === '');

   return (
      <Link to={to} className="relative group block outline-none">
         <div className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${isActive
            ? 'bg-indigo-500/10 text-indigo-400'
            : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/40'
            }`}>
            <div className={`transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-105'}`}>
               {icon}
            </div>
            <span className="font-semibold text-sm tracking-wide">{label}</span>

            {badge && (
               <span className={`ml-auto px-2 py-0.5 rounded-lg text-[10px] font-black ${isActive ? 'bg-indigo-500 text-white' : 'bg-rose-600/80 text-white'
                  }`}>
                  {badge}
               </span>
            )}
         </div>
         {isActive && (
            <motion.div
               layoutId="sidebarActive"
               className="absolute left-0 top-2 bottom-2 w-1 bg-indigo-500 rounded-full"
            />
         )}
      </Link>
   );
};

const SidebarContent = ({ user }) => (
   <>
      <div className="p-6 lg:p-8">
         <div className="flex items-center gap-3 mb-8 lg:mb-10">
            <div className="w-10 h-10 rounded-2xl premium-gradient flex-center shadow-[0_0_20px_rgba(99,102,241,0.4)]">
               <ShieldAlert size={22} className="text-white" />
            </div>
            <div>
               <span className="block font-black text-xl text-white tracking-tighter leading-tight">AEGIS</span>
               <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Health Systems</span>
            </div>
         </div>
         
         <div className="relative mb-8">
            <Search size={16} className="absolute left-3 top-2.5 text-slate-600" />
            <input 
               disabled
               placeholder="Universal search..." 
               className="w-full bg-slate-900/50 border border-slate-800 rounded-xl py-2 pl-10 pr-4 text-xs font-medium text-slate-400 cursor-not-allowed"
            />
            <div className="absolute right-2 top-2 px-1.5 py-0.5 bg-slate-800 rounded-md text-[8px] font-bold text-slate-500 border border-slate-700 flex items-center gap-1 uppercase">
               <Command size={8} /> K
            </div>
         </div>

         <nav className="space-y-1.5">
            <p className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.15em] mb-4 ml-4">Command Center</p>
            <SidebarItem to="/" icon={<LayoutDashboard size={20} />} label="Operational Overview" />
            <SidebarItem to="/recommendations" icon={<Sparkles size={20} />} label="AI Recommendations" />
            
            <div className="pt-6 mb-4">
               <p className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.15em] mb-4 ml-4">Management</p>
               <SidebarItem to="/patients" icon={<Users size={20} />} label="Patient Forensics" />
               <SidebarItem to="/providers" icon={<Database size={20} />} label="Provider Entities" />
              <SidebarItem to="/payments" icon={<Activity size={20} />} label="Payments" />
               <SidebarItem to="/cms" icon={<FileText size={20} />} label="Content Nexus" />
            </div>

            <div className="pt-6 mb-4">
               <p className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.15em] mb-4 ml-4">Anti-Fraud Engine</p>
               <SidebarItem to="/fraud" icon={<ShieldAlert size={20} />} label="Fraud Intelligence" badge="NEW" />
            </div>

            <div className="pt-6 mb-4">
               <p className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.15em] mb-4 ml-4">Tools</p>
               <SidebarItem to="/realtime-dashboard" icon={<Activity size={20} />} label="Real-time Dashboard" />
               <SidebarItem to="/search" icon={<Search size={20} />} label="Advanced Search" />
               <SidebarItem to="/file-upload" icon={<Upload size={20} />} label="File Upload" />
            </div>

            <div className="pt-6 mb-4">
               <p className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.15em] mb-4 ml-4">Personal Growth</p>
               <SidebarItem to="/gamification" icon={<Trophy size={20} />} label="Performance Center" />
            </div>
         </nav>
      </div>
      
      <div className="mt-auto p-4 lg:p-6 border-t border-slate-900 bg-slate-900/10">
         <div className="flex items-center gap-3 p-2 bg-slate-900/40 rounded-2xl border border-slate-800/50">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex-center font-bold text-white shadow-lg overflow-hidden relative">
               <span className="relative z-10 text-xs">{user.name.split(' ').map(n => n[0]).join('')}</span>
               <div className="absolute inset-0 bg-white/10 blur-sm"></div>
            </div>
            <div className="flex-1 overflow-hidden">
              <div className="text-sm font-bold text-slate-200 truncate">{user.name}</div>
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Level {user.level} Admin</div>
            </div>
         </div>
      </div>
   </>
);

const Layout = ({ children }) => {
  const { user } = useAppStore();
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
      if (window.innerWidth >= 1024) {
        setSidebarOpen(false);
      }
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location]);

  return (
    <div className="flex bg-[#0a0c10] min-h-screen relative">
      {/* Mobile Header */}
      {isMobile && (
        <header className="fixed top-0 left-0 right-0 z-50 bg-[#050608] border-b border-slate-900 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                aria-label="Toggle menu"
              >
                {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl premium-gradient flex-center shadow-[0_0_20px_rgba(99,102,241,0.4)]">
                  <ShieldAlert size={18} className="text-white" />
                </div>
                <span className="font-black text-lg text-white">AEGIS</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors relative">
                <Bell size={18} />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              </button>
            </div>
          </div>
        </header>
      )}

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isMobile && sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/50"
              onClick={() => setSidebarOpen(false)}
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 left-0 z-50 w-72 h-screen bg-[#050608] border-r border-slate-900 flex flex-col"
            >
              <SidebarContent user={user} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar */}
      {!isMobile && (
        <aside className="w-72 bg-[#050608] border-r border-slate-900 flex flex-col shrink-0 h-screen sticky top-0 z-50 overflow-y-auto">
          <SidebarContent user={user} />
        </aside>
      )}

      {/* Sub-surface background effect */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[10%] left-[20%] w-[40rem] h-[40rem] bg-indigo-900/10 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[20%] right-[10%] w-[30rem] h-[30rem] bg-purple-900/10 blur-[100px] rounded-full"></div>
      </div>

      {/* Main Viewport */}
      <main className={`flex-1 min-h-screen relative z-10 max-w-full overflow-hidden ${isMobile ? 'pt-16' : ''}`}>
        {children}
      </main>
    </div>
  );
};

const Placeholder = ({ name }) => (
  <div className="flex-center flex-col min-h-screen text-slate-500 space-y-4">
     <div className="w-20 h-20 rounded-3xl bg-slate-900 border border-slate-800 flex-center">
        <Activity size={40} className="text-slate-700" />
     </div>
     <h2 className="text-2xl font-bold text-slate-400">{name} Service</h2>
     <p className="max-w-xs text-center text-sm">This module is currently initializing. Please check the sidebar for live demonstrations.</p>
  </div>
);

const PaymentsPage = () => {
  const [lastCommand, setLastCommand] = useState(null);

  const handleExecutePayment = ({ amount, method, rawCommand }) => {
    // Scoped frontend behavior: accessibility command capture and confirmation.
    setLastCommand({
      id: Date.now(),
      amount,
      method,
      rawCommand
    });
  };

  return (
    <div className="p-8">
      <VoicePaymentCommands onExecutePayment={handleExecutePayment} />

      {lastCommand && (
        <div className="mb-6 p-4 rounded-2xl border border-emerald-600/30 bg-emerald-500/10 text-emerald-300">
          <p className="font-semibold">Last voice payment command queued</p>
          <p className="text-sm mt-1">
            ${lastCommand.amount.toFixed(2)} via {lastCommand.method} - "{lastCommand.rawCommand}"
          </p>
        </div>
      )}

      <PaymentHistoryAnalytics />
    </div>
  );
};

const AppWithSEO = () => {
   const location = useLocation();

   const getBreadcrumbs = () => {
      const pathSegments = location.pathname.split('/').filter(Boolean);
      const breadcrumbs = [{ name: 'Home', path: '/' }];

      let currentPath = '';
      pathSegments.forEach((segment, index) => {
         currentPath += `/${segment}`;
         const name = segment.charAt(0).toUpperCase() + segment.slice(1);
         breadcrumbs.push({ name, path: currentPath });
      });

      return breadcrumbs;
   };

   return (
      <>
         <SEOHead
            page={location.pathname}
            breadcrumbs={getBreadcrumbs()}
         />
         <Routes>
            <Route path="/" element={<Placeholder name="Main Dashboard" />} />
            <Route path="/patients" element={<Placeholder name="Patient Records" />} />
            <Route path="/providers" element={<Placeholder name="Provider Registry" />} />
            <Route path="/payments" element={<PaymentHistoryAnalytics />} />
            <Route path="/notifications" element={<NotificationManagementDashboard />} />
            <Route path="/fraud" element={<FraudDetectionPage />} />
         </Routes>
      </>
   );
};

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Placeholder name="Main Dashboard" />} />
          <Route path="/patients" element={<Placeholder name="Patient Records" />} />
          <Route path="/providers" element={<Placeholder name="Provider Registry" />} />
          <Route path="/payments" element={<PaymentsPage />} />
          <Route path="/fraud" element={<FraudDetectionPage />} />
          <Route path="/gamification" element={<GamificationPage />} />
          <Route path="/cms" element={<CMSPage />} />
          <Route path="/recommendations" element={<RecommendationsPage />} />
          <Route path="/realtime-dashboard" element={<RealtimeDashboard />} />
          <Route path="/search" element={<AdvancedSearch />} />
          <Route path="/file-upload" element={
            <div className="p-8">
              <h1 className="text-2xl font-bold text-white mb-6">File Upload & Management</h1>
              <DocumentUpload
                onUploadSuccess={(files) => console.log('Uploaded:', files)}
                onUploadError={(err) => console.error('Upload error:', err)}
              />
            </div>
          } />
        </Routes>
      </Layout>
      <StateDebugger />
    </Router>
  );
}

export default App;
