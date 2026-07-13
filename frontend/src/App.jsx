import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Import Layouts
import MainLayout from './components/MainLayout';
import AdminLayout from './components/AdminLayout';

// Import Halaman Operator
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Monitoring from './pages/Monitoring';
import Thresholds from './pages/Thresholds';
import Growth from './pages/Growth';
import Prediction from './pages/Prediction';
import HistoryPage from './pages/History';
import Profile from './pages/Profile';
import CameraSender from './components/CameraSender';

// Import Halaman Admin
import AdminTenants from './pages/AdminTenants';
import AdminUsers from './pages/AdminUsers';
import AdminBoxes from './pages/AdminBoxes';
import AdminSync from './pages/AdminSync';

// Import Halaman Research (Admin Only)
import ResearchLayout from './pages/research/ResearchLayout';
import ResearchDashboard from './pages/research/ResearchDashboard';
import ResearchExperiments from './pages/research/ResearchExperiments';
import ResearchSimulation from './pages/research/ResearchSimulation';
import ResearchMetrics from './pages/research/ResearchMetrics';
import ResearchDatasetExport from './pages/research/ResearchDatasetExport';
import ResearchComparison from './pages/research/ResearchComparison';
import ResearchPublication from './pages/research/ResearchPublication';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const role = localStorage.getItem('role');
  const isAdmin = role === 'admin';

  return (
    <Router>
      <Routes>
        {/* Rute publik: Simulasi kamera tanpa login */}
        <Route path="/camera" element={<CameraSender />} />

        {/* Rute Login: Jika sudah ada token, arahkan sesuai role */}
        <Route
          path="/login"
          element={
            !token
              ? <Login setToken={setToken} />
              : <Navigate to={isAdmin ? '/admin' : '/'} replace />
          }
        />

        {/* === RUTE ADMIN (Hanya untuk role admin) === */}
        {token && isAdmin ? (
          <Route element={<AdminLayout setToken={setToken} />}>
            <Route path="/admin/tenants" element={<AdminTenants />} />
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/boxes" element={<AdminBoxes />} />
            <Route path="/admin/sync" element={<AdminSync />} />
            
            {/* Rute Research Module */}
            <Route path="/admin/research" element={<ResearchLayout />}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<ResearchDashboard />} />
              <Route path="experiments" element={<ResearchExperiments />} />
              <Route path="simulation" element={<ResearchSimulation />} />
              <Route path="metrics" element={<ResearchMetrics />} />
              <Route path="export" element={<ResearchDatasetExport />} />
              <Route path="comparison" element={<ResearchComparison />} />
              <Route path="experiments/:id/publication" element={<ResearchPublication />} />
            </Route>

            {/* Redirect semua path lain ke admin tenants */}
            <Route path="/admin" element={<Navigate to="/admin/tenants" replace />} />
            <Route path="*" element={<Navigate to="/admin/tenants" replace />} />
          </Route>
        ) : null}

        {/* === RUTE OPERATOR (Hanya untuk role operator) === */}
        {token && !isAdmin ? (
          <Route element={<MainLayout setToken={setToken} />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/monitoring" element={<Monitoring />} />
            <Route path="/thresholds" element={<Thresholds />} />
            <Route path="/growth" element={<Growth />} />
            <Route path="/prediction" element={<Prediction />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/profile" element={<Profile />} />
            {/* Blokir akses ke /admin dari operator */}
            <Route path="/admin" element={<Navigate to="/" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        ) : null}

        {/* Fallback: Belum login → ke halaman login */}
        {!token && <Route path="*" element={<Navigate to="/login" replace />} />}
      </Routes>
    </Router>
  );
}

export default App;