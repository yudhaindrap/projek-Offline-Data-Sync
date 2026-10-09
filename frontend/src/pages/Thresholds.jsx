import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Save,
  Thermometer,
  Droplets,
  Wind,
  AlertCircle,
  RotateCcw,
  Layers,
  MoveRight,
  CheckCircle,
  X,
} from 'lucide-react';

export default function Thresholds() {

  // State ruang aktif
  const [selectedFloor, setSelectedFloor] = useState(1);

  // ── Box Relocation State ──
  const [boxes, setBoxes] = useState([]);
  const [relocBoxId, setRelocBoxId] = useState('');
  const [relocFloor, setRelocFloor] = useState(1);
  const [relocSlot, setRelocSlot] = useState('');
  const [relocLoading, setRelocLoading] = useState(false);
  const [relocToast, setRelocToast] = useState(null); // { type: 'success'|'error', message }

  const showRelocToast = useCallback((type, message) => {
    setRelocToast({ type, message });
    setTimeout(() => setRelocToast(null), 4000);
  }, []);

  // Fetch available boxes
  useEffect(() => {
    const token = localStorage.getItem('token');
    axios
      .get('http://192.168.1.10:5000/api/boxes', {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => {
        setBoxes(res.data);
        if (res.data.length > 0) setRelocBoxId(res.data[0].id);
      })
      .catch(err => console.error('Boxes Fetch Error:', err));
  }, []);

  const handleRelocate = async () => {
    if (!relocBoxId) return;
    setRelocLoading(true);
    const token = localStorage.getItem('token');
    try {
      const res = await axios.put(
        `http://192.168.1.10:5000/api/boxes/${relocBoxId}/relocate`,
        { room_number: relocFloor, slot_number: relocSlot },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      showRelocToast('success', res.data.message);
      setRelocSlot('');
      // Refresh box list to reflect new room_number
      const updated = await axios.get('http://192.168.1.10:5000/api/boxes', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBoxes(updated.data);
    } catch (err) {
      showRelocToast('error', err.response?.data?.message || 'Gagal memindahkan box.');
    } finally {
      setRelocLoading(false);
    }
  };

  // Form state
  const [form, setForm] = useState({
    floorLevel: 1,
    tempMin: 25.0,
    tempMax: 35.0,
    mediaMin: 40.0,
    mediaMax: 65.0,
    humAirMin: 60.0,
    humAirMax: 85.0
  });

  // Fetch data berdasarkan ruang
  useEffect(() => {
    const token = localStorage.getItem('token');

    axios
      .get(
        `http://192.168.1.10:5000/api/thresholds/${selectedFloor}`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      )
      .then((res) => setForm(res.data))
      .catch((err) =>
        console.error('Thresholds Fetch Error:', err)
      );

  }, [selectedFloor]);

  // Save
  const handleSave = async (e) => {
    e.preventDefault();

    const token = localStorage.getItem('token');

    try {

      await axios.post(
        'http://192.168.1.10:5000/api/thresholds',
        {
          ...form,
          floorLevel: selectedFloor
        },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      alert(
        `Konfigurasi ambang batas Ruang ${selectedFloor} berhasil diperbarui dan disinkronkan ke DB & Broker MQTT!`
      );

    } catch (err) {

      console.error('Save Thresholds Error:', err);

      alert(
        `Gagal menyimpan ambang batas Ruang ${selectedFloor}`
      );
    }
  };

  // Reset default
  const handleReset = () => {

    if (
      window.confirm(
        `Kembalikan pengaturan Ruang ${selectedFloor} ke default pabrik?`
      )
    ) {

      setForm({
        floorLevel: selectedFloor,
        tempMin: 25.0,
        tempMax: 32.0,
        mediaMin: 40.0,
        mediaMax: 65.0,
        humAirMin: 60.0,
        humAirMax: 85.0
      });

    }
  };

  return (
    <div className="space-y-6 pb-10">

      {/* HEADER INFO */}
      <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex items-start gap-4">

        <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
          <AlertCircle size={20} />
        </div>

        <div>
          <h4 className="text-sm font-bold text-emerald-900">
            Panduan Konfigurasi Multi-Ruang
          </h4>

          <p className="text-xs text-emerald-700 leading-relaxed">
            Pilih nomor Ruang terlebih dahulu sebelum mengubah parameter.
            Parameter di bawah ini akan menentukan kapan aktuator pada
            Ruang tersebut menyala secara otomatis.
          </p>
        </div>

      </div>

      {/* SELECTOR RUANG */}
      <div className="bg-slate-100 p-1.5 rounded-2xl inline-flex w-full md:w-auto gap-1 border border-slate-200">

        {[1, 2, 3, 4].map((floor) => (

          <button
            key={floor}
            type="button"
            onClick={() => setSelectedFloor(floor)}
            className={`
              flex-1 md:flex-initial
              px-6 py-2.5
              rounded-xl
              font-bold
              text-xs
              uppercase
              tracking-wider
              transition
              flex items-center justify-center gap-2

              ${selectedFloor === floor
                ? 'bg-white text-emerald-700 shadow-sm border border-slate-200/60'
                : 'text-slate-600 hover:bg-slate-200/70'
              }
            `}
          >

            <Layers size={14} />
            Ruang {floor}

          </button>

        ))}

      </div>

      {/* CARD */}
      <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-200">

        <div className="mb-6 flex items-center gap-2">

          <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full font-black text-xs">
            RUANG KANDANG {selectedFloor}
          </span>

        </div>

        <form onSubmit={handleSave} className="space-y-8">

          {/* SUHU UDARA */}
          <div className="space-y-3">

            <div className="flex items-center gap-2 text-emerald-700 border-b border-slate-100 pb-2">

              <Thermometer size={18} />

              <h3 className="text-base font-black uppercase tracking-tight">
                Ambang Suhu Udara
              </h3>

            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              <div className="space-y-1">

                <label className="text-[11px] font-bold text-slate-500 uppercase">
                  Suhu Minimum (°C)
                </label>

                <input
                  type="number"
                  step="0.1"
                  value={form.tempMin || ''}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      tempMin: parseFloat(e.target.value) || 0
                    })
                  }
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-semibold text-sm"
                />

                <p className="text-[10px] text-slate-400 italic">
                  Heater aktif jika suhu turun di bawah batas ini.
                </p>

              </div>

              <div className="space-y-1">

                <label className="text-[11px] font-bold text-slate-500 uppercase">
                  Suhu Maksimum (°C)
                </label>

                <input
                  type="number"
                  step="0.1"
                  value={form.tempMax || ''}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      tempMax: parseFloat(e.target.value) || 0
                    })
                  }
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-semibold text-sm"
                />

                <p className="text-[10px] text-slate-400 italic">
                  Kipas aktif jika suhu melebihi batas ini.
                </p>

              </div>

            </div>

          </div>

          {/* KELEMBAPAN MEDIA */}
          {selectedFloor !== 4 && (

            <div className="space-y-3">

              <div className="flex items-center gap-2 text-blue-600 border-b border-slate-100 pb-2">

                <Droplets size={18} />

                <h3 className="text-base font-black uppercase tracking-tight">
                  Ambang Kelembapan Media
                </h3>

              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                <div className="space-y-1">

                  <label className="text-[11px] font-bold text-slate-500 uppercase">
                    Kelembapan Min (%)
                  </label>

                  <input
                    type="number"
                    step="0.1"
                    value={form.mediaMin || ''}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        mediaMin: parseFloat(e.target.value) || 0
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-semibold text-sm"
                  />

                  <p className="text-[10px] text-slate-400 italic">
                    Memulai penyiraman otomatis.
                  </p>

                </div>

                <div className="space-y-1">

                  <label className="text-[11px] font-bold text-slate-500 uppercase">
                    Kelembapan Maks (%)
                  </label>

                  <input
                    type="number"
                    step="0.1"
                    value={form.mediaMax || ''}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        mediaMax: parseFloat(e.target.value) || 0
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-semibold text-sm"
                  />

                  <p className="text-[10px] text-slate-400 italic">
                    Menghentikan penyiraman otomatis.
                  </p>

                </div>

              </div>

            </div>

          )}

          {/* KELEMBAPAN UDARA */}
          <div className="space-y-3">

            <div className="flex items-center gap-2 text-indigo-600 border-b border-slate-100 pb-2">

              <Wind size={18} />

              <h3 className="text-base font-black uppercase tracking-tight">
                Ambang Kelembapan Udara
              </h3>

            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              <div className="space-y-1">

                <label className="text-[11px] font-bold text-slate-500 uppercase">
                  RH Min (%)
                </label>

                <input
                  type="number"
                  step="0.1"
                  value={form.humAirMin || ''}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      humAirMin: parseFloat(e.target.value) || 0
                    })
                  }
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-semibold text-sm"
                />

                <p className="text-[10px] text-slate-400 italic">
                  Mengaktifkan humidifier.
                </p>

              </div>

              <div className="space-y-1">

                <label className="text-[11px] font-bold text-slate-500 uppercase">
                  RH Maks (%)
                </label>

                <input
                  type="number"
                  step="0.1"
                  value={form.humAirMax || ''}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      humAirMax: parseFloat(e.target.value) || 0
                    })
                  }
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-semibold text-sm"
                />

                <p className="text-[10px] text-slate-400 italic">
                  Mengaktifkan kipas exhaust.
                </p>

              </div>

            </div>

          </div>

          {/* BUTTON */}
          <div className="flex flex-col md:flex-row items-center justify-end gap-3 pt-6 border-t border-slate-100">

            <button
              type="button"
              onClick={handleReset}
              className="w-full md:w-auto px-6 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl transition flex items-center justify-center gap-2"
            >

              <RotateCcw size={16} />
              Reset Default

            </button>

            <button
              type="submit"
              className="w-full md:w-auto px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl flex items-center justify-center gap-2 transition shadow-lg shadow-emerald-200 active:scale-95"
            >

              <Save size={18} />
              SIMPAN Ruang {selectedFloor}

            </button>

          </div>

        </form>

      </div>

      {/* BOX RELOCATION CARD */}
      <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-200">

        {/* Card Header */}
        <div className="flex items-center gap-2 mb-5">
          <div className="p-1.5 bg-indigo-100 text-indigo-600 rounded-lg">
            <MoveRight size={18} />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">
              Relokasi Box
            </h3>
            <p className="text-xs text-slate-400">
              Pindahkan unit box ke ruang kandang lain. Perubahan disimpan ke database.
            </p>
          </div>
        </div>

        {/* Toast */}
        {relocToast && (
          <div className={`
            flex items-start gap-3 p-3 rounded-xl mb-4 text-sm font-medium
            ${relocToast.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-red-50 border border-red-200 text-red-800'
            }
          `}>
            {relocToast.type === 'success'
              ? <CheckCircle size={16} className="flex-shrink-0 mt-0.5 text-emerald-600" />
              : <AlertCircle size={16} className="flex-shrink-0 mt-0.5 text-red-500" />
            }
            <span className="flex-1">{relocToast.message}</span>
            <button onClick={() => setRelocToast(null)} className="flex-shrink-0 opacity-50 hover:opacity-100">
              <X size={14} />
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">

          {/* Box Selector */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">
              Pilih Unit Box
            </label>
            <select
              id="reloc-box-select"
              value={relocBoxId}
              onChange={e => setRelocBoxId(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer transition-all"
            >
              {boxes.length === 0 && <option value="">Memuat...</option>}
              {boxes.map(box => (
                <option key={box.id} value={box.id}>
                  {box.name} — Ruang {box.floor_level}
                </option>
              ))}
            </select>
          </div>

          {/* Floor Selector */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">
              Pindah ke Ruang
            </label>
            <select
              id="reloc-floor-select"
              value={relocFloor}
              onChange={e => setRelocFloor(parseInt(e.target.value))}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer transition-all"
            >
              {[1, 2, 3, 4].map(f => (
                <option key={f} value={f}>Ruang {f}</option>
              ))}
            </select>
          </div>

          {/* Slot Selector */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">
              Slot (Opsional)
            </label>
            <input
              type="text"
              placeholder="Contoh: A1"
              value={relocSlot}
              onChange={e => setRelocSlot(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
            />
          </div>

          {/* Submit Button */}
          <button
            id="btn-relocate-box"
            type="button"
            onClick={handleRelocate}
            disabled={relocLoading || !relocBoxId}
            className="w-full px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-200 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {relocLoading ? (
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
            ) : (
              <MoveRight size={16} />
            )}
            Simpan Lokasi
          </button>

        </div>
      </div>

    </div>
  );
}
