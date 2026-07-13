import React, { useState, useEffect } from 'react';
import { 
    Cloud, 
    CloudOff, 
    Activity, 
    Database, 
    RefreshCcw,
    CheckCircle,
    Download,
    Wifi
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend
} from 'recharts';
import { format } from 'date-fns';

const AdminSync = () => {
    const [metrics, setMetrics] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchMetrics = async () => {
        try {
            const res = await fetch('/api/system/sync-metrics');
            if (res.ok) {
                const data = await res.json();
                setMetrics(data);
            }
        } catch (err) {
            console.error("Failed to fetch sync metrics", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMetrics();
        const interval = setInterval(fetchMetrics, 5000);
        return () => clearInterval(interval);
    }, []);

    const [exporting, setExporting] = useState(false);
    const [showExportMenu, setShowExportMenu] = useState(false);

    const handleExport = async (formatType, filtered = false) => {
        setExporting(true);
        setShowExportMenu(false);
        try {
            // Include filters in query string if filtered=true is implemented later
            let url = `/api/research/export/sync/${formatType}`;
            if (filtered) {
                // Add query params here when filter UI is built
                // url += '?startDate=...';
            }
            const res = await fetch(url);
            if (!res.ok) throw new Error('Export failed');
            
            const blob = await res.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = downloadUrl;
            
            // Extract filename from Content-Disposition if present, else default
            const contentDisposition = res.headers.get('content-disposition');
            let filename = `sync_logs.${formatType}`;
            if (contentDisposition) {
                const match = contentDisposition.match(/filename="?([^"]+)"?/);
                if (match && match[1]) filename = match[1];
            }
            
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(downloadUrl);
        } catch (err) {
            console.error("Export error:", err);
            alert("Failed to export data. Please try again.");
        } finally {
            setExporting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="relative w-16 h-16">
                    <div className="absolute inset-0 border-4 border-slate-200 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
                </div>
            </div>
        );
    }

    if (!metrics) {
        return (
            <div className="p-8 text-center bg-red-50 text-red-500 rounded-xl border border-red-200 shadow-sm mt-8">
                <CloudOff className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <h3 className="text-lg font-bold">Failed to load metrics</h3>
                <p className="text-sm">Please ensure the edge server is running.</p>
            </div>
        );
    }

    const isOnline = metrics.mode === 'ONLINE';

    // Prepare chart data
    const chartData = [...(metrics.history || [])].reverse().map(log => ({
        time: format(new Date(log.created_at), 'HH:mm:ss'),
        Accepted: log.accepted,
        Failed: log.failed,
        BatchSize: log.batch_size
    }));

    return (
        <div className="space-y-6 pb-12 animate-in fade-in duration-500">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div className="flex items-center gap-4">
                    <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-200">
                        <RefreshCcw className="w-8 h-8 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Offline Synchronization</h1>
                        <p className="text-sm text-slate-500 font-medium mt-1">Monitor Edge-to-Cloud data mobility and queue health in real-time.</p>
                    </div>
                </div>
                <div className="relative mt-6 md:mt-0">
                    <button 
                        onClick={() => setShowExportMenu(!showExportMenu)}
                        disabled={exporting}
                        className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-md shadow-indigo-200 transition-all active:scale-95 disabled:opacity-70"
                    >
                        {exporting ? (
                            <><RefreshCcw className="w-4 h-4 animate-spin" /> Exporting...</>
                        ) : (
                            <><Download className="w-4 h-4" /> Export Data</>
                        )}
                    </button>

                    {showExportMenu && !exporting && (
                        <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-100 rounded-xl shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                            <div className="p-1">
                                <button 
                                    onClick={() => handleExport('csv', false)}
                                    className="w-full text-left px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-indigo-600 rounded-lg transition-colors flex items-center gap-2"
                                >
                                    Export All (CSV)
                                </button>
                                <button 
                                    onClick={() => handleExport('json', false)}
                                    className="w-full text-left px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-indigo-600 rounded-lg transition-colors flex items-center gap-2"
                                >
                                    Export All (JSON)
                                </button>
                                <div className="h-px bg-slate-100 my-1"></div>
                                <button 
                                    onClick={() => handleExport('csv', true)}
                                    className="w-full text-left px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-indigo-600 rounded-lg transition-colors flex items-center gap-2"
                                >
                                    Export Filtered (CSV)
                                </button>
                                <button 
                                    onClick={() => handleExport('json', true)}
                                    className="w-full text-left px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-indigo-600 rounded-lg transition-colors flex items-center gap-2"
                                >
                                    Export Filtered (JSON)
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800 p-6 rounded-2xl shadow-xl hover:-translate-y-1 transition-transform duration-300">
                    <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white opacity-5 rounded-full blur-2xl"></div>
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm text-slate-400 font-medium mb-1">Network Status</p>
                            <p className="text-2xl font-black text-white tracking-wide">
                                {metrics.mode}
                            </p>
                        </div>
                        <div className={`p-3 rounded-xl ${isOnline ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>
                            {isOnline ? 
                                <Wifi className="w-7 h-7 text-emerald-400 animate-pulse" /> : 
                                <CloudOff className="w-7 h-7 text-red-400" />
                            }
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm text-slate-500 font-medium mb-1">Pending Queue</p>
                            <p className="text-3xl font-black text-slate-800">{metrics.pendingQueue}</p>
                        </div>
                        <div className="p-3 rounded-xl bg-amber-50">
                            <Database className="w-7 h-7 text-amber-500" />
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm text-slate-500 font-medium mb-1">Synced Records</p>
                            <p className="text-3xl font-black text-slate-800">{metrics.syncedRecords}</p>
                        </div>
                        <div className="p-3 rounded-xl bg-blue-50">
                            <CheckCircle className="w-7 h-7 text-blue-500" />
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm text-slate-500 font-medium mb-1">Oldest Pending</p>
                            <p className="text-2xl font-black text-slate-800 tracking-tight">
                                {metrics.oldestPendingRecord ? format(new Date(metrics.oldestPendingRecord), 'HH:mm:ss') : '-'}
                            </p>
                        </div>
                        <div className="p-3 rounded-xl bg-slate-50">
                            <Activity className="w-7 h-7 text-slate-600" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Statistics Row 1 */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                <div className="bg-white px-4 py-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-2 text-center">Avg Sync Time</p>
                    <p className="text-xl font-black text-slate-700">{metrics.avgSyncTime}</p>
                    <p className="text-[10px] text-slate-400 mt-1">Min: {metrics.minSyncTime} | Max: {metrics.maxSyncTime}</p>
                </div>
                <div className="bg-white px-4 py-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-2 text-center">Avg Batch Size</p>
                    <p className="text-xl font-black text-indigo-600">{metrics.avgBatchSize}</p>
                    <p className="text-[10px] text-slate-400 mt-1">Min: {metrics.minBatchSize} | Max: {metrics.maxBatchSize}</p>
                </div>
                <div className="bg-white px-4 py-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-2 text-center">Total Retries</p>
                    <p className="text-xl font-black text-slate-700">{metrics.totalRetries}</p>
                    <p className="text-[10px] text-slate-400 mt-1">Avg: {metrics.avgRetry}/item</p>
                </div>
                <div className="bg-white px-4 py-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-2 text-center">Peak Queue</p>
                    <p className="text-xl font-black text-amber-600">{metrics.maxQueueSize}</p>
                </div>
                <div className="bg-white px-4 py-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-2 text-center">Data Loss</p>
                    <p className="text-xl font-black text-emerald-500">{metrics.dataLoss}</p>
                </div>
                <div className="bg-white px-4 py-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-2 text-center">Success / Fail</p>
                    <p className="text-xl font-black text-blue-500">{metrics.successRate}%</p>
                    <p className="text-[10px] text-red-400 mt-1">Fail: {metrics.failureRate}%</p>
                </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-indigo-50 rounded-lg">
                            <Activity className="w-5 h-5 text-indigo-500" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-800">Sync History (Throughput)</h3>
                    </div>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%" minWidth={10} minHeight={10}>
                            <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="time" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} dy={10} />
                                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                                <RechartsTooltip 
                                    contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                />
                                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                <Line type="monotone" dataKey="Accepted" stroke="#10b981" strokeWidth={3} dot={{ r: 3, fill: '#10b981', strokeWidth: 0 }} activeDot={{ r: 6 }} />
                                <Line type="monotone" dataKey="Failed" stroke="#ef4444" strokeWidth={3} dot={{ r: 3, fill: '#ef4444', strokeWidth: 0 }} activeDot={{ r: 6 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-blue-50 rounded-lg">
                            <RefreshCcw className="w-5 h-5 text-blue-500" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-800">Batch Transmission Size</h3>
                    </div>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%" minWidth={10} minHeight={10}>
                            <BarChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="time" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} dy={10} />
                                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                                <RechartsTooltip 
                                    contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                    cursor={{ fill: '#f8fafc' }}
                                />
                                <Bar dataKey="BatchSize" fill="#6366f1" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Data Table */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-50 rounded-lg">
                            <Database className="w-5 h-5 text-slate-500" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-800">Recent Sync Logs</h3>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50 text-slate-500 text-[11px] uppercase tracking-widest">
                                <th className="px-6 py-4 font-bold">Timestamp</th>
                                <th className="px-6 py-4 font-bold">Batch Size</th>
                                <th className="px-6 py-4 font-bold">Duration</th>
                                <th className="px-6 py-4 font-bold">Accepted</th>
                                <th className="px-6 py-4 font-bold">Duplicates</th>
                                <th className="px-6 py-4 font-bold">Failed</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-sm">
                            {metrics.history && metrics.history.length > 0 ? (
                                metrics.history.map((log) => (
                                    <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-slate-500 font-medium">
                                            {format(new Date(log.created_at), 'MMM dd, yyyy HH:mm:ss')}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-bold">
                                                {log.batch_size}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-slate-500 font-medium">
                                            {log.sync_duration_ms ? `${log.sync_duration_ms} ms` : '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-emerald-600 font-bold flex items-center gap-1.5">
                                                {log.accepted > 0 && <CheckCircle className="w-3 h-3" />}
                                                {log.accepted}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-amber-500 font-semibold">
                                            {log.duplicates}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-red-500 font-bold">
                                            {log.failed}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="6" className="px-6 py-12 text-center">
                                        <div className="flex flex-col items-center justify-center text-slate-400">
                                            <Database className="w-10 h-10 mb-3 opacity-20" />
                                            <p className="font-medium">No synchronization logs found in the database.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default AdminSync;
