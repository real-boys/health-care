import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { ShieldAlert, Users, Database, LayoutDashboard, Search, Command, DollarSign, Bell } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from './components/LanguageSwitcher';
import SyncStatusIndicator from './components/SyncStatusIndicator';
import FraudDetectionPage from './pages/FraudDetectionPage';
import PaymentHistoryAnalytics from './components/PaymentHistoryAnalytics';
import NotificationManagementDashboard from './components/NotificationManagementDashboard';

const SidebarItem = ({ to, icon, label, badge }) => {
  const location = useLocation();
  const isActive = location.pathname === to || (to === '/' && location.pathname === '');

  return (
    <Link to={to} className="relative group block outline-none">
       <div className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${
          isActive 
          ? 'bg-indigo-500/10 text-indigo-400' 
          : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/40'
       }`}>
          <div className={`transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-105'}`}>
            {icon}
          </div>
          <span className="font-semibold text-sm tracking-wide">{label}</span>
          
          {badge && (
             <span className={`ml-auto px-2 py-0.5 rounded-lg text-[10px] font-black ${
                isActive ? 'bg-indigo-500 text-white' : 'bg-rose-600/80 text-white'
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

const Layout = ({ children }) => {
  const { t } = useTranslation();
  
  return (
    <div className="flex bg-[#0a0c10] min-h-screen">
       {/* Stealth Sidebar */}
       <aside className="w-72 bg-[#050608] border-r border-slate-900 flex flex-col hidden xl:flex shrink-0 h-screen sticky top-0 z-50">
          <div className="p-8">
             <div className="flex items-center gap-3 mb-10">
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

             {/* Sync Status Indicator */}
             <div className="mb-6 flex justify-end">
                <SyncStatusIndicator />
             </div>

             <nav className="space-y-1.5">
                <p className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.15em] mb-4 ml-4">{t('navigation.dashboard')}</p>
                <SidebarItem to="/" icon={<LayoutDashboard size={20} />} label={t('dashboard.title')} />
                <SidebarItem to="/patients" icon={<Users size={20} />} label={t('navigation.patients')} />
                <SidebarItem to="/providers" icon={<Database size={20} />} label={t('navigation.providers')} />
                <SidebarItem to="/payments" icon={<DollarSign size={20} />} label={t('navigation.payments')} />
                <SidebarItem to="/notifications" icon={<Bell size={20} />} label={t('navigation.notifications')} badge="NEW" />
                
                <div className="pt-8 mb-4">
                   <p className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.15em] mb-4 ml-4">{t('fraud.detection')}</p>
                   <SidebarItem to="/fraud" icon={<ShieldAlert size={20} />} label={t('navigation.fraud')} />
                </div>
             </nav>
          </div>
          
          <div className="mt-auto p-6 border-t border-slate-900 bg-slate-900/10">
             <div className="flex flex-col gap-3">
                <LanguageSwitcher />
                <div className="flex items-center gap-3 p-2 bg-slate-900/40 rounded-2xl border border-slate-800/50">
                   <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex-center font-bold text-white shadow-lg overflow-hidden relative">
                      <span className="relative z-10 text-xs">JS</span>
                      <div className="absolute inset-0 bg-white/10 blur-sm"></div>
                   </div>
                   <div className="flex-1 overflow-hidden">
                     <div className="text-sm font-bold text-slate-200 truncate">John Smith</div>
                     <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Level 4 Admin</div>
                   </div>
                </div>
             </div>
          </div>
       </aside>

       {/* Sub-surface background effect */}
       <div className="fixed inset-0 pointer-events-none z-0">
          <div className="absolute top-[10%] left-[20%] w-[40rem] h-[40rem] bg-indigo-900/10 blur-[120px] rounded-full"></div>
          <div className="absolute bottom-[20%] right-[10%] w-[30rem] h-[30rem] bg-purple-900/10 blur-[100px] rounded-full"></div>
       </div>

       {/* Main Viewport */}
       <main className="flex-1 min-h-screen relative z-10 max-w-full overflow-hidden">
          {children}
       </main>
    </div>
  );
};

const Placeholder = ({ name }) => (
  <div className="flex-center flex-col min-h-screen text-slate-500 space-y-4">
     <div className="w-20 h-20 rounded-3xl bg-slate-900 border border-slate-800 flex-center">
        <Database size={40} className="text-slate-700" />
     </div>
     <h2 className="text-2xl font-bold text-slate-400">{name} Service</h2>
     <p className="max-w-xs text-center text-sm">This module is currently initializing. Please check Fraud Intelligence for a live demonstration.</p>
  </div>
);

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Placeholder name="Main Dashboard" />} />
          <Route path="/patients" element={<Placeholder name="Patient Records" />} />
          <Route path="/providers" element={<Placeholder name="Provider Registry" />} />
          <Route path="/payments" element={<PaymentHistoryAnalytics />} />
          <Route path="/notifications" element={<NotificationManagementDashboard />} />
          <Route path="/fraud" element={<FraudDetectionPage />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;

export default App;

export default App;

export default App;

export default App;
