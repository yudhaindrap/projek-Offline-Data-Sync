// src/pages/AdminUsers.jsx
import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  UserPlus, Pencil, Trash2, X, ShieldCheck, User, CheckCircle, AlertCircle, Loader2, Users, RefreshCw
} from 'lucide-react';

const API = 'http://192.168.1.10:5000';

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

function RoleBadge({ role }) {
  if (role === 'admin') return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-violet-950/60 text-violet-300 border border-violet-700/40"><ShieldCheck size={11} /> Admin</span>;
  if (role === 'pembudidaya') return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-950/60 text-amber-300 border border-amber-700/40"><User size={11} /> Pembudidaya</span>;
  return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-950/60 text-emerald-300 border border-emerald-700/40"><User size={11} /> Operator</span>;
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

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState([]);

  const [addModal, setAddModal] = useState(false);
  const [editModal, setEditModal] = useState(null);

  const [form, setForm] = useState({ email: '', password: '', role: 'pembudidaya', tenant_id: '', is_active: true });
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
      const [uRes, tRes] = await Promise.all([
        axios.get(`${API}/api/admin/users`, { headers }),
        axios.get(`${API}/api/admin/tenants`, { headers })
      ]);
      setUsers(uRes.data);
      setTenants(tRes.data);
    } catch (err) {
      addToast('Gagal memuat data.', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAdd = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await axios.post(`${API}/api/admin/users`, form, { headers });
      addToast(res.data.message);
      setAddModal(false);
      fetchData();
    } catch (err) {
      addToast(err.response?.data?.message || 'Gagal menambahkan pengguna.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const openEdit = (u) => {
    setForm({ email: u.email, role: u.role, password: '', tenant_id: u.tenant_id || '', is_active: u.is_active });
    setEditModal(u);
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await axios.put(`${API}/api/admin/users/${editModal.id}`, form, { headers });
      addToast(res.data.message);
      setEditModal(null);
      fetchData();
    } catch (err) {
      addToast(err.response?.data?.message || 'Gagal memperbarui pengguna.', 'error');
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
              <Users size={20} className="text-emerald-400" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white tracking-tight">Manajemen Pengguna</h2>
              <p className="text-sm text-slate-500">Kelola akun dan role pengguna</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchData} className="p-2.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all"><RefreshCw size={16} className={loading ? 'animate-spin' : ''} /></button>
            <button onClick={() => { setForm({ email: '', password: '', role: 'pembudidaya', tenant_id: '', is_active: true }); setAddModal(true); }} className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-emerald-900/30 active:scale-95">
              <UserPlus size={16} /> Tambah Pengguna
            </button>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-300">Daftar Pengguna</h3>
            <span className="text-xs text-slate-500">{users.length} pengguna</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20 text-slate-500"><Loader2 size={24} className="animate-spin mr-2" /><span className="text-sm">Memuat data...</span></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                    <th className="text-left px-6 py-3">Email</th>
                    <th className="text-left px-6 py-3">Role</th>
                    <th className="text-left px-6 py-3">Tenant</th>
                    <th className="text-left px-6 py-3">Status</th>
                    <th className="text-left px-6 py-3">Bergabung</th>
                    <th className="text-center px-6 py-3">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-800/40 transition-colors group">
                      <td className="px-6 py-4 text-slate-200 font-medium">{u.email}</td>
                      <td className="px-6 py-4"><RoleBadge role={u.role} /></td>
                      <td className="px-6 py-4 text-slate-400">{u.tenant_name || '-'}</td>
                      <td className="px-6 py-4">{u.is_active ? <span className="text-emerald-400">Aktif</span> : <span className="text-red-400">Nonaktif</span>}</td>
                      <td className="px-6 py-4 text-slate-500 text-xs">{new Date(u.created_at).toLocaleDateString('id-ID')}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => openEdit(u)} className="p-2 text-slate-500 hover:text-emerald-400 hover:bg-emerald-950/50 rounded-lg transition-all"><Pencil size={15} /></button>
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
        <Modal title={editModal ? `Edit Pengguna` : "Tambah Pengguna"} onClose={() => { setAddModal(false); setEditModal(null); }}>
          <form onSubmit={editModal ? handleEdit : handleAdd} className="space-y-4 max-h-[70vh] overflow-y-auto px-1">
            <Field label="Email">
              <input type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className={inputCls} />
            </Field>
            <Field label={editModal ? "Password (kosongkan jika tidak diubah)" : "Password"}>
              <input type="password" required={!editModal} minLength={6} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className={inputCls} />
            </Field>
            <Field label="Role">
              <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} className={selectCls}>
                <option value="pembudidaya">Pembudidaya</option>
                <option value="operator">Operator</option>
                <option value="admin">Admin</option>
              </select>
            </Field>
            <Field label="Tenant Assignment">
              <select value={form.tenant_id} onChange={e => setForm({ ...form, tenant_id: e.target.value })} className={selectCls}>
                <option value="">Tidak ada tenant</option>
                {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </Field>
            <Field label="Status">
              <select value={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.value === 'true' })} className={selectCls}>
                <option value={true}>Aktif</option>
                <option value={false}>Nonaktif</option>
              </select>
            </Field>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => { setAddModal(false); setEditModal(null); }} className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-400 font-bold hover:bg-slate-800 transition-colors text-sm">Batal</button>
              <button type="submit" disabled={submitting} className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-colors text-sm flex items-center justify-center gap-2">
                {submitting ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />}
                {editModal ? 'Simpan' : 'Tambahkan'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
