import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import Icon, { Logo, GoogleG } from '../components/Icon.jsx';
import Splash from '../components/Splash.jsx';
import { useAuth } from '../auth/AuthContext.jsx';

const ERROR_MESSAGES: Record<string, string> = {
  'auth/invalid-credential': 'Wrong email or password.',
  'auth/invalid-email': 'That doesn’t look like a valid email.',
  'auth/user-not-found': 'Wrong email or password.',
  'auth/wrong-password': 'Wrong email or password.',
  'auth/email-already-in-use': 'That email already has an account — try signing in instead.',
  'auth/weak-password': 'Use at least 6 characters.',
  'auth/missing-password': 'Enter a password.',
  'auth/not-configured': 'Firebase isn’t configured yet.',
  'not-configured': 'Firebase isn’t configured yet.',
};
const errorText = (code: string) => ERROR_MESSAGES[code] || 'Something went wrong. Please try again.';

export default function Login() {
  const { user, loading, configured, error, signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
  const loc = useLocation();
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  if (loading) return <Splash />;
  // Already signed in → go where they were headed (or the landing).
  if (user) return <Navigate to={loc.state?.from?.pathname || '/'} replace />;

  const onSignIn = async () => {
    setBusy(true);
    await signInWithGoogle();
    setBusy(false);
  };

  const onEmailSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!email || !password) return;
    setBusy(true);
    const fn = mode === 'signup' ? signUpWithEmail : signInWithEmail;
    await fn(email.trim(), password);
    setBusy(false);
  };

  const disabled = !configured || busy;

  return (
    <div className="login">
      <div className="login-card">
        <Logo size={56} />
        <div>
          <h1>WeightTracker</h1>
          <p className="t2" style={{ margin: '8px 0 0' }}>Track your journey, together.</p>
        </div>

        {!configured && (
          <div className="row-warn" style={{ width: '100%' }}>
            <Icon name="warn" size={18} color="#b9742a" />
            <span>
              Firebase isn’t configured yet. Add your project keys to <b>.env.local</b> and restart the
              dev server (see the README).
            </span>
          </div>
        )}

        <button
          className="google-btn"
          onClick={onSignIn}
          disabled={disabled}
          style={disabled ? { opacity: 0.6, cursor: 'not-allowed' } : undefined}
        >
          <GoogleG /> {busy ? 'Signing in…' : 'Continue with Google'}
        </button>

        <div className="row" style={{ width: '100%', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          <span className="small muted">or</span>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>

        <form onSubmit={onEmailSubmit} className="col" style={{ width: '100%', gap: 10 }}>
          <input
            className="input" type="email" placeholder="Email" value={email} autoComplete="email"
            onChange={(e) => setEmail(e.target.value)} disabled={disabled} aria-label="Email"
          />
          <input
            className="input" type="password" placeholder="Password" value={password}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            onChange={(e) => setPassword(e.target.value)} disabled={disabled} aria-label="Password"
          />
          <button className="btn primary" type="submit" disabled={disabled || !email || !password} style={{ justifyContent: 'center' }}>
            {busy ? (mode === 'signup' ? 'Creating account…' : 'Signing in…') : mode === 'signup' ? 'Create account' : 'Sign in'}
          </button>
        </form>

        <button
          className="btn ghost sm"
          onClick={() => setMode((m) => (m === 'signup' ? 'signin' : 'signup'))}
        >
          {mode === 'signup' ? 'Already have an account? Sign in' : 'New here? Create an account'}
        </button>

        {error && configured && (
          <span className="small" style={{ color: 'var(--rose)' }}>
            {errorText(error)}
          </span>
        )}

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
