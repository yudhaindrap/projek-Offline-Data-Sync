// src/pages/AdminTenants.jsx
import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Pencil,
  Trash2,
  X,
  CheckCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
  Building2,
  Building
} from 'lucide-react';

const API = 'http://192.168.1.10:5000';

/* ─────────────────────────────────────────────
   TOAST NOTIFICATION COMPONENT
───────────────────────────────────────────── */
function Toast({ toasts, removeToast }) {
  return (
    <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`
            pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-2xl shadow-2xl
            border backdrop-blur-md min-w-[280px] max-w-sm
            animate-in slide-in-from-right-5 fade-in duration-300
            ${t.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-700/50 text-emerald-300'
              : 'bg-red-950/90 border-red-700/50 text-red-300'
            }
          `}
        >
          {t.type === 'success'
            ? <CheckCircle size={18} className="flex-shrink-0 mt-0.5 text-emerald-400" />
            : <AlertCircle size={18} className="flex-shrink-0 mt-0.5 text-red-400" />
          }
          <p className="text-sm font-medium flex-1">{t.message}</p>
          <button onClick={() => removeToast(t.id)} className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────
   MODAL BASE
───────────────────────────────────────────── */
function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h3 className="text-base font-bold text-white">{title}</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors p-1 rounded-lg hover:bg-slate-800">
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   FIELD COMPONENT
───────────────────────────────────────────── */
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

export default function AdminTenants() {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState([]);

  // Modal state
  const [addModal, setAddModal] = useState(false);
  const [editModal, setEditModal] = useState(null);

  // Form state
  const [form, setForm] = useState({ name: '', tenant_code: '', contact_person: '', phone: '', address: '', is_active: true });
  const [submitting, setSubmitting] = useState(false);

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  const addToast = useCallback((message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const fetchTenants = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/api/admin/tenants`, { headers });
      setTenants(res.data);
    } catch (err) {
      addToast(err.response?.data?.message || 'Gagal memuat data tenant.', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTenants();
  }, [fetchTenants]);

  const handleAdd = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await axios.post(`${API}/api/admin/tenants`, form, { headers });
      addToast(res.data.message);
      setAddModal(false);
      setForm({ name: '', tenant_code: '', contact_person: '', phone: '', address: '', is_active: true });
      fetchTenants();
    } catch (err) {
      addToast(err.response?.data?.message || 'Gagal menambahkan tenant.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const openEdit = (t) => {
    setForm({ name: t.name, tenant_code: t.tenant_code || '', contact_person: t.contact_person || '', phone: t.phone || '', address: t.address || '', is_active: t.is_active });
    setEditModal(t);
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await axios.put(`${API}/api/admin/tenants/${editModal.id}`, form, { headers });
      addToast(res.data.message);
      setEditModal(null);
      fetchTenants();
    } catch (err) {
      addToast(err.response?.data?.message || 'Gagal memperbarui tenant.', 'error');
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
              <Building2 size={20} className="text-emerald-400" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white tracking-tight">Manajemen Tenant</h2>
              <p className="text-sm text-slate-500">Kelola tenant dan entitas pelanggan</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchTenants} className="p-2.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all" title="Refresh">
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <button onClick={() => { setForm({ name: '', tenant_code: '', contact_person: '', phone: '', address: '', is_active: true }); setAddModal(true); }} className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-emerald-900/30 active:scale-95">
              <Building size={16} /> Tambah Tenant
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'Total Tenant', value: tenants.length, color: 'text-white' },
            { label: 'Tenant Aktif', value: tenants.filter(t => t.is_active).length, color: 'text-emerald-400' },
          ].map(s => (
            <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1">{s.label}</p>
              <p className={`text-3xl font-black ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-300">Daftar Tenant Terdaftar</h3>
            <span className="text-xs text-slate-500">{tenants.length} tenant</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20 text-slate-500">
              <Loader2 size={24} className="animate-spin mr-2" />
              <span className="text-sm">Memuat data...</span>
            </div>
          ) : tenants.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-600">
              <Building2 size={40} className="mb-3 opacity-30" />
              <p className="text-sm">Belum ada tenant terdaftar.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                    <th className="text-left px-6 py-3">Nama Tenant</th>
                    <th className="text-left px-6 py-3">Kode</th>
                    <th className="text-left px-6 py-3">Kontak Person</th>
                    <th className="text-left px-6 py-3">Status</th>
                    <th className="text-left px-6 py-3">Terdaftar</th>
                    <th className="text-center px-6 py-3">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {tenants.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-800/40 transition-colors group">
                      <td className="px-6 py-4 text-slate-200 font-medium">{t.name}</td>
                      <td className="px-6 py-4 text-slate-400 font-mono text-xs">{t.tenant_code || '-'}</td>
                      <td className="px-6 py-4 text-slate-400">{t.contact_person || '-'}</td>
                      <td className="px-6 py-4">
                        {t.is_active ? <span className="text-emerald-400">Aktif</span> : <span className="text-red-400">Nonaktif</span>}
                      </td>
                      <td className="px-6 py-4 text-slate-500 text-xs">
                        {new Date(t.created_at).toLocaleDateString('id-ID')}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => openEdit(t)} className="p-2 text-slate-500 hover:text-emerald-400 hover:bg-emerald-950/50 rounded-lg transition-all" title="Edit tenant">
                            <Pencil size={15} />
                          </button>
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

      {(addModal || editModal) && (
        <Modal title={editModal ? `Edit Tenant #${editModal.id.slice(0, 8)}` : "Tambah Tenant Baru"} onClose={() => { setAddModal(false); setEditModal(null); }}>
          <form onSubmit={editModal ? handleEdit : handleAdd} className="space-y-4 max-h-[70vh] overflow-y-auto px-1">
            <Field label="Nama Tenant">
              <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={inputCls} />
            </Field>
            <Field label="Kode Tenant">
              <input value={form.tenant_code} onChange={e => setForm({ ...form, tenant_code: e.target.value })} className={inputCls} />
            </Field>
            <Field label="Kontak Person">
              <input value={form.contact_person} onChange={e => setForm({ ...form, contact_person: e.target.value })} className={inputCls} />
            </Field>
            <Field label="Telepon">
              <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className={inputCls} />
            </Field>
            <Field label="Status">
              <select value={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.value === 'true' })} className={selectCls}>
                <option value={true}>Aktif</option>
                <option value={false}>Nonaktif</option>
              </select>
            </Field>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => { setAddModal(false); setEditModal(null); }} className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-400 font-bold hover:bg-slate-800 transition-colors text-sm">Batal</button>
              <button type="submit" disabled={submitting} className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-colors text-sm flex items-center justify-center gap-2 disabled:opacity-60">
                {submitting ? <Loader2 size={15} className="animate-spin" /> : <Building size={15} />}
                {editModal ? 'Simpan' : 'Tambahkan'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
