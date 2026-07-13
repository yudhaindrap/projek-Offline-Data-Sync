import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Table as TableIcon, BarChart3, Activity } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

export default function ResearchComparison() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [experiments, setExperiments] = useState([]);
  const [loading, setLoading] = useState(true);

  const ids = searchParams.get('ids')?.split(',') || [];

  useEffect(() => {
    const fetchSelected = async () => {
      try {
        const res = await fetch('/api/research/experiments');
        if (res.ok) {
          const data = await res.json();
          // Filter to only the selected ones and those that have metrics (finished)
          const selected = data.filter(e => ids.includes(e.id) && e.metrics);
          setExperiments(selected);
        }
      } catch (err) {
        console.error("Error fetching comparison data:", err);
      } finally {
        setLoading(false);
      }
    };
    if (ids.length > 0) fetchSelected();
    else setLoading(false);
  }, [searchParams]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-blue-500 animate-pulse">
        <Activity size={48} className="mb-4" />
        <p className="font-bold tracking-widest uppercase">Aggregating Comparison Data...</p>
      </div>
    );
  }

  if (experiments.length === 0) {
    return (
      <div className="p-8 text-center text-slate-400">
        <p>No valid finished experiments found for comparison.</p>
        <button onClick={() => navigate(-1)} className="mt-4 px-4 py-2 bg-slate-800 text-white rounded-lg">Go Back</button>
      </div>
    );
  }

  // Prepare Chart Data
  const chartData = experiments.map(exp => {
    const m = exp.metrics || {};
    return {
      name: exp.experiment_name,
      avgTemp: m.environment_metrics?.average_temperature || 0,
      avgHum: m.environment_metrics?.average_humidity || 0,
      mqttLatency: m.mqtt_metrics?.average_latency_ms || 0,
      wsLatency: m.websocket_metrics?.average_latency_ms || 0,
      syncTime: m.synchronization_results?.average_sync_time_ms || 0,
      thresholdEvents: m.threshold_events || 0,
      notificationCount: m.notification_count || 0,
      queueGrowth: m.synchronization_results?.maximum_queue || 0,
      syncSuccess: m.synchronization_results?.success_rate || 0,
      dataLoss: m.synchronization_results?.data_loss || 0,
    };
  });

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6'];

  const exportData = (format) => {
    const exportPayload = experiments.map(exp => {
        const m = exp.metrics || {};
        return {
            "Experiment ID": exp.id,
            "Name": exp.experiment_name,
            "Dataset": exp.dataset_name || 'N/A',
            "Replay Speed": exp.replay_speed || '1.0',
            "Duration (s)": m.duration_seconds || 0,
            "Avg Temp (C)": m.environment_metrics?.average_temperature || 0,
            "Avg Humidity (%)": m.environment_metrics?.average_humidity || 0,
            "MQTT Latency (ms)": m.mqtt_metrics?.average_latency_ms || 0,
            "WS Latency (ms)": m.websocket_metrics?.average_latency_ms || 0,
            "Sync Time (ms)": m.synchronization_results?.average_sync_time_ms || 0,
            "Sync Success (%)": m.synchronization_results?.success_rate || 0,
            "Max Queue Size": m.synchronization_results?.maximum_queue || 0,
            "Data Loss": m.synchronization_results?.data_loss || 0,
            "Threshold Events": m.threshold_events || 0,
            "Notifications": m.notification_count || 0
        };
    });

    if (format === 'json') {
      const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
      saveAs(blob, 'dataset_comparison.json');
    } else if (format === 'csv') {
      const ws = XLSX.utils.json_to_sheet(exportPayload);
      const csv = XLSX.utils.sheet_to_csv(ws);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      saveAs(blob, 'dataset_comparison.csv');
    } else if (format === 'excel') {
      const ws = XLSX.utils.json_to_sheet(exportPayload);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Comparison");
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      saveAs(new Blob([wbout], { type: 'application/octet-stream' }), 'dataset_comparison.xlsx');
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-6">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-2xl font-black text-white mb-1">Dataset Comparison</h2>
            <p className="text-slate-400 text-sm">Comparing {experiments.length} research experiments.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => exportData('csv')} className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-bold transition-colors"><Download size={14} /> CSV</button>
          <button onClick={() => exportData('excel')} className="flex items-center gap-2 px-3 py-2 bg-emerald-900/40 hover:bg-emerald-600 text-emerald-400 hover:text-white rounded-lg text-sm font-bold border border-emerald-500/30 transition-colors"><Download size={14} /> Excel</button>
          <button onClick={() => exportData('json')} className="flex items-center gap-2 px-3 py-2 bg-blue-900/40 hover:bg-blue-600 text-blue-400 hover:text-white rounded-lg text-sm font-bold border border-blue-500/30 transition-colors"><Download size={14} /> JSON</button>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Environment Chart */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
          <h3 className="text-sm font-bold text-white mb-6 uppercase tracking-wider flex items-center gap-2">
            <BarChart3 size={16} className="text-blue-500" /> Environment Profiles
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={10} minHeight={10}>
              <BarChart data={chartData} margin={{ top: 5, right: 30, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="name" stroke="#475569" fontSize={11} tickMargin={10} />
                <YAxis stroke="#475569" fontSize={11} />
                <RechartsTooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px', color: '#fff' }} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="avgTemp" name="Avg Temp (°C)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="avgHum" name="Avg Humidity (%)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Latency Chart */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
          <h3 className="text-sm font-bold text-white mb-6 uppercase tracking-wider flex items-center gap-2">
            <Activity size={16} className="text-emerald-500" /> Network Latency
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={10} minHeight={10}>
              <BarChart data={chartData} margin={{ top: 5, right: 30, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="name" stroke="#475569" fontSize={11} tickMargin={10} />
                <YAxis stroke="#475569" fontSize={11} />
                <RechartsTooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px', color: '#fff' }} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="mqttLatency" name="MQTT (ms)" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="wsLatency" name="WebSocket (ms)" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sync Success Chart */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg lg:col-span-2">
          <h3 className="text-sm font-bold text-white mb-6 uppercase tracking-wider flex items-center gap-2">
            <BarChart3 size={16} className="text-purple-500" /> Synchronization & Event Pressure
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={10} minHeight={10}>
              <BarChart data={chartData} margin={{ top: 5, right: 30, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="name" stroke="#475569" fontSize={11} tickMargin={10} />
                <YAxis stroke="#475569" fontSize={11} />
                <RechartsTooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px', color: '#fff' }} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="syncSuccess" name="Sync Success (%)" fill="#14b8a6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="queueGrowth" name="Max Queue Growth" fill="#ef4444" radius={[4, 4, 0, 0]} />
                <Bar dataKey="thresholdEvents" name="Threshold Events" fill="#ec4899" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* Publication Ready Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-lg overflow-hidden">
        <div className="p-5 border-b border-slate-800">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <TableIcon size={16} className="text-amber-500" /> Comparative Metrics Matrix
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-950 text-slate-400 uppercase font-bold text-xs">
              <tr>
                <th className="px-6 py-4">Experiment</th>
                <th className="px-6 py-4 text-right">Avg Temp</th>
                <th className="px-6 py-4 text-right">Avg Humidity</th>
                <th className="px-6 py-4 text-right">MQTT Latency</th>
                <th className="px-6 py-4 text-right">WS Latency</th>
                <th className="px-6 py-4 text-right">Sync Time</th>
                <th className="px-6 py-4 text-right">Events</th>
                <th className="px-6 py-4 text-right">Max Queue</th>
                <th className="px-6 py-4 text-right">Data Loss</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {chartData.map((d, idx) => (
                <tr key={idx} className="hover:bg-slate-800/50 transition-colors">
                  <td className="px-6 py-4 font-bold text-white whitespace-nowrap">{d.name}</td>
                  <td className="px-6 py-4 text-right text-slate-300">{d.avgTemp} °C</td>
                  <td className="px-6 py-4 text-right text-slate-300">{d.avgHum} %</td>
                  <td className="px-6 py-4 text-right text-slate-300">{d.mqttLatency} ms</td>
                  <td className="px-6 py-4 text-right text-slate-300">{d.wsLatency} ms</td>
                  <td className="px-6 py-4 text-right text-slate-300">{d.syncTime} ms</td>
                  <td className="px-6 py-4 text-right text-amber-400 font-bold">{d.thresholdEvents}</td>
                  <td className="px-6 py-4 text-right text-red-400 font-bold">{d.queueGrowth}</td>
                  <td className="px-6 py-4 text-right text-slate-400">{d.dataLoss}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
