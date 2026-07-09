import React from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import Icon, { Avatar } from '../components/Icon.jsx';
import { Toggle } from '../components/ui.jsx';
import { me } from '../data.js';

export default function Profile() {
  const nav = useNavigate();
  return (
    <Layout title="Profile & settings" primary={null}>
      <div className="col" style={{ gap: 24, maxWidth: 680, width: '100%' }}>
        <div className="card">
          <div className="row" style={{ gap: 16 }}>
            <Avatar size={64} color={me.color}>{me.initial}</Avatar>
            <div className="col" style={{ gap: 4 }}>
              <span style={{ fontSize: 18, fontWeight: 600 }}>{me.name}</span>
              <span className="muted small">{me.email} · signed in with Google</span>
              <span className="pill gray" style={{ marginTop: 6, alignSelf: 'flex-start' }}>Your personal account</span>
            </div>
          </div>
          <div className="divider" style={{ margin: '18px 0' }} />
          <div className="col" style={{ gap: 16 }}>
            <div><label className="field-label">Display name</label><input className="input" defaultValue="Parth" /></div>
            <div><label className="field-label">Height (m)</label><input className="input" defaultValue="1.78" /><p className="muted small" style={{ marginTop: 8 }}>Optional — used to show your BMI and healthy-weight band.</p></div>
          </div>
        </div>

        <div className="card">
          <div className="card-title" style={{ marginBottom: 16 }}>Preferences</div>
          <div className="col" style={{ gap: 0 }}>
            {[
              ['Units', 'Kilograms · meters', <span className="pill gray">kg · m</span>],
              ['Morning weigh-in reminder', 'Gentle in-app nudge', <Toggle on onClick={() => {}} />],
            ].map(([t, s, ctrl], i, arr) => (
              <div key={i} className="row between" style={{ padding: '14px 0', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 0 }}>
                <div className="col"><span style={{ fontWeight: 500 }}>{t}</span><span className="muted small">{s}</span></div>{ctrl}
              </div>
            ))}
          </div>
          <p className="muted small" style={{ marginTop: 12 }}>Chart preferences like smoothing live on each dashboard, next to the chart.</p>
        </div>

        <div className="card flat" style={{ background: 'var(--surface-2)' }}>
          <div className="card-title" style={{ marginBottom: 8 }}>Account</div>
          <button className="btn" style={{ width: '100%', justifyContent: 'center', marginBottom: 10 }} onClick={() => nav('/login')}><Icon name="logout" color="var(--text-2)" />Sign out</button>
          <p className="disclaimer" style={{ textAlign: 'left', margin: 0 }}>Health guidance in this app is general information, not medical advice.</p>
        </div>
      </div>
    </Layout>
  );
}
