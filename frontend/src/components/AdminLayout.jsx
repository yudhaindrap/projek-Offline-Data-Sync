import { Outlet, Link, useLocation } from 'react-router-dom';
import { Users, LogOut, ShieldCheck, ChevronRight, Building, Box, RefreshCcw, FlaskConical } from 'lucide-react';
import maggotLogo from '../assets/maggot.png';

export default function AdminLayout({ setToken }) {
  const location = useLocation();

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('user');
    setToken(null);
  };

  const email = localStorage.getItem('userEmail') || 'admin@admin.maggot';

  const navItems = [
    { path: '/admin/tenants', name: 'Manajemen Tenant', icon: Building },
    { path: '/admin/users', name: 'Manajemen Pengguna', icon: Users },
    { path: '/admin/boxes', name: 'Manajemen Box', icon: Box },
    { path: '/admin/sync', name: 'Offline Sync', icon: RefreshCcw },
    { path: '/admin/research', name: 'Research', icon: FlaskConical },
  ];

  return (
    <div className="flex h-screen bg-slate-950 text-white font-sans overflow-hidden">

      {/* ── SIDEBAR ── */}
      <aside className="w-64 flex-shrink-0 flex flex-col bg-slate-900 border-r border-slate-800">

        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-6 border-b border-slate-800">
          <div className="w-9 h-9 bg-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-900/50 overflow-hidden">
            <img src={maggotLogo} alt="MAG-SENSE" className="w-full h-full object-contain" />
          </div>
          <div className="leading-none">
            <p className="text-base font-black tracking-tight text-white">
              MAG<span className="text-emerald-400 font-light">-SENSE</span>
            </p>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">
              Admin Panel
            </p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-2 space-y-1">
          <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest px-3 mb-2">
            Menu
          </p>
          {navItems.map(({ path, name, icon: Icon }) => {
            const isActive = path === '/admin/research' 
              ? location.pathname.startsWith('/admin/research') 
              : location.pathname === path;
            return (
              <Link
                key={path}
                to={path}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold
                  transition-all duration-200
                  ${isActive
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }
                `}
              >
                <Icon size={18} />
                {name}
              </Link>
            );
          })}
        </nav>
        {/* Admin Badge */}
        <div className="mx-4 mt-5 mb-3 px-3 py-2.5 bg-emerald-950/60 border border-emerald-800/40 rounded-xl flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-700/40 flex items-center justify-center flex-shrink-0">
            <ShieldCheck size={16} className="text-emerald-400" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Administrator</p>
            <p className="text-xs text-slate-300 font-medium truncate">{email}</p>
          </div>
        </div>
        {/* Logout */}
        <div className="px-3 pb-5 border-t border-slate-800 pt-4">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-red-400 hover:bg-red-950/40 hover:text-red-300 transition-all duration-200"
          >
            <LogOut size={18} />
            Keluar
          </button>
        </div>
      </aside>

      {/* ── MAIN AREA ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Header */}
        <header className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800 px-8 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <ChevronRight size={16} className="text-slate-600" />
            <h1 className="text-slate-200 font-bold text-lg">
              {navItems.find(n => n.path === location.pathname)?.name || 'Admin Panel'}
            </h1>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-950/50 border border-emerald-800/40 rounded-full">
            <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
            <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-widest">Admin Mode</span>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-8 bg-slate-950">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
