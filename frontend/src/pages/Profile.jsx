// src/pages/Profile.jsx
import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { User, Camera, Lock, KeyRound, Save, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function Profile() {
  const fileInputRef = useRef(null);

  // Data user awal (Mock State)
  const [profile, setProfile] = useState({
    name: 'Pembudidaya',
    email: 'admin@maggott.com',
    avatar: null, // Berisi URL objek gambar saat di-upload
  });

  useEffect(() => {
    const token = localStorage.getItem("token");
    axios.get('http://192.168.1.10:5000/api/profile', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => setProfile({ ...profile, name: res.data.username, email: res.data.email }))
      .catch(err => console.error("Profile Fetch Error:", err));
  }, []);

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // State Notifikasi/Umpan Balik
  const [status, setStatus] = useState({ type: '', message: '' });

  // Handle Perubahan Input Teks Profil
  const handleProfileChange = (e) => {
    setProfile({ ...profile, [e.target.name]: e.target.value });
  };

  // Handle Perubahan Input Teks Password
  const handlePasswordChange = (e) => {
    setPasswordData({ ...passwordData, [e.target.name]: e.target.value });
  };

  // Handle Unggah & Preview Foto Profil
  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) { // Batas maksimal ukuran file 10MB
        showNotification('error', 'Ukuran gambar maksimal adalah 10MB');
        return;
      }
      const imageUrl = URL.createObjectURL(file);
      setProfile({ ...profile, avatar: imageUrl });
      showNotification('success', 'Pratinjau foto profil berhasil diperbarui!');
    }
  };

  // Trigger klik pada input file tersembunyi
  const triggerFileInput = () => {
    fileInputRef.current.click();
  };

  // Fungsi Helper Notifikasi
  const showNotification = (type, message) => {
    setStatus({ type, message });
    setTimeout(() => setStatus({ type: '', message: '' }), 4000);
  };

  // Submit Perubahan Profil (Nama & Email)
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!profile.name.trim()) {
      showNotification('error', 'Nama pengguna tidak boleh kosong');
      return;
    }
    const token = localStorage.getItem("token");
    try {
      await axios.put('http://192.168.1.10:5000/api/profile', { name: profile.name }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      showNotification('success', 'Informasi profil Anda berhasil diperbarui!');
    } catch (err) {
      showNotification('error', 'Gagal memperbarui profil');
    }
  };

  // Submit Perubahan Password
  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    const { currentPassword, newPassword, confirmPassword } = passwordData;

    if (!currentPassword || !newPassword || !confirmPassword) {
      showNotification('error', 'Semua kolom kata sandi wajib diisi');
      return;
    }
    if (newPassword.length < 6) {
      showNotification('error', 'Kata sandi baru minimal harus 6 karakter');
      return;
    }
    if (newPassword !== confirmPassword) {
      showNotification('error', 'Konfirmasi kata sandi baru tidak cocok');
      return;
    }

    const token = localStorage.getItem("token");
    try {
      await axios.put('http://192.168.1.10:5000/api/profile/password', { currentPassword, newPassword }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      showNotification('success', 'Kata sandi Anda sukses diperbarui!');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      showNotification('error', err.response?.data?.message || 'Gagal memperbarui kata sandi');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">

      {/* BANNER NOTIFIKASI */}
      {status.message && (
        <div className={`p-4 rounded-xl border flex items-center gap-3 transition-all animate-fadeIn ${status.type === 'success'
          ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
          : 'bg-red-50 border-red-200 text-red-800'
          }`}>
          {status.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          <p className="text-sm font-semibold">{status.message}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* KARTU FOTO PROFIL */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center">
          <p className="text-slate-400 font-bold text-[10px] uppercase tracking-wider mb-4">Foto Profil</p>

          <div className="relative group cursor-pointer" onClick={triggerFileInput}>
            <div className="w-28 h-28 rounded-full bg-slate-100 border-2 border-emerald-500 overflow-hidden flex items-center justify-center shadow-inner transition-transform group-hover:scale-105">
              {profile.avatar ? (
                <img src={profile.avatar} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <User size={48} className="text-slate-400" />
              )}
            </div>
            {/* Overlay Hover Unggah */}
            <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <Camera size={24} className="text-white" />
            </div>
          </div>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleAvatarChange}
            accept="image/*"
            className="hidden"
          />

          <button
            onClick={triggerFileInput}
            className="mt-4 text-xs font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 py-1.5 px-4 rounded-xl transition-colors"
          >
            Pilih Foto Baru
          </button>
          <p className="text-[10px] text-slate-400 mt-2">Mendukung format JPG, PNG. Maks 10MB.</p>
        </div>

        {/* FORM DATA PENGGUNA */}
        <div className="md:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-base font-bold text-slate-800 border-b pb-3 mb-4">Informasi Akun</h3>

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Nama Lengkap</label>
              <input
                type="text"
                name="name"
                value={profile.name}
                onChange={handleProfileChange}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                placeholder="Masukkan nama lengkap"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Alamat Email</label>
              <input
                type="email"
                name="email"
                value={profile.email}
                onChange={handleProfileChange}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all bg-slate-50 text-slate-400 cursor-not-allowed"
                disabled
              />
              <p className="text-[10px] text-slate-400 mt-1">Email utama tidak dapat diubah demi keamanan akun.</p>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-100 transition-all"
              >
                <Save size={14} /> Simpan Perubahan
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* FORM PENGATURAN KATA SANDI */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h3 className="text-base font-bold text-slate-800 border-b pb-3 mb-4 flex items-center gap-2">
          <Lock size={18} className="text-slate-400" /> Keamanan & Kata Sandi
        </h3>

        <form onSubmit={handleUpdatePassword} className="space-y-4 max-w-2xl">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Kata Sandi Saat Ini</label>
            <input
              type="password"
              name="currentPassword"
              value={passwordData.currentPassword}
              onChange={handlePasswordChange}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              placeholder="••••••••"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Kata Sandi Baru</label>
              <input
                type="password"
                name="newPassword"
                value={passwordData.newPassword}
                onChange={handlePasswordChange}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                placeholder="Minimal 6 karakter"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Konfirmasi Kata Sandi Baru</label>
              <input
                type="password"
                name="confirmPassword"
                value={passwordData.confirmPassword}
                onChange={handlePasswordChange}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                placeholder="Ulangi kata sandi baru"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold shadow-md shadow-slate-100 transition-all"
            >
              <KeyRound size={14} /> Perbarui Kata Sandi
            </button>
          </div>
        </form>
      </div>

    </div>
  );
}
