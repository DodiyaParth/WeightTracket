import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';

// A real 404 (DEV-37) instead of silently bouncing every unknown path to "/",
// which made typos and dead links indistinguishable from a normal landing.
export default function NotFound() {
  return (
    <div className="empty" style={{ minHeight: '100vh' }}>
      <span className="empty-ic" style={{ background: 'var(--amber-tint)' }}><Icon name="warn" size={26} color="#b9742a" /></span>
      <h2>Page not found</h2>
      <p className="t2">That link doesn’t match anything here.</p>
      <Link to="/" className="btn primary">Back to dashboards</Link>
    </div>
  );
}
