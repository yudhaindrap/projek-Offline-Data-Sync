// src/pages/Monitoring.jsx
import { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Thermometer, Droplets, Fan, AlertTriangle,
  Activity, Zap, Box as BoxIcon, Power, Lightbulb
} from 'lucide-react';
import {
  XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, AreaChart, Area
} from 'recharts';

// Data Mock untuk Grafik dihapus, kita menggunakan fetch API dari chartsRoutes (real database data)

// 1. DAFTAR AKTUATOR DIPERBARUI (Menambahkan Lampu Heater)
const AVAILABLE_ACTUATORS = ['Kipas Exhaust', 'Solenoid Valve', 'Lampu Heater'];

export default function Monitoring() {
  const [boxes, setBoxes] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");

    const fetchData = async () => {
      try {
        const boxRes = await axios.get('http://192.168.1.10:5000/api/monitoring/all', { headers: { Authorization: `Bearer ${token}` } });
        const fetchedBoxes = boxRes.data;
        setBoxes(fetchedBoxes);

        if (fetchedBoxes && fetchedBoxes.length > 0) {
          const firstBoxId = fetchedBoxes[0].id;
          const chartRes = await axios.get(`http://192.168.1.10:5000/api/charts/${firstBoxId}`, { headers: { Authorization: `Bearer ${token}` } });
          setChartData(chartRes.data);
        }
        setLoading(false);
      } catch (err) {
        console.error("Monitoring Fetch Error:", err);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  // Fungsi untuk menyalakan/mematikan aktuator secara manual
  const handleToggleActuator = async (boxId, actuatorName) => {
    const token = localStorage.getItem("token");
    const targetBox = boxes.find(b => b.id === boxId);
    if (!targetBox) return;

    const isActive = targetBox.activeActuators.includes(actuatorName);
    const newState = !isActive;

    try {
      // 1. Kirim perintah ke Backend (MQTT Bridge)
      await axios.post('http://192.168.1.10:5000/api/actuators/toggle', {
        box_id: boxId,
        actuator: actuatorName,
        state: newState
      }, { headers: { Authorization: `Bearer ${token}` } });

      // 2. Optimistic Update UI
      setBoxes((prevBoxes) =>
        prevBoxes.map((box) => {
          if (box.id === boxId) {
            return {
              ...box,
              activeActuators: newState
                ? [...box.activeActuators, actuatorName]
                : box.activeActuators.filter((act) => act !== actuatorName),
            };
          }
          return box;
        })
      );
    } catch (err) {
      console.error("Manual Toggle Error:", err);
      alert("Gagal mengirim perintah manual ke alat.");
    }
  };

  // Fungsi Helper untuk memberikan Icon yang sesuai pada masing-masing Aktuator
  const renderActuatorIcon = (name) => {
    switch (name) {
      case 'Kipas Exhaust':
        return <Fan size={12} className="animate-spin" />;
      case 'Solenoid Valve':
        return <Droplets size={12} />;
      case 'Lampu Heater':
        return <Lightbulb size={12} className="animate-pulse text-amber-300" />;
      default:
        return <Zap size={12} />;
    }
  };

  // Hitung statistik secara dinamis
  const averageTemp = (boxes.reduce((acc, box) => acc + box.temp, 0) / boxes.length).toFixed(1);
  const totalActiveActuators = boxes.reduce((acc, box) => acc + box.activeActuators.length, 0);

  return (
    <div className="space-y-6 mb-10">
      {/* SECTION 1: RINGKASAN STATISTIK */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center">
            <BoxIcon size={24} />
          </div>
          <div>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Total Box</p>
            <p className="text-2xl font-black text-slate-800">{boxes.length} Unit</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center">
            <Activity size={24} />
          </div>
          <div>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Rerata Suhu</p>
            <p className="text-2xl font-black text-slate-800">{averageTemp} °C</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center">
            <Zap size={24} />
          </div>
          <div>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Aktuator Aktif</p>
            <p className="text-2xl font-black text-slate-800">{totalActiveActuators} Perangkat</p>
          </div>
        </div>
      </div>

      {/* SECTION 2: GRAFIK TREN */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Tren Mikroklimat</h3>
            <p className="text-sm text-slate-500">Visualisasi suhu dan kelembapan 24 jam terakhir</p>
          </div>
        </div>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%" minWidth={10} minHeight={10}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorTemp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.1} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
              <Tooltip
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              />
              <Area type="monotone" dataKey="temp" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorTemp)" name="Suhu (°C)" />
              <Area type="monotone" dataKey="hum" stroke="#3b82f6" strokeWidth={3} fillOpacity={0} name="Kelembapan Udara (%)" />
              <Area type="monotone" dataKey="media_hum" stroke="#f59e0b" strokeWidth={3} fillOpacity={0} name="Kelembapan Media (%)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* SECTION 3: GRID BOX MONITORING */}
      {loading ? (
        <div className="py-20 text-center text-slate-400 font-bold bg-white rounded-2xl border border-dashed animate-pulse">Menghubungkan ke Sensor Box...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {boxes.map((box) => (
            <div key={box.id} className={`bg-white p-6 rounded-2xl shadow-sm border-t-4 transition-all hover:shadow-md ${box.tempStatus === 'warning' || box.mediaStatus === 'warning' ? 'border-orange-500' : 'border-emerald-500'}`}>
              <div className="flex justify-between items-start mb-4 border-b pb-3">
                <h2 className="text-lg font-bold text-slate-700 uppercase">
                  Ruang {box.floor} <span className="text-slate-300 mx-1">|</span> Box #{box.id}
                </h2>
                {box.tempStatus === 'warning' && <AlertTriangle className="text-orange-500 animate-pulse" size={20} />}
              </div>

              {/* Sensor Data */}
              <div className="space-y-5">
                <div className="flex justify-between items-center group">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-50 rounded-lg group-hover:bg-emerald-50 transition-colors">
                      <Thermometer size={18} className="text-slate-500 group-hover:text-emerald-600" />
                    </div>
                    <span className="text-sm font-medium text-slate-600">Suhu Udara</span>
                  </div>
                  <span className={`font-bold px-3 py-1 rounded-full text-sm ${box.tempStatus === 'warning' ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-700'}`}>
                    {box.temp.toFixed(1)} °C
                  </span>
                </div>

                <div className="flex justify-between items-center group">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-50 rounded-lg group-hover:bg-blue-50 transition-colors">
                      <Droplets size={18} className="text-slate-500 group-hover:text-blue-600" />
                    </div>
                    <span className="text-sm font-medium text-slate-600">Kelembapan Udara</span>
                  </div>
                  <span className="font-bold px-3 py-1 rounded-full text-sm bg-slate-100 text-slate-700">
                    {box.humidity.toFixed(1)} %
                  </span>
                </div>

                <div className="flex justify-between items-center group">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-50 rounded-lg group-hover:bg-orange-50 transition-colors">
                      <Droplets size={18} className="text-slate-500 group-hover:text-orange-600" />
                    </div>
                    <span className="text-sm font-medium text-slate-600">Kelembapan Media</span>
                  </div>
                  <span className={`font-bold px-3 py-1 rounded-full text-sm flex items-center gap-1 ${box.mediaStatus === 'warning' ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-700'}`}>
                    {box.media.toFixed(1)} %
                  </span>
                </div>
              </div>

              {/* Status Aktuator Terkini (Menggunakan fungsi dinamis pendeteksi icon) */}
              <div className="mt-6 pt-4 border-t border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Status Aktuator</p>
                {box.activeActuators.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {box.activeActuators.map((act, idx) => (
                      <span key={idx} className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 shadow-sm shadow-emerald-100">
                        {renderActuatorIcon(act)} {act}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-slate-400 bg-slate-50 p-2 rounded-lg border border-dashed border-slate-200">
                    <div className="w-2 h-2 bg-slate-300 rounded-full"></div>
                    <span className="text-xs italic font-medium">Standby Mode</span>
                  </div>
                )}
              </div>

              {/* KONTROL MANUAL DEVICE (Diubah menjadi flex-wrap agar muat 3 tombol) */}
              <div className="mt-4 pt-4 border-t border-slate-100 bg-slate-50/50 -mx-6 -mb-6 p-6 rounded-b-2xl">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1">
                  <Power size={10} /> Kontrol Manual Device
                </p>
                <div className="flex flex-col gap-2">
                  {AVAILABLE_ACTUATORS.map((actuator) => {
                    const isActive = box.activeActuators.includes(actuator);
                    return (
                      <button
                        key={actuator}
                        onClick={() => handleToggleActuator(box.id, actuator)}
                        className={`flex items-center justify-between gap-2 py-2.5 px-3 rounded-xl text-xs font-bold border transition-all duration-200 ${isActive
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm shadow-emerald-100'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                      >
                        <div className="flex items-center gap-2">
                          {actuator === 'Lampu Heater' && <Lightbulb size={14} className={isActive ? 'text-amber-500' : 'text-slate-400'} />}
                          {actuator === 'Kipas Exhaust' && <Fan size={14} className={isActive ? 'text-emerald-500' : 'text-slate-400'} />}
                          {actuator === 'Solenoid Valve' && <Droplets size={14} className={isActive ? 'text-blue-500' : 'text-slate-400'} />}
                          <span>{actuator}</span>
                        </div>
                        <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`}></span>
                      </button>
                    );
                  })}
                </div>
              </div>

            </div>
          ))}
        </div>
      )}
    </div>
  );
}
