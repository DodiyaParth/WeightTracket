import { useEffect, useState } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import Login from './pages/Login.jsx';
import DashboardsList from './pages/DashboardsList.jsx';
import DashboardDetail from './pages/DashboardDetail.jsx';
import AddWeight from './pages/AddWeight.jsx';
import History from './pages/History.jsx';
import Profile from './pages/Profile.jsx';
import PublicView from './pages/PublicView.jsx';
import NotFound from './pages/NotFound.jsx';
import ProtectedRoute from './auth/ProtectedRoute.jsx';
import Splash from './components/Splash.jsx';
import { useAuthedUser } from './auth/useAuthedUser.js';
import { useDashboards } from './hooks/useData.js';
import { landingRoute } from './lib/dashboards.js';

// Post-login landing (REQUIREMENTS §11.2): on the first visit to "/" this session,
// jump to the most-recently-active dashboard (collaboration first); otherwise show
// the dashboards list. Subsequent visits to "/" always show the list.
function Landing() {
  const user = useAuthedUser();
  const { data: dashboards, loading } = useDashboards(user.uid);
  const nav = useNavigate();
  const [decided, setDecided] = useState(false);

  useEffect(() => {
    if (loading || decided) return;
    // Keyed to this uid (DEV-36), not a flat flag — so switching accounts in
    // the same tab always re-evaluates landing for whoever's actually signed
    // in now, rather than trusting a state left over from a previous user.
    const key = `wt_landed_${user.uid}`;
    let landed = false;
    try { landed = sessionStorage.getItem(key) === '1'; } catch { /* ignore */ }
    if (!landed) {
      try { sessionStorage.setItem(key, '1'); } catch { /* ignore */ }
      const route = landingRoute(dashboards || [], user.uid);
      if (route !== '/') { nav(route, { replace: true }); return; }
    }
    setDecided(true);
  }, [loading, decided, dashboards, user, nav]);

  if (!decided) return <Splash />;
  return <DashboardsList />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/s/:token" element={<PublicView />} />
      <Route path="/" element={<ProtectedRoute><Landing /></ProtectedRoute>} />
      <Route path="/dashboard/:id" element={<ProtectedRoute><DashboardDetail /></ProtectedRoute>} />
      <Route path="/add" element={<ProtectedRoute><AddWeight /></ProtectedRoute>} />
      <Route path="/history" element={<ProtectedRoute><History /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
