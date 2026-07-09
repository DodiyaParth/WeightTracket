import React from 'react';
import { Logo } from './Icon.jsx';

// Full-screen loading state (initial auth resolution, route guards).
export default function Splash({ label = 'Loading…' }) {
  return (
    <div className="splash">
      <Logo size={48} />
      <div className="spinner" />
      <span className="muted small">{label}</span>
    </div>
  );
}
