import { useState, useEffect } from 'react';
import { Play, Pause, Square, Plus, RefreshCw, Trash2, CheckCircle2, BarChart2, Book } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function ResearchExperiments() {
  const [experiments, setExperiments] = useState([]);
  const [selectedExperiments, setSelectedExperiments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    experiment_name: '',
    description: '',
    network_mode: 'Hybrid',
    sampling_interval: 15
  });

  const fetchExperiments = async () => {
    try {
      const res = await fetch('/api/research/experiments');
      if (res.ok) {
        const data = await res.json();
        setExperiments(data);
      }
    } catch (err) {
      console.error("Error fetching experiments:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExperiments();
    const interval = setInterval(fetchExperiments, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...formData, created_by: localStorage.getItem('userId') || null };
      const res = await fetch('/api/research/experiments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setShowModal(false);
        setFormData({ experiment_name: '', description: '', network_mode: 'Hybrid', sampling_interval: 15 });
        fetchExperiments();
      }
    } catch (err) {
      console.error("Error creating experiment:", err);
    }
  };

  const handleAction = async (id, action) => {
    try {
      const res = await fetch(`/api/research/experiments/${id}/${action}`, { method: 'POST' });
      if (res.ok) {
        fetchExperiments();
      } else {
        const err = await res.json();
        alert(err.error || `Failed to ${action}`);
      }
    } catch (err) {
      console.error(`Error ${action} experiment:`, err);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this experiment?")) return;
    try {
      const res = await fetch(`/api/research/experiments/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setSelectedExperiments(prev => prev.filter(x => x !== id));
        fetchExperiments();
      }
    } catch (err) {
      console.error("Error deleting experiment:", err);
    }
  };

  const handleCompare = () => {
    if (selectedExperiments.length < 2) return;
    const query = selectedExperiments.join(',');
    navigate(`/admin/research/comparison?ids=${query}`);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'active': return <span className="px-2 py-1 rounded bg-emerald-500/20 text-emerald-400 text-xs font-bold border border-emerald-500/30 uppercase flex items-center gap-1"><Play size={12}/> Active</span>;
      case 'paused': return <span className="px-2 py-1 rounded bg-yellow-500/20 text-yellow-400 text-xs font-bold border border-yellow-500/30 uppercase flex items-center gap-1"><Pause size={12}/> Paused</span>;
      case 'finished': return <span className="px-2 py-1 rounded bg-blue-500/20 text-blue-400 text-xs font-bold border border-blue-500/30 uppercase flex items-center gap-1"><CheckCircle2 size={12}/> Finished</span>;
      default: return <span className="px-2 py-1 rounded bg-slate-500/20 text-slate-400 text-xs font-bold border border-slate-500/30 uppercase">Created</span>;
    }
  };

  return (
    <div className="space-y-6 relative">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white mb-1">Experiment Manager</h2>
          <p className="text-slate-400 text-sm">Create and control isolated research experiments.</p>
        </div>
        <div className="flex items-center gap-3">
          {selectedExperiments.length >= 2 && (
            <button 
              onClick={handleCompare}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold text-sm transition-colors shadow-lg shadow-blue-900/40 animate-in fade-in"
            >
              <BarChart2 size={16} /> Compare Selected ({selectedExperiments.length})
            </button>
          )}
          <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold text-sm transition-colors shadow-lg shadow-emerald-900/40">
            <Plus size={16} /> New Experiment
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-slate-400 flex items-center gap-2"><RefreshCw className="animate-spin" size={16} /> Loading experiments...</div>
      ) : experiments.length === 0 ? (
        <div className="p-8 border border-slate-800 rounded-xl bg-slate-900 flex items-center justify-center text-slate-500">
          No experiments found. Create one to get started.
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {experiments.map(exp => (
            <div key={exp.id} className={`p-5 rounded-xl border transition-all relative ${exp.status === 'active' ? 'bg-slate-900 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.1)]' : selectedExperiments.includes(exp.id) ? 'bg-slate-800 border-blue-500' : 'bg-slate-900 border-slate-800'}`}>
              
              {exp.status === 'finished' && (
                <div className="absolute top-4 right-4">
                  <input 
                    type="checkbox" 
                    className="w-5 h-5 accent-blue-500 cursor-pointer"
                    checked={selectedExperiments.includes(exp.id)}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedExperiments([...selectedExperiments, exp.id]);
                      else setSelectedExperiments(selectedExperiments.filter(id => id !== exp.id));
                    }}
                  />
                </div>
              )}

              <div className="flex items-start justify-between mb-4">
                <div className="pr-10">
                  <h3 className="text-lg font-bold text-white flex flex-wrap items-center gap-3">
                    {exp.experiment_name}
                    {getStatusBadge(exp.status)}
                  </h3>
                  <p className="text-sm text-slate-400 mt-1">{exp.description}</p>
                </div>
                <button onClick={() => handleDelete(exp.id)} className="text-slate-500 hover:text-red-400 p-2 rounded-lg hover:bg-slate-900 transition-colors">
                  <Trash2 size={16} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-5 text-sm">
                <div>
                  <span className="text-slate-500 font-medium">Network Mode</span>
                  <p className="text-slate-300">{exp.network_mode}</p>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Sampling Interval</span>
                  <p className="text-slate-300">{exp.sampling_interval} seconds</p>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Started At</span>
                  <p className="text-slate-300">{exp.started_at ? new Date(exp.started_at).toLocaleString() : '-'}</p>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Finished At</span>
                  <p className="text-slate-300">{exp.finished_at ? new Date(exp.finished_at).toLocaleString() : '-'}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-4 border-t border-slate-800">
                {exp.status === 'created' && (
                  <button onClick={() => handleAction(exp.id, 'start')} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold text-sm transition-colors flex-1 justify-center">
                    <Play size={16} /> Start
                  </button>
                )}
                {exp.status === 'finished' && (
                  <>
                    <button onClick={() => navigate(`/admin/research/experiments/${exp.id}/publication`)} className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-semibold text-sm transition-colors flex-1 justify-center">
                      <Book size={16} /> Publication Report
                    </button>
                    <button onClick={() => handleAction(exp.id, 'start')} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold text-sm transition-colors flex-1 justify-center">
                      <Play size={16} /> Re-run
                    </button>
                  </>
                )}
                {exp.status === 'active' && (
                  <>
                    <button onClick={() => handleAction(exp.id, 'pause')} className="flex items-center gap-2 px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-white rounded-lg font-semibold text-sm transition-colors flex-1 justify-center">
                      <Pause size={16} /> Pause
                    </button>
                    <button onClick={() => handleAction(exp.id, 'finish')} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold text-sm transition-colors flex-1 justify-center">
                      <Square size={16} /> Finish
                    </button>
                  </>
                )}
                {exp.status === 'paused' && (
                  <>
                    <button onClick={() => handleAction(exp.id, 'resume')} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold text-sm transition-colors flex-1 justify-center">
                      <Play size={16} /> Resume
                    </button>
                    <button onClick={() => handleAction(exp.id, 'finish')} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold text-sm transition-colors flex-1 justify-center">
                      <Square size={16} /> Finish
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-4">New Experiment</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-1">Experiment Name</label>
                <input required type="text" className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500" value={formData.experiment_name} onChange={e => setFormData({...formData, experiment_name: e.target.value})} placeholder="e.g. Test Run 01" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-1">Description</label>
                <textarea required className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500 h-24 resize-none" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Purpose of this experiment..."></textarea>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-1">Network Mode</label>
                  <select className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500" value={formData.network_mode} onChange={e => setFormData({...formData, network_mode: e.target.value})}>
                    <option>Hybrid</option>
                    <option>Offline-Only</option>
                    <option>Cloud-Only</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-1">Interval (s)</label>
                  <input required type="number" min="1" className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500" value={formData.sampling_interval} onChange={e => setFormData({...formData, sampling_interval: parseInt(e.target.value)})} />
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 pt-4 mt-2 border-t border-slate-800">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-slate-400 hover:text-white transition-colors text-sm font-semibold">Cancel</button>
                <button type="submit" className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold text-sm transition-colors">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
