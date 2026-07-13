import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Book, Activity, Server, FileText } from 'lucide-react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

export default function ResearchPublication() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const res = await fetch(`/api/research/experiments/${id}/publication`);
        if (res.ok) {
          setReport(await res.json());
        }
      } catch (err) {
        console.error("Error fetching publication report:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-purple-500 animate-pulse">
        <Activity size={48} className="mb-4" />
        <p className="font-bold tracking-widest uppercase">Compiling Academic Statistics...</p>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="p-8 text-center text-slate-400">
        <p>Failed to load publication report.</p>
        <button onClick={() => navigate(-1)} className="mt-4 px-4 py-2 bg-slate-800 text-white rounded-lg">Go Back</button>
      </div>
    );
  }

  const exportReport = (format) => {
    const payload = [
      { Category: 'MQTT Latency (ms)', N: report.performance.mqtt_latency.n, Min: report.performance.mqtt_latency.min, Max: report.performance.mqtt_latency.max, Avg: report.performance.mqtt_latency.average, StdDev: report.performance.mqtt_latency.std_dev, CI_95: report.performance.mqtt_latency.ci_95 },
      { Category: 'WS Latency (ms)', N: report.performance.ws_latency.n, Min: report.performance.ws_latency.min, Max: report.performance.ws_latency.max, Avg: report.performance.ws_latency.average, StdDev: report.performance.ws_latency.std_dev, CI_95: report.performance.ws_latency.ci_95 },
      { Category: 'Sync Duration (ms)', N: report.performance.sync_duration.n, Min: report.performance.sync_duration.min, Max: report.performance.sync_duration.max, Avg: report.performance.sync_duration.average, StdDev: report.performance.sync_duration.std_dev, CI_95: report.performance.sync_duration.ci_95 },
      { Category: 'Sync Throughput (rps)', N: report.performance.sync_throughput.n, Min: report.performance.sync_throughput.min, Max: report.performance.sync_throughput.max, Avg: report.performance.sync_throughput.average, StdDev: report.performance.sync_throughput.std_dev, CI_95: report.performance.sync_throughput.ci_95 },
      { Category: 'Queue Growth (items)', N: report.performance.queue_growth.n, Min: report.performance.queue_growth.min, Max: report.performance.queue_growth.max, Avg: report.performance.queue_growth.average, StdDev: report.performance.queue_growth.std_dev, CI_95: report.performance.queue_growth.ci_95 },
      { Category: 'Temperature (°C)', N: report.environment.temperature.n, Min: report.environment.temperature.min, Max: report.environment.temperature.max, Avg: report.environment.temperature.average, StdDev: report.environment.temperature.std_dev, CI_95: report.environment.temperature.ci_95 },
      { Category: 'Humidity (%)', N: report.environment.humidity.n, Min: report.environment.humidity.min, Max: report.environment.humidity.max, Avg: report.environment.humidity.average, StdDev: report.environment.humidity.std_dev, CI_95: report.environment.humidity.ci_95 }
    ];

    if (format === 'json') {
      const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
      saveAs(blob, `publication_${report.experiment.id}.json`);
    } else if (format === 'csv') {
      const ws = XLSX.utils.json_to_sheet(payload);
      const csv = XLSX.utils.sheet_to_csv(ws);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      saveAs(blob, `publication_${report.experiment.id}.csv`);
    } else if (format === 'excel') {
      const ws = XLSX.utils.json_to_sheet(payload);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Statistics");
      
      const actWs = XLSX.utils.json_to_sheet(report.actuators);
      XLSX.utils.book_append_sheet(wb, actWs, "Actuators");

      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      saveAs(new Blob([wbout], { type: 'application/octet-stream' }), `publication_${report.experiment.id}.xlsx`);
    }
  };

  const StatTable = ({ title, icon: Icon, metrics }) => (
    <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-lg overflow-hidden mb-6">
      <div className="p-5 border-b border-slate-800">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Icon size={16} className="text-purple-500" /> {title}
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-950 text-slate-400 uppercase font-bold text-xs">
            <tr>
              <th className="px-6 py-4">Metric</th>
              <th className="px-6 py-4 text-right">N</th>
              <th className="px-6 py-4 text-right">Min</th>
              <th className="px-6 py-4 text-right">Max</th>
              <th className="px-6 py-4 text-right text-emerald-400">Average</th>
              <th className="px-6 py-4 text-right text-amber-400">Std. Dev (σ)</th>
              <th className="px-6 py-4 text-right text-blue-400">95% CI (±)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {Object.entries(metrics).map(([key, stat]) => (
              <tr key={key} className="hover:bg-slate-800/50 transition-colors">
                <td className="px-6 py-4 font-bold text-white whitespace-nowrap capitalize">{key.replace(/_/g, ' ')}</td>
                <td className="px-6 py-4 text-right text-slate-300">{stat.n.toLocaleString()}</td>
                <td className="px-6 py-4 text-right text-slate-300">{stat.min.toFixed(2)}</td>
                <td className="px-6 py-4 text-right text-slate-300">{stat.max.toFixed(2)}</td>
                <td className="px-6 py-4 text-right text-emerald-400 font-bold">{stat.average.toFixed(2)}</td>
                <td className="px-6 py-4 text-right text-amber-400 font-mono bg-amber-500/5">{stat.std_dev.toFixed(4)}</td>
                <td className="px-6 py-4 text-right text-blue-400 font-mono bg-blue-500/5">{stat.ci_95.toFixed(4)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-6">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-2xl font-black text-white mb-1 flex items-center gap-2">
              <Book className="text-purple-500" /> Publication Summary
            </h2>
            <p className="text-slate-400 text-sm">Academic statistics generated for <span className="font-bold text-white">{report.experiment.name}</span></p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => exportReport('csv')} className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-bold transition-colors"><Download size={14} /> CSV</button>
          <button onClick={() => exportReport('excel')} className="flex items-center gap-2 px-3 py-2 bg-emerald-900/40 hover:bg-emerald-600 text-emerald-400 hover:text-white rounded-lg text-sm font-bold border border-emerald-500/30 transition-colors"><Download size={14} /> Excel</button>
          <button onClick={() => exportReport('json')} className="flex items-center gap-2 px-3 py-2 bg-blue-900/40 hover:bg-blue-600 text-blue-400 hover:text-white rounded-lg text-sm font-bold border border-blue-500/30 transition-colors"><Download size={14} /> JSON</button>
        </div>
      </div>

      {/* Meta Profile */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Dataset Replayed</span>
          <p className="text-lg font-bold text-white mt-1">{report.experiment.dataset || 'N/A'}</p>
        </div>
        <div>
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Replay Speed</span>
          <p className="text-lg font-bold text-white mt-1">{report.experiment.speed}x</p>
        </div>
        <div>
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Network Emulation</span>
          <p className="text-lg font-bold text-white mt-1">{report.experiment.network_mode}</p>
        </div>
        <div>
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Duration</span>
          <p className="text-lg font-bold text-white mt-1">{report.experiment.duration_seconds} seconds</p>
        </div>
      </div>

      {/* Statistics Tables */}
      <StatTable title="Network & Synchronization Performance" icon={Server} metrics={report.performance} />
      
      <StatTable title="Environmental Deviation Profile" icon={Activity} metrics={report.environment} />

      {/* Actuator Metrics */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-lg overflow-hidden mb-6">
        <div className="p-5 border-b border-slate-800">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <FileText size={16} className="text-amber-500" /> Threshold & Actuator Interventions
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-950 text-slate-400 uppercase font-bold text-xs">
              <tr>
                <th className="px-6 py-4">Actuator Type</th>
                <th className="px-6 py-4">Action Taken</th>
                <th className="px-6 py-4 text-right">Frequency (Count)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {report.actuators.length === 0 ? (
                <tr><td colSpan="3" className="px-6 py-4 text-center text-slate-500">No actuator interventions recorded.</td></tr>
              ) : (
                report.actuators.map((act, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-white uppercase">{act.actuator_type}</td>
                    <td className="px-6 py-4 text-slate-300">
                      <span className={`px-2 py-1 rounded text-xs font-bold border ${act.action === 'ON' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'}`}>
                        {act.action}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-black text-amber-400">{act.frequency}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
