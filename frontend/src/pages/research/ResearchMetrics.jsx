import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Activity, Clock, Cpu, HardDrive, Database, Network } from 'lucide-react';
import io from 'socket.io-client';

export default function ResearchMetrics() {
  const [metrics, setMetrics] = useState([]);
  const [stats, setStats] = useState({});
  const [activeExperiment, setActiveExperiment] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Determine WS Latency
    const socket = io();
    socket.on('latency_ping', (data) => {
      if (data && data.server_send_at) {
        const browser_receive_at = Date.now();
        requestAnimationFrame(() => {
          const browser_render_at = Date.now();
          socket.emit('latency_pong', {
            server_send_at: data.server_send_at,
            browser_receive_at,
            browser_render_at
          });
        });
      }
    });

    const fetchActiveExperiment = async () => {
      try {
        const res = await fetch('/api/research/experiments');
        if (res.ok) {
          const data = await res.json();
          const active = data.find(e => e.status === 'active');
          setActiveExperiment(active);
          if (active) {
            fetchMetrics(active.id);
          } else {
            setLoading(false);
          }
        }
      } catch (err) {
        console.error("Error fetching experiments:", err);
        setLoading(false);
      }
    };

    fetchActiveExperiment();

    const interval = setInterval(() => {
      if (activeExperiment) {
        fetchMetrics(activeExperiment.id);
      } else {
        fetchActiveExperiment();
      }
    }, 5000);

    return () => {
      clearInterval(interval);
      socket.disconnect();
    };
  }, [activeExperiment]);

  const fetchMetrics = async (expId) => {
    try {
      const res = await fetch(`/api/research/metrics/${expId}`);
      if (res.ok) {
        const data = await res.json();
        // Format timestamp for charts
        const formatted = data.timeseries.map(m => ({
          ...m,
          timeLabel: new Date(m.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        }));
        setMetrics(formatted);
        setStats(data.statistics || {});
      }
    } catch (err) {
      console.error("Error fetching metrics:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-white p-6 animate-pulse">Loading Metrics...</div>;
  }

  if (!activeExperiment) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Activity size={64} className="text-slate-600 mb-6" />
        <h2 className="text-2xl font-black text-slate-400 mb-2">No Active Experiment</h2>
        <p className="text-slate-500 max-w-md">
          Start an experiment in the Experiment Manager to begin recording and visualizing performance metrics.
        </p>
      </div>
    );
  }

  const renderStatRow = (label, statKey) => {
    const avg = stats[`avg_${statKey}`] ?? '-';
    const min = stats[`min_${statKey}`] ?? '-';
    const max = stats[`max_${statKey}`] ?? '-';
    const median = stats[`median_${statKey}`] ?? '-';
    const stddev = stats[`stddev_${statKey}`] ?? '-';

    return (
      <tr className="border-b border-slate-800 hover:bg-slate-800/50 transition-colors">
        <td className="py-3 px-4 font-bold text-slate-300">{label}</td>
        <td className="py-3 px-4 text-blue-400">{avg}</td>
        <td className="py-3 px-4 text-emerald-400">{min}</td>
        <td className="py-3 px-4 text-red-400">{max}</td>
        <td className="py-3 px-4 text-purple-400">{median}</td>
        <td className="py-3 px-4 text-amber-400">{stddev}</td>
      </tr>
    );
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 border border-slate-700 p-3 rounded-lg shadow-xl">
          <p className="text-slate-300 text-sm font-bold mb-2">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color }} className="text-sm font-semibold">
              {entry.name}: {entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-white mb-1">Performance Metrics</h2>
          <p className="text-slate-400 text-sm">Real-time telemetry for <span className="text-emerald-400 font-bold">{activeExperiment.experiment_name}</span>.</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-emerald-900/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-sm font-bold">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Live Recording
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Latency Chart */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
          <h3 className="text-md font-bold text-slate-200 mb-4 flex items-center gap-2"><Network size={16}/> Communication Latency (ms)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%" minWidth={10} minHeight={10}>
              <LineChart data={metrics}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="timeLabel" stroke="#64748b" fontSize={12} tickMargin={10} />
                <YAxis stroke="#64748b" fontSize={12} />
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }}/>
                <Line type="monotone" dataKey="mqtt_latency_ms" name="MQTT Latency" stroke="#3b82f6" strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="ws_latency_ms" name="WebSocket Latency" stroke="#a855f7" strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="webrtc_latency_ms" name="WebRTC Latency" stroke="#ef4444" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sync Duration Chart */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
          <h3 className="text-md font-bold text-slate-200 mb-4 flex items-center gap-2"><Clock size={16}/> Sync Performance</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%" minWidth={10} minHeight={10}>
              <LineChart data={metrics}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="timeLabel" stroke="#64748b" fontSize={12} tickMargin={10} />
                <YAxis yAxisId="left" stroke="#64748b" fontSize={12} />
                <YAxis yAxisId="right" orientation="right" stroke="#64748b" fontSize={12} />
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }}/>
                <Line yAxisId="left" type="monotone" dataKey="sync_duration_ms" name="Duration (ms)" stroke="#10b981" strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line yAxisId="right" type="monotone" dataKey="sync_throughput_rps" name="Throughput (Req/s)" stroke="#f59e0b" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* System Usage Chart */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
          <h3 className="text-md font-bold text-slate-200 mb-4 flex items-center gap-2"><Cpu size={16}/> System Utilization</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%" minWidth={10} minHeight={10}>
              <LineChart data={metrics}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="timeLabel" stroke="#64748b" fontSize={12} tickMargin={10} />
                <YAxis yAxisId="left" stroke="#64748b" fontSize={12} domain={[0, 100]} />
                <YAxis yAxisId="right" orientation="right" stroke="#64748b" fontSize={12} />
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }}/>
                <Line yAxisId="left" type="monotone" dataKey="cpu_usage_pct" name="CPU (%)" stroke="#ef4444" strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line yAxisId="right" type="monotone" dataKey="memory_usage_mb" name="Memory (MB)" stroke="#0ea5e9" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Storage Chart */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
          <h3 className="text-md font-bold text-slate-200 mb-4 flex items-center gap-2"><HardDrive size={16}/> Storage & Database Size</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%" minWidth={10} minHeight={10}>
              <LineChart data={metrics}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="timeLabel" stroke="#64748b" fontSize={12} tickMargin={10} />
                <YAxis stroke="#64748b" fontSize={12} />
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }}/>
                <Line type="monotone" dataKey="sqlite_size_kb" name="SQLite Buffer Size (KB)" stroke="#f43f5e" strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="queue_size" name="Pending Queue Items" stroke="#eab308" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* Statistics Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-lg overflow-hidden">
        <div className="p-5 border-b border-slate-800 flex items-center gap-2">
          <Database size={18} className="text-slate-300" />
          <h3 className="text-lg font-bold text-white">Aggregated Statistics</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-400">
            <thead className="text-xs uppercase bg-slate-800/50 text-slate-400">
              <tr>
                <th className="py-3 px-4">Metric</th>
                <th className="py-3 px-4">Average</th>
                <th className="py-3 px-4">Minimum</th>
                <th className="py-3 px-4">Maximum</th>
                <th className="py-3 px-4">Median</th>
                <th className="py-3 px-4">Std Dev</th>
              </tr>
            </thead>
            <tbody>
              {renderStatRow("MQTT Latency (ms)", "mqtt_latency_ms")}
              {renderStatRow("WebSocket Latency (ms)", "ws_latency_ms")}
              {renderStatRow("WebRTC Latency (ms)", "webrtc_latency_ms")}
              {renderStatRow("Sync Duration (ms)", "sync_duration_ms")}
              {renderStatRow("Sync Throughput (rps)", "sync_throughput_rps")}
              {renderStatRow("Queue Size", "queue_size")}
              {renderStatRow("CPU Usage (%)", "cpu_usage_pct")}
              {renderStatRow("Memory Usage (MB)", "memory_usage_mb")}
              {renderStatRow("Disk Usage (MB)", "disk_usage_mb")}
              {renderStatRow("SQLite Size (KB)", "sqlite_size_kb")}
              {renderStatRow("PG Insertion Time (ms)", "pg_insert_time_ms")}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
