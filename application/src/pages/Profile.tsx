import { useState, useEffect } from 'react';
import Layout from '../components/Layout.jsx';
import Icon from '../components/Icon.jsx';
import UserAvatar from '../components/UserAvatar.jsx';
import { Toast } from '../components/ui.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import { useAuthedUser } from '../auth/useAuthedUser.js';
import { useProfile } from '../hooks/useData.js';
import { useUpdateProfile } from '../hooks/mutations.js';

export default function Profile() {
  const { signOutUser } = useAuth();
  const user = useAuthedUser();
  const { data: profile } = useProfile(user.uid);
  const [name, setName] = useState('');
  const [height, setHeight] = useState('');
  const [dob, setDob] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const { run, busy, error } = useUpdateProfile();
  const signedInWithGoogle = user.providerData?.[0]?.providerId === 'google.com';

  useEffect(() => {
    if (profile) {
      setName(profile.name || '');
      setHeight(profile.heightM ? String(profile.heightM) : '');
      setDob(profile.dob || '');
    }
  }, [profile]);

  const save = async () => {
    try {
      await run(user.uid, { name: name.trim() || 'You', heightM: height ? +height : null, dob: dob || null });
    } catch { return; }
    setToast('Profile saved');
    setTimeout(() => setToast(null), 2200);
  };

  return (
    <Layout title="Profile & settings" primary={null}>
      <div className="col" style={{ gap: 24, maxWidth: 680, width: '100%' }}>
        <div className="card">
          <div className="row" style={{ gap: 16 }}>
            <UserAvatar user={{ ...user, photoURL: profile?.photoURL || user.photoURL }} size={64} color={profile?.color || 'var(--accent)'} />
            <div className="col" style={{ gap: 4 }}>
              <span className="num-md">{profile?.name || user.displayName}</span>
              <span className="muted small">{user.email}{signedInWithGoogle ? ' · signed in with Google' : ' · signed in with email'}</span>
              <span className="pill gray" style={{ marginTop: 6, alignSelf: 'flex-start' }}>Your personal account</span>
            </div>
          </div>
          <div className="divider" style={{ margin: '18px 0' }} />
          <div className="col" style={{ gap: 16 }}>
            <div><label className="field-label">Display name</label><input className="input" value={name} disabled={busy} onChange={(e) => setName(e.target.value)} /></div>
            <div>
              <label className="field-label">Height (m)</label>
              <input className="input" inputMode="decimal" placeholder="e.g. 1.78" value={height} disabled={busy} onChange={(e) => setHeight(e.target.value)} />
              <p className="muted small" style={{ marginTop: 8 }}>Used to show your BMI and healthy-weight band, and required before creating or joining a dashboard.</p>
            </div>
            <div>
              <label className="field-label">Date of birth</label>
              <input className="input" type="date" max={new Date().toISOString().slice(0, 10)} value={dob} disabled={busy} onChange={(e) => setDob(e.target.value)} />
              <p className="muted small" style={{ marginTop: 8 }}>Also required to create or join a dashboard — used for age-aware guidance, never shared.</p>
            </div>
            {error && <p className="small" style={{ color: 'var(--rose)', margin: 0 }}>{error}</p>}
            <button className="btn primary" style={{ alignSelf: 'flex-start' }} onClick={save} disabled={busy}><Icon name="check" color="#fff" />{busy ? 'Saving…' : 'Save changes'}</button>
          </div>
        </div>

        <div className="card">
          <div className="card-title" style={{ marginBottom: 16 }}>Preferences</div>
          <div className="row between" style={{ padding: '14px 0' }}>
            <div className="col"><span style={{ fontWeight: 500 }}>Units</span><span className="muted small">Kilograms · meters (fixed)</span></div>
            <span className="pill gray">kg · m</span>
          </div>
          <p className="muted small" style={{ marginTop: 4 }}>Chart preferences like smoothing live on each dashboard, next to the chart.</p>
        </div>

        <div className="card flat" style={{ background: 'var(--surface-2)' }}>
          <div className="card-title" style={{ marginBottom: 8 }}>Account</div>
          <button className="btn" style={{ width: '100%', justifyContent: 'center', marginBottom: 10 }} onClick={signOutUser}><Icon name="logout" color="var(--text-2)" />Sign out</button>
          <p className="disclaimer" style={{ textAlign: 'left', margin: 0 }}>Health guidance in this app is general information, not medical advice.</p>
        </div>
      </div>
      {toast && <Toast>{toast}</Toast>}
    </Layout>
  );
}
