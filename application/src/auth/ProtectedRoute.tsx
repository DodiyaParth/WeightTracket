import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';
import Splash from '../components/Splash.jsx';
import { QuickLogProvider } from '../components/QuickLog.jsx';

// Gate for signed-in-only routes. While auth state resolves we show a splash;
// unauthenticated users are bounced to /login (remembering where they were headed).
// Authenticated pages share one QuickLog provider so any page's actions can open it.
export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const loc = useLocation();

  if (loading) return <Splash />;
  if (!user) return <Navigate to="/login" replace state={{ from: loc }} />;
  return <QuickLogProvider>{children}</QuickLogProvider>;
}
