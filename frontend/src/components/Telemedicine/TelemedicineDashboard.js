import React, { useState } from 'react';
import { 
  Video, 
  Calendar, 
  Activity, 
  Pill, 
  Users, 
  ChevronRight,
  Stethoscope,
  Clock,
  MessageCircle,
  Shield
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import VideoConsultation from './VideoConsultation';
import AppointmentScheduler from './AppointmentScheduler';
import RemoteMonitoring from './RemoteMonitoring';
import PrescriptionManager from './PrescriptionManager';
import VirtualLobby from './VirtualLobby';

const TelemedicineDashboard = ({ user }) => {
  const [activeView, setActiveView] = useState('overview'); // overview, video, schedule, monitoring, prescriptions, lobby
  const [currentConsultation, setCurrentConsultation] = useState(null);

  const stats = [
    { label: 'Next Appointment', value: 'Today, 2:00 PM', icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Active Prescriptions', value: '3', icon: Pill, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Health Score', value: '92/100', icon: Activity, color: 'text-purple-600', bg: 'bg-purple-50' },
  ];

  const quickActions = [
    { id: 'schedule', title: 'Book Session', icon: Calendar, color: 'bg-blue-600' },
    { id: 'monitoring', title: 'Vitals Log', icon: Activity, color: 'bg-emerald-600' },
    { id: 'prescriptions', title: 'Refill', icon: Pill, color: 'bg-purple-600' },
  ];

  const renderView = () => {
    switch (activeView) {
      case 'video':
        return <VideoConsultation patientName={user?.name || 'Patient'} onEndCall={() => setActiveView('overview')} />;
      case 'schedule':
        return <AppointmentScheduler onSchedule={(data) => {
          console.log("Scheduled:", data);
          setActiveView('lobby');
        }} />;
      case 'monitoring':
        return <RemoteMonitoring />;
      case 'prescriptions':
        return <PrescriptionManager />;
      case 'lobby':
        return <VirtualLobby doctorName="Dr. Sarah Chen" onJoinConsultation={() => setActiveView('video')} />;
      default:
        return (
          <div className="space-y-8">
            {/* Hero Section */}
            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[2.5rem] p-10 text-white relative overflow-hidden">
              <div className="relative z-10">
                <h1 className="text-4xl font-black mb-4 tracking-tight">Virtual Care, Anytime.</h1>
                <p className="text-blue-100 text-lg mb-8 max-w-lg">Connect with world-class healthcare specialists from the comfort of your home.</p>
                <button 
                  onClick={() => setActiveView('lobby')}
                  className="bg-white text-blue-600 font-bold px-8 py-4 rounded-2xl flex items-center gap-2 hover:bg-blue-50 transition-all shadow-xl shadow-blue-900/20 active:scale-95"
                >
                  Join Waiting Room
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
              <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl translate-x-1/3 -translate-y-1/3" />
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {stats.map((stat, idx) => (
                <div key={idx} className="bg-white p-6 rounded-3xl border border-slate-100 flex items-center gap-4">
                  <div className={`p-4 ${stat.bg} ${stat.color} rounded-2xl`}>
                    <stat.icon className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">{stat.label}</p>
                    <p className="text-xl font-bold text-slate-900">{stat.value}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Quick Actions & Recent Appts */}
              <div className="lg:col-span-2 space-y-6">
                <section>
                  <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <Stethoscope className="w-5 h-5 text-blue-600" />
                    Quick Actions
                  </h3>
                  <div className="grid grid-cols-3 gap-4">
                    {quickActions.map(action => (
                      <button
                        key={action.id}
                        onClick={() => setActiveView(action.id)}
                        className="flex flex-col items-center gap-3 p-6 bg-white rounded-3xl border border-slate-100 hover:border-blue-200 hover:shadow-xl hover:shadow-blue-600/5 transition-all group"
                      >
                        <div className={`p-4 ${action.color} text-white rounded-2xl group-hover:scale-110 transition-transform`}>
                          <action.icon className="w-6 h-6" />
                        </div>
                        <span className="font-bold text-slate-700">{action.title}</span>
                      </button>
                    ))}
                  </div>
                </section>

                <section className="bg-white rounded-3xl p-8 border border-slate-100">
                  <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-blue-600" />
                    Upcoming Consultations
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 font-bold">SC</div>
                        <div>
                          <p className="font-bold text-slate-900">Dr. Sarah Chen</p>
                          <p className="text-sm text-slate-500">General Consultation • 2:00 PM</p>
                        </div>
                      </div>
                      <button className="p-2 text-blue-600 hover:bg-white rounded-lg transition-colors">
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </section>
              </div>

              {/* Sidebar: Health Tips or Secondary Info */}
              <div className="space-y-6">
                <div className="bg-slate-900 rounded-[2rem] p-8 text-white">
                  <Shield className="w-10 h-10 text-blue-400 mb-6" />
                  <h3 className="text-xl font-bold mb-2">Private & Secure</h3>
                  <p className="text-slate-400 text-sm mb-6">Your consultations and health data are always end-to-end encrypted.</p>
                  <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full w-full bg-blue-500" />
                  </div>
                </div>

                <div className="bg-blue-50 rounded-[2rem] p-8 border border-blue-100">
                  <h3 className="text-lg font-bold text-blue-900 mb-4">Need help?</h3>
                  <p className="text-blue-700 text-sm mb-6">Our 24/7 support team is here to assist with any technical issues.</p>
                  <button className="w-full py-4 bg-white text-blue-600 font-bold rounded-2xl flex items-center justify-center gap-2 hover:bg-blue-100 transition-colors shadow-sm">
                    <MessageCircle className="w-5 h-5" />
                    Start Chat
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="telemedicine-dashboard pb-12">
      {/* View Header with Breadcrumbs if not in overview */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeView}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
        >
          {activeView !== 'overview' && (
            <button 
              onClick={() => setActiveView('overview')}
              className="mb-6 flex items-center gap-2 text-slate-500 hover:text-slate-900 font-semibold transition-colors group"
            >
              <ChevronRight className="w-5 h-5 rotate-180" />
              Back to Overview
            </button>
          )}
          {renderView()}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default TelemedicineDashboard;
