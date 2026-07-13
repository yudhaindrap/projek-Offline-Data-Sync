// src/pages/AdminBoxes.jsx
import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Box, Pencil, Trash2, X, CheckCircle, AlertCircle, Loader2, RefreshCw } from 'lucide-react';

const API = 'http://192.168.1.19:5000';

function Toast({ toasts, removeToast }) {
  return (
    <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-2xl shadow-2xl border backdrop-blur-md min-w-[280px] max-w-sm animate-in slide-in-from-right-5 fade-in duration-300 ${t.type === 'success' ? 'bg-emerald-950/90 border-emerald-700/50 text-emerald-300' : 'bg-red-950/90 border-red-700/50 text-red-300'}`}>
          {t.type === 'success' ? <CheckCircle size={18} className="flex-shrink-0 mt-0.5 text-emerald-400" /> : <AlertCircle size={18} className="flex-shrink-0 mt-0.5 text-red-400" />}
          <p className="text-sm font-medium flex-1">{t.message}</p>
          <button onClick={() => removeToast(t.id)} className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity"><X size={14} /></button>
        </div>
      ))}
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h3 className="text-base font-bold text-white">{title}</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors p-1 rounded-lg hover:bg-slate-800"><X size={18} /></button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest">{label}</label>
      {children}
    </div>
  );
}

const inputCls = "w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 text-white rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all placeholder:text-slate-600";
const selectCls = `${inputCls} cursor-pointer`;

export default function AdminBoxes() {
  const [boxes, setBoxes] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState([]);

  const [addBoxModal, setAddBoxModal] = useState(false);
  const [editBoxModal, setEditBoxModal] = useState(null);
  const [deleteBoxModal, setDeleteBoxModal] = useState(null);

  const [boxForm, setBoxForm] = useState({ box_name: '', box_code: '', room_number: 1, slot_number: '', status: 'active', user_id: '' });
  const [submitting, setSubmitting] = useState(false);

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  const addToast = useCallback((message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);
  const removeToast = useCallback((id) => setToasts(prev => prev.filter(t => t.id !== id)), []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [bRes, tRes] = await Promise.all([
        axios.get(`${API}/api/admin/boxes`, { headers }),
        axios.get(`${API}/api/admin/tenants`, { headers })
      ]);
      setBoxes(bRes.data);
      setTenants(tRes.data);
    } catch (err) {
      addToast('Gagal memuat data.', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAddBox = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await axios.post(`${API}/api/admin/boxes`, boxForm, { headers });
      addToast(res.data.message);
      setAddBoxModal(false);
      fetchData();
    } catch (err) {
      addToast(err.response?.data?.message || 'Gagal menambahkan box.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const openEditBox = (b) => {
    setBoxForm({ box_name: b.box_name, box_code: b.box_code || '', room_number: b.room_number || 1, slot_number: b.slot_number || '', status: b.status, user_id: b.user_id || '' });
    setEditBoxModal(b);
  };

  const handleEditBox = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await axios.put(`${API}/api/admin/boxes/${editBoxModal.id}`, boxForm, { headers });
      addToast(res.data.message);
      setEditBoxModal(null);
      fetchData();
    } catch (err) {
      addToast(err.response?.data?.message || 'Gagal memperbarui box.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteBox = async () => {
    setSubmitting(true);
    try {
      const res = await axios.delete(`${API}/api/admin/boxes/${deleteBoxModal.id}`, { headers });
      addToast(res.data.message);
      setDeleteBoxModal(null);
      fetchData();
    } catch (err) {
      addToast(err.response?.data?.message || 'Gagal menghapus box.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Toast toasts={toasts} removeToast={removeToast} />
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-700/30 rounded-2xl flex items-center justify-center border border-emerald-700/30">
              <Box size={20} className="text-emerald-400" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white tracking-tight">Manajemen Box</h2>
              <p className="text-sm text-slate-500">Kelola box perangkat dan distribusinya</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchData} className="p-2.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all"><RefreshCw size={16} className={loading ? 'animate-spin' : ''} /></button>
            <button onClick={() => { setBoxForm({ box_name: '', box_code: '', room_number: 1, slot_number: '', status: 'active', user_id: '' }); setAddBoxModal(true); }} className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-emerald-900/30 active:scale-95">
              <Box size={16} /> Tambah Box
            </button>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-300">Daftar Box</h3>
            <span className="text-xs text-slate-500">{boxes.length} box</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20 text-slate-500"><Loader2 size={24} className="animate-spin mr-2" /><span className="text-sm">Memuat data...</span></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                    <th className="text-left px-6 py-3">Nama Box</th>
                    <th className="text-left px-6 py-3">Kode</th>
                    <th className="text-left px-6 py-3">Lantai (Ruang)</th>
                    <th className="text-left px-6 py-3">Slot</th>
                    <th className="text-left px-6 py-3">Tenant (Pemilik)</th>
                    <th className="text-left px-6 py-3">Status</th>
                    <th className="text-center px-6 py-3">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {boxes.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-800/40 transition-colors group">
                      <td className="px-6 py-4 text-slate-200 font-medium">{b.box_name}</td>
                      <td className="px-6 py-4 text-slate-400">{b.box_code || '-'}</td>
                      <td className="px-6 py-4 text-slate-400">{b.room_number}</td>
                      <td className="px-6 py-4 text-slate-400">{b.slot_number || '-'}</td>
                      <td className="px-6 py-4 text-slate-400">{b.user_email || '-'}</td>
                      <td className="px-6 py-4">{b.status === 'active' ? <span className="text-emerald-400">Aktif</span> : <span className="text-red-400">Nonaktif</span>}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => openEditBox(b)} className="p-2 text-slate-500 hover:text-emerald-400 hover:bg-emerald-950/50 rounded-lg transition-all"><Pencil size={15} /></button>
                          <button onClick={() => setDeleteBoxModal(b)} className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-950/50 rounded-lg transition-all"><Trash2 size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {(addBoxModal || editBoxModal) && (
        <Modal title={editBoxModal ? `Edit Box` : "Tambah Box"} onClose={() => { setAddBoxModal(false); setEditBoxModal(null); }}>
          <form onSubmit={editBoxModal ? handleEditBox : handleAddBox} className="space-y-4 max-h-[70vh] overflow-y-auto px-1">
            <Field label="Nama Box">
              <input required value={boxForm.box_name} onChange={e => setBoxForm({ ...boxForm, box_name: e.target.value })} className={inputCls} />
            </Field>
            <Field label="Kode Box">
              <input value={boxForm.box_code} onChange={e => setBoxForm({ ...boxForm, box_code: e.target.value })} className={inputCls} />
            </Field>
            <Field label="Lantai (Ruang)">
              <input type="number" required value={boxForm.room_number} onChange={e => setBoxForm({ ...boxForm, room_number: e.target.value })} className={inputCls} />
            </Field>
            <Field label="Slot (Opsional)">
              <input value={boxForm.slot_number} onChange={e => setBoxForm({ ...boxForm, slot_number: e.target.value })} className={inputCls} />
            </Field>
            <Field label="Tenant Kepemilikan">
              <select value={boxForm.user_id} onChange={e => setBoxForm({ ...boxForm, user_id: e.target.value })} className={selectCls}>
                <option value="">Tidak Ada</option>
                {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </Field>
            <Field label="Status">
              <select value={boxForm.status} onChange={e => setBoxForm({ ...boxForm, status: e.target.value })} className={selectCls}>
                <option value="active">Aktif</option>
                <option value="inactive">Nonaktif</option>
                <option value="maintenance">Maintenance</option>
              </select>
            </Field>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => { setAddBoxModal(false); setEditBoxModal(null); }} className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-400 font-bold hover:bg-slate-800 transition-colors text-sm">Batal</button>
              <button type="submit" disabled={submitting} className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-colors text-sm flex items-center justify-center gap-2">
                {submitting ? <Loader2 size={15} className="animate-spin" /> : <Box size={15} />}
                {editBoxModal ? 'Simpan' : 'Tambahkan'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {deleteBoxModal && (
        <Modal title="Hapus Box" onClose={() => setDeleteBoxModal(null)}>
          <div className="space-y-4">
            <p className="text-sm text-slate-300">Yakin ingin menghapus box:</p>
            <div className="p-4 rounded-xl bg-red-950/30 border border-red-800/40 text-white font-bold">{deleteBoxModal.box_name}</div>
            <div className="flex gap-3">
              <button onClick={() => setDeleteBoxModal(null)} className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-400 font-bold hover:bg-slate-800">Batal</button>
              <button onClick={handleDeleteBox} disabled={submitting} className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold flex items-center justify-center gap-2">
                {submitting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />} Hapus
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
