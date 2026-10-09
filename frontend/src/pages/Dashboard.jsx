import { useEffect, useState, useRef } from 'react';
import io from 'socket.io-client';
import { useWebSocketLatency } from '../hooks/useLatencyMetrics';
import axios from 'axios';
import {
    AlertCircle,
    ThermometerSun,
    Droplets,
    Sprout,
    Activity,
    Wind,
    Zap,
} from 'lucide-react';

const socket = io('http://192.168.1.10:5000');

export default function Dashboard() {
    const [staticData, setStaticData] = useState({
        summary: [],
        critical_alerts: []
    });

    const [realtimeBox, setRealtimeBox] = useState(null);
    useWebSocketLatency(socket);

    const activeBoxIndexRef = useRef(0);
    // Dynamic box IDs fetched from /api/boxes — replaces hardcoded [1,2,3]
    const boxIdsRef = useRef([]);

    useEffect(() => {
        const token = localStorage.getItem("token");

        // Step 1: Fetch owned box IDs first, then start polling
        const initBoxIds = async () => {
            try {
                const res = await axios.get('http://192.168.1.10:5000/api/boxes', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                boxIdsRef.current = res.data.map(b => b.id);
            } catch (err) {
                console.error("Box ID fetch failed:", err);
                // Fallback so page doesn't freeze
                boxIdsRef.current = [1, 2, 3];
            }
        };

        const fetchSummary = () => {
            axios.get('http://192.168.1.10:5000/api/dashboard', {
                headers: { Authorization: `Bearer ${token}` }
            })
                .then(res => {
                    setStaticData(prev => ({
                        ...prev,
                        summary: res.data.summary || []
                    }));
                })
                .catch(err => console.error("Dashboard API Error:", err));
        };

        const fetchLatestLiveDetails = () => {
            const ids = boxIdsRef.current;
            if (ids.length === 0) return;
            const focusBoxId = ids[activeBoxIndexRef.current % ids.length];
            axios.get(`http://192.168.1.10:5000/api/dashboard/latest/${focusBoxId}`, {
                headers: { Authorization: `Bearer ${token}` }
            })
                .then(res => {
                    const liveData = res.data;
                    setRealtimeBox({
                        box_id: liveData.box_id,
                        temperature: liveData.air_temp,
                        humidity: liveData.air_humidity,
                        media_humidity: liveData.media_humidity,
                        cv_latest: {
                            phase: liveData.cv_latest.phase,
                            confidence: liveData.cv_latest.confidence,
                            counts: liveData.cv_latest.counts
                        },
                        actuators: {
                            fan_in: liveData.actuators.fan_in,
                            pump: liveData.actuators.pump,
                            heater: liveData.actuators.heater
                        },
                        harvest_est: liveData.harvest_est
                    });
                })
                .catch(err => {
                    console.error("Live Data Fetch Error (Pastikan Simulator ESP32 & CV Berjalan):", err);
                });
        };

        // Init: fetch box IDs, then start data loading
        initBoxIds().then(() => {
            fetchSummary();
            fetchLatestLiveDetails();
        });

        const pollingInterval = setInterval(() => {
            activeBoxIndexRef.current = (activeBoxIndexRef.current + 1);
            fetchLatestLiveDetails();
            fetchSummary();
        }, 5000);

        socket.on('telemetry_update', () => { fetchLatestLiveDetails(); });
        socket.on('ml_harvest_update', () => { fetchLatestLiveDetails(); });

        return () => {
            clearInterval(pollingInterval);
            socket.off('telemetry_update');
            socket.off('ml_harvest_update');
        };
    }, []);

    return (
        <div className="space-y-6 animate-in fade-in duration-500 relative">

            {/* ALERT CRITICAL */}
            {staticData.critical_alerts.length > 0 && (
                <div className="bg-red-50 border border-red-200 p-4 rounded-2xl flex items-center gap-4 animate-pulse">
                    <div className="bg-red-500 p-2 rounded-xl text-white">
                        <AlertCircle size={20} />
                    </div>
                    <div>
                        <h3 className="text-red-900 font-bold text-sm">Peringatan Sistem</h3>
                        <p className="text-red-700 text-xs">{staticData.critical_alerts[0].message}</p>
                    </div>
                </div>
            )}

            {/* RINGKASAN DASHBOARD */}
            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <Activity size={20} className="text-emerald-600" />
                    <h2 className="text-lg font-bold text-slate-800 uppercase tracking-wider">Dashboard Ringkasan</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {staticData.summary.length > 0 ? (
                        staticData.summary.map(box => (
                            <div key={box.box_id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex justify-between items-center mb-4">
                                    <div className="flex flex-col">
                                        <span className="text-xs font-black text-slate-400 uppercase">Box Unit</span>
                                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md mt-0.5 w-max">
                                            Ruang {box.room_number || '—'}
                                        </span>
                                    </div>
                                    <h3 className="text-sm font-bold text-emerald-700">#{box.box_id}</h3>
                                </div>
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center p-2 bg-slate-50 rounded-lg">
                                        <div className="flex items-center gap-2 text-slate-500 text-xs">
                                            <ThermometerSun size={14} /> Suhu
                                        </div>
                                        <span className="font-bold text-slate-700">{Number(box.avg_temp).toFixed(1)}°C</span>
                                    </div>
                                    <div className="flex justify-between items-center p-2 bg-slate-50 rounded-lg">
                                        <div className="flex items-center gap-2 text-slate-500 text-xs">
                                            <Droplets size={14} /> Hum. Udara
                                        </div>
                                        <span className="font-bold text-slate-700">{Number(box.avg_humidity).toFixed(1)}%</span>
                                    </div>
                                    <div className="flex justify-between items-center p-2 bg-slate-50 rounded-lg">
                                        <div className="flex items-center gap-2 text-slate-500 text-xs">
                                            <Wind size={14} /> Hum. Media
                                        </div>
                                        <span className="font-bold text-slate-700">{Number(box.avg_media_humidity || 0).toFixed(1)}%</span>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="col-span-3 py-10 text-center bg-slate-100 rounded-2xl border border-dashed border-slate-300 text-slate-400 text-sm">
                            Memuat data ringkasan...
                        </div>
                    )}
                </div>
            </div>

            {/* STATUS AKTUATOR & DETAIL REAL-TIME */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Detail Sensor (2/3 Width) */}
                <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="font-bold text-slate-800 flex items-center gap-2">
                            <Zap size={18} className="text-yellow-500" />
                            STATUS REAL-TIME {realtimeBox && `BOX #${realtimeBox.box_id}`}
                        </h2>
                        {realtimeBox && (
                            <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full">
                                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></span>
                                <span className="text-[10px] font-bold uppercase tracking-widest">Live System</span>
                            </div>
                        )}
                    </div>

                    {realtimeBox ? (
                        <div className="space-y-8">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                                    <p className="text-[10px] font-bold text-emerald-600 uppercase mb-1">Suhu Udara</p>
                                    <p className="text-3xl font-black text-emerald-900">{realtimeBox.temperature}<span className="text-lg">°C</span></p>
                                </div>
                                <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                                    <p className="text-[10px] font-bold text-blue-600 uppercase mb-1">Hum. Udara</p>
                                    <p className="text-3xl font-black text-blue-900">{realtimeBox.humidity}<span className="text-lg">%</span></p>
                                </div>
                                <div className="p-4 bg-orange-50 rounded-2xl border border-orange-100">
                                    <p className="text-[10px] font-bold text-orange-600 uppercase mb-1">Hum. Media</p>
                                    <p className="text-3xl font-black text-orange-900">{realtimeBox.media_humidity}<span className="text-lg">%</span></p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Status Aktuator</p>
                                <div className="grid grid-cols-3 gap-4">
                                    <div className={`flex flex-col items-center justify-center p-4 rounded-2xl border transition-all ${realtimeBox.actuators?.heater ? 'bg-red-50 border-red-200 text-red-600 shadow-inner' : 'bg-slate-50 border-slate-100 text-slate-300'}`}>
                                        <ThermometerSun size={24} className={realtimeBox.actuators?.heater ? 'animate-pulse' : ''} />
                                        <span className="text-[10px] font-black mt-2 uppercase">Heater</span>
                                        <span className="text-[9px] font-bold">{realtimeBox.actuators?.heater ? 'ACTIVE' : 'OFF'}</span>
                                    </div>
                                    <div className={`flex flex-col items-center justify-center p-4 rounded-2xl border transition-all ${realtimeBox.actuators?.fan_in ? 'bg-blue-50 border-blue-200 text-blue-600 shadow-inner' : 'bg-slate-50 border-slate-100 text-slate-300'}`}>
                                        <Wind size={24} className={realtimeBox.actuators?.fan_in ? 'animate-spin' : ''} />
                                        <span className="text-[10px] font-black mt-2 uppercase">Kipas</span>
                                        <span className="text-[9px] font-bold">{realtimeBox.actuators?.fan_in ? 'ACTIVE' : 'OFF'}</span>
                                    </div>
                                    <div className={`flex flex-col items-center justify-center p-4 rounded-2xl border transition-all ${realtimeBox.actuators?.pump ? 'bg-cyan-50 border-cyan-200 text-cyan-600 shadow-inner' : 'bg-slate-50 border-slate-100 text-slate-300'}`}>
                                        <Droplets size={24} className={realtimeBox.actuators?.pump ? 'animate-bounce' : ''} />
                                        <span className="text-[10px] font-black mt-2 uppercase">Pompa</span>
                                        <span className="text-[9px] font-bold">{realtimeBox.actuators?.pump ? 'ACTIVE' : 'OFF'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                            <Activity className="animate-pulse mb-2" />
                            <p className="text-sm">Menunggu Sinkronisasi ESP32...</p>
                        </div>
                    )}
                </div>

                {/* Prediksi Panen (1/3 Width) */}
                <div className="space-y-6">
                    <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-3xl text-white shadow-xl relative overflow-hidden">
                        <div className="relative z-10">
                            <h3 className="text-xs font-black text-emerald-400 uppercase tracking-widest mb-4">Prediksi Panen Terdekat</h3>
                            {realtimeBox ? (
                                <>
                                    <div className="flex items-end gap-2 mb-2">
                                        <span className="text-6xl font-black">{realtimeBox.harvest_est}</span>
                                        <span className="text-xl font-bold text-slate-400 mb-2">Hari Lagi</span>
                                    </div>
                                    <div className="p-3 bg-white/10 rounded-xl border border-white/10 backdrop-blur-sm">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-emerald-500 rounded-lg">
                                                <Sprout size={18} />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold text-slate-300 uppercase">Fase Saat Ini</p>
                                                <p className="text-sm font-bold">{realtimeBox.cv_latest?.phase || 'Unknown'}</p>
                                            </div>
                                        </div>
                                    </div>
                                    <p className="mt-4 text-[10px] text-slate-400 italic">*Estimasi berdasarkan Computer Vision & ML</p>
                                </>
                            ) : (
                                <p className="text-slate-500 text-sm py-10 text-center">Menghitung estimasi...</p>
                            )}
                        </div>
                        {/* Decorative Circle */}
                        <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl"></div>
                    </div>

                    <div className="bg-white p-5 rounded-2xl border border-slate-200">
                        <h4 className="text-xs font-bold text-slate-500 uppercase mb-3">Informasi Sistem</h4>
                        <div className="space-y-2">
                            <div className="flex justify-between text-xs font-medium">
                                <span className="text-slate-400">Status Gateway</span>
                                <span className="text-emerald-600">Online</span>
                            </div>
                            <div className="flex justify-between text-xs font-medium">
                                <span className="text-slate-400">Database</span>
                                <span className="text-emerald-600">Connected</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

        </div>
    );
}
