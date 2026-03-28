import React from 'react';
import { Activity, Heart, Thermometer, Droplets, Weight, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';

const RemoteMonitoring = ({ patientData }) => {
  const metrics = [
    { title: 'Heart Rate', value: '72', unit: 'bpm', icon: Heart, color: 'text-red-500', bg: 'bg-red-50', trend: 'stable' },
    { title: 'Blood Pressure', value: '120/80', unit: 'mmHg', icon: Activity, color: 'text-blue-500', bg: 'bg-blue-50', trend: 'up' },
    { title: 'Temperature', value: '98.6', unit: '°F', icon: Thermometer, color: 'text-orange-500', bg: 'bg-orange-50', trend: 'stable' },
    { title: 'Blood Oxygen', value: '98', unit: '%', icon: Droplets, color: 'text-cyan-500', bg: 'bg-cyan-50', trend: 'down' },
    { title: 'Weight', value: '165', unit: 'lbs', icon: Weight, color: 'text-green-500', bg: 'bg-green-50', trend: 'up' },
  ];

  return (
    <div className="remote-monitoring space-y-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Health Monitoring</h2>
          <p className="text-slate-500">Real-time vitals and historical trends</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
          <span className="text-sm font-semibold uppercase tracking-wider">Live Syncing</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {metrics.map((metric, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 hover:shadow-xl hover:shadow-slate-200/50 transition-all group"
          >
            <div className="flex items-start justify-between mb-4">
              <div className={`p-4 ${metric.bg} ${metric.color} rounded-2xl group-hover:scale-110 transition-transform`}>
                <metric.icon className="w-6 h-6" />
              </div>
              <div className="flex items-center gap-1">
                {metric.trend === 'up' && <TrendingUp className="w-4 h-4 text-red-500" />}
                {metric.trend === 'down' && <TrendingDown className="w-4 h-4 text-blue-500" />}
                <span className={`text-xs font-bold uppercase tracking-wider ${metric.trend === 'up' ? 'text-red-500' : metric.trend === 'down' ? 'text-blue-500' : 'text-slate-400'}`}>
                  {metric.trend}
                </span>
              </div>
            </div>
            
            <div className="space-y-1">
              <h3 className="text-slate-500 text-sm font-medium">{metric.title}</h3>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-slate-900 tracking-tight">{metric.value}</span>
                <span className="text-slate-400 font-semibold">{metric.unit}</span>
              </div>
            </div>

            <div className="mt-6 h-12 w-full bg-slate-50 rounded-xl overflow-hidden relative">
              {/* Simple visual sparkline representation */}
              <div className="absolute inset-0 flex items-end justify-between px-1">
                {[...Array(10)].map((_, i) => (
                  <div 
                    key={i} 
                    className={`w-2 ${metric.bg.replace('bg-', 'bg-').replace('50', '200')} rounded-t-sm`} 
                    style={{ height: `${Math.random() * 80 + 20}%` }}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="bg-slate-900 rounded-3xl p-8 text-white relative overflow-hidden mt-8">
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-white/10 backdrop-blur-md rounded-2xl text-yellow-400">
              <AlertCircle className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-xl font-bold">Health Alert System</h3>
              <p className="text-slate-400 text-sm">We'll notify you if any vitals fall outside your normal range.</p>
            </div>
          </div>
          <button className="px-8 py-4 bg-white text-slate-900 font-bold rounded-2xl hover:bg-white/90 transition-colors whitespace-nowrap">
            Configure Alerts
          </button>
        </div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-64 h-48 bg-purple-500/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
      </div>
    </div>
  );
};

export default RemoteMonitoring;
