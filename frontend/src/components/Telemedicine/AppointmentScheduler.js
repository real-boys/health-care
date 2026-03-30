import React, { useState } from 'react';
import { Calendar as CalendarIcon, Clock, ChevronRight, User, Plus } from 'lucide-react';
import { motion } from 'framer-motion';

const AppointmentScheduler = ({ onSchedule }) => {
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [reason, setReason] = useState('');

  const timeSlots = [
    '09:00 AM', '10:00 AM', '11:00 AM', '01:00 PM', '02:00 PM', '03:00 PM', '04:00 PM'
  ];

  const dates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i + 1);
    return d;
  });

  const handleSchedule = () => {
    if (selectedDate && selectedTime) {
      onSchedule({
        date: selectedDate,
        time: selectedTime,
        reason
      });
    }
  };

  return (
    <div className="appointment-scheduler bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
          <CalendarIcon className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900">Schedule Consultation</h2>
          <p className="text-slate-500 text-sm">Book a virtual session with your healthcare provider</p>
        </div>
      </div>

      <div className="space-y-8">
        {/* Date Selection */}
        <section>
          <label className="block text-sm font-semibold text-slate-700 mb-4 uppercase tracking-wider">Select Date</label>
          <div className="grid grid-cols-4 md:grid-cols-7 gap-3">
            {dates.map((date, idx) => {
              const isSelected = selectedDate?.toDateString() === date.toDateString();
              return (
                <button
                  key={idx}
                  onClick={() => setSelectedDate(date)}
                  className={`flex flex-col items-center justify-center p-4 rounded-2xl transition-all border ${
                    isSelected ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-600/20 scale-105' : 'bg-slate-50 border-transparent text-slate-600 hover:border-slate-200'
                  }`}
                >
                  <span className="text-xs opacity-60 uppercase mb-1">{date.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                  <span className="text-lg font-bold">{date.getDate()}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Time Selection */}
        <section>
          <label className="block text-sm font-semibold text-slate-700 mb-4 uppercase tracking-wider">Available Times</label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {timeSlots.map((time, idx) => {
              const isSelected = selectedTime === time;
              return (
                <button
                  key={idx}
                  onClick={() => setSelectedTime(time)}
                  className={`flex items-center gap-3 p-4 rounded-2xl transition-all border ${
                    isSelected ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-600/20 scale-105' : 'bg-slate-50 border-transparent text-slate-600 hover:border-slate-200'
                  }`}
                >
                  <Clock className="w-5 h-5 opacity-60" />
                  <span className="font-semibold">{time}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Reason Input */}
        <section>
          <label className="block text-sm font-semibold text-slate-700 mb-4 uppercase tracking-wider">Reason for Visit</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-900 placeholder:text-slate-400"
            placeholder="Describe your symptoms or reason for the consultation..."
            rows={4}
          />
        </section>

        <button
          onClick={handleSchedule}
          disabled={!selectedDate || !selectedTime}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:cursor-not-allowed text-white font-bold py-5 rounded-3xl transition-all flex items-center justify-center gap-2 group shadow-xl shadow-blue-600/10 active:scale-95"
        >
          <Plus className="w-5 h-5" />
          Confirm Appointment
          <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    </div>
  );
};

export default AppointmentScheduler;
