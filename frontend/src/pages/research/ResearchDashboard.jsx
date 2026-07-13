import { useState, useEffect } from 'react';
import { 
  Play, Pause, Square, FastForward, Activity, WifiOff, Globe, Database, 
  Server, HardDrive, RefreshCw, AlertTriangle, FileText, BarChart3, Wifi, Trash2, X
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';

const StatusCard = ({ title, value, icon: Icon, colorClass, subtitle }) => (
  <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex items-center gap-4 shadow-lg hover:border-slate-700 transition-colors">
    <div className={`p-4 rounded-xl ${colorClass} bg-opacity-10 border border-opacity-20 shadow-inner`}>
      <Icon className={colorClass.split(' ')[0].replace('text-', 'stroke-')} size={28} />
    </div>
    <div className="flex-1">
      <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">{title}</h3>
      <div className="flex items-baseline gap-2">
        <p className="text-white text-2xl font-black">{value}</p>
        {subtitle && <span className="text-slate-500 text-sm font-semibold">{subtitle}</span>}
      </div>
    </div>
  </div>
);

export default function ResearchDashboard() {
  const [network, setNetwork] = useState(null);
  const [dataset, setDataset] = useState(null);
  const [loading, setLoading] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [chartData, setChartData] = useState([]);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetting, setResetting] = useState(false);

  const fetchData = async () => {
    try {
      const [resNet, resDs] = await Promise.all([
        fetch('/api/research/simulator/network'),
        fetch('/api/research/datasets')
      ]);

      if (resNet.ok) {
        const data = await resNet.json();
        setNetwork(data);
        if (data.replaySpeed) setSpeed(data.replaySpeed);
        
        // Update Chart Data
        setChartData(prev => {
          const newData = [...prev, {
            time: new Date().toLocaleTimeString(),
            queue: data.pendingQueue || 0,
            throughput: data.replayThroughput || 0,
            syncTime: data.averageSyncTime || 0
          }];
          return newData.slice(-20); // Keep last 20 points
        });
      }

      if (resDs.ok) {
        const dsData = await resDs.json();
        setDataset(dsData.currentDataset);
      }
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, []);

  const apiAction = async (endpoint, method = 'POST', body = null) => {
    try {
      const options = { method, headers: { 'Content-Type': 'application/json' } };
      if (body) options.body = JSON.stringify(body);
      const res = await fetch(endpoint, options);
      if (res.ok) fetchData();
    } catch (err) {
      console.error(`Error with ${endpoint}:`, err);
    }
  };

  const handleReset = async () => {
    setResetting(true);
    try {
      const res = await fetch('/api/research/reset', { method: 'POST' });
      if (res.ok) {
        await fetchData();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setResetting(false);
      setShowResetModal(false);
    }
  };

  if (loading && !network) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-emerald-500 animate-pulse">
        <Activity size={48} className="mb-4" />
        <p className="font-bold tracking-widest uppercase">Initializing Telemetry...</p>
      </div>
    );
  }

  if (!network) {
    return <div className="text-red-400 font-bold p-4 bg-red-900/20 rounded-lg border border-red-900/50">Failed to connect to Research Engine API.</div>;
  }

  const isRunning = network.isRunning;
  const isPaused = network.replayState === 'paused';
  const progressPercent = network.progress ? network.progress.toFixed(2) : 0;

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-2xl font-black text-white mb-2 flex items-center gap-3">
            <Activity className="text-emerald-500" /> Research Telemetry
          </h2>
          <p className="text-slate-400 text-sm">Real-time edge pipeline metrics and Dataset Replay controls.</p>
        </div>
        
        {dataset && (
          <div className="bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 flex items-center gap-4 shadow-lg">
            <FileText className="text-blue-400" size={24} />
            <div>
              <p className="text-xs text-slate-400 uppercase font-bold tracking-wider">Active Dataset</p>
              <p className="text-white font-bold">{dataset.name}</p>
            </div>
            <div className="pl-4 border-l border-slate-700">
              <p className="text-xs text-slate-400 uppercase font-bold tracking-wider">Records</p>
              <p className="text-emerald-400 font-black">{dataset.totalRecords.toLocaleString()}</p>
            </div>
          </div>
        )}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Controls Sidebar */}
        <div className="lg:col-span-3 space-y-6">
          
          {/* Replay Engine Controls */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
            <h3 className="text-sm font-bold text-white mb-4 uppercase tracking-wider flex items-center gap-2">
              <Play size={16} className="text-emerald-500" /> Engine Controls
            </h3>
            
            <div className="grid grid-cols-2 gap-3 mb-6">
              {!isRunning || isPaused ? (
                <button 
                  onClick={() => apiAction(isPaused ? '/api/research/simulator/resume' : '/api/research/simulator/start', 'POST', !isPaused ? { boxCount: 1, offlineMode: network.status === 'offline' } : null)}
                  className="col-span-2 flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold shadow-lg transition-all"
                >
                  <Play size={18} /> {isPaused ? 'Resume Replay' : 'Start Replay'}
                </button>
              ) : (
                <button 
                  onClick={() => apiAction('/api/research/simulator/pause')}
                  className="col-span-2 flex items-center justify-center gap-2 px-4 py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-bold shadow-lg transition-all"
                >
                  <Pause size={18} /> Pause Replay
                </button>
              )}
              
              <button 
                onClick={() => setShowResetModal(true)}
                className="col-span-2 flex items-center justify-center gap-2 px-4 py-3 bg-red-900/60 hover:bg-red-600 border border-red-500/50 text-white rounded-lg font-bold shadow-lg transition-all"
              >
                <Trash2 size={18} /> Reset Experiment
              </button>

              <button 
                onClick={() => apiAction('/api/research/simulator/reset')}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold transition-all"
              >
                <RefreshCw size={16} /> Rewind
              </button>
              <button 
                onClick={() => apiAction('/api/research/simulator/stop')}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold transition-all"
              >
                <Square size={16} /> Stop
              </button>
            </div>

            <div className="space-y-2">
              <label className="flex justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
                Replay Speed <span className="text-emerald-400">{speed}x</span>
              </label>
              <input 
                type="range" min="1" max="100" step="1" 
                value={speed}
                onChange={(e) => {
                  const val = e.target.value;
                  setSpeed(val);
                  apiAction('/api/research/simulator/speed', 'POST', { speed: val });
                }}
                className="w-full accent-emerald-500"
              />
            </div>
            
            {isRunning && (
              <div className="mt-6 pt-4 border-t border-slate-800">
                <div className="flex justify-between text-xs font-bold text-slate-400 mb-2">
                  <span>Progress</span>
                  <span className="text-emerald-400">{progressPercent}%</span>
                </div>
                <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${progressPercent}%` }}></div>
                </div>
                <p className="text-center text-xs text-slate-500 mt-2 font-mono">
                  {network.currentRecord} / {dataset?.totalRecords || 0}
                </p>
              </div>
            )}
          </div>

          {/* Network Controls */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
            <h3 className="text-sm font-bold text-white mb-4 uppercase tracking-wider flex items-center gap-2">
              <Wifi size={16} className="text-blue-500" /> Network Emulation
            </h3>
            
            <div className="flex flex-col gap-3">
              <button
                onClick={() => apiAction('/api/research/simulator/network', 'POST', { status: 'online' })}
                className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-bold transition-all ${network.status === 'online' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40 border border-blue-500' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
              >
                <Globe size={18} /> Online Mode
              </button>
              <button
                onClick={() => apiAction('/api/research/simulator/network', 'POST', { status: 'offline' })}
                className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-bold transition-all ${network.status === 'offline' ? 'bg-amber-600 text-white shadow-lg shadow-amber-900/40 border border-amber-500' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
              >
                <WifiOff size={18} /> Offline Mode
              </button>
            </div>
          </div>
          
        </div>

        {/* Telemetry Dashboard */}
        <div className="lg:col-span-9 space-y-6">
          
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatusCard 
              title="Throughput" 
              value={network.replayThroughput || 0} 
              subtitle="rps"
              icon={FastForward} 
              colorClass="text-emerald-400 border-emerald-400" 
            />
            <StatusCard 
              title="Pending Queue" 
              value={network.pendingQueue || 0} 
              subtitle="items"
              icon={Database} 
              colorClass={network.pendingQueue > 0 ? "text-amber-400 border-amber-400" : "text-blue-400 border-blue-400"} 
            />
            <StatusCard 
              title="Sync Success" 
              value={`${network.successRate || 100}%`} 
              icon={Server} 
              colorClass={network.successRate < 100 ? "text-amber-400 border-amber-400" : "text-emerald-400 border-emerald-400"} 
            />
            <StatusCard 
              title="Data Loss" 
              value={network.dataLoss || 0} 
              subtitle="dropped"
              icon={AlertTriangle} 
              colorClass={network.dataLoss > 0 ? "text-red-400 border-red-400" : "text-slate-400 border-slate-400"} 
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
               <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Sync Time (Avg)</h3>
               <p className="text-3xl font-black text-white">{network.averageSyncTime || 0} <span className="text-sm text-slate-500 font-semibold">ms</span></p>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
               <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Total Retries</h3>
               <p className="text-3xl font-black text-amber-400">{network.totalRetries || 0} <span className="text-sm text-slate-500 font-semibold">attempts</span></p>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
               <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Avg Retry Count</h3>
               <p className="text-3xl font-black text-emerald-400">{network.averageRetryCount || 0} <span className="text-sm text-slate-500 font-semibold">per item</span></p>
            </div>
          </div>

          {/* Charts Area */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
            <h3 className="text-sm font-bold text-white mb-6 uppercase tracking-wider flex items-center gap-2">
              <BarChart3 size={16} className="text-purple-500" /> Live Sync & Queue Telemetry
            </h3>
            
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorQueue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorThroughput" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="time" stroke="#475569" fontSize={12} tickMargin={10} />
                  <YAxis stroke="#475569" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px', color: '#fff' }}
                    itemStyle={{ fontWeight: 'bold' }}
                  />
                  <Area type="monotone" name="Queue Size" dataKey="queue" stroke="#f59e0b" strokeWidth={3} fillOpacity={1} fill="url(#colorQueue)" />
                  <Area type="monotone" name="Throughput (rps)" dataKey="throughput" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorThroughput)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          
        </div>
      </div>

      {/* Reset Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-red-950/20">
              <h3 className="text-xl font-black text-red-500 flex items-center gap-3">
                <AlertTriangle /> Reset Experiment Data
              </h3>
              <button onClick={() => setShowResetModal(false)} className="text-slate-400 hover:text-white transition-colors" disabled={resetting}>
                <X size={24} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-slate-300">
                You are about to permanently delete all data generated by experiments and replays across both <strong>Edge</strong> and <strong>Cloud</strong> databases.
              </p>
              <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 space-y-2">
                <p className="text-sm font-bold text-emerald-400">✅ Preserved (Kept)</p>
                <p className="text-xs text-slate-400 pl-4 border-l-2 border-emerald-500/30">Users, Tenants, Boxes, Thresholds, and Configuration.</p>
                
                <p className="text-sm font-bold text-red-400 mt-4">🗑️ Deleted</p>
                <p className="text-xs text-slate-400 pl-4 border-l-2 border-red-500/30">Sensor Data, Actuator Logs, Sync Queues, Metrics, and Notifications.</p>
              </div>
              <p className="text-sm font-semibold text-amber-500">
                This action cannot be undone. It ensures a clean slate for reproducible research experiments.
              </p>
            </div>
            <div className="p-6 border-t border-slate-800 bg-slate-900/50 flex justify-end gap-3">
              <button 
                onClick={() => setShowResetModal(false)} 
                className="px-5 py-2.5 rounded-lg font-bold text-slate-300 hover:bg-slate-800 transition-colors"
                disabled={resetting}
              >
                Cancel
              </button>
              <button 
                onClick={handleReset} 
                disabled={resetting}
                className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-lg font-bold shadow-lg shadow-red-900/50 transition-all"
              >
                {resetting ? (
                  <><RefreshCw className="animate-spin" size={18} /> Resetting...</>
                ) : (
                  <><Trash2 size={18} /> Confirm Reset</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
