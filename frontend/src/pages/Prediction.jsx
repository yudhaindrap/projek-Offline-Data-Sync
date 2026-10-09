// src/pages/Prediction.jsx
import { useState, useEffect } from 'react';
import axios from 'axios';
import {
  CalendarClock, AlertTriangle, TrendingUp,
  Package, Timer, ChevronRight
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell
} from 'recharts';

export default function Prediction() {
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const fetchPredictions = () => {
      axios.get('http://192.168.1.10:5000/api/predictions/all', {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => {
          setPredictions(res.data);
          setLoading(false);
        })
        .catch(err => console.error("Predictions API Error:", err));
    };

    fetchPredictions();
    const interval = setInterval(fetchPredictions, 15000); // Sinkron dengan cycle XGBoost (15s)
    return () => clearInterval(interval);
  }, []);

  // Mengurutkan data berdasarkan sisa hari terkecil (paling mendesak di atas)
  const sortedPredictions = [...predictions].sort((a, b) => a.days - b.days);

  // Data untuk Grafik Batang
  const chartData = sortedPredictions.map(p => ({
    name: `Box ${p.boxId}`,
    sisa: p.days,
    color: p.status === 'warning' ? '#f97316' : '#10b981'
  }));

  return (
    <div className="space-y-6 pb-10">
      {/* SECTION 1: INSIGHT CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-emerald-600 p-5 rounded-2xl shadow-lg shadow-emerald-100 text-white flex items-center gap-4">
          <div className="bg-white/20 p-3 rounded-xl">
            <TrendingUp size={24} />
          </div>
          <div>
            <p className="text-emerald-100 text-xs font-bold uppercase tracking-wider">Akurasi Model</p>
            <p className="text-2xl font-black">94.2%</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="bg-orange-100 text-orange-600 p-3 rounded-xl">
            <Package size={24} />
          </div>
          <div>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Siap Panen (Minggu Ini)</p>
            <p className="text-2xl font-black text-slate-800">1 Box</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="bg-blue-100 text-blue-600 p-3 rounded-xl">
            <Timer size={24} />
          </div>
          <div>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Rerata Siklus</p>
            <p className="text-2xl font-black text-slate-800">24 Hari</p>
          </div>
        </div>
      </div>

      {/* SECTION 2: GRAFIK ESTIMASI */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
          <CalendarClock size={20} className="text-emerald-600" />
          Perbandingan Estimasi Panen
        </h3>
        <div className="h-[250px] w-full min-h-[250px]">
          <ResponsiveContainer width="100%" height="100%" minWidth={200} minHeight={250}>
            {/* 1. Ubah margin left menjadi positif (misal: 10 atau 20) */}
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
              <XAxis type="number" hide />

              {/* 2. Tambahkan width pada YAxis agar label tidak tercekik */}
              <YAxis
                dataKey="name"
                type="category"
                width={60}
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#64748b', fontWeight: 600, fontSize: 12 }}
              />

              <Tooltip
                cursor={{ fill: 'transparent' }}
                contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              />
              <Bar dataKey="sisa" radius={[0, 10, 10, 0]} barSize={30}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="text-center text-xs text-slate-400 mt-2 italic">* Box dengan sisa hari paling sedikit ditampilkan paling atas</p>
      </div>

      {/* SECTION 3: PREDICTION CARDS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {sortedPredictions.map((pred) => (
          <div key={pred.boxId} className={`bg-white rounded-2xl shadow-sm border-2 overflow-hidden transition-all hover:shadow-md ${pred.status === 'warning' ? 'border-orange-400' : 'border-slate-100'}`}>
            {/* Header Box */}
            <div className={`p-4 flex justify-between items-center ${pred.status === 'warning' ? 'bg-orange-50' : 'bg-slate-50'}`}>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter leading-none">Ruang {pred.floor}</p>
                <h2 className="text-lg font-black text-slate-700">BOX #{pred.boxId}</h2>
              </div>
              {pred.status === 'warning' && (
                <div className="animate-bounce">
                  <AlertTriangle size={24} className="text-orange-500" />
                </div>
              )}
            </div>

            <div className="p-6">
              {/* Progress Bar */}
              <div className="mb-6">
                <div className="flex justify-between text-xs font-bold mb-1.5">
                  <span className="text-slate-400 uppercase">Tahap Siklus</span>
                  <span className={pred.status === 'warning' ? 'text-orange-600' : 'text-emerald-600'}>{pred.progress}%</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ${pred.status === 'warning' ? 'bg-orange-500' : 'bg-emerald-500'}`}
                    style={{ width: `${pred.progress}%` }}
                  ></div>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="text-slate-400 mt-1"><TrendingUp size={16} /></div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Status Mikroklimat</p>
                    <p className="text-xs text-slate-600 font-medium leading-tight">{pred.input}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="text-slate-400 mt-1"><Package size={16} /></div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Analisis Visual</p>
                    <p className="text-xs text-slate-600 font-medium leading-tight">{pred.dist}</p>
                  </div>
                </div>
              </div>

              <div className="relative p-5 bg-slate-900 rounded-2xl overflow-hidden shadow-inner">
                <div className="absolute top-0 right-0 w-20 h-20 bg-white/5 rounded-full -mr-10 -mt-10"></div>

                <div className="relative z-10 flex flex-col items-center">
                  <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-[0.2em] mb-1">Prediksi Panen</p>
                  <p className="text-lg font-bold text-white mb-3">{pred.date}</p>

                  <div className="h-[1px] w-full bg-white/10 mb-3"></div>

                  <div className="flex items-baseline gap-1">
                    <span className={`text-4xl font-black ${pred.status === 'warning' ? 'text-orange-400' : 'text-emerald-400'}`}>
                      {pred.days}
                    </span>
                    <span className="text-white font-bold text-sm">Hari Lagi</span>
                  </div>
                </div>
              </div>

              {pred.status === 'warning' && (
                <button className="w-full mt-4 py-3 bg-orange-100 text-orange-700 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-orange-200 transition-colors flex items-center justify-center gap-2">
                  Siapkan Logistik Panen <ChevronRight size={14} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
