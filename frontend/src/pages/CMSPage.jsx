import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FilePlus, Save, History, Send, Clock, BarChart3, Edit3, Trash2, CheckCircle2 } from 'lucide-react';
import useAppStore from '../store/useAppStore';

const CMSPage = () => {
  const { content, addContent, updateContent } = useAppStore();
  const [isCreating, setIsCreating] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({ title: '', body: '', category: 'Announcement' });

  const handleSave = () => {
    if (editingItem) {
      updateContent(editingItem.id, formData);
      setEditingItem(null);
    } else {
      addContent(formData);
      setIsCreating(false);
    }
    setFormData({ title: '', body: '', category: 'Announcement' });
  };

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tight mb-2">Content Nexus</h1>
          <p className="text-slate-500 font-medium">Manage system announcements, help articles, and documentation.</p>
        </div>
        <button 
          onClick={() => setIsCreating(true)}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-indigo-500/20"
        >
          <FilePlus size={20} />
          Create New Content
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Analytics Mini-Dashboard */}
        <section className="lg:col-span-1 space-y-4">
           <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-3xl">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                 <BarChart3 size={16} className="text-indigo-500" />
                 Content Insights
              </h3>
              <div className="space-y-6">
                 <div>
                    <span className="block text-3xl font-black text-white">{content.length}</span>
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Total Articles</span>
                 </div>
                 <div className="pt-4 border-t border-slate-800/50">
                    <span className="block text-xl font-black text-emerald-500">1,240</span>
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Total Impressions</span>
                 </div>
              </div>
           </div>

           <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-3xl">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                 <Clock size={16} className="text-purple-500" />
                 Scheduled
              </h3>
              <p className="text-xs text-slate-600 font-medium italic">No content currently scheduled for release.</p>
           </div>
        </section>

        {/* Content List */}
        <section className="lg:col-span-3 space-y-4">
          <AnimatePresence>
            {(isCreating || editingItem) && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="bg-slate-900 border border-indigo-500/30 p-8 rounded-3xl shadow-2xl space-y-6 mb-8"
              >
                <div className="flex justify-between items-center">
                   <h2 className="text-xl font-bold text-white flex items-center gap-2">
                      <Edit3 size={20} className="text-indigo-400" />
                      {editingItem ? 'Edit Content' : 'Draft New Article'}
                   </h2>
                   <button onClick={() => { setIsCreating(false); setEditingItem(null); }} className="text-slate-500 hover:text-white transition-colors">Cancel</button>
                </div>
                
                <div className="grid grid-cols-2 gap-6">
                   <div className="col-span-2">
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Title</label>
                      <input 
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:border-indigo-500 outline-none transition-colors"
                        placeholder="e.g. System Maintenance Update"
                      />
                   </div>
                   <div className="col-span-2">
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Body Content (Rich Text)</label>
                      <textarea 
                        value={formData.body}
                        onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                        rows={6}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:border-indigo-500 outline-none transition-colors resize-none"
                        placeholder="Write your content here..."
                      />
                   </div>
                </div>

                <div className="flex justify-end gap-4">
                   <button className="flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-800 text-slate-300 font-bold hover:bg-slate-700 transition-colors">
                      <Clock size={18} />
                      Schedule
                   </button>
                   <button 
                    onClick={handleSave}
                    className="flex items-center gap-2 px-8 py-3 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-500 transition-colors"
                   >
                      <Save size={18} />
                      {editingItem ? 'Update' : 'Publish Now'}
                   </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-4">
            {content.length === 0 ? (
               <div className="bg-slate-900/20 border-2 border-dashed border-slate-800 rounded-3xl p-12 text-center">
                  <p className="text-slate-600 font-medium">No content created yet. Start by drafting your first article.</p>
               </div>
            ) : (
              content.map((item) => (
                <motion.div 
                  layout
                  key={item.id}
                  className="bg-slate-900/40 border border-slate-800 p-6 rounded-3xl flex justify-between items-start group hover:border-slate-700 transition-colors"
                >
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-bold text-slate-200">{item.title}</h3>
                      <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[8px] font-black uppercase tracking-tighter flex items-center gap-1">
                        <CheckCircle2 size={10} /> Published
                      </span>
                    </div>
                    <p className="text-sm text-slate-500 line-clamp-1 max-w-xl">{item.body}</p>
                    <div className="flex items-center gap-6 pt-2">
                       <span className="text-[10px] font-bold text-slate-600 flex items-center gap-1.5 uppercase">
                          <History size={12} /> v{item.version}
                       </span>
                       <span className="text-[10px] font-bold text-slate-600 flex items-center gap-1.5 uppercase">
                          <Clock size={12} /> {new Date(item.createdAt).toLocaleDateString()}
                       </span>
                    </div>
                  </div>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => { setEditingItem(item); setFormData({ title: item.title, body: item.body }); }}
                      className="p-2 hover:bg-indigo-500/10 text-slate-400 hover:text-indigo-400 rounded-lg transition-colors"
                    >
                      <Edit3 size={18} />
                    </button>
                    <button className="p-2 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 rounded-lg transition-colors">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default CMSPage;
