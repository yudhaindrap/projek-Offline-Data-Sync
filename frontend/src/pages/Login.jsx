// src/pages/Login.jsx
import { useState } from 'react';
import axios from 'axios';
import { Lock, Mail, ArrowRight, ShieldCheck } from 'lucide-react';

// Mengimpor logo dari folder assets
import maggotLogo from '../assets/maggot.png';

export default function Login({ setToken }) {
    const [form, setForm] = useState({ email: '', password: '' });
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        try {
            const res = await axios.post('http://192.168.1.19:5000/api/auth/login', form);
            localStorage.setItem('token', res.data.token);
            localStorage.setItem('role', res.data.role);
            localStorage.setItem('userEmail', res.data.email);

            // Simpan data user secara utuh untuk MainLayout & Profile
            localStorage.setItem('user', JSON.stringify({
                role: res.data.role,
                username: res.data.username,
                tenant_id: res.data.tenant_id
            }));

            setToken(res.data.token);
        } catch (err) {
            setError(err.response?.data?.message || 'Akses ditolak. Silakan periksa kredensial Anda.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-900 relative overflow-hidden font-sans">
            {/* EFEK ANIMASI LATAR BELAKANG */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-600/20 rounded-full blur-[120px] animate-pulse"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[120px] animate-bounce duration-[10s]"></div>

            <div className="relative z-10 w-full max-w-md p-4">

                {/* LOGO & TEXT HEADER */}
                <div className="flex flex-col items-center mb-10">
                    <div className="flex items-center gap-4">
                        {/* Container Logo Gambar (1x1) */}
                        <div className="w-16 h-16 bg-emerald-500 rounded-2xl shadow-xl shadow-emerald-500/30 overflow-hidden transform -rotate-6 hover:rotate-0 transition-all duration-300 border-2 border-white/10">
                            <img
                                src={maggotLogo}
                                alt="Mag-Sense Logo"
                                className="w-full h-full object-cover"
                            />
                        </div>

                        {/* Branding Text */}
                        <h1 className="text-4xl font-black text-white tracking-tighter leading-none">
                            MAG<span className="text-emerald-500">-SENSE</span>
                        </h1>
                    </div>

                    <p className="text-slate-400 mt-4 text-sm font-medium tracking-wide">
                        Intelligent Monitoring & Control System
                    </p>
                </div>

                {/* LOGIN CARD (Glassmorphism) */}
                <div className="bg-white/10 backdrop-blur-xl p-8 rounded-3xl border border-white/10 shadow-2xl">
                    <h2 className="text-xl font-bold text-white mb-6">Selamat Datang Kembali</h2>

                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl mb-6 text-xs flex items-center gap-2">
                            <ShieldCheck size={16} />
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleLogin} className="space-y-5">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Email</label>
                            <div className="relative group">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-emerald-500 transition-colors" size={18} />
                                <input
                                    type="email"
                                    required
                                    placeholder="nama@email.com"
                                    className="w-full bg-slate-800/50 border border-slate-700 text-white pl-12 pr-4 py-3.5 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all placeholder:text-slate-600"
                                    onChange={e => setForm({ ...form, email: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Password</label>
                            <div className="relative group">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-emerald-500 transition-colors" size={18} />
                                <input
                                    type="password"
                                    required
                                    placeholder="••••••••"
                                    className="w-full bg-slate-800/50 border border-slate-700 text-white pl-12 pr-4 py-3.5 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all placeholder:text-slate-600"
                                    onChange={e => setForm({ ...form, password: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-between px-1">
                            <label className="flex items-center gap-2 cursor-pointer group">
                                <input type="checkbox" className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-emerald-500 focus:ring-emerald-500" />
                                <span className="text-xs text-slate-400 group-hover:text-slate-300">Ingat saya</span>
                            </label>
                            <a href="#" className="text-xs text-emerald-500 font-bold hover:underline">Lupa Password?</a>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 rounded-2xl transition-all shadow-lg shadow-emerald-900/20 flex items-center justify-center gap-2 group active:scale-[0.98] disabled:opacity-50"
                        >
                            {isLoading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : (
                                <>
                                    MASUK KE SISTEM
                                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </button>
                    </form>
                </div>

                <p className="text-center text-slate-500 text-xs mt-8 font-medium">
                    &copy; 2026 MAG-SENSE Project. <br />
                    Optimalisasi Budidaya Maggot BSF.
                </p>
            </div>
        </div>
    );
}
