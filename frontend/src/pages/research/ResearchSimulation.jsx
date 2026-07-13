import { useState, useEffect } from 'react';
import { Play, Square, Activity, WifiOff, Globe, Database, RefreshCw, AlertTriangle } from 'lucide-react';

export default function ResearchSimulation() {
  const [status, setStatus] = useState({
    isRunning: false,
    config: { boxCount: 1, intervalMs: 5000, offlineMode: false }
  });
  const [loading, setLoading] = useState(true);

  // Form states
  const [boxCount, setBoxCount] = useState(1);
  const [intervalMs, setIntervalMs] = useState(5000);
  const [offlineMode, setOfflineMode] = useState(false);

  // Network State
  const [network, setNetwork] = useState({
    status: 'online',
    packetDelay: 0,
    packetLoss: 0,
    queueSize: 0,
    retryCount: 0,
    metrics: { syncDurationMs: 0, recordsUploaded: 0, recordsFailed: 0 }
  });

  const fetchStatus = async () => {
    try {
      const [resSim, resNet] = await Promise.all([
        fetch('/api/research/simulator/status'),
        fetch('/api/research/simulator/network')
      ]);

      if (resSim.ok) {
        const data = await resSim.json();
        setStatus(data);
        if (!data.isRunning) {
          setBoxCount(data.config.boxCount);
          setIntervalMs(data.config.intervalMs);
          setOfflineMode(data.config.offlineMode);
        }
      }

      if (resNet.ok) {
        setNetwork(await resNet.json());
      }
    } catch (err) {
      console.error("Error fetching simulator status:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleStart = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/research/simulator/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boxCount, intervalMs, offlineMode })
      });
      if (res.ok) fetchStatus();
    } catch (err) {
      console.error("Error starting simulator:", err);
    }
  };

  const handleStop = async () => {
    try {
      const res = await fetch('/api/research/simulator/stop', { method: 'POST' });
      if (res.ok) fetchStatus();
    } catch (err) {
      console.error("Error stopping simulator:", err);
    }
  };
  const handleNetworkUpdate = async (updates) => {
    try {
      const res = await fetch('/api/research/simulator/network', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...network, ...updates })
      });
      if (res.ok) fetchStatus();
    } catch (err) {
      console.error("Error updating network config:", err);
    }
  };

  const handleReconnect = async () => {
    try {
      const res = await fetch('/api/research/simulator/network/reconnect', { method: 'POST' });
      if (res.ok) fetchStatus();
    } catch (err) {
      console.error("Error reconnecting:", err);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white mb-1">Edge Hardware Simulator</h2>
        <p className="text-slate-400 text-sm">Emulate Raspberry Pi edge devices and ML nodes for testing without hardware.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Control Panel */}
        <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
          <h3 className="text-lg font-bold text-white mb-4">Configuration</h3>

          <form onSubmit={handleStart} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">Simulated Boxes</label>
              <select
                disabled={status.isRunning}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500 disabled:opacity-50"
                value={boxCount}
                onChange={e => setBoxCount(parseInt(e.target.value))}
              >
                <option value={1}>1 Box</option>
                <option value={3}>3 Boxes</option>
                <option value={5}>5 Boxes</option>
                <option value={10}>10 Boxes</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">Data Interval (ms)</label>
              <input
                required
                type="number"
                min="1000"
                step="1000"
                disabled={status.isRunning}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500 disabled:opacity-50"
                value={intervalMs}
                onChange={e => setIntervalMs(parseInt(e.target.value))}
              />
            </div>

            <label className={`flex items-center gap-3 p-3 rounded-lg border ${offlineMode ? 'bg-amber-900/20 border-amber-500/50' : 'bg-slate-950 border-slate-700'} cursor-pointer transition-colors ${status.isRunning ? 'opacity-50 pointer-events-none' : ''}`}>
              <input
                type="checkbox"
                className="w-5 h-5 accent-amber-500"
                checked={offlineMode}
                onChange={e => setOfflineMode(e.target.checked)}
              />
              <div>
                <span className={`block text-sm font-bold ${offlineMode ? 'text-amber-400' : 'text-slate-300'}`}>Simulate Offline Mode</span>
                <span className="text-xs text-slate-500">Forces data to local DB instead of MQTT</span>
              </div>
            </label>

            <div className="pt-4 border-t border-slate-800">
              {!status.isRunning ? (
                <button type="submit" className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold transition-colors shadow-lg shadow-emerald-900/40">
                  <Play size={18} /> Start Simulator
                </button>
              ) : (
                <button type="button" onClick={handleStop} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold transition-colors shadow-lg shadow-red-900/40">
                  <Square size={18} /> Stop Simulator
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Status Dashboard */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg flex flex-col">
          <h3 className="text-lg font-bold text-white mb-4">Simulator Engine Status</h3>

          <div className="flex-1 flex flex-col items-center justify-center">
            {loading ? (
              <p className="text-slate-500 animate-pulse">Checking status...</p>
            ) : status.isRunning ? (
              <div className="text-center space-y-6">
                <div className="relative inline-flex items-center justify-center w-24 h-24 rounded-full bg-emerald-500/10 border-4 border-emerald-500/30">
                  <Activity size={40} className="text-emerald-400 animate-pulse" />
                  <div className="absolute inset-0 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin"></div>
                </div>
                <div>
                  <h4 className="text-2xl font-black text-emerald-400 tracking-wider uppercase mb-2">Online & Running</h4>
                  <p className="text-slate-400">
                    Injecting telemetry and predictions for <span className="text-white font-bold">{status.config.boxCount} Boxes</span> every <span className="text-white font-bold">{status.config.intervalMs / 1000}s</span>.
                  </p>
                </div>

                {status.config.offlineMode && (
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/20 text-amber-400 border border-amber-500/50 rounded-full text-sm font-bold shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                    <WifiOff size={16} /> Offline Insertion Active
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-slate-800 border-4 border-slate-700 mb-6 text-slate-500">
                  <Square size={40} />
                </div>
                <h4 className="text-2xl font-black text-slate-500 tracking-wider uppercase mb-2">Idle</h4>
                <p className="text-slate-500 max-w-sm mx-auto">
                  The simulator is currently stopped. Configure the parameters on the left and start the engine to begin generating realistic data.
                </p>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Network Emulation Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Network Controls */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Globe size={20} /> Network Link Emulation</h3>
          <p className="text-sm text-slate-400 mb-6">Simulate internet connection drops without turning off your local network.</p>

          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleNetworkUpdate({ status: 'online' })}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-bold transition-all ${network.status === 'online' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40 border border-emerald-500' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
              >
                <Globe size={18} /> Online
              </button>
              <button
                onClick={() => handleNetworkUpdate({ status: 'offline' })}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-bold transition-all ${network.status === 'offline' ? 'bg-red-600 text-white shadow-lg shadow-red-900/40 border border-red-500' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
              >
                <WifiOff size={18} /> Offline
              </button>
              <button
                onClick={handleReconnect}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-bold bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-lg shadow-blue-900/40"
              >
                <RefreshCw size={18} /> Reconnect
              </button>
            </div>

            <div className="space-y-4 pt-4 border-t border-slate-800">
              <div>
                <label className="flex justify-between text-sm font-semibold text-slate-300 mb-2">
                  <span>Packet Delay</span>
                  <span className="text-amber-400">{network.packetDelay} ms</span>
                </label>
                <input
                  type="range"
                  min="0" max="5000" step="100"
                  className="w-full accent-amber-500"
                  value={network.packetDelay}
                  onChange={e => handleNetworkUpdate({ packetDelay: parseInt(e.target.value) })}
                />
              </div>

              <div>
                <label className="flex justify-between text-sm font-semibold text-slate-300 mb-2">
                  <span>Packet Loss</span>
                  <span className="text-amber-400">{network.packetLoss} %</span>
                </label>
                <input
                  type="range"
                  min="0" max="100" step="5"
                  className="w-full accent-red-500"
                  value={network.packetLoss}
                  onChange={e => handleNetworkUpdate({ packetLoss: parseInt(e.target.value) })}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Sync Status */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Database size={20} /> Sync Queue Statistics</h3>
          <p className="text-sm text-slate-400 mb-6">Metrics for the local SQLite buffer syncing to the PostgreSQL Cloud.</p>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 flex flex-col items-center justify-center text-center">
              <span className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Queue Size</span>
              <span className="text-3xl font-black text-amber-400">{network.queueSize}</span>
            </div>

            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 flex flex-col items-center justify-center text-center">
              <span className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Last Sync Duration</span>
              <span className="text-2xl font-black text-blue-400">{network.metrics.syncDurationMs} <span className="text-sm">ms</span></span>
            </div>

            <div className="bg-emerald-900/10 border border-emerald-900/30 rounded-xl p-4 flex flex-col items-center justify-center text-center">
              <span className="text-emerald-500/70 text-xs font-bold uppercase tracking-wider mb-1">Records Uploaded</span>
              <span className="text-2xl font-black text-emerald-400">{network.metrics.recordsUploaded}</span>
            </div>

            <div className="bg-red-900/10 border border-red-900/30 rounded-xl p-4 flex flex-col items-center justify-center text-center relative">
              <span className="text-red-500/70 text-xs font-bold uppercase tracking-wider mb-1">Records Failed</span>
              <span className="text-2xl font-black text-red-400">{network.metrics.recordsFailed}</span>
              {network.retryCount > 0 && (
                <div className="absolute top-2 right-2 flex items-center gap-1 text-xs font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full">
                  <AlertTriangle size={12} /> {network.retryCount} Retries
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
