import React, { useState } from 'react';
import { Pill, FileText, Download, CheckCircle, Clock, Plus, Search, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';

const PrescriptionManager = () => {
  const [prescriptions] = useState([
    { id: 1, medication: 'Amoxicillin', dosage: '500mg', frequency: 'Twice daily', date: 'Oct 12, 2024', status: 'Active', doctor: 'Dr. Sarah Chen' },
    { id: 2, medication: 'Lisinopril', dosage: '10mg', frequency: 'Once daily', date: 'Sep 28, 2024', status: 'Active', doctor: 'Dr. Michael Ross' },
    { id: 3, medication: 'Ibuprofen', dosage: '400mg', frequency: 'Every 6 hours as needed', date: 'Aug 15, 2024', status: 'Expired', doctor: 'Dr. Emily Watson' },
  ]);

  return (
    <div className="prescription-manager space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Prescriptions</h2>
          <p className="text-slate-500">Manage your active and historical medications</p>
        </div>
        <button className="flex items-center gap-2 px-6 py-4 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 active:scale-95">
          <Plus className="w-5 h-5" />
          Request Renewal
        </button>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input 
          type="text" 
          placeholder="Search medications..." 
          className="w-full pl-12 pr-6 py-4 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
        />
      </div>

      <div className="grid gap-4">
        {prescriptions.map((prescription, idx) => (
          <motion.div
            key={prescription.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:shadow-xl hover:shadow-slate-200/50 transition-all group"
          >
            <div className="flex items-center gap-6">
              <div className={`p-5 rounded-2xl ${prescription.status === 'Active' ? 'bg-blue-50 text-blue-600' : 'bg-slate-50 text-slate-400'} group-hover:scale-110 transition-transform`}>
                <Pill className="w-8 h-8" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-lg font-bold text-slate-900">{prescription.medication}</h3>
                  <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${
                    prescription.status === 'Active' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {prescription.status}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm text-slate-500">
                  <span className="flex items-center gap-1.5"><Clock className="w-4 h-4" /> {prescription.frequency}</span>
                  <span className="flex items-center gap-1.5"><FileText className="w-4 h-4" /> {prescription.dosage}</span>
                </div>
                <p className="text-xs text-slate-400 mt-2">Prescribed by {prescription.doctor} on {prescription.date}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button title="Download PDF" className="p-3 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all">
                <Download className="w-5 h-5" />
              </button>
              <button title="View Details" className="p-3 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all border border-transparent hover:border-blue-100">
                <CheckCircle className="w-5 h-5" />
              </button>
              <div className="w-[1px] h-6 bg-slate-100 mx-2 hidden md:block" />
              <button className="px-6 py-3 text-sm font-bold text-blue-600 hover:bg-blue-50 rounded-xl transition-all">
                Find Pharmacy
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default PrescriptionManager;
