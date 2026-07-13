import { useState, useEffect, useRef } from 'react';
import { Download, FileJson, FileSpreadsheet, FileText, BarChart, Database, Activity } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';

export default function ResearchDatasetExport() {
  const [experiments, setExperiments] = useState([]);
  const [selectedExp, setSelectedExp] = useState(null);
  const [dataset, setDataset] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const chartRef = useRef(null);

  useEffect(() => {
    fetchExperiments();
  }, []);

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

  const handleSelectExperiment = async (expId) => {
    setSelectedExp(expId);
    setDataset(null);
    if (!expId) return;

    try {
      const res = await fetch(`/api/research/export/${expId}`);
      if (res.ok) {
        const data = await res.json();
        // Format chart timestamps
        if (data.performance_metrics) {
          data.performance_metrics = data.performance_metrics.map(m => ({
            ...m,
            timeLabel: new Date(m.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
          }));
        }
        setDataset(data);
      }
    } catch (err) {
      console.error("Error fetching dataset:", err);
    }
  };

  const convertToCSV = (arr) => {
    if (!arr || arr.length === 0) return '';
    const keys = Object.keys(arr[0]);
    const csvContent = [
      keys.join(','),
      ...arr.map(item => keys.map(k => `"${(item[k] ?? '').toString().replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    return csvContent;
  };

  const handleExportZip = async () => {
    if (!dataset) return;
    setExporting(true);

    try {
      const zip = new JSZip();

      // 1. JSON
      const jsonFolder = zip.folder("json");
      jsonFolder.file("summary.json", JSON.stringify(dataset.summary_statistics, null, 2));
      jsonFolder.file("sensor_data.json", JSON.stringify(dataset.sensor_data, null, 2));
      jsonFolder.file("performance_metrics.json", JSON.stringify(dataset.performance_metrics, null, 2));
      jsonFolder.file("cv_results.json", JSON.stringify(dataset.cv_results, null, 2));
      jsonFolder.file("harvest_predictions.json", JSON.stringify(dataset.harvest_predictions, null, 2));

      // 2. CSV
      const csvFolder = zip.folder("csv");
      csvFolder.file("sensor_data.csv", convertToCSV(dataset.sensor_data));
      csvFolder.file("performance_metrics.csv", convertToCSV(dataset.performance_metrics));
      csvFolder.file("cv_results.csv", convertToCSV(dataset.cv_results));
      csvFolder.file("harvest_predictions.csv", convertToCSV(dataset.harvest_predictions));

      // 3. Excel
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dataset.sensor_data), "Sensor Data");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dataset.performance_metrics), "Performance Metrics");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dataset.cv_results), "CV Results");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dataset.harvest_predictions), "Predictions");
      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      zip.folder("excel").file("dataset.xlsx", excelBuffer);

      // 4. Academic Charts (PNG)
      if (chartRef.current) {
        const canvas = await html2canvas(chartRef.current, { backgroundColor: '#0f172a' }); // Match dark theme
        const imgData = canvas.toDataURL("image/png").split(',')[1];
        zip.folder("charts").file("performance_charts.png", imgData, { base64: true });
      }

      // Generate Zip
      const content = await zip.generateAsync({ type: "blob" });
      const expName = dataset.experiment.experiment_name.replace(/\s+/g, '_');
      saveAs(content, `SenseMaggot_${expName}_Dataset.zip`);

    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white mb-1">Dataset Export</h2>
        <p className="text-slate-400 text-sm">Download comprehensive datasets, metrics, and academic charts for your experiments.</p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
        <label className="block text-sm font-semibold text-slate-300 mb-2">Select Experiment to Export</label>
        <select 
          className="w-full lg:w-1/2 bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500"
          value={selectedExp || ''}
          onChange={(e) => handleSelectExperiment(e.target.value)}
        >
          <option value="">-- Select an Experiment --</option>
          {experiments.map(exp => (
            <option key={exp.id} value={exp.id}>
              {exp.experiment_name} ({exp.status}) - {new Date(exp.started_at).toLocaleDateString()}
            </option>
          ))}
        </select>
      </div>

      {dataset && (
        <>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-white flex items-center gap-2"><Database size={20}/> Dataset Overview</h3>
              <button 
                onClick={handleExportZip}
                disabled={exporting}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white rounded-lg font-bold transition-all shadow-lg shadow-blue-900/40"
              >
                <Download size={18} /> {exporting ? 'Bundling ZIP...' : 'Download Full Dataset (.zip)'}
              </button>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                <p className="text-slate-400 text-xs font-bold uppercase mb-1">Sensor Records</p>
                <p className="text-2xl font-black text-emerald-400">{dataset.sensor_data.length}</p>
              </div>
              <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                <p className="text-slate-400 text-xs font-bold uppercase mb-1">Telemetry Ticks</p>
                <p className="text-2xl font-black text-amber-400">{dataset.performance_metrics.length}</p>
              </div>
              <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                <p className="text-slate-400 text-xs font-bold uppercase mb-1">CV Inferences</p>
                <p className="text-2xl font-black text-purple-400">{dataset.cv_results.length}</p>
              </div>
              <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                <p className="text-slate-400 text-xs font-bold uppercase mb-1">Predictions</p>
                <p className="text-2xl font-black text-blue-400">{dataset.harvest_predictions.length}</p>
              </div>
            </div>

            <h4 className="text-md font-bold text-slate-200 mb-4 border-b border-slate-800 pb-2">Academic Summary Statistics</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-sm text-slate-300">
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span>Avg MQTT Latency</span>
                <span className="font-bold text-white">{dataset.summary_statistics.average_mqtt_latency} ms</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span>Avg WS Latency</span>
                <span className="font-bold text-white">{dataset.summary_statistics.average_ws_latency} ms</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span>Sync Success Rate</span>
                <span className="font-bold text-white">{dataset.summary_statistics.sync_success_rate}%</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span>Data Loss Rate</span>
                <span className="font-bold text-white">{dataset.summary_statistics.data_loss_rate}%</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span>Max Queue Size</span>
                <span className="font-bold text-white">{dataset.summary_statistics.max_queue_size}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span>Avg Sync Duration</span>
                <span className="font-bold text-white">{dataset.summary_statistics.average_sync_time} ms</span>
              </div>
            </div>
          </div>

          {/* Academic Charts (Hidden behind a ref to be captured, or just shown) */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg" ref={chartRef}>
            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2"><BarChart size={20}/> Academic Publication Charts</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              <div className="h-64">
                <h4 className="text-center text-sm font-bold text-slate-400 mb-2">Network Latency Over Time</h4>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dataset.performance_metrics}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="timeLabel" stroke="#94a3b8" fontSize={10} />
                    <YAxis stroke="#94a3b8" fontSize={10} />
                    <Tooltip contentStyle={{backgroundColor: '#1e293b', borderColor: '#334155'}} />
                    <Legend />
                    <Line type="monotone" dataKey="mqtt_latency_ms" name="MQTT (ms)" stroke="#3b82f6" dot={false} />
                    <Line type="monotone" dataKey="ws_latency_ms" name="WebSocket (ms)" stroke="#a855f7" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="h-64">
                <h4 className="text-center text-sm font-bold text-slate-400 mb-2">Sync Performance & DB Load</h4>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dataset.performance_metrics}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="timeLabel" stroke="#94a3b8" fontSize={10} />
                    <YAxis yAxisId="left" stroke="#94a3b8" fontSize={10} />
                    <YAxis yAxisId="right" orientation="right" stroke="#94a3b8" fontSize={10} />
                    <Tooltip contentStyle={{backgroundColor: '#1e293b', borderColor: '#334155'}} />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="sync_duration_ms" name="Sync Time (ms)" stroke="#10b981" dot={false} />
                    <Line yAxisId="right" type="monotone" dataKey="pg_insert_time_ms" name="PG Insert (ms)" stroke="#f43f5e" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

            </div>
          </div>
        </>
      )}

      {!dataset && !loading && (
        <div className="flex flex-col items-center justify-center py-20 text-center opacity-50">
          <FileText size={64} className="text-slate-600 mb-6" />
          <h2 className="text-2xl font-black text-slate-400 mb-2">Select an Experiment</h2>
          <p className="text-slate-500 max-w-md">Choose an experiment from the dropdown above to load and export its complete dataset.</p>
        </div>
      )}
    </div>
  );
}
