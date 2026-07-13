import { Outlet, Link, useLocation } from 'react-router-dom';

export default function ResearchLayout() {
  const location = useLocation();

  const tabs = [
    { name: 'Dashboard', path: '/admin/research/dashboard' },
    { name: 'Experiments', path: '/admin/research/experiments' },
    { name: 'Simulation', path: '/admin/research/simulation' },
    { name: 'Metrics', path: '/admin/research/metrics' },
    { name: 'Dataset Export', path: '/admin/research/export' }
  ];

  return (
    <div className="flex flex-col h-full bg-slate-950 text-white rounded-xl overflow-hidden border border-slate-800 shadow-xl">
      {/* Sub-header / Tabs */}
      <div className="border-b border-slate-800 bg-slate-900/80 px-6 pt-4 flex-shrink-0">
        <div className="flex gap-6">
          {tabs.map((tab) => {
            const isActive = location.pathname.includes(tab.path);
            return (
              <Link
                key={tab.path}
                to={tab.path}
                className={`px-1 py-3 font-semibold text-sm border-b-2 transition-all ${
                  isActive 
                    ? 'border-emerald-500 text-emerald-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600'
                }`}
              >
                {tab.name}
              </Link>
            );
          })}
        </div>
      </div>
      
      {/* Content Area */}
      <div className="flex-1 overflow-auto p-6 bg-slate-950/50">
        <Outlet />
      </div>
    </div>
  );
}
