import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Logo, GoogleG } from '../components/Icon.jsx';
import { landingRoute } from '../data.js';

export default function Login() {
  const nav = useNavigate();
  // Post-login landing (REQUIREMENTS §11.2): jump to the active dashboard if any.
  return (
    <div className="login">
      <div className="login-card">
        <Logo size={56} />
        <div>
          <h1>WeightTracker</h1>
          <p className="t2" style={{ margin: '8px 0 0' }}>Track your journey, together.</p>
        </div>
        <button className="google-btn" onClick={() => nav(landingRoute())}>
          <GoogleG /> Continue with Google
        </button>
        <p className="small muted" style={{ margin: 0, lineHeight: 1.5 }}>
          Sign in to keep your weight history in your own account and create shared dashboards.
        </p>
      </div>
      <p className="disclaimer" style={{ position: 'absolute', bottom: 28, left: 0, right: 0 }}>
        Health guidance in this app is general information, not medical advice.
      </p>
    </div>
  );
}
