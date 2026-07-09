import React from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { QuickLogProvider } from './components/QuickLog.jsx';
import Login from './pages/Login.jsx';
import DashboardsList from './pages/DashboardsList.jsx';
import DashboardDetail from './pages/DashboardDetail.jsx';
import AddWeight from './pages/AddWeight.jsx';
import Profile from './pages/Profile.jsx';
import PublicView from './pages/PublicView.jsx';

export default function App() {
  const loc = useLocation();
  const bare = loc.pathname === '/login' || loc.pathname.startsWith('/s/');
  return (
    <QuickLogProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<DashboardsList />} />
        <Route path="/dashboard/:id" element={<DashboardDetail />} />
        <Route path="/add" element={<AddWeight />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/s/:token" element={<PublicView />} />
      </Routes>
      {!bare && <div className="proto-banner">Prototype · hardcoded data · not production code</div>}
    </QuickLogProvider>
  );
}
