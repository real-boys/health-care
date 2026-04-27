import React from 'react';
import { motion } from 'framer-motion';
import { Trophy, Star, Target, TrendingUp, Award, Zap } from 'lucide-react';
import useAppStore from '../store/useAppStore';

const GamificationPage = () => {
  const { points, badges, achievements, addPoints } = useAppStore();

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tight mb-2">Performance Center</h1>
          <p className="text-slate-500 font-medium">Track your contributions and unlock rewards.</p>
        </div>
        <div className="flex gap-4">
          <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-2xl flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/20 flex items-center justify-center">
              <Zap className="text-indigo-400" size={24} />
            </div>
            <div>
              <span className="block text-2xl font-black text-white">{points}</span>
              <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Total Points</span>
            </div>
          </div>
          <button 
            onClick={() => addPoints(50)}
            className="premium-gradient px-6 py-4 rounded-2xl font-bold text-white shadow-lg hover:scale-105 transition-transform active:scale-95"
          >
            Claim Daily Bonus
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Progress Tracking */}
        <section className="lg:col-span-2 space-y-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Target className="text-indigo-500" size={20} />
            Active Achievements
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {achievements.map((achievement) => (
              <motion.div 
                key={achievement.id}
                whileHover={{ y: -4 }}
                className="bg-slate-900/40 border border-slate-800 p-6 rounded-3xl relative overflow-hidden group"
              >
                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="font-bold text-slate-200">{achievement.name}</h3>
                    {achievement.completed && <Award className="text-yellow-500" size={20} />}
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full mb-2 overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${(achievement.progress / achievement.total) * 100}%` }}
                      className="h-full bg-indigo-500"
                    />
                  </div>
                  <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase">
                    <span>{achievement.progress} / {achievement.total}</span>
                    <span>{Math.round((achievement.progress / achievement.total) * 100)}%</span>
                  </div>
                </div>
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-3xl rounded-full -mr-16 -mt-16 group-hover:bg-indigo-500/10 transition-colors" />
              </motion.div>
            ))}
          </div>

          <h2 className="text-xl font-bold text-white flex items-center gap-2 pt-4">
            <Award className="text-purple-500" size={20} />
            Unlocked Badges
          </h2>
          <div className="flex flex-wrap gap-4">
            {badges.map((badge) => (
              <motion.div 
                key={badge.id}
                whileHover={{ scale: 1.1, rotate: 5 }}
                className="w-24 h-24 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col items-center justify-center gap-2 p-2 text-center shadow-xl"
              >
                <span className="text-3xl">{badge.icon}</span>
                <span className="text-[9px] font-black text-slate-400 uppercase leading-tight">{badge.name}</span>
              </motion.div>
            ))}
            <div className="w-24 h-24 border-2 border-dashed border-slate-800 rounded-2xl flex items-center justify-center text-slate-700">
               <Star size={24} />
            </div>
          </div>
        </section>

        {/* Leaderboard */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-3xl overflow-hidden">
          <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/40">
             <h2 className="font-bold text-white flex items-center gap-2">
                <TrendingUp className="text-emerald-500" size={20} />
                Global Leaderboard
             </h2>
             <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter bg-slate-800 px-2 py-1 rounded">Weekly</span>
          </div>
          <div className="p-4 space-y-2">
             {[
               { name: 'Sarah Connor', points: 4820, rank: 1, color: 'text-yellow-500' },
               { name: 'Marcus Wright', points: 4150, rank: 2, color: 'text-slate-300' },
               { name: 'Kyle Reese', points: 3900, rank: 3, color: 'text-amber-600' },
               { name: 'John Smith', points: 1250, rank: 42, color: 'text-indigo-400', me: true },
             ].map((user, i) => (
               <div key={user.name} className={`flex items-center gap-4 p-3 rounded-2xl transition-colors ${user.me ? 'bg-indigo-500/10 border border-indigo-500/20' : 'hover:bg-white/5'}`}>
                  <span className={`w-6 text-center font-black ${user.color}`}>{user.rank}</span>
                  <div className="w-8 h-8 rounded-lg bg-slate-800 flex-center text-xs font-bold text-slate-400">
                    {user.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div className="flex-1">
                    <span className={`block text-xs font-bold ${user.me ? 'text-indigo-300' : 'text-slate-300'}`}>{user.name}</span>
                    <span className="text-[10px] text-slate-500 font-medium">{user.points.toLocaleString()} XP</span>
                  </div>
               </div>
             ))}
          </div>
          <div className="p-6 text-center border-t border-slate-800 bg-slate-900/20">
             <button className="text-[10px] font-black text-indigo-400 uppercase tracking-widest hover:text-indigo-300 transition-colors">View Full Leaderboard</button>
          </div>
        </section>
      </div>
    </div>
  );
};

export default GamificationPage;
