// src/components/MainLayout.jsx
import { useState, useEffect } from 'react'; // Tambahkan useState dan useEffect
import { Link, useLocation, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  Thermometer,
  Camera,
  CalendarClock,
  History,
  Settings,
  LogOut,
  ChevronRight,
  Bell,
  User,
} from 'lucide-react';

// Mengimpor logo dari folder assets
import maggotLogo from '../assets/maggot.png';

const Sidebar = ({ setToken }) => {
  const location = useLocation();

  const menuItems = [
    { path: '/', name: 'Dashboard', icon: LayoutDashboard },
    { path: '/monitoring', name: 'Mikroklimat', icon: Thermometer },
    { path: '/growth', name: 'Fase Pertumbuhan', icon: Camera },
    { path: '/prediction', name: 'Prediksi Panen', icon: CalendarClock },
    { path: '/history', name: 'Riwayat Data', icon: History },
    { path: '/thresholds', name: 'Parameter Ambang', icon: Settings },
  ];

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('role');      // clear role so routing resets cleanly
    localStorage.removeItem('userEmail'); // clear cached email
    setToken(null);
  };

  return (
    <nav
      className="
        group fixed z-50 transition-all duration-300 ease-in-out

        /* MOBILE: Floating Transparent Bottom Navigation (Glassmorphism) */
        bottom-4 left-4 right-4 h-16 flex flex-row justify-between items-center px-4
        rounded-2xl border border-white/20 bg-white/70 backdrop-blur-md
        shadow-[0_10px_30px_-5px_rgba(0,0,0,0.08)]

        /* DESKTOP: Sidebar Reset (Kembali solid/tidak transparan) */
        md:relative md:bottom-auto md:left-auto md:right-auto md:h-screen 
        md:rounded-none md:border-0 md:border-r md:border-slate-200 md:shadow-none
        md:bg-white md:backdrop-blur-none
        md:flex-col md:p-4 md:w-20 md:hover:w-64
        md:items-start overflow-hidden
      "
    >
      {/* CSS Injection untuk menyembunyikan scrollbar di mobile navbar */}
      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* LOGO SECTION */}
      <div className="hidden md:flex items-center gap-3 mb-8 w-full">
        <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center">
          <img
            src={maggotLogo}
            alt="Maggot Logo"
            className="w-full h-full object-contain"
          />
        </div>

        <div className="text-2xl font-black text-emerald-700 tracking-tight leading-none opacity-0 md:group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap">
          MAG<span className="text-slate-400 font-light">-SENSE</span>
        </div>
      </div>

      {/* MENU NAVIGASI */}
      <div className="flex flex-row md:flex-col flex-1 gap-2 justify-start items-center md:items-stretch overflow-x-auto md:overflow-y-auto no-scrollbar h-full md:h-auto md:w-full md:flex-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <Link
              key={item.path}
              to={item.path}
              title={item.name}
              className={`
                flex items-center p-2.5 md:p-3 rounded-xl transition-all duration-200 flex-shrink-0

                ${isActive
                  ? 'bg-emerald-600 text-white md:shadow-lg md:shadow-emerald-200'
                  : 'text-slate-500 hover:bg-slate-100/60 md:hover:bg-slate-100'
                }

                ${item.mobileOnly ? 'flex md:hidden' : ''}
              `}
            >
              <div className="flex items-center justify-center min-w-[24px]">
                <Icon size={20} />
              </div>

              <span className="hidden md:block ml-3 font-medium opacity-0 md:group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap">
                {item.name}
              </span>
            </Link>
          );
        })}
      </div>

      {/* TOMBOL LOGOUT */}
      <div className="flex items-center h-full pl-3 border-l border-slate-200/60 flex-shrink-0 md:h-auto md:w-full md:mt-auto md:pt-4 md:border-t md:border-l-0 md:border-slate-100">
        <button
          onClick={handleLogout}
          title="Logout"
          className="flex items-center p-2.5 md:p-3 md:w-full rounded-xl text-red-500 hover:bg-red-50 transition-colors group/logout"
        >
          <div className="flex items-center justify-center min-w-[24px]">
            <LogOut
              size={20}
              className="md:group-hover/logout:-translate-x-1 transition-transform"
            />
          </div>

          <span className="hidden md:block ml-3 font-bold opacity-0 md:group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap">
            Logout
          </span>
        </button>
      </div>
    </nav>
  );
};

const MainLayout = ({ setToken }) => {
  const location = useLocation();

  // 1. Inisialisasi State User dengan nilai default/fallback
  const [user, setUser] = useState({
    role: 'Koordinator',
    username: 'Pembudidaya'
  });

  // 2. Ambil data user dari localStorage saat komponen pertama kali dimuat
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (error) {
        console.error("Gagal parse data user dari localStorage", error);
      }
    }
  }, []);

  const menuItems = [
    { path: '/', name: 'Dashboard' },
    { path: '/monitoring', name: 'Monitoring Mikroklimat' },
    { path: '/growth', name: 'Analisis Fase Pertumbuhan' },
    { path: '/prediction', name: 'Estimasi Prediksi Panen' },
    { path: '/history', name: 'Riwayat Log Data' },
    { path: '/thresholds', name: 'Pengaturan Ambang Otomasi' },
    { path: '/profile', name: 'Profil Pengguna' },
  ];

  const currentPage = menuItems.find((item) => item.path === location.pathname);
  const pageTitle = currentPage ? currentPage.name : 'Halaman Tidak Dikenal';

  return (
    <div className="flex flex-col md:flex-row h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
      <Sidebar setToken={setToken} />

      <div className="flex-1 flex flex-col min-w-0 h-full pb-24 md:pb-0">
        {/* HEADER */}
        <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 z-10 px-4 md:px-8 py-3 sticky top-0">
          <div className="max-w-7xl mx-auto flex flex-row items-center justify-between gap-4">
            {/* TITLE */}
            <div className="flex items-center gap-2">
              <ChevronRight
                size={18}
                className="text-slate-300 hidden sm:block"
              />
              <h1 className="text-slate-800 font-bold tracking-tight text-lg md:text-xl truncate">
                {pageTitle}
              </h1>
            </div>

            {/* RIGHT SECTION */}
            <div className="flex items-center gap-3 md:gap-6 flex-shrink-0">
              <div className="flex items-center gap-2 border-l border-slate-200 pl-4">
                {/* NOTIFICATION */}
                <button className="p-2 text-slate-500 hover:bg-slate-100 rounded-full relative">
                  <Bell size={18} />
                  <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
                </button>

                {/* PROFILE */}
                <Link
                  to="/profile"
                  className={`
                    flex items-center gap-2 px-2 py-1 rounded-lg
                    cursor-pointer transition-all
                    ${location.pathname === '/profile'
                      ? 'bg-emerald-50 ring-1 ring-emerald-200'
                      : 'hover:bg-slate-50'
                    }
                  `}
                >
                  <div className="w-8 h-8 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center font-bold text-xs overflow-hidden border border-emerald-200">
                    <User size={16} />
                  </div>

                  {/* 3. TAMPILKAN DATA USER SECARA DINAMIS */}
                  <div className="hidden lg:block text-left">
                    <p className="text-[10px] font-bold text-slate-400 uppercase leading-none mb-1">
                      {user.role}
                    </p>

                    <p className="text-xs font-bold text-slate-700 leading-none">
                      {user.username}
                    </p>
                  </div>
                </Link>
              </div>
            </div>
          </div>
        </header>

        {/* MAIN CONTENT */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default MainLayout;